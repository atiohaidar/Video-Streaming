use redis::{AsyncCommands, Client as RedisClient};
use sqlx::PgPool;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::sync::Arc;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;
use uuid::Uuid;

use crate::config::Config;
use crate::models::{Resolution, TranscodeJobMessage, VideoStatus};
use crate::services::StorageService;

/// Resolution configuration for transcoding
#[derive(Debug, Clone)]
pub struct ResolutionConfig {
    pub name: String,
    pub width: u32,
    pub height: u32,
    pub video_bitrate: u32,  // kbps
    pub audio_bitrate: u32,  // kbps
}

impl ResolutionConfig {
    pub fn get_configs() -> Vec<Self> {
        vec![
            Self {
                name: "360p".to_string(),
                width: 640,
                height: 360,
                video_bitrate: 800,
                audio_bitrate: 96,
            },
            Self {
                name: "720p".to_string(),
                width: 1280,
                height: 720,
                video_bitrate: 2500,
                audio_bitrate: 128,
            },
            Self {
                name: "1080p".to_string(),
                width: 1920,
                height: 1080,
                video_bitrate: 5000,
                audio_bitrate: 192,
            },
        ]
    }

    pub fn get_by_name(name: &str) -> Option<Self> {
        Self::get_configs().into_iter().find(|c| c.name == name)
    }
}

/// FFmpeg transcoding service
pub struct TranscoderService {
    redis_client: RedisClient,
    ffmpeg_path: String,
    ffprobe_path: String,
    temp_dir: PathBuf,
    storage: Arc<StorageService>,
    db: PgPool,
}

impl TranscoderService {
    /// Create a new transcoder service
    pub async fn new(
        config: &Config,
        storage: Arc<StorageService>,
        db: PgPool,
    ) -> Result<Self, Box<dyn std::error::Error + Send + Sync>> {
        let redis_client = RedisClient::open(config.redis_url.as_str())?;

        // Ensure temp directory exists
        let temp_dir = PathBuf::from(&config.temp_dir);
        tokio::fs::create_dir_all(&temp_dir).await?;

        Ok(Self {
            redis_client,
            ffmpeg_path: config.ffmpeg_path.clone(),
            ffprobe_path: config.ffprobe_path.clone(),
            temp_dir,
            storage,
            db,
        })
    }

    /// Queue a transcoding job
    pub async fn queue_job(
        &self,
        job: TranscodeJobMessage,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let mut conn = self.redis_client.get_multiplexed_async_connection().await?;
        let job_json = serde_json::to_string(&job)?;
        conn.lpush::<_, _, ()>("transcode_queue", job_json).await?;
        tracing::info!("Queued transcoding job for video: {}", job.video_id);
        Ok(())
    }

    /// Start the background worker to process jobs
    pub async fn start_worker(self: Arc<Self>) {
        tracing::info!("Starting transcoding worker...");

        loop {
            match self.process_next_job().await {
                Ok(Some(video_id)) => {
                    tracing::info!("Completed transcoding for video: {}", video_id);
                }
                Ok(None) => {
                    // No jobs, wait a bit
                    tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;
                }
                Err(e) => {
                    tracing::error!("Error processing job: {}", e);
                    tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;
                }
            }
        }
    }

    /// Process the next job from the queue
    async fn process_next_job(
        &self,
    ) -> Result<Option<Uuid>, Box<dyn std::error::Error + Send + Sync>> {
        let mut conn = self.redis_client.get_multiplexed_async_connection().await?;

        // Blocking pop with 5 second timeout
        let result: Option<(String, String)> = conn
            .brpop("transcode_queue", 5.0)
            .await?;

        let job_json = match result {
            Some((_, json)) => json,
            None => return Ok(None),
        };

        let job: TranscodeJobMessage = serde_json::from_str(&job_json)?;
        let video_id = job.video_id;

        // Update status to processing
        sqlx::query("UPDATE videos SET status = 'processing' WHERE id = $1")
            .bind(video_id)
            .execute(&self.db)
            .await?;

        // Process the video
        match self.transcode_video(&job).await {
            Ok(resolutions) => {
                // Update video with success
                sqlx::query(
                    r#"
                    UPDATE videos 
                    SET status = 'ready', 
                        resolutions = $2,
                        manifest_path = $3,
                        processed_at = CURRENT_TIMESTAMP
                    WHERE id = $1
                    "#,
                )
                .bind(video_id)
                .bind(sqlx::types::Json(resolutions))
                .bind(format!("{}/master.m3u8", video_id))
                .execute(&self.db)
                .await?;
            }
            Err(e) => {
                // Update video with failure
                sqlx::query(
                    r#"
                    UPDATE videos 
                    SET status = 'failed', 
                        error_message = $2
                    WHERE id = $1
                    "#,
                )
                .bind(video_id)
                .bind(e.to_string())
                .execute(&self.db)
                .await?;

                return Err(e);
            }
        }

        Ok(Some(video_id))
    }

