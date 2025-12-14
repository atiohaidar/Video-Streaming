import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { VideoService, Video } from '../../services/video.service';
import { Subject, takeUntil } from 'rxjs';

@Component({
    selector: 'app-video-edit',
    standalone: true,
    imports: [CommonModule, FormsModule, RouterLink],
    template: `
    <div class="edit-page">
      <div class="edit-container">
        <!-- Loading State -->
        <div *ngIf="loading" class="loading-container">
          <div class="loading-spinner"></div>
          <p>Loading video...</p>
        </div>

        <!-- Edit Form -->
        <form *ngIf="video && !loading" class="edit-form" (ngSubmit)="saveChanges()">
          <div class="form-header">
            <h1>Edit Video</h1>
            <span class="badge" [ngClass]="'badge-' + video.status">
              {{ video.status }}
            </span>
          </div>

          <!-- Thumbnail Preview -->
          <div class="thumbnail-preview">
            <img *ngIf="video.thumbnail_url" [src]="video.thumbnail_url" [alt]="video.title" />
            <div *ngIf="!video.thumbnail_url" class="thumbnail-placeholder">
              <span>🎬</span>
            </div>
          </div>

          <!-- Title -->
          <div class="form-group">
            <label class="form-label" for="title">Title *</label>
            <input
              type="text"
              id="title"
              class="form-input"
              [(ngModel)]="editTitle"
              name="title"
              placeholder="Enter video title"
              required />
          </div>

          <!-- Description -->
          <div class="form-group">
            <label class="form-label" for="description">Description</label>
            <textarea
              id="description"
              class="form-textarea"
              [(ngModel)]="editDescription"
              name="description"
              placeholder="Enter video description"
              rows="5">
            </textarea>
          </div>

          <!-- Video Info (Read-only) -->
          <div class="video-info-section">
            <h3>Video Information</h3>
            <div class="info-grid">
              <div class="info-item">
                <span class="info-label">Original File</span>
                <span class="info-value">{{ video.original_filename }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">File Size</span>
                <span class="info-value">{{ videoService.formatFileSize(video.original_size) }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Duration</span>
                <span class="info-value">{{ videoService.formatDuration(video.duration_seconds) }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Uploaded</span>
                <span class="info-value">{{ formatDate(video.created_at) }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Last Modified</span>
                <span class="info-value">{{ formatDate(video.updated_at) }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Resolutions</span>
                <span class="info-value">
                      {{ resolutionNames() }}
                </span>
              </div>
            </div>
          </div>

          <!-- Error Message -->
          <div *ngIf="errorMessage" class="error-message">
            <span>❌</span>
            <p>{{ errorMessage }}</p>
          </div>

          <!-- Success Message -->
          <div *ngIf="successMessage" class="success-message">
            <span>✅</span>
            <p>{{ successMessage }}</p>
          </div>

          <!-- Actions -->
          <div class="form-actions">
            <a routerLink="/" class="btn btn-secondary">
              Cancel
            </a>
            <button
              type="submit"
              class="btn btn-primary"
              [disabled]="saving || !editTitle">
              <span *ngIf="!saving">💾 Save Changes</span>
              <span *ngIf="saving">Saving...</span>
            </button>
          </div>
        </form>

        <!-- Danger Zone -->
        <div *ngIf="video && !loading" class="danger-zone">
          <h3>Danger Zone</h3>
          <p>Deleting this video will permanently remove it and all associated files.</p>
          <button 
            class="btn btn-danger"
            (click)="deleteVideo()"
            [disabled]="deleting">
            <span *ngIf="!deleting">🗑️ Delete Video</span>
            <span *ngIf="deleting">Deleting...</span>
          </button>
        </div>
      </div>
    </div>
  `,
    styles: [`
    .edit-page {
      max-width: 700px;
      margin: 0 auto;
      padding: var(--spacing-xl) 0;
    }

    .edit-container {
      background: var(--color-bg-card);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-xl);
      padding: var(--spacing-xl);
    }

    .loading-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: var(--spacing-2xl);
      gap: var(--spacing-md);
      color: var(--color-text-secondary);
    }

    .form-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: var(--spacing-xl);
    }

    .form-header h1 {
      font-size: var(--font-size-2xl);
    }

    .thumbnail-preview {
      aspect-ratio: 16 / 9;
      max-width: 400px;
      margin: 0 auto var(--spacing-xl);
      border-radius: var(--radius-lg);
      overflow: hidden;
      background: var(--color-bg-tertiary);
    }

    .thumbnail-preview img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .thumbnail-placeholder {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 4rem;
      opacity: 0.5;
    }

    .video-info-section {
      margin-top: var(--spacing-xl);
      padding-top: var(--spacing-xl);
      border-top: 1px solid var(--color-border);
    }

    .video-info-section h3 {
      font-size: var(--font-size-base);
      margin-bottom: var(--spacing-md);
      color: var(--color-text-secondary);
    }

    .info-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: var(--spacing-md);
    }

    .info-item {
      display: flex;
      flex-direction: column;
      gap: var(--spacing-xs);
    }

    .info-label {
      font-size: var(--font-size-xs);
      color: var(--color-text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .info-value {
      font-size: var(--font-size-sm);
      color: var(--color-text-primary);
      word-break: break-all;
    }

    .error-message,
    .success-message {
      display: flex;
      align-items: center;
      gap: var(--spacing-md);
      padding: var(--spacing-md);
      border-radius: var(--radius-md);
      margin-bottom: var(--spacing-lg);
    }

    .error-message {
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid var(--color-error);
      color: var(--color-error);
    }

    .success-message {
      background: rgba(34, 197, 94, 0.1);
      border: 1px solid var(--color-success);
      color: var(--color-success);
    }

    .form-actions {
      display: flex;
      gap: var(--spacing-md);
      justify-content: flex-end;
      margin-top: var(--spacing-xl);
    }

    .danger-zone {
      margin-top: var(--spacing-xl);
      padding: var(--spacing-lg);
      background: rgba(239, 68, 68, 0.05);
      border: 1px solid var(--color-error);
      border-radius: var(--radius-lg);
    }

    .danger-zone h3 {
      color: var(--color-error);
      font-size: var(--font-size-base);
      margin-bottom: var(--spacing-sm);
    }

    .danger-zone p {
      color: var(--color-text-secondary);
      font-size: var(--font-size-sm);
      margin-bottom: var(--spacing-md);
    }

    @media (max-width: 600px) {
      .info-grid {
        grid-template-columns: 1fr;
      }
      
      .form-actions {
        flex-direction: column-reverse;
      }
      
      .form-actions button,
      .form-actions a {
        width: 100%;
      }
    }
  `],
})
export class VideoEditComponent implements OnInit, OnDestroy {
    video: Video | null = null;
    loading = true;
    saving = false;
    deleting = false;

