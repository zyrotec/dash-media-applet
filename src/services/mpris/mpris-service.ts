import Gio from "gi://Gio";
import GLib from "gi://GLib";
import * as Signals from 'resource:///org/gnome/shell/misc/signals.js';
import { MPRIS_CHANGED_PROPERTIES } from "../../enums/mpris/mpris-changed-properties.enum.js";
import { MPRIS_CHANGED_SIGNALS } from "../../enums/mpris/mpris-changed-signals.enum.js";
import { MPRIS_LOOP_STATUS } from "../../enums/mpris/mpris-loop-status.enum.js";
import { MPRIS_METADATA } from "../../enums/mpris/mpris-metadata.enum.js";
import { MPRIS_PLAYBACK_STATUS } from "../../enums/mpris/mpris-playback-status.enum.js";
import { Environment } from "../../environment/environment.js";
import { MprisLoopStatus } from "../../types/mpris/mpris-loop-status.type.js";
import { MprisMetadata } from "../../types/mpris/mpris-metadata.type.js";
import { MprisPlaybackStatus } from "../../types/mpris/mpris-playback-status.type.js";
import { MprisRawMetadata } from "../../types/mpris/mpris-raw-metadata.type.js";
import { MprisPlayerService } from "./mpris-player-service.js";

export class MprisService extends Signals.EventEmitter {
    private _mprisPlayers: Map<string, MprisPlayerService> = new Map<string, MprisPlayerService>();
    private _mprisActivePlayer: MprisPlayerService | null = null;
    private _mprisNameWatcherId: number | null = null;

    constructor() {
        super();
        this._init();
    }

    private _init(): void {
        this._mprisNameWatcherId = Gio.DBus.session.signal_subscribe(
            Environment.ORG_FREEDESKTOP_DBUS,
            Environment.ORG_FREEDESKTOP_DBUS,
            Environment.NAME_OWNER_CHANGED,
            Environment.ORG_FREEDESKTOP_DBUS_PATH,
            null,
            Gio.DBusSignalFlags.NONE,
            (_connection, _sender, _path, _iFace, _signal, params) => {
                const [playerName, playerOldOwner, playerNewOwner] = <string[]>params.deepUnpack();

                if (!playerName.startsWith(Environment.MPRIS_PREFIX)) {
                    return;
                }

                if (!playerOldOwner && playerNewOwner) {
                    this._addMprisPlayer(playerName);
                } else if (playerOldOwner && !playerNewOwner) {
                    this._removeMprisPlayer(playerName);
                }
            }
        );

        this._findExistingMprisPlayers();
    }

    private _findExistingMprisPlayers(): void {
        Gio.DBus.session.call(
            Environment.ORG_FREEDESKTOP_DBUS,
            Environment.MPRIS_PATH,
            Environment.ORG_FREEDESKTOP_DBUS,
            Environment.LIST_NAMES,
            null,
            GLib.VariantType.new("(as)"),
            Gio.DBusCallFlags.NONE,
            -1,
            null,
            (connection, result) => {
                if (!connection) {
                    return;
                }

                try {
                    const playerReply = connection.call_finish(result);
                    const [playerNames] = <string[][]>playerReply.deepUnpack();

                    for (const playerName of playerNames) {
                        if (!playerName.startsWith(Environment.MPRIS_PREFIX)) {
                            continue;
                        }

                        this._addMprisPlayer(playerName);
                    }
                } catch (error) {
                    logError(error);
                }
            }
        );
    }

    //Manage Active Player
    private _addMprisPlayer(playerName: string): void {
        if (this._mprisPlayers.has(playerName)) {
            return;
        }

        Gio.DBusProxy.new(
            Gio.DBus.session,
            Gio.DBusProxyFlags.NONE,
            null,
            playerName,
            Environment.MPRIS_PATH,
            Environment.MPRIS_PLAYER_IFACE,
            null,
            (source, result) => {
                try {
                    const playerProxy = Gio.DBusProxy.new_finish(result);

                    const mprisPlayer = new MprisPlayerService(playerName, playerProxy);

                    mprisPlayer.connectSignals((player, changed) => {
                        this._onMprisPropertiesChanged(player, changed);
                    });

                    this._mprisPlayers.set(playerName, mprisPlayer);
                    if (this._shouldSwitchTo(mprisPlayer)) {
                        this._setActiveMprisPlayer(mprisPlayer);
                    }

                    this.emit(MPRIS_CHANGED_SIGNALS.playerConnected, playerName);

                } catch (error) {
                    logError(error);
                }
            }
        );
    }

