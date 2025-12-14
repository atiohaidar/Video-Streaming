import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { VideoService, Video } from '../../services/video.service';
import { Subject, takeUntil, interval } from 'rxjs';

@Component({
    selector: 'app-video-list',
    standalone: true,
    imports: [CommonModule, RouterLink],
    template: `
    <div class="video-list-page">
      <!-- Page Header -->
      <div class="page-header">
        <div>
          <h1 class="page-title">Your Videos</h1>
          <p class="page-subtitle">{{ totalVideos }} videos in your library</p>
        </div>
        <a routerLink="/upload" class="btn btn-primary">
          <span>⬆️</span>
          Upload Video
        </a>
      </div>

      <!-- Loading State -->
      <div *ngIf="loading" class="loading-container">
        <div class="loading-spinner"></div>
        <p>Loading videos...</p>
      </div>

      <!-- Empty State -->
      <div *ngIf="!loading && videos.length === 0" class="empty-state">
        <div class="empty-state-icon">📹</div>
        <h2 class="empty-state-title">No videos yet</h2>
        <p class="empty-state-description">
          Upload your first video to get started with streaming.
        </p>
        <a routerLink="/upload" class="btn btn-primary">
          Upload Video
        </a>
      </div>

      <!-- Video Grid -->
      <div *ngIf="!loading && videos.length > 0" class="video-grid">
        <div *ngFor="let video of videos" class="video-card card">
          <!-- Thumbnail -->
          <a [routerLink]="video.status === 'ready' ? ['/watch', video.id] : null" 
             class="video-thumbnail"
             [class.disabled]="video.status !== 'ready'">
            <img *ngIf="video.thumbnail_url" [src]="video.thumbnail_url" [alt]="video.title" />
            <div *ngIf="!video.thumbnail_url" class="thumbnail-placeholder">
              <span>🎬</span>
            </div>
            
            <!-- Duration Badge -->
            <span *ngIf="video.duration_seconds" class="duration-badge">
              {{ videoService.formatDuration(video.duration_seconds) }}
            </span>

            <!-- Status Overlay -->
            <div *ngIf="video.status !== 'ready'" class="status-overlay">
              <div class="status-content">
                <div *ngIf="video.status === 'processing'" class="loading-spinner"></div>
                <span *ngIf="video.status === 'pending'">⏳</span>
                <span *ngIf="video.status === 'failed'">❌</span>
                <p>{{ getStatusText(video.status) }}</p>
              </div>
            </div>

            <!-- Play Icon -->
            <div *ngIf="video.status === 'ready'" class="play-overlay">
              <span class="play-icon">▶</span>
            </div>
          </a>

          <!-- Video Info -->
          <div class="video-info">
            <h3 class="video-title">{{ video.title }}</h3>
            <p class="video-meta">
              {{ videoService.formatFileSize(video.original_size) }} •
              {{ videoService.getTimeAgo(video.created_at) }}
            </p>
            
            <!-- Status Badge -->
            <span class="badge" [ngClass]="'badge-' + video.status">
              {{ video.status }}
            </span>

            <!-- Actions -->
            <div class="video-actions">
              <a [routerLink]="['/edit', video.id]" class="btn btn-secondary btn-icon" title="Edit">
                ✏️
              </a>
              <button 
                class="btn btn-danger btn-icon" 
                title="Delete"
                (click)="deleteVideo(video)">
                🗑️
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Load More -->
      <div *ngIf="hasMore && !loading" class="load-more">
        <button class="btn btn-secondary" (click)="loadMore()">
          Load More Videos
        </button>
      </div>
    </div>
  `,
    styles: [`
    .video-list-page {
      padding: var(--spacing-md) 0;
    }

    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: var(--spacing-xl);
      flex-wrap: wrap;
      gap: var(--spacing-md);
    }

    .page-title {
      font-size: var(--font-size-3xl);
      margin-bottom: var(--spacing-xs);
    }

    .page-subtitle {
      color: var(--color-text-secondary);
      font-size: var(--font-size-sm);
    }

    .loading-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: var(--spacing-2xl);
      color: var(--color-text-secondary);
      gap: var(--spacing-md);
    }

    .video-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: var(--spacing-lg);
    }

    .video-card {
      display: flex;
      flex-direction: column;
    }

    .video-thumbnail {
      position: relative;
      aspect-ratio: 16 / 9;
      overflow: hidden;
      background: var(--color-bg-tertiary);
      display: block;
      text-decoration: none;
    }

    .video-thumbnail.disabled {
      cursor: not-allowed;
    }

    .video-thumbnail img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      transition: transform var(--transition-normal);
    }

    .video-card:hover .video-thumbnail img {
      transform: scale(1.05);
    }

    .thumbnail-placeholder {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 3rem;
      opacity: 0.5;
    }

    .duration-badge {
      position: absolute;
      bottom: var(--spacing-sm);
      right: var(--spacing-sm);
      padding: var(--spacing-xs) var(--spacing-sm);
      background: rgba(0, 0, 0, 0.8);
      color: white;
      font-size: var(--font-size-xs);
      font-weight: 500;
      border-radius: var(--radius-sm);
    }

    .status-overlay {
      position: absolute;
      inset: 0;
      background: rgba(0, 0, 0, 0.7);
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .status-content {
      text-align: center;
      color: white;
    }

    .status-content span {
      font-size: 2rem;
    }

    .status-content p {
      margin-top: var(--spacing-sm);
      font-size: var(--font-size-sm);
    }

    .play-overlay {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(0, 0, 0, 0.3);
      opacity: 0;
      transition: opacity var(--transition-normal);
    }

    .video-card:hover .play-overlay {
      opacity: 1;
    }

    .play-icon {
      width: 60px;
      height: 60px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--color-accent-gradient);
      border-radius: 50%;
      font-size: var(--font-size-xl);
      color: white;
      box-shadow: var(--shadow-lg);
    }

    .video-info {
      padding: var(--spacing-md);
      display: flex;
      flex-direction: column;
      gap: var(--spacing-sm);
    }

    .video-title {
      font-size: var(--font-size-base);
      font-weight: 600;
      line-height: 1.4;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .video-meta {
      font-size: var(--font-size-sm);
      color: var(--color-text-muted);
    }

    .video-actions {
      display: flex;
      gap: var(--spacing-sm);
      margin-top: var(--spacing-sm);
    }

    .load-more {
      display: flex;
      justify-content: center;
      margin-top: var(--spacing-xl);
    }

    @media (max-width: 600px) {
      .video-grid {
        grid-template-columns: 1fr;
      }
    }
  `],
})
export class VideoListComponent implements OnInit, OnDestroy {
    videos: Video[] = [];
    loading = true;
    totalVideos = 0;
    hasMore = false;
    private offset = 0;
    private limit = 12;
    private destroy$ = new Subject<void>();
    private refreshInterval$ = interval(10000); // Refresh every 10 seconds