    editTitle = '';
    editDescription = '';
    errorMessage = '';
    successMessage = '';

    private destroy$ = new Subject<void>();

    constructor(
        private route: ActivatedRoute,
        private router: Router,
        public videoService: VideoService
    ) { }

    ngOnInit() {
        const id = this.route.snapshot.paramMap.get('id');
        if (id) {
            this.loadVideo(id);
        } else {
            this.router.navigate(['/']);
        }
    }

    ngOnDestroy() {
        this.destroy$.next();
        this.destroy$.complete();
    }

    loadVideo(id: string) {
        this.videoService
            .getVideo(id)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
                next: (video) => {
                    this.video = video;
                    this.editTitle = video.title;
                    this.editDescription = video.description || '';
                    this.loading = false;
                },
                error: (err) => {
                    console.error('Failed to load video:', err);
                    this.router.navigate(['/']);
                },
            });
    }

    saveChanges() {
        if (!this.video || !this.editTitle) return;

        this.saving = true;
        this.errorMessage = '';
        this.successMessage = '';

        this.videoService
            .updateVideo(this.video.id, {
                title: this.editTitle,
                description: this.editDescription || undefined,
            })
            .pipe(takeUntil(this.destroy$))
            .subscribe({
                next: (updatedVideo) => {
                    this.video = updatedVideo;
                    this.saving = false;
                    this.successMessage = 'Changes saved successfully!';

                    // Clear success message after 3 seconds
                    setTimeout(() => {
                        this.successMessage = '';
                    }, 3000);
                },
                error: (err) => {
                    console.error('Failed to save changes:', err);
                    this.saving = false;
                    this.errorMessage = 'Failed to save changes. Please try again.';
                },
            });
    }

    deleteVideo() {
        if (!this.video) return;

        if (confirm(`Are you sure you want to delete "${this.video.title}"? This cannot be undone.`)) {
            this.deleting = true;

            this.videoService
                .deleteVideo(this.video.id)
                .pipe(takeUntil(this.destroy$))
                .subscribe({
                    next: () => {
                        this.router.navigate(['/']);
                    },
                    error: (err) => {
                        console.error('Failed to delete video:', err);
                        this.deleting = false;
                        this.errorMessage = 'Failed to delete video. Please try again.';
                    },
                });
        }
    }

    formatDate(dateString: string): string {
        return new Date(dateString).toLocaleString();
    }

    resolutionNames(): string {
      const names = this.video?.resolutions?.map(r => r.name) || [];
      return names.length > 0 ? names.join(', ') : 'Processing...';
    }
}