    private _removeMprisPlayer(playerName: string): void {
        const mprisPlayer = this._mprisPlayers.get(playerName);
        if (!mprisPlayer) {
            return;
        }

        console.log(`Player removed: ${playerName}`);

        mprisPlayer.disconnect();

        this._mprisPlayers.delete(playerName);

        if (this._mprisActivePlayer === mprisPlayer) {
            this._mprisActivePlayer = null;
            this._switchToMostRecentMprisPlayer();
        }

        this.emit(MPRIS_CHANGED_SIGNALS.playerDisconnected, playerName);
    }

    private _switchToMostRecentMprisPlayer(): void {
        let best: MprisPlayerService | null = null;

        for (const candidate of this._mprisPlayers.values()) {

            if (!best) {
                best = candidate;
                continue;
            }

            const bestPriority = this._getPriority(best);
            const candidatePriority = this._getPriority(candidate);

            const bestActivity = best.getMprisLastActivityTime();
            const candidateActivity = candidate.getMprisLastActivityTime();

            if (candidatePriority > bestPriority) {
                best = candidate;
                continue;
            }

            if (candidatePriority < bestPriority) {
                continue;
            }

            if (candidateActivity > bestActivity) {
                best = candidate;
                continue;
            }

            if (candidateActivity < bestActivity) {
                continue;
            }

            if (
                candidate.getMprisBusName() < best.getMprisBusName()
            ) {
                best = candidate;
            }
        }

        if (best && this._shouldSwitchTo(best)) {
            this._setActiveMprisPlayer(best);
        }
    }

    private _getPriority(player: MprisPlayerService | null): number {
        if (!player) {
            return 0;
        }

        const status = this._getPlaybackStatus(player);

        switch (status) {
            case MPRIS_PLAYBACK_STATUS.playing: return 3;
            case MPRIS_PLAYBACK_STATUS.paused: return 2;
            case MPRIS_PLAYBACK_STATUS.stopped: return 1;
            default: return 0;
        }
    }

    private _shouldSwitchTo(candidate: MprisPlayerService): boolean {
        if (!this._mprisActivePlayer) {
            return true;
        }

        if (this._mprisActivePlayer === candidate) {
            return false;
        }

        const candidateStatus = this._getPlaybackStatus(candidate);
        const activeStatus = this._getPlaybackStatus(this._mprisActivePlayer);

        if (candidateStatus === MPRIS_PLAYBACK_STATUS.playing &&
            activeStatus !== MPRIS_PLAYBACK_STATUS.playing) {
            return true;
        }

        if (activeStatus === MPRIS_PLAYBACK_STATUS.playing &&
            candidateStatus !== MPRIS_PLAYBACK_STATUS.playing) {
            return false;
        }

        if (candidateStatus === MPRIS_PLAYBACK_STATUS.paused &&
            activeStatus === MPRIS_PLAYBACK_STATUS.stopped) {
            return true;
        }

        if (candidateStatus === MPRIS_PLAYBACK_STATUS.stopped) {
            return false;
        }

        if (candidateStatus === activeStatus) {
            return candidate.getMprisLastActivityTime() >
                this._mprisActivePlayer.getMprisLastActivityTime();
        }

        return false;
    }

    private _getPlaybackStatus(player: MprisPlayerService): MprisPlaybackStatus {
        const variant = player
            .getMprisPlayerProxy()
            .get_cached_property(MPRIS_CHANGED_PROPERTIES.playbackStatus);

        return variant
            ? <MprisPlaybackStatus>variant.unpack()
            : MPRIS_PLAYBACK_STATUS.stopped;
    }

