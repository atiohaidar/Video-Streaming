use sqlx::postgres::PgPoolOptions;
use sqlx::PgPool;
use std::time::Duration;

/// Create a PostgreSQL connection pool
pub async fn create_pool(database_url: &str) -> Result<PgPool, sqlx::Error> {
    PgPoolOptions::new()
        .max_connections(10)
        .min_connections(2)
        .acquire_timeout(Duration::from_secs(30))
        .idle_timeout(Duration::from_secs(600))
        .connect(database_url)
        .await
}

/// Run database migrations
pub async fn run_migrations(pool: &PgPool) -> Result<(), sqlx::Error> {
    // The migrations are handled by the init-db.sql script in Docker
    // This function ensures the connection is working
    sqlx::query("SELECT 1")
        .execute(pool)
        .await?;
    
    tracing::info!("Database connection verified");
    Ok(())
}
