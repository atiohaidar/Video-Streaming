-- Video Streaming Application Database Migrations
-- This file is used by SQLx for compile-time checking

-- Migration: 001_create_videos
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TYPE video_status AS ENUM (
    'pending',
    'processing', 
    'ready',
    'failed'
);

CREATE TABLE IF NOT EXISTS videos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    original_filename VARCHAR(255) NOT NULL,
    original_size BIGINT NOT NULL,
    mime_type VARCHAR(100),
    duration_seconds FLOAT,
    original_path VARCHAR(500),
    manifest_path VARCHAR(500),
    thumbnail_path VARCHAR(500),
    status video_status NOT NULL DEFAULT 'pending',
    error_message TEXT,
    resolutions JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_videos_status ON videos(status);
CREATE INDEX idx_videos_created_at ON videos(created_at DESC);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_videos_updated_at
    BEFORE UPDATE ON videos
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
