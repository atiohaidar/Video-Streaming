use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde_json::json;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum AppError {
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),

    #[error("Storage error: {0}")]
    Storage(String),

    #[error("Transcoding error: {0}")]
    Transcoding(String),

    #[error("Not found: {0}")]
    NotFound(String),

    #[error("Bad request: {0}")]
    BadRequest(String),

    #[error("Internal error: {0}")]
    Internal(String),

    #[error("Redis error: {0}")]
    Redis(#[from] redis::RedisError),
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, error_message) = match &self {
            AppError::Database(e) => {
                tracing::error!("Database error: {:?}", e);
                (StatusCode::INTERNAL_SERVER_ERROR, "Database error occurred")
            }
            AppError::Storage(msg) => {
                tracing::error!("Storage error: {}", msg);
                (StatusCode::INTERNAL_SERVER_ERROR, "Storage error occurred")
            }
            AppError::Transcoding(msg) => {
                tracing::error!("Transcoding error: {}", msg);
                (StatusCode::INTERNAL_SERVER_ERROR, "Transcoding error occurred")
            }
            AppError::NotFound(msg) => {
                tracing::warn!("Not found: {}", msg);
                (StatusCode::NOT_FOUND, msg.as_str())
            }
            AppError::BadRequest(msg) => {
                tracing::warn!("Bad request: {}", msg);
                (StatusCode::BAD_REQUEST, msg.as_str())
            }
            AppError::Internal(msg) => {
                tracing::error!("Internal error: {}", msg);
                (StatusCode::INTERNAL_SERVER_ERROR, "Internal server error")
            }
            AppError::Redis(e) => {
                tracing::error!("Redis error: {:?}", e);
                (StatusCode::INTERNAL_SERVER_ERROR, "Queue error occurred")
            }
        };

        let body = Json(json!({
            "error": error_message,
            "success": false
        }));

        (status, body).into_response()
    }
}

pub type Result<T> = std::result::Result<T, AppError>;
