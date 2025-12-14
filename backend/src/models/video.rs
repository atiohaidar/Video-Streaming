use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

/// Video status enum matching PostgreSQL enum
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type, PartialEq)]
#[sqlx(type_name = "video_status", rename_all = "lowercase")]
pub enum VideoStatus {
    Pending,
    Processing,
    Ready,
    Failed,
}

impl Default for VideoStatus {
    fn default() -> Self {
        Self::Pending
    }
}

/// Video resolution info
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Resolution {
    pub name: String,      // e.g., "720p"
    pub width: u32,
    pub height: u32,
    pub bitrate: u32,      // in kbps
    pub segment_path: String,
}

/// Video model from database
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Video {
    pub id: Uuid,
    pub title: String,
    pub description: Option<String>,
    pub original_filename: String,
    pub original_size: i64,
    pub mime_type: Option<String>,
    pub duration_seconds: Option<f64>,
    pub original_path: Option<String>,
    pub manifest_path: Option<String>,
    pub thumbnail_path: Option<String>,
    pub status: VideoStatus,
    pub error_message: Option<String>,
    pub resolutions: sqlx::types::Json<Vec<Resolution>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub processed_at: Option<DateTime<Utc>>,
}


/// Request to update video metadata
#[derive(Debug, Deserialize)]
pub struct UpdateVideoRequest {
    pub title: Option<String>,
    pub description: Option<String>,
}

/// Video response for API
#[derive(Debug, Serialize)]
pub struct VideoResponse {
    pub id: Uuid,
    pub title: String,
    pub description: Option<String>,
    pub original_filename: String,
    pub original_size: i64,
    pub duration_seconds: Option<f64>,
    pub status: VideoStatus,
    pub resolutions: Vec<Resolution>,
    pub streaming_url: Option<String>,
    pub thumbnail_url: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl Video {
    /// Convert to API response with streaming URL
    pub fn to_response(&self, base_url: &str) -> VideoResponse {
        let streaming_url = if self.status == VideoStatus::Ready {
            self.manifest_path.as_ref().map(|p| format!("{}/manifests/{}", base_url, p))
        } else {
            None
        };

        let thumbnail_url = self.thumbnail_path.as_ref()
            .map(|p| format!("{}/segments/{}", base_url, p));

        VideoResponse {
            id: self.id,
            title: self.title.clone(),
            description: self.description.clone(),
            original_filename: self.original_filename.clone(),
            original_size: self.original_size,
            duration_seconds: self.duration_seconds,
            status: self.status.clone(),
            resolutions: self.resolutions.0.clone(),
            streaming_url,
            thumbnail_url,
            created_at: self.created_at,
            updated_at: self.updated_at,
        }
    }
}

/// Video list response
#[derive(Debug, Serialize)]
pub struct VideoListResponse {
    pub videos: Vec<VideoResponse>,
    pub total: i64,
}


/// Message for Redis job queue
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranscodeJobMessage {
    pub video_id: Uuid,
    pub original_path: String,
    pub resolutions: Vec<String>,  // ["360p", "720p", "1080p"]
}
