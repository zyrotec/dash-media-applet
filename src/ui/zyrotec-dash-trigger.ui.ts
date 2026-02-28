import GLib from "gi://GLib";
import St from "gi://St";
import Clutter from "gi://Clutter";
import GObject from 'gi://GObject';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import { DominantColorUtil } from "../utils/dominant-color/dominant-color.util.js";
import { MprisUtil } from "../utils/mpris/mpris.util.js";
import { CavaUtil } from "../utils/cava/cava.util.js";
import { ZyrotecDashComponent } from "./zyrotec-dash-component.ui.js";
import { ZyrotecMediaControls } from "./zyrotec-media-controls.ui.js";
import { ColorUtil } from "../utils/color/color.util.js";
import { MprisMetadata } from "../types/mpris/mpris-metadata.type.js";
import { MPRIS_CHANGED_SIGNALS } from "../enums/mpris/mpris-changed-signals.enum.js";

class ZyrotecDashTriggerBase extends St.BoxLayout {
    private _mprisUtil?: MprisUtil;
    private _cavaUtil?: CavaUtil;
    private _dominantColorUtil?: DominantColorUtil;
    private _colorUtil?: ColorUtil;

    private _zyrotecDashComponent?: ZyrotecDashComponent;
    private _zyrotecMediaControls?: ZyrotecMediaControls;

    private _mediaDashTriggerButton!: St.Button;
    private _separator!: St.Widget;
    private _mediaPopupMenu?: PopupMenu.PopupMenu;
    private _menuManager?: PopupMenu.PopupMenuManager;
    private _mediaMenuItem?: PopupMenu.PopupBaseMenuItem;

    private _signalIds: number[] = [];
    private _sessionSignalId!: number;
    private _buttonSignalIds: Map<St.Button, number[]> = new Map<St.Button, number[]>();
    private _popupSignalIds: Map<PopupMenu.PopupMenu, number[]> = new Map<PopupMenu.PopupMenu, number[]>();

    private _destroyed: boolean = false;

    constructor(params?: Partial<St.BoxLayout.ConstructorProps>) {
        super(params);

        this._initialize();
    }

    private _initialize(): void {
        this._mprisUtil = new MprisUtil();
        this._cavaUtil = new CavaUtil(this._setCavaConfig());
        this._dominantColorUtil = new DominantColorUtil();
        this._colorUtil = new ColorUtil();

        this._cavaUtil.cavaStart();

        this._generateDashComponent();
        this._generatePopup();
        this._generateUI();

        this._handleMprisSignals();
        this._handleButtonSignals();
        this._handelPopupSignals();
        this._handleMprisSignals();
        this._handleSessionSignals();

        this._handleSessionSync();
    }

    private _generateUI(): void {
        this._separator = new St.Widget({
            style_class: 'zt-dash-separator',
            y_expand: true,
            x_align: Clutter.ActorAlign.CENTER,
        });

        this.set_style_class_name("zt-media-dash-trigger");
        this.set_orientation(Clutter.Orientation.HORIZONTAL);
        this.set_y_expand(false);
        this.set_x_expand(false);
        this.add_child(this._separator);
        this.add_child(this._mediaDashTriggerButton);
    }

    private _generateDashComponent(): void {
        this._zyrotecDashComponent = new ZyrotecDashComponent();

        this._mediaDashTriggerButton = new St.Button({
            style_class: "zt-media-trigger-button",
            reactive: true,
            can_focus: true,
            track_hover: true,
            y_expand: false,
            x_expand: false,
            child: this._zyrotecDashComponent?.getComponent()
        });
    }

    private _generatePopup(): void {
        if (!this._mprisUtil) {
            return;
        }

        this._mediaPopupMenu = new PopupMenu.PopupMenu(
            this._mediaDashTriggerButton,
            0.5,
            St.Side.TOP
        );

        this._zyrotecMediaControls = new ZyrotecMediaControls(
            this._mprisUtil
        );

        Main.layoutManager.uiGroup.add_child(this._mediaPopupMenu.actor);
        this._mediaPopupMenu.box.add_style_class_name("zt-popover");
        this._mediaPopupMenu.actor.hide();

        this._menuManager = new PopupMenu.PopupMenuManager(this._mediaDashTriggerButton);
        this._menuManager.addMenu(this._mediaPopupMenu);

        this._mediaMenuItem = new PopupMenu.PopupBaseMenuItem({
            reactive: false,
            can_focus: false,
            style_class: "zt-popover-item"
        });

        this._mediaMenuItem.add_child(this._zyrotecMediaControls.getComponent());
        this._mediaPopupMenu.addMenuItem(this._mediaMenuItem);
    }

