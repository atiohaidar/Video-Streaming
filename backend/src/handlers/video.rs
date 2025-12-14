use axum::{
    extract::{Multipart, Path, Query, State},
    http::StatusCode,
    Json,
};
use serde::Deserialize;
use sqlx::PgPool;
use std::sync::Arc;
use uuid::Uuid;

use crate::error::{AppError, Result};
use crate::models::{TranscodeJobMessage, UpdateVideoRequest, Video, VideoListResponse, VideoResponse};
use crate::services::{StorageService, TranscoderService};

/// Application state shared across handlers
#[derive(Clone)]
pub struct AppState {
    pub db: PgPool,
    pub storage: Arc<StorageService>,
    pub transcoder: Arc<TranscoderService>,
    pub base_url: String,
}

/// Query parameters for listing videos
#[derive(Debug, Deserialize)]
pub struct ListVideosQuery {
    pub limit: Option<i64>,
    pub offset: Option<i64>,
    pub status: Option<String>,
}

/// Upload a new video
/// POST /videos
pub async fn upload_video(
    State(state): State<AppState>,
    mut multipart: Multipart,
) -> Result<(StatusCode, Json<VideoResponse>)> {
    let mut title: Option<String> = None;
    let mut description: Option<String> = None;
    let mut file_data: Option<Vec<u8>> = None;
    let mut filename: Option<String> = None;
    let mut content_type: Option<String> = None;

    // Parse multipart form
    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|e| AppError::BadRequest(format!("Failed to parse multipart: {}", e)))?
    {
        let name = field.name().unwrap_or("").to_string();

        match name.as_str() {
            "title" => {
                title = Some(
                    field
                        .text()
                        .await
                        .map_err(|e| AppError::BadRequest(format!("Failed to read title: {}", e)))?,
                );
            }
            "description" => {
                description = Some(
                    field
                        .text()
                        .await
                        .map_err(|e| AppError::BadRequest(format!("Failed to read description: {}", e)))?,
                );
            }
            "file" => {
                filename = field.file_name().map(|s| s.to_string());
                content_type = field.content_type().map(|s| s.to_string());
                file_data = Some(
                    field
                        .bytes()
                        .await
                        .map_err(|e| AppError::BadRequest(format!("Failed to read file: {}", e)))?
                        .to_vec(),
                );
            }
            _ => {}
        }
    }

    // Validate required fields
    let file_data = file_data.ok_or_else(|| AppError::BadRequest("No file uploaded".to_string()))?;
    let filename = filename.ok_or_else(|| AppError::BadRequest("No filename provided".to_string()))?;
    let title = title.unwrap_or_else(|| filename.clone());

    // Validate file type
    let content_type = content_type.unwrap_or_else(|| "application/octet-stream".to_string());
    if !content_type.starts_with("video/") {
        return Err(AppError::BadRequest("File must be a video".to_string()));
    }

    let file_size = file_data.len() as i64;
    let video_id = Uuid::new_v4();
    let original_path = format!("{}/{}", video_id, filename);

    // Upload original file to MinIO
    state
        .storage
        .upload_original(&original_path, file_data.clone(), &content_type)
        .await
        .map_err(|e| AppError::Storage(e.to_string()))?;

    // Insert video record into database
    let video = sqlx::query_as::<_, Video>(
        r#"
        INSERT INTO videos (id, title, description, original_filename, original_size, mime_type, original_path, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
        RETURNING *
        "#,
    )
    .bind(video_id)
    .bind(&title)
    .bind(&description)
    .bind(&filename)
    .bind(file_size)
    .bind(&content_type)
    .bind(&original_path)
    .fetch_one(&state.db)
    .await?;

    // Queue transcoding job
    let job_message = TranscodeJobMessage {
        video_id,
        original_path: original_path.clone(),
        resolutions: vec!["360p".to_string(), "720p".to_string()],
    };

    state
        .transcoder
        .queue_job(job_message)
        .await
        .map_err(|e| AppError::Internal(format!("Failed to queue transcoding job: {}", e)))?;

    tracing::info!("Video uploaded: {} ({})", video_id, filename);

    Ok((StatusCode::CREATED, Json(video.to_response(&state.base_url))))
}

