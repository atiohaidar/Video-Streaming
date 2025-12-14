import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { VideoService, UploadProgress } from '../../services/video.service';

@Component({
    selector: 'app-video-upload',
    standalone: true,
    imports: [CommonModule, FormsModule],
    template: `
    <div class="upload-page">
      <div class="upload-container">
        <h1 class="page-title">Upload Video</h1>
        <p class="page-subtitle">
          Supported formats: MP4, WebM, MOV, AVI • Max size: 5GB
        </p>

        <!-- Drop Zone -->
        <div
          class="drop-zone"
          [class.active]="isDragging"
          [class.has-file]="selectedFile"
          (dragover)="onDragOver($event)"
          (dragleave)="onDragLeave($event)"
          (drop)="onDrop($event)"
          (click)="fileInput.click()">
          
          <input
            type="file"
            #fileInput
            accept="video/*"
            (change)="onFileSelected($event)"
            hidden />

          <div *ngIf="!selectedFile" class="drop-zone-content">
            <span class="drop-icon">📁</span>
            <h3>Drag and drop your video here</h3>
            <p>or click to browse</p>
          </div>

          <div *ngIf="selectedFile" class="file-preview">
            <span class="file-icon">🎬</span>
            <div class="file-info">
              <h3>{{ selectedFile.name }}</h3>
              <p>{{ videoService.formatFileSize(selectedFile.size) }}</p>
            </div>
            <button class="btn btn-secondary btn-icon" (click)="clearFile($event)">
              ✕
            </button>
          </div>
        </div>

        <!-- Metadata Form -->
        <form *ngIf="selectedFile" class="metadata-form" (ngSubmit)="uploadVideo()">
          <div class="form-group">
            <label class="form-label" for="title">Title *</label>
            <input
              type="text"
              id="title"
              class="form-input"
              [(ngModel)]="title"
              name="title"
              placeholder="Enter video title"
              required />
          </div>

          <div class="form-group">
            <label class="form-label" for="description">Description</label>
            <textarea
              id="description"
              class="form-textarea"
              [(ngModel)]="description"
              name="description"
              placeholder="Enter video description (optional)"
              rows="4">
            </textarea>
          </div>

          <!-- Upload Progress -->
          <div *ngIf="uploading" class="progress-container">
            <div class="progress-header">
              <span>{{ uploadPhase }}</span>
              <span>{{ uploadProgress }}%</span>
            </div>
            <div class="progress-bar">
              <div class="progress-fill" [style.width.%]="uploadProgress"></div>
            </div>
            <p class="progress-details">
              {{ videoService.formatFileSize(uploadedBytes) }} / 
              {{ videoService.formatFileSize(totalBytes) }}
            </p>
          </div>

          <!-- Actions -->
          <div class="form-actions">
            <button
              type="button"
              class="btn btn-secondary"
              (click)="cancel()"
              [disabled]="uploading">
              Cancel
            </button>
            <button
              type="submit"
              class="btn btn-primary"
              [disabled]="!title || uploading">
              <span *ngIf="!uploading">🚀 Upload Video</span>
              <span *ngIf="uploading">Uploading...</span>
            </button>
          </div>
        </form>

        <!-- Success Message -->
        <div *ngIf="uploadSuccess" class="success-message">
          <div class="success-icon">✅</div>
          <h3>Upload Successful!</h3>
          <p>Your video is now being processed. This may take a few minutes.</p>
          <div class="success-actions">
            <button class="btn btn-primary" (click)="goToVideos()">
              View Videos
            </button>
            <button class="btn btn-secondary" (click)="resetForm()">
              Upload Another
            </button>
          </div>
        </div>

        <!-- Error Message -->
        <div *ngIf="errorMessage" class="error-message">
          <span>❌</span>
          <p>{{ errorMessage }}</p>
          <button class="btn btn-secondary" (click)="errorMessage = ''">
            Dismiss
          </button>
        </div>
      </div>
    </div>
  `,
    styles: [`
    .upload-page {
      max-width: 700px;
      margin: 0 auto;
      padding: var(--spacing-xl) 0;
    }

    .upload-container {
      background: var(--color-bg-card);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-xl);
      padding: var(--spacing-xl);
    }

    .page-title {
      font-size: var(--font-size-2xl);
      margin-bottom: var(--spacing-xs);
    }

    .page-subtitle {
      color: var(--color-text-secondary);
      font-size: var(--font-size-sm);
      margin-bottom: var(--spacing-xl);
    }

    .drop-zone {
      border: 2px dashed var(--color-border);
      border-radius: var(--radius-lg);
      padding: var(--spacing-2xl);
      text-align: center;
      cursor: pointer;
      transition: all var(--transition-normal);
      margin-bottom: var(--spacing-xl);
    }

    .drop-zone:hover,
    .drop-zone.active {
      border-color: var(--color-accent-primary);
      background: rgba(99, 102, 241, 0.05);
    }

    .drop-zone.has-file {
      border-style: solid;
      background: var(--color-bg-tertiary);
    }

    .drop-zone-content h3 {
      margin-top: var(--spacing-md);
      font-size: var(--font-size-lg);
    }

    .drop-zone-content p {
      color: var(--color-text-muted);
      font-size: var(--font-size-sm);
      margin-top: var(--spacing-xs);
    }

    .drop-icon {
      font-size: 3rem;
    }

    .file-preview {
      display: flex;
      align-items: center;
      gap: var(--spacing-md);
      text-align: left;
    }

    .file-icon {
      font-size: 2.5rem;
    }

    .file-info {
      flex: 1;
    }

    .file-info h3 {
      font-size: var(--font-size-base);
      margin-bottom: var(--spacing-xs);
      word-break: break-all;
    }

    .file-info p {
      color: var(--color-text-muted);
      font-size: var(--font-size-sm);
    }

    .metadata-form {
      animation: fadeIn var(--transition-slow);
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .progress-container {
      background: var(--color-bg-tertiary);
      border-radius: var(--radius-md);
      padding: var(--spacing-md);
      margin-bottom: var(--spacing-lg);
    }

    .progress-header {
      display: flex;
      justify-content: space-between;
      margin-bottom: var(--spacing-sm);
      font-size: var(--font-size-sm);
      font-weight: 500;
    }

    .progress-bar {
      height: 8px;
      background: var(--color-bg-secondary);
      border-radius: var(--radius-full);
      overflow: hidden;
    }

    .progress-fill {
      height: 100%;
      background: var(--color-accent-gradient);
      border-radius: var(--radius-full);
      transition: width var(--transition-normal);
    }

    .progress-details {
      margin-top: var(--spacing-sm);
      font-size: var(--font-size-xs);
      color: var(--color-text-muted);
      text-align: center;
    }

    .form-actions {
      display: flex;
      gap: var(--spacing-md);
      justify-content: flex-end;
    }

    .success-message,
    .error-message {
      text-align: center;
      padding: var(--spacing-xl);
      animation: fadeIn var(--transition-slow);
    }

    .success-icon {
      font-size: 4rem;
      margin-bottom: var(--spacing-md);
    }

    .success-message h3 {
      font-size: var(--font-size-xl);
      margin-bottom: var(--spacing-sm);
      color: var(--color-success);
    }

    .success-message p {
      color: var(--color-text-secondary);
      margin-bottom: var(--spacing-lg);
    }

    .success-actions {
      display: flex;
      gap: var(--spacing-md);
      justify-content: center;
    }

    .error-message {
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid var(--color-error);
      border-radius: var(--radius-md);
      display: flex;
      align-items: center;
      gap: var(--spacing-md);
      padding: var(--spacing-md);
    }

    .error-message span {
      font-size: 1.5rem;
    }

    .error-message p {
      flex: 1;
      color: var(--color-error);
    }
  `],
})
export class VideoUploadComponent {
    selectedFile: File | null = null;
    title = '';
    description = '';
    isDragging = false;
    uploading = false;
    uploadProgress = 0;
    uploadedBytes = 0;
    totalBytes = 0;
    uploadPhase = 'Uploading...';
    uploadSuccess = false;
    errorMessage = '';

