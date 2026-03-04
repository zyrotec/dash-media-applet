import '@girs/cogl-2.0';
import '@girs/gjs';
import '@girs/gjs/dom';
import '@girs/gnome-shell/ambient';
import '@girs/gnome-shell/extensions/global';
import { IMprisSignalMap } from './interfaces/mpris/mpris-signal-map.interface.js';

declare module 'resource:///org/gnome/shell/misc/signals.js' {
    export interface EventEmitter {
        connect<K extends keyof IMprisSignalMap>(
            signal: K,
            callback: (source: this, ...args: IMprisSignalMap[K]) => boolean | void | undefined
        ): number;
        connect(
            signal: string,
            callback: (source: this, ...args: unknown[]) => boolean | void | undefined
        ): number;
    }
}