    /// Transcode a video to HLS with multiple resolutions
    async fn transcode_video(
        &self,
        job: &TranscodeJobMessage,
    ) -> Result<Vec<Resolution>, Box<dyn std::error::Error + Send + Sync>> {
        let video_id = job.video_id;
        let work_dir = self.temp_dir.join(video_id.to_string());
        tokio::fs::create_dir_all(&work_dir).await?;

        // Download original video
        let original_data = self.storage.download_original(&job.original_path).await?;
        let input_path = work_dir.join("original");
        tokio::fs::write(&input_path, &original_data).await?;

        // Get video duration using ffprobe
        let duration = self.get_video_duration(&input_path).await?;

        // Update duration in database
        sqlx::query("UPDATE videos SET duration_seconds = $2 WHERE id = $1")
            .bind(video_id)
            .bind(duration)
            .execute(&self.db)
            .await?;

        let mut resolutions = Vec::new();

        // Transcode each requested resolution
        for res_name in &job.resolutions {
            if let Some(res_config) = ResolutionConfig::get_by_name(res_name) {
                tracing::info!("Transcoding {} for video {}", res_name, video_id);

                let output_dir = work_dir.join(&res_config.name);
                tokio::fs::create_dir_all(&output_dir).await?;

                // Run FFmpeg for this resolution
                self.run_ffmpeg_hls(&input_path, &output_dir, &res_config)
                    .await?;

                // Upload segments to MinIO
                let segment_prefix = format!("{}/{}", video_id, res_config.name);
                self.upload_segments(&output_dir, &segment_prefix).await?;

                resolutions.push(Resolution {
                    name: res_config.name.clone(),
                    width: res_config.width,
                    height: res_config.height,
                    bitrate: res_config.video_bitrate,
                    segment_path: segment_prefix,
                });
            }
        }

        // Generate and upload master playlist
        let master_playlist = self.generate_master_playlist(&resolutions, &video_id.to_string());
        self.storage
            .upload_manifest(
                &format!("{}/master.m3u8", video_id),
                master_playlist.into_bytes(),
            )
            .await?;

        // Generate thumbnail
        self.generate_thumbnail(&input_path, &work_dir, video_id).await?;

        // Cleanup temp files
        tokio::fs::remove_dir_all(&work_dir).await?;

        Ok(resolutions)
    }

    /// Get video duration using ffprobe
    async fn get_video_duration(
        &self,
        input_path: &Path,
    ) -> Result<f64, Box<dyn std::error::Error + Send + Sync>> {
        let output = Command::new(&self.ffprobe_path)
            .args([
                "-v", "quiet",
                "-print_format", "json",
                "-show_format",
            ])
            .arg(input_path)
            .output()
            .await?;

        if !output.status.success() {
            return Err("ffprobe failed".into());
        }

        let json: serde_json::Value = serde_json::from_slice(&output.stdout)?;
        let duration = json["format"]["duration"]
            .as_str()
            .and_then(|s| s.parse::<f64>().ok())
            .unwrap_or(0.0);

        Ok(duration)
    }

