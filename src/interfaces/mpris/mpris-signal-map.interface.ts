import { MPRIS_CHANGED_SIGNALS } from "../../enums/mpris/mpris-changed-signals.enum";
import { MprisLoopStatus } from "../../types/mpris/mpris-loop-status.type";
import { MprisMetadata } from "../../types/mpris/mpris-metadata.type";
import { MprisPlaybackStatus } from "../../types/mpris/mpris-playback-status.type";

export interface IMprisSignalMap {
    [MPRIS_CHANGED_SIGNALS.playerConnected]: [busName: string];
    [MPRIS_CHANGED_SIGNALS.playerDisconnected]: [busName: string];
    [MPRIS_CHANGED_SIGNALS.activePlayerChanged]: [busName: string];
    [MPRIS_CHANGED_SIGNALS.metadataChanged]: [metadata: MprisMetadata];
    [MPRIS_CHANGED_SIGNALS.playbackStatusChanged]: [status: MprisPlaybackStatus];
    [MPRIS_CHANGED_SIGNALS.shuffleChanged]: [enabled: boolean];
    [MPRIS_CHANGED_SIGNALS.loopStatusChanged]: [loop: MprisLoopStatus];
    [MPRIS_CHANGED_SIGNALS.positionChanged]: [position: number];
}