/// List all videos
/// GET /videos
pub async fn list_videos(
    State(state): State<AppState>,
    Query(params): Query<ListVideosQuery>,
) -> Result<Json<VideoListResponse>> {
    let limit = params.limit.unwrap_or(20).min(100);
    let offset = params.offset.unwrap_or(0);

    // Support optional status filter
    let videos = if let Some(status_filter) = params.status {
        sqlx::query_as::<_, Video>(
            r#"
            SELECT * FROM videos WHERE status = $1
            ORDER BY created_at DESC
            LIMIT $2 OFFSET $3
            "#,
        )
        .bind(status_filter)
        .bind(limit)
        .bind(offset)
        .fetch_all(&state.db)
        .await?
    } else {
        sqlx::query_as::<_, Video>(
            r#"
            SELECT * FROM videos
            ORDER BY created_at DESC
            LIMIT $1 OFFSET $2
            "#,
        )
        .bind(limit)
        .bind(offset)
        .fetch_all(&state.db)
        .await?
    };

    let total = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM videos")
        .fetch_one(&state.db)
        .await?;

    let video_responses: Vec<VideoResponse> = videos
        .into_iter()
        .map(|v| v.to_response(&state.base_url))
        .collect();

    Ok(Json(VideoListResponse {
        videos: video_responses,
        total,
    }))
}

/// Get a single video by ID
/// GET /videos/:id
pub async fn get_video(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<VideoResponse>> {
    let video = sqlx::query_as::<_, Video>(
        r#"
        SELECT * FROM videos WHERE id = $1
        "#,
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound(format!("Video {} not found", id)))?;

    Ok(Json(video.to_response(&state.base_url)))
}

/// Update video metadata
/// PUT /videos/:id
pub async fn update_video(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateVideoRequest>,
) -> Result<Json<VideoResponse>> {
    // Check if video exists
    let existing = sqlx::query_as::<_, Video>("SELECT * FROM videos WHERE id = $1")
        .bind(id)
        .fetch_optional(&state.db)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Video {} not found", id)))?;

    // Update fields (last write wins)
    let new_title = payload.title.unwrap_or(existing.title);
    let new_description = payload.description.or(existing.description);

    let video = sqlx::query_as::<_, Video>(
        r#"
        UPDATE videos 
        SET title = $2, description = $3, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING *
        "#,
    )
    .bind(id)
    .bind(&new_title)
    .bind(&new_description)
    .fetch_one(&state.db)
    .await?;

    tracing::info!("Video updated: {}", id);

    Ok(Json(video.to_response(&state.base_url)))
}

/// Delete a video
/// DELETE /videos/:id
pub async fn delete_video(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode> {
    // Check if video exists and get paths
    let video = sqlx::query_as::<_, Video>("SELECT * FROM videos WHERE id = $1")
        .bind(id)
        .fetch_optional(&state.db)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Video {} not found", id)))?;

    // Delete from storage
    if let Some(path) = &video.original_path {
        state
            .storage
            .delete_original(path)
            .await
            .map_err(|e| AppError::Storage(format!("Failed to delete original: {}", e)))?;
    }

    // Delete segments
    for resolution in video.resolutions.0.iter() {
        state
            .storage
            .delete_segments(&resolution.segment_path)
            .await
            .map_err(|e| AppError::Storage(format!("Failed to delete segments: {}", e)))?;
    }

    // Delete manifest
    if let Some(path) = &video.manifest_path {
        state
            .storage
            .delete_manifest(path)
            .await
            .map_err(|e| AppError::Storage(format!("Failed to delete manifest: {}", e)))?;
    }

    // Delete from database
    sqlx::query("DELETE FROM videos WHERE id = $1")
        .bind(id)
        .execute(&state.db)
        .await?;

    tracing::info!("Video deleted: {}", id);

    Ok(StatusCode::NO_CONTENT)
}

/// Get video processing status
/// GET /videos/:id/status
pub async fn get_video_status(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>> {
    let video = sqlx::query_as::<_, Video>("SELECT * FROM videos WHERE id = $1")
        .bind(id)
        .fetch_optional(&state.db)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Video {} not found", id)))?;

    Ok(Json(serde_json::json!({
        "id": video.id,
        "status": video.status,
        "error_message": video.error_message,
        "processed_at": video.processed_at,
    })))
}