    /// Run FFmpeg to create HLS segments with VP9 codec
    async fn run_ffmpeg_hls(
        &self,
        input_path: &Path,
        output_dir: &Path,
        config: &ResolutionConfig,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let playlist_path = output_dir.join("playlist.m3u8");
        let segment_pattern = output_dir.join("segment_%03d.webm");

        // VP9 encoding with HLS output
        // Using WebM segments for VP9 compatibility
        let mut child = Command::new(&self.ffmpeg_path)
            .args([
                "-i", input_path.to_str().unwrap(),
                // Video codec: VP9
                "-c:v", "libvpx-vp9",
                "-b:v", &format!("{}k", config.video_bitrate),
                "-maxrate", &format!("{}k", config.video_bitrate * 2),
                "-bufsize", &format!("{}k", config.video_bitrate * 4),
                // Quality settings
                "-quality", "good",
                "-speed", "4",
                "-tile-columns", "2",
                "-frame-parallel", "1",
                "-auto-alt-ref", "1",
                "-lag-in-frames", "25",
                // Resolution
                "-vf", &format!("scale={}:{}", config.width, config.height),
                // Audio codec: Opus (open-source)
                "-c:a", "libopus",
                "-b:a", &format!("{}k", config.audio_bitrate),
                // HLS settings
                "-f", "hls",
                "-hls_time", "4",
                "-hls_list_size", "0",
                "-hls_segment_type", "fmp4",
                "-hls_segment_filename", segment_pattern.to_str().unwrap(),
                "-hls_flags", "independent_segments",
                // Output
                playlist_path.to_str().unwrap(),
            ])
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()?;

        // Monitor progress
        if let Some(stderr) = child.stderr.take() {
            let reader = BufReader::new(stderr);
            let mut lines = reader.lines();
            while let Ok(Some(line)) = lines.next_line().await {
                if line.contains("time=") {
                    tracing::debug!("FFmpeg: {}", line);
                }
            }
        }

        let status = child.wait().await?;
        if !status.success() {
            return Err(format!("FFmpeg failed with status: {}", status).into());
        }

        Ok(())
    }

    /// Upload all segments from a directory
    async fn upload_segments(
        &self,
        output_dir: &Path,
        prefix: &str,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let mut entries = tokio::fs::read_dir(output_dir).await?;

        while let Some(entry) = entries.next_entry().await? {
            let path = entry.path();
            if path.is_file() {
                let filename = path.file_name().unwrap().to_str().unwrap();
                let key = format!("{}/{}", prefix, filename);

                let content_type = if filename.ends_with(".m3u8") {
                    "application/vnd.apple.mpegurl"
                } else if filename.ends_with(".webm") {
                    "video/webm"
                } else if filename.ends_with(".m4s") || filename.ends_with(".mp4") {
                    "video/mp4"
                } else {
                    "application/octet-stream"
                };

                // Upload playlist to manifests bucket, segments to segments bucket
                if filename.ends_with(".m3u8") {
                    self.storage
                        .upload_manifest_from_file(&key, &path)
                        .await?;
                } else {
                    self.storage
                        .upload_segment_from_file(&key, &path, content_type)
                        .await?;
                }
            }
        }

        Ok(())
    }

    /// Generate master HLS playlist
    fn generate_master_playlist(&self, resolutions: &[Resolution], video_id: &str) -> String {
        let mut playlist = String::from("#EXTM3U\n#EXT-X-VERSION:6\n\n");

        for res in resolutions {
            let bandwidth = res.bitrate * 1000;
            playlist.push_str(&format!(
                "#EXT-X-STREAM-INF:BANDWIDTH={},RESOLUTION={}x{},NAME=\"{}\"\n",
                bandwidth, res.width, res.height, res.name
            ));
            playlist.push_str(&format!("/segments/{}/{}/playlist.m3u8\n\n", video_id, res.name));
        }

        playlist
    }

    /// Generate video thumbnail
    async fn generate_thumbnail(
        &self,
        input_path: &Path,
        work_dir: &Path,
        video_id: Uuid,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let thumbnail_path = work_dir.join("thumbnail.jpg");

        let status = Command::new(&self.ffmpeg_path)
            .args([
                "-i", input_path.to_str().unwrap(),
                "-ss", "00:00:01",
                "-vframes", "1",
                "-vf", "scale=320:-1",
                "-q:v", "2",
                thumbnail_path.to_str().unwrap(),
            ])
            .status()
            .await?;

        if status.success() && thumbnail_path.exists() {
            let key = format!("{}/thumbnail.jpg", video_id);
            self.storage
                .upload_segment_from_file(&key, &thumbnail_path, "image/jpeg")
                .await?;

            sqlx::query("UPDATE videos SET thumbnail_path = $2 WHERE id = $1")
                .bind(video_id)
                .bind(&key)
                .execute(&self.db)
                .await?;
        }

        Ok(())
    }
}