    private _setActiveMprisPlayer(mprisPlayerService: MprisPlayerService): void {
        if (this._mprisActivePlayer === mprisPlayerService) {
            return;
        }

        this._mprisActivePlayer = mprisPlayerService;

        this._notifyMprisInitialState();

        this.emit(MPRIS_CHANGED_SIGNALS.activePlayerChanged, mprisPlayerService.getMprisBusName());
    }

    private _onMprisPropertiesChanged(mprisPlayer: MprisPlayerService, changed: GLib.Variant): void {
        const changedProperties = <Record<string, GLib.Variant>>changed.deepUnpack();
        const shouldSwitchTo = this._shouldSwitchTo(mprisPlayer);

        if (MPRIS_CHANGED_PROPERTIES.playbackStatus in changedProperties) {
            const status = <MprisPlaybackStatus>changedProperties[MPRIS_CHANGED_PROPERTIES.playbackStatus].unpack();

            if (status === MPRIS_PLAYBACK_STATUS.playing || status === MPRIS_PLAYBACK_STATUS.paused) {
                if (shouldSwitchTo) {
                    this._setActiveMprisPlayer(mprisPlayer);
                }
            }

            if (status === MPRIS_PLAYBACK_STATUS.stopped &&
                mprisPlayer === this._mprisActivePlayer) {
                this._switchToMostRecentMprisPlayer();
            }
        }

        if (MPRIS_CHANGED_PROPERTIES.metadata in changedProperties) {
            const statusVariant = mprisPlayer.getMprisPlayerProxy().get_cached_property(MPRIS_CHANGED_PROPERTIES.playbackStatus);
            if (statusVariant) {
                const status = <MprisPlaybackStatus>statusVariant.unpack();
                if (status !== MPRIS_PLAYBACK_STATUS.stopped) {
                    if (shouldSwitchTo) {
                        this._setActiveMprisPlayer(mprisPlayer);
                    }
                }
            }
        }

        if (mprisPlayer === this._mprisActivePlayer) {
            if (MPRIS_CHANGED_PROPERTIES.metadata in changedProperties) {
                const metadata = this._parseMprisMetadata(<MprisRawMetadata>changedProperties[MPRIS_CHANGED_PROPERTIES.metadata].deepUnpack());

                this.emit(MPRIS_CHANGED_SIGNALS.metadataChanged, metadata);
            }

            if (MPRIS_CHANGED_PROPERTIES.playbackStatus in changedProperties) {
                const status = <MprisPlaybackStatus>changedProperties[MPRIS_CHANGED_PROPERTIES.playbackStatus].unpack();

                this.emit(MPRIS_CHANGED_SIGNALS.playbackStatusChanged, status);
            }

            if (MPRIS_CHANGED_PROPERTIES.shuffle in changedProperties) {
                const shuffle = <boolean>changedProperties[MPRIS_CHANGED_PROPERTIES.shuffle].unpack();

                this.emit(MPRIS_CHANGED_SIGNALS.shuffleChanged, shuffle);
            }

            if (MPRIS_CHANGED_PROPERTIES.loopStatus in changedProperties) {
                const loop = <MprisLoopStatus>changedProperties[MPRIS_CHANGED_PROPERTIES.loopStatus].unpack();

                this.emit(MPRIS_CHANGED_SIGNALS.loopStatusChanged, loop);
            }
        }
    }

    private _notifyMprisInitialState(): void {
        const metadata = this.getMprisMetadata();

        if (metadata) {
            this.emit(MPRIS_CHANGED_SIGNALS.metadataChanged, metadata);
        }
        this.emit(MPRIS_CHANGED_SIGNALS.playbackStatusChanged, this.getMprisPlaybackStatus());
        this.emit(MPRIS_CHANGED_SIGNALS.shuffleChanged, this.getMprisShuffle());
        this.emit(MPRIS_CHANGED_SIGNALS.loopStatusChanged, this.getMprisLoopStatus());
    }

