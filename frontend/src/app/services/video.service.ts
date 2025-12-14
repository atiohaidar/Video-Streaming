import { Injectable } from '@angular/core';
import { HttpClient, HttpEvent, HttpEventType } from '@angular/common/http';
import { Observable, map } from 'rxjs';

export interface Video {
    id: string;
    title: string;
    description: string | null;
    original_filename: string;
    original_size: number;
    duration_seconds: number | null;
    status: 'pending' | 'processing' | 'ready' | 'failed';
    resolutions: Resolution[];
    streaming_url: string | null;
    thumbnail_url: string | null;
    created_at: string;
    updated_at: string;
}

export interface Resolution {
    name: string;
    width: number;
    height: number;
    bitrate: number;
    segment_path: string;
}

export interface VideoListResponse {
    videos: Video[];
    total: number;
}

export interface UploadProgress {
    progress: number;
    loaded: number;
    total: number;
}

@Injectable({
    providedIn: 'root',
})
export class VideoService {
    private apiUrl = '/api/videos';

    constructor(private http: HttpClient) { }

    /**
     * Get list of all videos
     */
    getVideos(limit = 20, offset = 0): Observable<VideoListResponse> {
        return this.http.get<VideoListResponse>(this.apiUrl, {
            params: { limit: limit.toString(), offset: offset.toString() },
        });
    }

    /**
     * Get a single video by ID
     */
    getVideo(id: string): Observable<Video> {
        return this.http.get<Video>(`${this.apiUrl}/${id}`);
    }

    /**
     * Upload a new video with progress tracking
     */
    uploadVideo(
        file: File,
        title: string,
        description?: string
    ): Observable<UploadProgress | Video> {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('title', title);
        if (description) {
            formData.append('description', description);
        }

        return this.http
            .post<Video>(this.apiUrl, formData, {
                reportProgress: true,
                observe: 'events',
            })
            .pipe(
                map((event: HttpEvent<Video>) => {
                    switch (event.type) {
                        case HttpEventType.UploadProgress:
                            const total = event.total || 0;
                            const progress = total > 0 ? Math.round((100 * event.loaded) / total) : 0;
                            return {
                                progress,
                                loaded: event.loaded,
                                total,
                            } as UploadProgress;
                        case HttpEventType.Response:
                            return event.body as Video;
                        default:
                            return { progress: 0, loaded: 0, total: 0 } as UploadProgress;
                    }
                })
            );
    }

    /**
     * Update video metadata
     */
    updateVideo(
        id: string,
        data: { title?: string; description?: string }
    ): Observable<Video> {
        return this.http.put<Video>(`${this.apiUrl}/${id}`, data);
    }

    /**
     * Delete a video
     */
    deleteVideo(id: string): Observable<void> {
        return this.http.delete<void>(`${this.apiUrl}/${id}`);
    }

    /**
     * Get video processing status
     */
    getVideoStatus(id: string): Observable<{ status: string; error_message?: string }> {
        return this.http.get<{ status: string; error_message?: string }>(
            `${this.apiUrl}/${id}/status`
        );
    }

    /**
     * Format file size for display
     */
    formatFileSize(bytes: number): string {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * Format duration for display
     */
    formatDuration(seconds: number | null): string {
        if (!seconds) return '--:--';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    /**
     * Get relative time ago
     */
    getTimeAgo(dateString: string): string {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMins < 1) return 'just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString();
    }
}
