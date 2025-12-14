declare module 'hls.js' {
    export default class Hls {
        constructor(config?: any);
        static isSupported(): boolean;
        static Events: {
            MANIFEST_PARSED: string;
            LEVEL_SWITCHED: string;
            ERROR: string;
        };
        static ErrorTypes: {
            NETWORK_ERROR: string;
            MEDIA_ERROR: string;
        };

        loadSource(url: string): void;
        attachMedia(media: HTMLVideoElement): void;
        destroy(): void;
        startLoad(): void;
        recoverMediaError(): void;
        currentLevel: number;
        on(event: string, callback: (event: any, data?: any) => void): void;
    }

    export namespace Hls {
        interface Level {
            height: number;
            width: number;
            bitrate: number;
        }
    }
}
