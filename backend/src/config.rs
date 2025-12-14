use std::env;

/// Application configuration loaded from environment variables
#[derive(Debug, Clone)]
pub struct Config {
    // Server
    pub server_host: String,
    pub server_port: u16,

    // Database
    pub database_url: String,

    // Redis
    pub redis_url: String,

    // MinIO/S3
    pub minio_endpoint: String,
    pub minio_access_key: String,
    pub minio_secret_key: String,
    pub minio_bucket_videos: String,
    pub minio_bucket_segments: String,
    pub minio_bucket_manifests: String,

    // FFmpeg
    pub ffmpeg_path: String,
    pub ffprobe_path: String,
    pub temp_dir: String,
}

impl Config {
    /// Load configuration from environment variables
    pub fn from_env() -> Result<Self, env::VarError> {
        Ok(Self {
            server_host: env::var("SERVER_HOST").unwrap_or_else(|_| "0.0.0.0".to_string()),
            server_port: env::var("SERVER_PORT")
                .unwrap_or_else(|_| "3000".to_string())
                .parse()
                .unwrap_or(3000),

            database_url: env::var("DATABASE_URL")?,

            redis_url: env::var("REDIS_URL").unwrap_or_else(|_| "redis://localhost:6379".to_string()),

            minio_endpoint: env::var("MINIO_ENDPOINT")
                .unwrap_or_else(|_| "http://localhost:9000".to_string()),
            minio_access_key: env::var("MINIO_ACCESS_KEY")
                .unwrap_or_else(|_| "minioadmin".to_string()),
            minio_secret_key: env::var("MINIO_SECRET_KEY")
                .unwrap_or_else(|_| "minioadmin123".to_string()),
            minio_bucket_videos: env::var("MINIO_BUCKET_VIDEOS")
                .unwrap_or_else(|_| "videos".to_string()),
            minio_bucket_segments: env::var("MINIO_BUCKET_SEGMENTS")
                .unwrap_or_else(|_| "segments".to_string()),
            minio_bucket_manifests: env::var("MINIO_BUCKET_MANIFESTS")
                .unwrap_or_else(|_| "manifests".to_string()),

            ffmpeg_path: env::var("FFMPEG_PATH").unwrap_or_else(|_| "ffmpeg".to_string()),
            ffprobe_path: env::var("FFPROBE_PATH").unwrap_or_else(|_| "ffprobe".to_string()),
            temp_dir: env::var("TEMP_DIR").unwrap_or_else(|_| "/tmp/uploads".to_string()),
        })
    }
}
