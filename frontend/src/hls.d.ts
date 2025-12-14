declare module 'hls.js' {
    export default Hls;
    export interface Hls {
        loadSource(url: string): void;
        attachMedia(media: HTMLVideoElement): void;
        destroy(): void;
        startLoad(): void;
        recoverMediaError(): void;
        currentLevel: number;
        on(event: string, callback: (event: string, data: any) => void): void;
    }
    export namespace Hls {
        const isSupported: () => boolean;
        const Events: {
            MANIFEST_PARSED: string;
            LEVEL_SWITCHED: string;
            ERROR: string;
        };
        const ErrorTypes: {
            NETWORK_ERROR: string;
            MEDIA_ERROR: string;
        };
        interface Level {
            height: number;
            width: number;
            bitrate: number;
        }
    }
}