    private _handleMprisSignals(): void {
        if (!this._mprisUtil) {
            return;
        }

        const connectedSignal = this._mprisUtil.connect(MPRIS_CHANGED_SIGNALS.playerConnected, () => {
            if (this._destroyed) {
                return;
            }

            try {
                this._handleSessionSync();
            } catch (error) { }
        });
        this._handleSignalsIds(connectedSignal);

        const disconnectedSignal = this._mprisUtil.connect(MPRIS_CHANGED_SIGNALS.playerDisconnected, () => {
            if (this._destroyed) {
                return;
            }

            try {
                this._handleSessionSync();
            } catch (error) { }
        });
        this._handleSignalsIds(disconnectedSignal);

        const positionSignal = this._mprisUtil.connect(MPRIS_CHANGED_SIGNALS.positionChanged, (service, args) => {
            if (this._destroyed) {
                return;
            }

            try {
                const metadata = this._mprisUtil!.getMprisMetadata();

                this._zyrotecMediaControls?.setPositionState(args, metadata);
            } catch (error) { }
        });
        this._signalIds.push(positionSignal);

        const playbackStatusSignal = this._mprisUtil.connect(MPRIS_CHANGED_SIGNALS.playbackStatusChanged, (service, args) => {
            if (this._destroyed) {
                return;
            }

            try {
                this._zyrotecMediaControls?.setPlayState(args);
            } catch (error) { }
        });
        this._handleSignalsIds(playbackStatusSignal);

        const shuffleSignal = this._mprisUtil.connect(MPRIS_CHANGED_SIGNALS.shuffleChanged, (service, args) => {
            if (this._destroyed) {
                return;
            }

            try {
                this._zyrotecMediaControls?.setShuffleState(args);
            } catch (error) { }
        });
        this._handleSignalsIds(shuffleSignal);

        const loopStatusSignal = this._mprisUtil.connect(MPRIS_CHANGED_SIGNALS.loopStatusChanged, (service, args) => {
            if (this._destroyed) {
                return;
            }

            try {
                this._zyrotecMediaControls?.setRepeatState(args);
            } catch (error) { }
        });
        this._handleSignalsIds(loopStatusSignal);

        const metadataSignal = this._mprisUtil.connect(MPRIS_CHANGED_SIGNALS.metadataChanged, (service, args: MprisMetadata) => {
            if (this._destroyed) return;

            try {
                this._zyrotecMediaControls?.setDefaultPositionState(args);
                this._updateMetadata(args);
            } catch (error) { }
        });
        this._handleSignalsIds(metadataSignal);
    }

    private _handleButtonSignals(): void {
        if (!this._mediaDashTriggerButton) {
            return;
        }

        const clickedSignal = this._mediaDashTriggerButton.connect('clicked', () => {
            this._mediaPopupMenu?.toggle();
        });

        this._handleButtonSignalIds(clickedSignal, this._mediaDashTriggerButton);
    }

    private _handelPopupSignals(): void {

    }

    private _handleSignalsIds(signalId: number): void {
        this._signalIds = [...this._signalIds, signalId];
    }

    private _handleButtonSignalIds(signalId: number, button: St.Button): void {
        if (!this._buttonSignalIds.has(button)) {
            this._buttonSignalIds.set(button, []);
        }
        this._buttonSignalIds.get(button)?.push(signalId);
    }

    private _handlePopupSignalIds(signalId: number, popup: PopupMenu.PopupMenu): void {
        if (!this._popupSignalIds.has(popup)) {
            this._popupSignalIds.set(popup, []);
        }
        this._popupSignalIds.get(popup)?.push(signalId);
    }

    private _handleSessionSignals(): void {
        this._sessionSignalId = Main.sessionMode.connect(
            "updated",
            this._handleSessionSync.bind(this)
        );
    }

    private _handleSessionSync(): void {
        if (!this._mprisUtil) {
            return;
        }

        if (!this._mprisUtil.isMprisConnected()) {
            this.visible = false;

            this._zyrotecDashComponent?.setMediaArtUrl("");
            this._zyrotecDashComponent?.setTitleText("");
            this._zyrotecDashComponent?.setArtistText("");

            this._zyrotecMediaControls?.setMediaArtUrl("");
            this._zyrotecMediaControls?.setTitleText("");
            this._zyrotecMediaControls?.setAlbumText("");
            this._zyrotecMediaControls?.setArtistText("");

            return;
        }

        this.visible = true;

        const metadata = this._mprisUtil.getMprisMetadata();
        this._updateMetadata(metadata);
    }

    private _updateMetadata(metadata: MprisMetadata | null): void {
        if (!metadata || !metadata.artUrl) {
            return;
        }

        try {
            this._setColors(metadata);
            this._setText(metadata);
            this._setAlbumArt(metadata);
        } catch (error) {
            logError(error);
        }
    }

