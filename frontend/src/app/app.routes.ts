import { Routes } from '@angular/router';

export const routes: Routes = [
    {
        path: '',
        loadComponent: () =>
            import('./components/video-list/video-list.component').then(
                (m) => m.VideoListComponent
            ),
    },
    {
        path: 'upload',
        loadComponent: () =>
            import('./components/video-upload/video-upload.component').then(
                (m) => m.VideoUploadComponent
            ),
    },
    {
        path: 'watch/:id',
        loadComponent: () =>
            import('./components/video-player/video-player.component').then(
                (m) => m.VideoPlayerComponent
            ),
    },
    {
        path: 'edit/:id',
        loadComponent: () =>
            import('./components/video-edit/video-edit.component').then(
                (m) => m.VideoEditComponent
            ),
    },
    {
        path: '**',
        redirectTo: '',
    },
];
