mod config;
mod db;
mod error;
mod handlers;
mod models;
mod services;

use axum::{
    routing::{delete, get, post, put},
    Router,
};
use std::net::SocketAddr;
use std::sync::Arc;
use tower_http::cors::{Any, CorsLayer};
use tower_http::trace::TraceLayer;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use crate::config::Config;
use crate::handlers::{
    delete_video, get_video, get_video_status, list_videos, update_video, upload_video, AppState,
};
use crate::services::{StorageService, TranscoderService};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    // Initialize logging
    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::try_from_default_env()
            .unwrap_or_else(|_| "info,tower_http=debug".into()))
        .with(tracing_subscriber::fmt::layer())
        .init();

    // Load configuration
    dotenvy::dotenv().ok();
    let config = Config::from_env()?;

    tracing::info!("Starting Video Streaming Backend...");
    tracing::info!("Server: {}:{}", config.server_host, config.server_port);

    // Create database connection pool
    let db_pool = db::create_pool(&config.database_url).await?;
    db::run_migrations(&db_pool).await?;
    tracing::info!("Database connected");

    // Create storage service
    let storage = Arc::new(StorageService::new(&config).await?);
    tracing::info!("Storage service initialized");

    // Create transcoder service
    let transcoder = Arc::new(
        TranscoderService::new(&config, storage.clone(), db_pool.clone()).await?,
    );
    tracing::info!("Transcoder service initialized");

    // Start background transcoding worker
    let worker_transcoder = transcoder.clone();
    tokio::spawn(async move {
        worker_transcoder.start_worker().await;
    });

    // Create application state
    let state = AppState {
        db: db_pool,
        storage,
        transcoder,
        base_url: String::new(), // Will be set by reverse proxy
    };

    // Configure CORS
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    // Build router
    let app = Router::new()
        // Video routes
        .route("/videos", post(upload_video))
        .route("/videos", get(list_videos))
        .route("/videos/{id}", get(get_video))
        .route("/videos/{id}", put(update_video))
        .route("/videos/{id}", delete(delete_video))
        .route("/videos/{id}/status", get(get_video_status))
        // Health check
        .route("/health", get(|| async { "OK" }))
        // Middleware
        .layer(cors)
        .layer(TraceLayer::new_for_http())
        .with_state(state);

    // Start server
    let addr: SocketAddr = format!("{}:{}", config.server_host, config.server_port)
        .parse()?;

    tracing::info!("Listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}