    private async _setColors(metadata: MprisMetadata): Promise<void> {
        if (!this._dominantColorUtil || !this._colorUtil) {
            return;
        }

        try {
            let uri = metadata.artUrl;

            if (!uri?.startsWith('file://') &&
                !uri?.startsWith('http://') &&
                !uri?.startsWith('https://')) {
                uri = `${decodeURI(uri ?? "")}`;
            }

            const dominantColor = (await this._dominantColorUtil.getDominantColorFromImage(uri)) ?? { r: 255, g: 255, b: 255 };
            const { r: rAccent, g: gAccent, b: bAccent } = this._colorUtil.getLuminanceColor(dominantColor, 0.25, 0.625);
            const { r: rBackground, g: gBackground, b: bBackground } = this._colorUtil.getInvertedLuminanceColor(dominantColor, { r: rAccent, g: gAccent, b: bAccent }, 0.125);

            this._zyrotecDashComponent?.setDominantColor({ r: rAccent, g: gAccent, b: bAccent }, { r: rBackground, g: gBackground, b: bBackground });
            this._zyrotecMediaControls?.setDominantColor({ r: rAccent, g: gAccent, b: bAccent }, { r: rBackground, g: gBackground, b: bBackground });
        } catch (error) {
            logError(error);
        }
    }

    private _setText(metadata: MprisMetadata): void {
        const title = metadata.title ?? 'Unknown Title';
        const album = metadata.album ?? 'Unknown Album';
        let artist = "Unknown Artist";

        if (Array.isArray(metadata.artist)) {
            artist = metadata.artist.map(a => typeof a === 'object' && 'unpack' in a ? (a as any).unpack() : a).join(', ');
        } else if (!!metadata.artist) {
            if (typeof metadata.artist === 'object' && 'unpack' in (metadata.artist ?? {})) {
                artist = (metadata.artist as any)?.unpack();
            } else {
                artist = (metadata.artist as any);
            }
        } else {
            artist = "Unknown Artist";
        }

        this._zyrotecDashComponent?.setTitleText(title);
        this._zyrotecDashComponent?.setArtistText(artist);

        this._zyrotecMediaControls?.setTitleText(title);
        this._zyrotecMediaControls?.setAlbumText(album);
        this._zyrotecMediaControls?.setArtistText(artist);
    }

    private _setAlbumArt(metadata: MprisMetadata): void {
        let uri = metadata.artUrl;

        if (!uri?.startsWith('file://') &&
            !uri?.startsWith('http://') &&
            !uri?.startsWith('https://')) {
            uri = `file://${decodeURI(uri ?? "")}`;
        }

        this._zyrotecDashComponent?.setMediaArtUrl(uri);

        this._zyrotecMediaControls?.setMediaArtUrl(uri);
    }

    private _setCavaConfig(): string {
        const path = `${GLib.get_tmp_dir()}/gnome-ext-cava.conf`;

        const content = `
            [general]
            bars = 128
            framerate = 60
            autosens = 1

            [input]
            method = pulse

            [output]
            method = raw
            bit_format = 16bit
            raw_target = /dev/stdout
            data_format = ascii
            ascii_max_range = 100
        `;

        GLib.file_set_contents(path, content);

        return path;
    }

    private _getMonitorSource(): string {
        try {
            const [ok, stdout] = GLib.spawn_command_line_sync(
                "pactl get-default-sink"
            );

            if (!ok || !stdout)
                return "auto";

            const sink = new TextDecoder().decode(stdout).trim();

            return `${sink}.monitor`;
        } catch {
            return "auto";
        }
    }

    public destroy(): void {
        this._destroyed = true;

        for (const signalId of this._signalIds) {
            try {
                this._mprisUtil?.disconnect(signalId);
            } catch (error) { }
        }
        this._signalIds = [];

        for (const [button, signalIds] of this._buttonSignalIds.entries()) {
            for (const signalId of signalIds) {
                try {
                    button.disconnect(signalId);
                } catch (error) { }
            }
        }
        this._buttonSignalIds.clear();

        for (const [popup, signalIds] of this._popupSignalIds.entries()) {
            for (const signalId of signalIds) {
                try {
                    popup.disconnect(signalId);
                } catch (error) { }
            }
        }
        this._buttonSignalIds.clear();

        if (this._sessionSignalId) {
            Main.sessionMode.disconnect(this._sessionSignalId);
        }

        this._mprisUtil?.destroy();
        this._zyrotecDashComponent?.destroy();
        this._zyrotecMediaControls?.destroy();

        this._zyrotecDashComponent = undefined;
        this._mprisUtil = undefined;
        this._zyrotecMediaControls = undefined;

        this._mediaDashTriggerButton.destroy();

        if (this._mediaPopupMenu) {
            this._menuManager?.removeMenu(this._mediaPopupMenu);
            Main.layoutManager.uiGroup.remove_child(this._mediaPopupMenu.actor);
            this._mediaPopupMenu.destroy();
            this._mediaPopupMenu = undefined;
        }

        if (this._mediaMenuItem) {
            this._mediaMenuItem.destroy();
            this._mediaMenuItem = undefined;
        }

        this._cavaUtil?.cavaStop();
        this._cavaUtil = undefined;
    }
}

export const ZyrotecDashTrigger = GObject.registerClass(
    { GTypeName: 'ZyrotecDashTrigger' },
    ZyrotecDashTriggerBase
);
export type ZyrotecDashTrigger = InstanceType<typeof ZyrotecDashTriggerBase>;