    private _parseMprisMetadata(mprisRawMetadata: MprisRawMetadata): MprisMetadata {
        return {
            title: <string>mprisRawMetadata[MPRIS_METADATA.title]?.unpack() ?? null,
            artist: <string[]>mprisRawMetadata[MPRIS_METADATA.artist]?.unpack() ?? null,
            album: <string>mprisRawMetadata[MPRIS_METADATA.album]?.unpack() ?? null,
            artUrl: <string>mprisRawMetadata[MPRIS_METADATA.artURL]?.unpack() ?? null,
            length: <number>mprisRawMetadata[MPRIS_METADATA.length]?.unpack() ?? null,
            albumArtist: <string[]>mprisRawMetadata[MPRIS_METADATA.albumArtist]?.unpack() ?? null,
            trackNumber: <number>mprisRawMetadata[MPRIS_METADATA.trackNumber]?.unpack() ?? null,
            discNumber: <number>mprisRawMetadata[MPRIS_METADATA.discNumber]?.unpack() ?? null,
            url: <string>mprisRawMetadata[MPRIS_METADATA.url]?.unpack() ?? null
        };
    }

    //Property Control Methods
    public setMprisShuffle(enabled: boolean): void {
        if (!this._mprisActivePlayer?.getMprisPlayerProxy() || !this._mprisActivePlayer.getMprisBusName()) {
            return;
        }

        Gio.DBus.session.call(
            this._mprisActivePlayer.getMprisBusName(),
            Environment.MPRIS_PATH,
            Environment.ORG_FREEDESKTOP_DBUS_PROPERTIES,
            Environment.SET,
            GLib.Variant.new("(ssv)", [
                Environment.MPRIS_PLAYER_IFACE,
                MPRIS_CHANGED_PROPERTIES.shuffle,
                GLib.Variant.new_boolean(enabled)
            ]),
            null,
            Gio.DBusCallFlags.NONE,
            -1,
            null,
            (connection, result) => {
                try {
                    connection?.call_finish(result);
                } catch (error) {
                    logError(error);
                }
            }
        );
    }

    public toggleMprisShuffle(): void {
        const current = this.getMprisShuffle();
        this.setMprisShuffle(!current);
    }

    public setMprisLoopStatus(mprisLoopStatus: MprisLoopStatus): void {
        if (!this._mprisActivePlayer?.getMprisPlayerProxy() || !this._mprisActivePlayer.getMprisBusName()) {
            return;
        }

        Gio.DBus.session.call(
            this._mprisActivePlayer.getMprisBusName(),
            Environment.MPRIS_PATH,
            Environment.ORG_FREEDESKTOP_DBUS_PROPERTIES,
            Environment.SET,
            GLib.Variant.new("(ssv)", [
                Environment.MPRIS_PLAYER_IFACE,
                MPRIS_CHANGED_PROPERTIES.loopStatus,
                GLib.Variant.new_string(mprisLoopStatus)
            ]),
            null,
            Gio.DBusCallFlags.NONE,
            -1,
            null,
            (connection, result) => {
                try {
                    connection?.call_finish(result);
                } catch (error) {
                    logError(error);
                }
            }
        );
    }

    public cycleMprisLoopStatus(): void {
        const current = this.getMprisLoopStatus();
        const statuses: MprisLoopStatus[] = [MPRIS_LOOP_STATUS.none, MPRIS_LOOP_STATUS.track, MPRIS_LOOP_STATUS.playlist];
        const currentIndex = statuses.indexOf(current);
        const nextIndex = (currentIndex + 1) % statuses.length;
        this.setMprisLoopStatus(statuses[nextIndex]);
    }

    public setPosition(mprisTrackId: string, mprisSeekPosition: number): void {
        if (!this._mprisActivePlayer?.getMprisPlayerProxy() || !this._mprisActivePlayer.getMprisBusName()) {
            return;
        }

        try {
            Gio.DBus.session.call(
                this._mprisActivePlayer.getMprisBusName(),
                Environment.MPRIS_PATH,
                Environment.MPRIS_PLAYER_IFACE,
                'SetPosition',
                GLib.Variant.new('(ox)', [mprisTrackId, mprisSeekPosition]),
                null,
                Gio.DBusCallFlags.NONE,
                -1,
                null,
                (connection: Gio.DBusConnection | null, result: Gio.AsyncResult) => {
                    try {
                        connection?.call_finish(result);
                    } catch (error) {
                        logError(error);
                    }
                }
            );
        } catch (error) {
            logError(error);
        }
    }