    constructor(
        public videoService: VideoService,
        private router: Router
    ) { }

    onDragOver(event: DragEvent) {
        event.preventDefault();
        event.stopPropagation();
        this.isDragging = true;
    }

    onDragLeave(event: DragEvent) {
        event.preventDefault();
        event.stopPropagation();
        this.isDragging = false;
    }

    onDrop(event: DragEvent) {
        event.preventDefault();
        event.stopPropagation();
        this.isDragging = false;

        const files = event.dataTransfer?.files;
        if (files && files.length > 0) {
            this.handleFile(files[0]);
        }
    }

    onFileSelected(event: Event) {
        const input = event.target as HTMLInputElement;
        if (input.files && input.files.length > 0) {
            this.handleFile(input.files[0]);
        }
    }

    handleFile(file: File) {
        if (!file.type.startsWith('video/')) {
            this.errorMessage = 'Please select a video file';
            return;
        }

        // 5GB limit
        if (file.size > 5 * 1024 * 1024 * 1024) {
            this.errorMessage = 'File size exceeds 5GB limit';
            return;
        }

        this.selectedFile = file;
        this.title = file.name.replace(/\.[^/.]+$/, ''); // Remove extension
        this.errorMessage = '';
    }

    clearFile(event: Event) {
        event.stopPropagation();
        this.selectedFile = null;
        this.title = '';
        this.description = '';
    }

    uploadVideo() {
        if (!this.selectedFile || !this.title) return;

        this.uploading = true;
        this.uploadProgress = 0;
        this.uploadPhase = 'Uploading...';
        this.errorMessage = '';

        this.videoService
            .uploadVideo(this.selectedFile, this.title, this.description)
            .subscribe({
                next: (event) => {
                    if ('progress' in event) {
                        this.uploadProgress = event.progress;
                        this.uploadedBytes = event.loaded;
                        this.totalBytes = event.total;
                    } else {
                        // Upload complete
                        this.uploading = false;
                        this.uploadSuccess = true;
                    }
                },
                error: (err) => {
                    console.error('Upload failed:', err);
                    this.uploading = false;
                    this.errorMessage = 'Upload failed. Please try again.';
                },
            });
    }

    cancel() {
        this.router.navigate(['/']);
    }

    goToVideos() {
        this.router.navigate(['/']);
    }

    resetForm() {
        this.selectedFile = null;
        this.title = '';
        this.description = '';
        this.uploadSuccess = false;
        this.uploadProgress = 0;
    }
}
