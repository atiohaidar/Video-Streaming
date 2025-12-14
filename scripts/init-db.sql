-- Video Streaming Application Database Schema
-- PostgreSQL 16+

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Video status enum
CREATE TYPE video_status AS ENUM (
    'pending',      -- Just uploaded, waiting for transcoding
    'processing',   -- Currently being transcoded
    'ready',        -- Transcoding complete, ready to stream
    'failed'        -- Transcoding failed
);

-- Videos table
CREATE TABLE IF NOT EXISTS videos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- File information
    original_filename VARCHAR(255) NOT NULL,
    original_size BIGINT NOT NULL,
    mime_type VARCHAR(100),
    duration_seconds FLOAT,
    
    -- Storage paths
    original_path VARCHAR(500),
    manifest_path VARCHAR(500),
    thumbnail_path VARCHAR(500),
    
    -- Processing status
    status video_status NOT NULL DEFAULT 'pending',
    error_message TEXT,
    
    -- Available resolutions (stored as JSON array)
    resolutions JSONB DEFAULT '[]'::jsonb,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP WITH TIME ZONE
);

-- Create index for common queries
CREATE INDEX idx_videos_status ON videos(status);
CREATE INDEX idx_videos_created_at ON videos(created_at DESC);

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to auto-update updated_at
CREATE TRIGGER update_videos_updated_at
    BEFORE UPDATE ON videos
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Transcoding jobs table (for tracking job progress)
CREATE TABLE IF NOT EXISTS transcoding_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    resolution VARCHAR(10) NOT NULL,  -- e.g., '360p', '720p', '1080p'
    status video_status NOT NULL DEFAULT 'pending',
    progress INTEGER DEFAULT 0,  -- 0-100
    output_path VARCHAR(500),
    error_message TEXT,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_transcoding_jobs_video_id ON transcoding_jobs(video_id);
CREATE INDEX idx_transcoding_jobs_status ON transcoding_jobs(status);

-- Grant permissions (for docker setup)
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO videostream;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO videostream;
