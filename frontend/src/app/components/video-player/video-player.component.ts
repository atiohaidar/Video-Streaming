import {
    Component,
    OnInit,
    OnDestroy,
    AfterViewInit,
    ElementRef,
    ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { VideoService, Video } from '../../services/video.service';
import { Subject, takeUntil } from 'rxjs';
import Hls from 'hls.js';

@Component({
    selector: 'app-video-player',
    standalone: true,
    imports: [CommonModule, RouterLink],
    template: `
    <div class="player-page">
      <!-- Loading State -->
      <div *ngIf="loading" class="loading-container">
        <div class="loading-spinner"></div>
        <p>Loading video...</p>
      </div>

      <!-- Error State -->
      <div *ngIf="error" class="error-container">
        <span class="error-icon">❌</span>
        <h2>{{ error }}</h2>
        <a routerLink="/" class="btn btn-primary">Back to Videos</a>
      </div>

      <!-- Video Player -->
      <div *ngIf="video && !loading" class="player-container">
        <!-- Video Element -->
        <div class="video-wrapper">
          <video
            #videoPlayer
            class="video-element"
            controls
            playsinline
            (waiting)="onBuffering()"
            (playing)="onPlaying()"
            (error)="onError($event)">
            Your browser does not support HTML5 video.
          </video>

          <!-- Buffering Overlay -->
          <div *ngIf="isBuffering" class="buffering-overlay">
            <div class="loading-spinner"></div>
            <p>Buffering...</p>
          </div>

          <!-- Processing Overlay -->
          <div *ngIf="video.status !== 'ready'" class="processing-overlay">
            <div *ngIf="video.status === 'processing'" class="processing-content">
              <div class="loading-spinner"></div>
              <h3>Video is being processed</h3>
              <p>This may take a few minutes. The page will update automatically.</p>
            </div>
            <div *ngIf="video.status === 'pending'" class="processing-content">
              <span class="processing-icon">⏳</span>
              <h3>Queued for processing</h3>
              <p>Your video is waiting in the transcoding queue.</p>
            </div>
            <div *ngIf="video.status === 'failed'" class="processing-content">
              <span class="processing-icon">❌</span>
              <h3>Processing failed</h3>
              <p>There was an error transcoding your video.</p>
            </div>
          </div>
        </div>

        <!-- Video Info -->
        <div class="video-info">
          <h1 class="video-title">{{ video.title }}</h1>
          
          <div class="video-meta">
            <span class="badge" [ngClass]="'badge-' + video.status">
              {{ video.status }}
            </span>
            <span>{{ videoService.formatFileSize(video.original_size) }}</span>
            <span *ngIf="video.duration_seconds">
              {{ videoService.formatDuration(video.duration_seconds) }}
            </span>
            <span>{{ videoService.getTimeAgo(video.created_at) }}</span>
          </div>

          <p *ngIf="video.description" class="video-description">
            {{ video.description }}
          </p>

          <!-- Quality Selector -->
          <div *ngIf="levels.length > 0" class="quality-selector">
            <label>Quality:</label>
            <select (change)="onQualityChange($event)">
              <option value="-1" [selected]="currentLevel === -1">Auto</option>
              <option *ngFor="let level of levels; let i = index" 
                      [value]="i" 
                      [selected]="currentLevel === i">
                {{ level.height }}p ({{ Math.round(level.bitrate / 1000) }}kbps)
              </option>
            </select>
          </div>

          <!-- Actions -->
          <div class="video-actions">
            <a [routerLink]="['/edit', video.id]" class="btn btn-secondary">
              ✏️ Edit
            </a>
            <a routerLink="/" class="btn btn-secondary">
              ← Back to Videos
            </a>
          </div>
        </div>

        <!-- Resolutions Available -->
        <div *ngIf="video.resolutions && video.resolutions.length > 0" class="resolutions-info">
          <h3>Available Resolutions</h3>
          <div class="resolution-list">
            <div *ngFor="let res of video.resolutions" class="resolution-item">
              <span class="resolution-name">{{ res.name }}</span>
              <span class="resolution-details">
                {{ res.width }}×{{ res.height }} • {{ res.bitrate }}kbps
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
    styles: [`
    .player-page {
      max-width: 1200px;
      margin: 0 auto;
    }

    .loading-container,
    .error-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: var(--spacing-2xl);
      text-align: center;
      gap: var(--spacing-md);
    }

    .error-icon {
      font-size: 4rem;
    }

    .player-container {
      animation: fadeIn var(--transition-slow);
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    .video-wrapper {
      position: relative;
      width: 100%;
      aspect-ratio: 16 / 9;
      background: #000;
      border-radius: var(--radius-lg);
      overflow: hidden;
      box-shadow: var(--shadow-lg);
    }

    .video-element {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }

    .buffering-overlay,
    .processing-overlay {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: rgba(0, 0, 0, 0.8);
      color: white;
      gap: var(--spacing-md);
    }

    .processing-content {
      text-align: center;
    }

    .processing-icon {
      font-size: 4rem;
      display: block;
      margin-bottom: var(--spacing-md);
    }

    .processing-content h3 {
      font-size: var(--font-size-xl);
      margin-bottom: var(--spacing-sm);
    }

    .processing-content p {
      color: var(--color-text-secondary);
    }

    .video-info {
      padding: var(--spacing-xl) 0;
    }

    .video-title {
      font-size: var(--font-size-2xl);
      margin-bottom: var(--spacing-md);
    }

    .video-meta {
      display: flex;
      flex-wrap: wrap;
      gap: var(--spacing-md);
      align-items: center;
      color: var(--color-text-secondary);
      font-size: var(--font-size-sm);
      margin-bottom: var(--spacing-md);
    }

    .video-description {
      color: var(--color-text-secondary);
      line-height: 1.6;
      margin-bottom: var(--spacing-lg);
      white-space: pre-wrap;
    }

    .quality-selector {
      display: flex;
      align-items: center;
      gap: var(--spacing-md);
      margin-bottom: var(--spacing-lg);
      padding: var(--spacing-md);
      background: var(--color-bg-tertiary);
      border-radius: var(--radius-md);
    }

    .quality-selector label {
      font-size: var(--font-size-sm);
      font-weight: 500;
    }

    .quality-selector select {
      padding: var(--spacing-sm) var(--spacing-md);
      background: var(--color-bg-secondary);
      color: var(--color-text-primary);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-sm);
      font-size: var(--font-size-sm);
      cursor: pointer;
    }

    .video-actions {
      display: flex;
      gap: var(--spacing-md);
      flex-wrap: wrap;
    }

    .resolutions-info {
      margin-top: var(--spacing-xl);
      padding: var(--spacing-lg);
      background: var(--color-bg-card);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-lg);
    }

    .resolutions-info h3 {
      font-size: var(--font-size-base);
      margin-bottom: var(--spacing-md);
    }

    .resolution-list {
      display: flex;
      flex-wrap: wrap;
      gap: var(--spacing-sm);
    }

    .resolution-item {
      display: flex;
      flex-direction: column;
      padding: var(--spacing-sm) var(--spacing-md);
      background: var(--color-bg-tertiary);
      border-radius: var(--radius-md);
    }

    .resolution-name {
      font-weight: 600;
      color: var(--color-accent-primary);
    }

    .resolution-details {
      font-size: var(--font-size-xs);
      color: var(--color-text-muted);
    }

    @media (max-width: 600px) {
      .video-wrapper {
        border-radius: 0;
        margin: 0 calc(var(--spacing-lg) * -1);
      }
    }
  `],
})
export class VideoPlayerComponent implements OnInit, OnDestroy, AfterViewInit {
    @ViewChild('videoPlayer') videoPlayerRef!: ElementRef<HTMLVideoElement>;

    video: Video | null = null;
    loading = true;
    error = '';
    isBuffering = false;

    // HLS
    private hls: Hls | null = null;
    levels: Hls.Level[] = [];
    currentLevel = -1;

    // Math for template
    Math = Math;

    private destroy$ = new Subject<void>();

    constructor(
        private route: ActivatedRoute,
        public videoService: VideoService
    ) { }

    ngOnInit() {
        const id = this.route.snapshot.paramMap.get('id');
        if (id) {
            this.loadVideo(id);
        } else {
            this.error = 'Video ID not provided';
            this.loading = false;
        }
    }

    ngAfterViewInit() {
        // HLS initialization happens after video data is loaded
    }

    ngOnDestroy() {
        this.destroy$.next();
        this.destroy$.complete();
        this.destroyHls();
    }

    loadVideo(id: string) {
        this.videoService
            .getVideo(id)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
                next: (video) => {
                    this.video = video;
                    this.loading = false;

                    if (video.status === 'ready' && video.streaming_url) {
                        // Wait for view to initialize
                        setTimeout(() => this.initializePlayer(), 100);
                    }

                    // Poll for status if still processing
                    if (video.status === 'processing' || video.status === 'pending') {
                        this.pollStatus(id);
                    }
                },
                error: (err) => {
                    console.error('Failed to load video:', err);
                    this.error = 'Video not found';
                    this.loading = false;
                },
            });
    }

    pollStatus(id: string) {
        const interval = setInterval(() => {
            this.videoService
                .getVideoStatus(id)
                .pipe(takeUntil(this.destroy$))
                .subscribe({
                    next: (status) => {
                        if (this.video) {
                            this.video.status = status.status as any;
                            if (status.status === 'ready') {
                                clearInterval(interval);
                                // Reload full video data
                                this.loadVideo(id);
                            } else if (status.status === 'failed') {
                                clearInterval(interval);
                            }
                        }
                    },
                });
        }, 5000);

        // Cleanup on destroy
        this.destroy$.subscribe(() => clearInterval(interval));
    }

    initializePlayer() {
        if (!this.video?.streaming_url || !this.videoPlayerRef) return;

        const video = this.videoPlayerRef.nativeElement;
        const streamUrl = this.video.streaming_url;

        if (Hls.isSupported()) {
            this.hls = new Hls({
                enableWorker: true,
                lowLatencyMode: false,
                backBufferLength: 90,
            });

            this.hls.loadSource(streamUrl);
            this.hls.attachMedia(video);

            this.hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
                this.levels = data.levels;
                video.play().catch(() => {
                    // Autoplay blocked, user needs to interact
                });
            });

            this.hls.on(Hls.Events.LEVEL_SWITCHED, (_, data) => {
                this.currentLevel = data.level;
            });

            this.hls.on(Hls.Events.ERROR, (_, data) => {
                if (data.fatal) {
                    switch (data.type) {
                        case Hls.ErrorTypes.NETWORK_ERROR:
                            console.error('HLS network error, trying to recover...');
                            this.hls?.startLoad();
                            break;
                        case Hls.ErrorTypes.MEDIA_ERROR:
                            console.error('HLS media error, trying to recover...');
                            this.hls?.recoverMediaError();
                            break;
                        default:
                            console.error('Fatal HLS error:', data);
                            this.destroyHls();
                            this.error = 'Failed to load video stream';
                            break;
                    }
                }
            });
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            // Native HLS support (Safari)
            video.src = streamUrl;
            video.addEventListener('loadedmetadata', () => {
                video.play().catch(() => { });
            });
        } else {
            this.error = 'HLS is not supported in this browser';
        }
    }

    destroyHls() {
        if (this.hls) {
            this.hls.destroy();
            this.hls = null;
        }
    }

    onQualityChange(event: Event) {
        const select = event.target as HTMLSelectElement;
        const level = parseInt(select.value, 10);
        if (this.hls) {
            this.hls.currentLevel = level;
            this.currentLevel = level;
        }
    }

    onBuffering() {
        this.isBuffering = true;
    }

    onPlaying() {
        this.isBuffering = false;
    }

    onError(event: Event) {
        console.error('Video error:', event);
        if (!this.hls) {
            this.error = 'Failed to play video';
        }
    }
}