    // Playback Methods
    public play(): void {
        const proxy = this._mprisActivePlayer?.getMprisPlayerProxy();

        if (!proxy) {
            return;
        }

        proxy.PlayRemote();
    }

    public pause(): void {

        const proxy = this._mprisActivePlayer?.getMprisPlayerProxy();

        if (!proxy) {
            return;
        }

        proxy.PauseRemote();
    }

    public playPause(): void {

        const proxy = this._mprisActivePlayer?.getMprisPlayerProxy();

        if (!proxy) {
            return;
        }

        proxy.PlayPauseRemote();
    }

    public stop(): void {

        const proxy = this._mprisActivePlayer?.getMprisPlayerProxy();

        if (!proxy) {
            return;
        }

        proxy.StopRemote();
    }

    public next(): void {
        const proxy = this._mprisActivePlayer?.getMprisPlayerProxy();

        if (!proxy) {
            return;
        }

        proxy.NextRemote();
    }

    public previous(): void {
        const proxy = this._mprisActivePlayer?.getMprisPlayerProxy();

        if (!proxy) {
            return;
        }

        proxy.PreviousRemote();
    }

    public seek(offset: number): void {
        const proxy = this._mprisActivePlayer?.getMprisPlayerProxy();

        if (!proxy) {
            return;
        }

        try {
            proxy.SeekRemote(offset);
        } catch (error) {
            logError(error);
        }
    }

    //Getters
    public getMprisMetadata(): MprisMetadata | null {
        const proxy = this._mprisActivePlayer?.getMprisPlayerProxy();

        if (!proxy) {
            return null;
        }

        const variant = proxy.get_cached_property(MPRIS_CHANGED_PROPERTIES.metadata);
        if (!variant) {
            return null;
        }

        return this._parseMprisMetadata(<MprisRawMetadata>variant.deepUnpack());
    }

    public getMprisPlaybackStatus(): MprisPlaybackStatus {
        const proxy = this._mprisActivePlayer?.getMprisPlayerProxy();

        if (!proxy) {
            return MPRIS_PLAYBACK_STATUS.stopped;
        }

        const variant = proxy.get_cached_property(MPRIS_CHANGED_PROPERTIES.playbackStatus);

        return variant ? <MprisPlaybackStatus>variant.unpack() : MPRIS_PLAYBACK_STATUS.stopped;
    }

    public getMprisShuffle(): boolean {
        const proxy = this._mprisActivePlayer?.getMprisPlayerProxy();

        if (!proxy) {
            return false;
        }

        const variant = proxy.get_cached_property(MPRIS_CHANGED_PROPERTIES.shuffle);

        return variant ? <boolean>variant.unpack() : false;
    }

    public getMprisLoopStatus(): MprisLoopStatus {
        const proxy = this._mprisActivePlayer?.getMprisPlayerProxy();

        if (!proxy) {
            return MPRIS_LOOP_STATUS.none;
        }

        const variant = proxy.get_cached_property(MPRIS_CHANGED_PROPERTIES.loopStatus);

        return variant ? <MprisLoopStatus>variant.unpack() : MPRIS_LOOP_STATUS.none;
    }

    public getMprisSeekPosition(): number | null {
        const proxy = this._mprisActivePlayer?.getMprisPlayerProxy();

        if (!proxy) return null;

        const variant = proxy.get_cached_property('Position');
        return variant ? variant.get_int64() : null;
    }

    public getMprisPlayerName(): string | null {
        if (!this._mprisActivePlayer) {
            return null;
        }

        return this._mprisActivePlayer.getMprisBusName();
    }

    public getActiveMprisPlayer(): MprisPlayerService | null {
        return this._mprisActivePlayer;
    }

    public isMprisConnected(): boolean {
        return this._mprisActivePlayer !== null;
    }

    public destroy(): void {
        if (this._mprisNameWatcherId !== null) {
            Gio.DBus.session.signal_unsubscribe(this._mprisNameWatcherId);
            this._mprisNameWatcherId = null;
        }

        for (const mprisPlayer of this._mprisPlayers.values()) {
            mprisPlayer.disconnect();
        }

        this._mprisPlayers.clear();
        this._mprisActivePlayer = null;
        this.disconnectAll();
    }
}