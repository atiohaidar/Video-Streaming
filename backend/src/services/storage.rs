use aws_config::Region;
use aws_credential_types::Credentials;
use aws_sdk_s3::{
    config::Builder as S3ConfigBuilder,
    primitives::ByteStream,
    Client,
};
use std::path::Path;

use crate::config::Config;

/// MinIO/S3 storage service
#[derive(Clone)]
pub struct StorageService {
    client: Client,
    bucket_videos: String,
    bucket_segments: String,
    bucket_manifests: String,
    endpoint: String,
}

impl StorageService {
    /// Create a new storage service
    pub async fn new(config: &Config) -> Result<Self, Box<dyn std::error::Error + Send + Sync>> {
        // Create credentials
        let credentials = Credentials::new(
            &config.minio_access_key,
            &config.minio_secret_key,
            None,
            None,
            "minio",
        );

        // Build S3 config for MinIO
        let s3_config = S3ConfigBuilder::new()
            .endpoint_url(&config.minio_endpoint)
            .region(Region::new("us-east-1"))
            .credentials_provider(credentials)
            .force_path_style(true)
            .build();

        let client = Client::from_conf(s3_config);

        Ok(Self {
            client,
            bucket_videos: config.minio_bucket_videos.clone(),
            bucket_segments: config.minio_bucket_segments.clone(),
            bucket_manifests: config.minio_bucket_manifests.clone(),
            endpoint: config.minio_endpoint.clone(),
        })
    }

    /// Upload original video file
    pub async fn upload_original(
        &self,
        key: &str,
        data: Vec<u8>,
        content_type: &str,
    ) -> Result<String, Box<dyn std::error::Error + Send + Sync>> {
        let body = ByteStream::from(data);

        self.client
            .put_object()
            .bucket(&self.bucket_videos)
            .key(key)
            .body(body)
            .content_type(content_type)
            .send()
            .await?;

        tracing::info!("Uploaded original video: {}", key);
        Ok(format!("{}/{}/{}", self.endpoint, self.bucket_videos, key))
    }

    /// Download original video file
    pub async fn download_original(
        &self,
        key: &str,
    ) -> Result<Vec<u8>, Box<dyn std::error::Error + Send + Sync>> {
        let response = self
            .client
            .get_object()
            .bucket(&self.bucket_videos)
            .key(key)
            .send()
            .await?;

        let data = response.body.collect().await?.into_bytes().to_vec();
        Ok(data)
    }

    /// Upload video segment

    /// Upload segment from file path
    pub async fn upload_segment_from_file(
        &self,
        key: &str,
        file_path: &Path,
        content_type: &str,
    ) -> Result<String, Box<dyn std::error::Error + Send + Sync>> {
        let body = ByteStream::from_path(file_path).await?;

        self.client
            .put_object()
            .bucket(&self.bucket_segments)
            .key(key)
            .body(body)
            .content_type(content_type)
            .send()
            .await?;

        Ok(format!("{}/{}/{}", self.endpoint, self.bucket_segments, key))
    }

    /// Upload HLS manifest file
    pub async fn upload_manifest(
        &self,
        key: &str,
        data: Vec<u8>,
    ) -> Result<String, Box<dyn std::error::Error + Send + Sync>> {
        let body = ByteStream::from(data);

        self.client
            .put_object()
            .bucket(&self.bucket_manifests)
            .key(key)
            .body(body)
            .content_type("application/vnd.apple.mpegurl")
            .send()
            .await?;

        tracing::info!("Uploaded manifest: {}", key);
        Ok(format!("{}/{}/{}", self.endpoint, self.bucket_manifests, key))
    }

    /// Upload manifest from file path
    pub async fn upload_manifest_from_file(
        &self,
        key: &str,
        file_path: &Path,
    ) -> Result<String, Box<dyn std::error::Error + Send + Sync>> {
        let body = ByteStream::from_path(file_path).await?;

        self.client
            .put_object()
            .bucket(&self.bucket_manifests)
            .key(key)
            .body(body)
            .content_type("application/vnd.apple.mpegurl")
            .send()
            .await?;

        tracing::info!("Uploaded manifest: {}", key);
        Ok(key.to_string())
    }

    /// Delete original video
    pub async fn delete_original(
        &self,
        key: &str,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        self.client
            .delete_object()
            .bucket(&self.bucket_videos)
            .key(key)
            .send()
            .await?;

        tracing::info!("Deleted original video: {}", key);
        Ok(())
    }

    /// Delete segments by prefix
    pub async fn delete_segments(
        &self,
        prefix: &str,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        // List all objects with prefix
        let response = self
            .client
            .list_objects_v2()
            .bucket(&self.bucket_segments)
            .prefix(prefix)
            .send()
            .await?;

        if let Some(objects) = response.contents {
            for object in objects {
                if let Some(key) = object.key {
                    self.client
                        .delete_object()
                        .bucket(&self.bucket_segments)
                        .key(&key)
                        .send()
                        .await?;
                }
            }
        }

        tracing::info!("Deleted segments with prefix: {}", prefix);
        Ok(())
    }

    /// Delete manifest
    pub async fn delete_manifest(
        &self,
        key: &str,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        self.client
            .delete_object()
            .bucket(&self.bucket_manifests)
            .key(key)
            .send()
            .await?;

        tracing::info!("Deleted manifest: {}", key);
        Ok(())
    }

    /// Get public URL for streaming
    pub fn get_streaming_url(&self, manifest_key: &str) -> String {
        format!("{}/{}/{}", self.endpoint, self.bucket_manifests, manifest_key)
    }
}