    constructor(public videoService: VideoService) { }

    ngOnInit() {
        this.loadVideos();

        // Auto-refresh for processing videos
        this.refreshInterval$
            .pipe(takeUntil(this.destroy$))
            .subscribe(() => {
                if (this.videos.some(v => v.status === 'processing' || v.status === 'pending')) {
                    this.refreshVideos();
                }
            });
    }

    ngOnDestroy() {
        this.destroy$.next();
        this.destroy$.complete();
    }

    loadVideos() {
        this.loading = true;
        this.videoService
            .getVideos(this.limit, this.offset)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
                next: (response) => {
                    this.videos = response.videos;
                    this.totalVideos = response.total;
                    this.hasMore = this.videos.length < response.total;
                    this.loading = false;
                },
                error: (err) => {
                    console.error('Failed to load videos:', err);
                    this.loading = false;
                },
            });
    }

    refreshVideos() {
        this.videoService
            .getVideos(this.limit, 0)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
                next: (response) => {
                    this.videos = response.videos;
                    this.totalVideos = response.total;
                },
            });
    }

    loadMore() {
        this.offset += this.limit;
        this.videoService
            .getVideos(this.limit, this.offset)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
                next: (response) => {
                    this.videos = [...this.videos, ...response.videos];
                    this.hasMore = this.videos.length < response.total;
                },
            });
    }

    getStatusText(status: string): string {
        switch (status) {
            case 'pending':
                return 'Queued for processing';
            case 'processing':
                return 'Transcoding...';
            case 'failed':
                return 'Processing failed';
            default:
                return status;
        }
    }

    deleteVideo(video: Video) {
        if (confirm(`Are you sure you want to delete "${video.title}"?`)) {
            this.videoService
                .deleteVideo(video.id)
                .pipe(takeUntil(this.destroy$))
                .subscribe({
                    next: () => {
                        this.videos = this.videos.filter((v) => v.id !== video.id);
                        this.totalVideos--;
                    },
                    error: (err) => {
                        console.error('Failed to delete video:', err);
                        alert('Failed to delete video');
                    },
                });
        }
    }
}
