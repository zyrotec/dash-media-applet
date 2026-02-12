import '@girs/cogl-2.0';
import '@girs/gjs';
import '@girs/gjs/dom';
import '@girs/gnome-shell/ambient';
import '@girs/gnome-shell/extensions/global';

import type { MPRIS_CHANGED_SIGNALS } from './enums/mpris/mpris-changed-signals.enum.js';
import type { MprisLoopStatus } from './types/types/mpris-loop-status.type.js';
import type { MprisMetadata } from './types/types/mpris-metadata.type.js';
import type { MprisPlaybackStatus } from './types/types/mpris-playback-status.type.js';
interface MprisSignalMap {
    [MPRIS_CHANGED_SIGNALS.playerConnected]: [busName: string];
    [MPRIS_CHANGED_SIGNALS.playerDisconnected]: [busName: string];
    [MPRIS_CHANGED_SIGNALS.activePlayerChanged]: [busName: string];
    [MPRIS_CHANGED_SIGNALS.metadataChanged]: [metadata: MprisMetadata];
    [MPRIS_CHANGED_SIGNALS.playbackStatusChanged]: [status: MprisPlaybackStatus];
    [MPRIS_CHANGED_SIGNALS.shuffleChanged]: [enabled: boolean];
    [MPRIS_CHANGED_SIGNALS.loopStatusChanged]: [loop: MprisLoopStatus];
}

declare module 'resource:///org/gnome/shell/misc/signals.js' {
    export interface EventEmitter {
        connect<K extends keyof MprisSignalMap>(
            signal: K,
            callback: (source: this, ...args: MprisSignalMap[K]) => void
        ): number;
    }
}