#!/bin/sh
# MinIO Bucket Initialization Script

set -e

# Wait for MinIO to be ready
echo "Waiting for MinIO to be ready..."
until curl -sf http://minio:9000/minio/health/live > /dev/null 2>&1; do
    echo "MinIO is not ready yet, waiting..."
    sleep 2
done

echo "MinIO is ready. Setting up buckets..."

# Configure mc client
mc alias set myminio http://minio:9000 ${MINIO_ROOT_USER:-minioadmin} ${MINIO_ROOT_PASSWORD:-minioadmin123}

# Create buckets
mc mb myminio/videos --ignore-existing
mc mb myminio/segments --ignore-existing
mc mb myminio/manifests --ignore-existing

# Set anonymous download policy for segments and manifests (for streaming)
mc anonymous set download myminio/segments
mc anonymous set download myminio/manifests

echo "MinIO buckets created and configured successfully!"

# List buckets
echo "Available buckets:"
mc ls myminio
