# 🎬 Open-Source Video Streaming Platform

A fully self-hosted, open-source video streaming platform built with modern technologies.

## ✨ Features

- **Video Upload**: Upload any video format (MP4, WebM, MOV, AVI)
- **Adaptive Streaming**: HLS-based streaming with multiple quality levels
- **Open Codecs**: VP9 video codec, Opus audio codec (no proprietary codecs)
- **CRUD Operations**: Create, Read, Update, Delete video metadata
- **Multi-Resolution**: Automatic transcoding to 360p, 720p (configurable)
- **Buffering & Seeking**: Full support for buffering and timeline seeking
- **Self-Hosted**: No external cloud dependencies

## 🛠️ Tech Stack

| Component | Technology |
|-----------|------------|
| Frontend | Angular 17, HLS.js |
| Backend | Rust, Axum, Tokio |
| Database | PostgreSQL 16 |
| Object Storage | MinIO (S3-compatible) |
| Job Queue | Redis |
| Transcoding | FFmpeg (VP9/Opus) |
| Reverse Proxy | Nginx |
| Container | Docker, Docker Compose |

## 📁 Project Structure

```
Video Streaming/
├── docker-compose.yml      # Container orchestration
├── .env                    # Environment configuration
├── backend/                # Rust API server
│   ├── Cargo.toml
│   ├── Dockerfile
│   └── src/
│       ├── main.rs
│       ├── config.rs
│       ├── db.rs
│       ├── error.rs
│       ├── handlers/       # API route handlers
│       ├── models/         # Data models
│       └── services/       # Business logic
├── frontend/               # Angular SPA
│   ├── package.json
│   ├── Dockerfile
│   └── src/
│       └── app/
│           ├── components/ # UI components
│           └── services/   # HTTP services
├── nginx/                  # Reverse proxy
│   ├── nginx.conf
│   └── Dockerfile
└── scripts/                # Database & MinIO setup
    ├── init-db.sql
    └── init-minio.sh
```

## 🚀 Quick Start

### Prerequisites

- Docker & Docker Compose
- 8GB+ RAM recommended
- 20GB+ disk space

### 1. Clone and Configure

```bash
cd "d:\Project\Video Streaming"

# Review/modify environment variables
cp .env.example .env
```

### 2. Build and Run

```bash
# Build all containers (first run takes 5-10 minutes)
docker-compose up --build

# Or run in detached mode
docker-compose up --build -d
```

### 3. Access the Application

| Service | URL |
|---------|-----|
| **Web UI** | http://localhost |
| **API** | http://localhost/api |
| MinIO Console | http://localhost:9001 |

## 📖 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/videos` | Upload video (multipart form) |
| `GET` | `/api/videos` | List all videos |
| `GET` | `/api/videos/{id}` | Get video details |
| `PUT` | `/api/videos/{id}` | Update video metadata |
| `DELETE` | `/api/videos/{id}` | Delete video |
| `GET` | `/api/videos/{id}/status` | Get processing status |

### Upload Example

```bash
curl -X POST http://localhost/api/videos \
  -F "file=@sample.mp4" \
  -F "title=My Video" \
  -F "description=Optional description"
```

## 🎥 Video Processing Flow

1. **Upload**: Video file uploaded via REST API
2. **Store Original**: Saved to MinIO `videos` bucket
3. **Queue**: Transcoding job added to Redis queue
4. **Transcode**: FFmpeg worker processes video:
   - Convert to VP9 codec (WebM container)
   - Generate multiple resolutions
   - Create HLS segments (4-second chunks)
   - Generate master playlist
5. **Store Segments**: Uploaded to MinIO `segments` bucket
6. **Ready**: Video available for streaming

## 🔧 Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `POSTGRES_USER` | videostream | Database user |
| `POSTGRES_PASSWORD` | videostream_secret | Database password |
| `MINIO_ROOT_USER` | minioadmin | MinIO admin user |
| `MINIO_ROOT_PASSWORD` | minioadmin123 | MinIO admin password |

### Adding 1080p Resolution

Edit `backend/src/services/transcoder.rs`:

```rust
resolutions: vec!["360p".to_string(), "720p".to_string(), "1080p".to_string()],
```

## 🐛 Troubleshooting

### Container Issues

```bash
# View logs
docker-compose logs -f backend
docker-compose logs -f frontend

# Restart specific service
docker-compose restart backend

# Rebuild a service
docker-compose up --build backend
```

### Database Reset

```bash
docker-compose down -v
docker-compose up --build
```

### Check Video Processing

```bash
# View transcoding logs
docker-compose logs -f backend | grep -i transcode

# Check Redis queue
docker exec videostream-redis redis-cli LLEN transcode_queue
```

## 🗂️ Data Persistence

Data is stored in Docker volumes:

| Volume | Content |
|--------|---------|
| `postgres_data` | Database |
| `redis_data` | Job queue |
| `minio_data` | Video files |

To backup:

```bash
docker run --rm -v videostream_minio_data:/data -v $(pwd):/backup alpine \
  tar czf /backup/minio-backup.tar.gz /data
```

## 📝 Development

### Backend Development

```bash
cd backend
cargo build
cargo run
```

### Frontend Development

```bash
cd frontend
npm install
npm start
# Visit http://localhost:4200
```

## 🔒 Security Notes

This is a **development setup**. For production:

1. Change all default passwords
2. Enable HTTPS (add SSL certificates to Nginx)
3. Implement authentication
4. Set proper CORS origins
5. Configure rate limiting
6. Use external PostgreSQL/Redis

## 📜 License

All components are open-source:

- Angular: MIT
- Rust: MIT/Apache 2.0
- FFmpeg: LGPL/GPL
- VP9: BSD
- MinIO: AGPL v3
- PostgreSQL: PostgreSQL License
- Nginx: BSD-like
- Redis: BSD 3-Clause

---

**Built with 💜 using open-source technologies**
