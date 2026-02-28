import Clutter from "gi://Clutter";
import St from "gi://St";
import * as Main from "resource:///org/gnome/shell/ui/main.js";

import { MPRIS_CHANGED_SIGNALS } from "../enums/mpris/mpris-changed-signals.enum.js";
import { ColorService } from "../services/color/color-service.js";
import { DominantColorService } from "../services/dominant-color/dominant-color-service.js";
import { MprisService } from "../services/mpris/mpris-service.js";
import { MprisMetadata } from "../types/mpris/mpris-metadata.type.js";
import { ZyrotecAudioVisualizer } from "./zyrotec-audio-visualizer.ui.js";
import { ZyrotecMarqueeLabel } from "./zyrotec-marquee-label.ui.js";

export class ZyrotecDashComponent {
    private _mprisService!: MprisService;
    private _dominantColorService!: DominantColorService;
    private _colorService!: ColorService;

    private _mediaDashBox!: St.BoxLayout;
    private _mediaArtBox!: St.BoxLayout;
    private _mediaLabelBox!: St.BoxLayout;
    private _mediaVisualizerBox!: St.BoxLayout;
    private _mediaVisualizerWrapper!: St.Bin;
    private _mediaTitleLabel!: ZyrotecMarqueeLabel;
    private _mediaArtistLabel!: ZyrotecMarqueeLabel;
    private _mediaAudioVisualizer?: ZyrotecAudioVisualizer;

    private _destroyed: boolean = false;
    private _signalIds: number[] = [];
    private _sessionSignalId?: number;

    constructor(
        private mprisService: MprisService,
        private dominantColorService: DominantColorService,
        private colorService: ColorService
    ) {
        this._mprisService = mprisService;
        this._dominantColorService = dominantColorService;
        this._colorService = colorService;

        this._init();
    }

    public _init(): void {
        this._generateComponent();
        this._handleMprisSignals();
        this._syncSession();
    }

    private _generateComponent(): void {
        this._mediaDashBox = new St.BoxLayout({
            styleClass: "zt-media-dash-box",
            yExpand: true,
            yAlign: Clutter.ActorAlign.CENTER,
            orientation: Clutter.Orientation.HORIZONTAL,
            width: 180
        });

        this._mediaArtBox = new St.BoxLayout({
            height: this._getDashIconSize() - (this._mediaDashBox.get_theme_node().get_padding(St.Side.TOP) * 2),
            width: this._getDashIconSize() - (this._mediaDashBox.get_theme_node().get_padding(St.Side.LEFT) * 2),
            styleClass: "zt-media-art-box",
            yAlign: Clutter.ActorAlign.CENTER
        });

        this._mediaLabelBox = new St.BoxLayout({
            yAlign: Clutter.ActorAlign.CENTER,
            orientation: Clutter.Orientation.VERTICAL,
            styleClass: "zt-media-label-container",
            y_expand: false
        });

        this._mediaVisualizerBox = new St.BoxLayout({
            height: 16,
            width: 20,
            style_class: 'zt-media-visualizer-container',
            yAlign: Clutter.ActorAlign.CENTER,
        });

        this._mediaTitleLabel = new ZyrotecMarqueeLabel({
            style_class: 'zt-media-title-label',
            yAlign: Clutter.ActorAlign.CENTER
        });

        this._mediaArtistLabel = new ZyrotecMarqueeLabel({
            style_class: 'zt-media-artist-label',
            yAlign: Clutter.ActorAlign.CENTER
        });

        this._mediaVisualizerWrapper = new St.Bin({
            x_align: Clutter.ActorAlign.CENTER,
            yAlign: Clutter.ActorAlign.CENTER,
            x_expand: true,
            y_expand: true,
        });

        this._mediaAudioVisualizer = new ZyrotecAudioVisualizer({
            reactive: false,
            x_expand: false,
            y_expand: false,
            width: 16,
            height: 14
        });

        const labelWidth = 180 - (38 + (this._getDashIconSize() - (this._mediaDashBox.get_theme_node().get_padding(St.Side.TOP) * 2)));

        this._mediaTitleLabel.setText("");
        this._mediaArtistLabel.setText("");
        this._mediaTitleLabel.setWidth(labelWidth);
        this._mediaArtistLabel.setWidth(labelWidth);
        this._mediaTitleLabel.setMarqueeScrollSpeed(40);
        this._mediaArtistLabel.setMarqueeScrollSpeed(40);
        this._mediaTitleLabel.setLabelSpacerGap(16);
        this._mediaArtistLabel.setLabelSpacerGap(16);
        this._mediaTitleLabel.setMarqueeAnimationDelay(60);
        this._mediaArtistLabel.setMarqueeAnimationDelay(60);

        this._mediaLabelBox.insert_child_at_index(this._mediaTitleLabel.getComponent(), 0);
        this._mediaLabelBox.insert_child_at_index(this._mediaArtistLabel.getComponent(), 1);
        this._mediaLabelBox.set_width(labelWidth);

        this._mediaVisualizerWrapper.add_child(this._mediaAudioVisualizer.getComponent());
        this._mediaVisualizerBox.add_child(this._mediaVisualizerWrapper);

        this._mediaDashBox.insert_child_at_index(this._mediaArtBox, 0);
        this._mediaDashBox.insert_child_at_index(this._mediaLabelBox, 1);
        this._mediaDashBox.insert_child_at_index(this._mediaVisualizerBox, 2);
    }

    private _handleMprisSignals(): void {
        const connectedSignal = this._mprisService.connect(MPRIS_CHANGED_SIGNALS.playerConnected, () => {
            if (this._destroyed) {
                return;
            }

            try {
                this._syncSession();
            } catch (error) { }
        });
        this._signalIds.push(connectedSignal);

        const disconnectedSignal = this._mprisService.connect(MPRIS_CHANGED_SIGNALS.playerDisconnected, () => {
            if (this._destroyed) {
                return;
            }

            try {
                this._syncSession();
            } catch (error) { }
        });
        this._signalIds.push(disconnectedSignal);

        const playbackStatusSignal = this._mprisService.connect(MPRIS_CHANGED_SIGNALS.playbackStatusChanged, (service, args) => {
            if (this._destroyed) {
                return;
            }

            try {

            } catch (error) { }
        });
        this._signalIds.push(playbackStatusSignal);

        const metadataSignal = this._mprisService.connect(MPRIS_CHANGED_SIGNALS.metadataChanged, (service, args: MprisMetadata) => {
            if (this._destroyed) {
                return;
            }

            try {
                this._updateMetadata(args);
            } catch (error) { }
        });
        this._signalIds.push(metadataSignal);
    }

    private _handleSessionSignals(): void {
        this._sessionSignalId = Main.sessionMode.connect(
            "updated",
            this._syncSession.bind(this)
        );
    }

    private _syncSession(): void {
        if (!this._mprisService) {
            return;
        }

        if (!this._mprisService.isMprisConnected()) {
            this._mediaDashBox.visible = false;
            this._mediaArtBox.set_style(`background-image: url("");`);
            this._mediaTitleLabel.setText("");
            this._mediaArtistLabel.setText("");
            return;
        }

        this._mediaDashBox.visible = true;

        const metadata = this._mprisService.getMprisMetadata();
        this._updateMetadata(metadata);
    }

    private _updateMetadata(metadata: MprisMetadata | null): void {
        this._setMediaText(metadata);
        this._setDominantColor(metadata);
        this._setMediaArtUrl(metadata);
    }

    private _setMediaText(metadata: MprisMetadata | null): void {
        if (!metadata) {
            return;
        }

        const title = metadata.title ?? 'Unknown Title';
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

        this._mediaTitleLabel.setText(title);
        this._mediaArtistLabel.setText(artist);
    }

    private _setMediaArtUrl(metadata: MprisMetadata | null): void {
        if (!metadata || !metadata.artUrl) {
            return;
        }

        let uri = metadata.artUrl;

        if (!uri?.startsWith('file://') &&
            !uri?.startsWith('http://') &&
            !uri?.startsWith('https://')) {
            uri = `file://${decodeURI(uri ?? "")}`;
        }

        this._mediaArtBox.set_style(`background-image: url("${uri ?? ''}");`);
    }

    private async _setDominantColor(metadata: MprisMetadata | null): Promise<void> {
        if (!metadata || !metadata.artUrl) {
            return;
        }

        try {
            let uri = metadata.artUrl;

            if (!uri?.startsWith('file://') &&
                !uri?.startsWith('http://') &&
                !uri?.startsWith('https://')) {
                uri = `${decodeURI(uri ?? "")}`;
            }

            const dominantColor = (await this._dominantColorService.getDominantColorFromImage(uri)) ?? { r: 255, g: 255, b: 255 };
            const { r: rAccent, g: gAccent, b: bAccent } = this._colorService.getLuminanceColor(dominantColor, 0.25, 0.625);
            const { r: rBackground, g: gBackground, b: bBackground } = this._colorService.getInvertedLuminanceColor(dominantColor, { r: rAccent, g: gAccent, b: bAccent }, 0.125);

            this._mediaTitleLabel.setTextColor(rAccent, gAccent, bAccent);
            this._mediaArtistLabel.setTextColor(rAccent, gAccent, bAccent);
            this._mediaAudioVisualizer?.setAudioBarColor({ red: rAccent, green: gAccent, blue: bAccent, alpha: 1 });

            this._mediaDashBox.set_style(`background-color: rgb(${rBackground}, ${gBackground}, ${bBackground});`);
        } catch (error) {
            logError(error);
        }
    }

    private _getDashIconSize(): number {
        const iconSize = Main.overview.dash.iconSize;
        return iconSize;
    }

    public getComponent(): St.BoxLayout {
        return this._mediaDashBox;
    }

    public destroy(): void {
        this._destroyed = true;

        for (const signalId of this._signalIds) {
            try {
                this._mprisService.disconnect(signalId);
            } catch (error) { }
        }
        this._signalIds = [];

        if (this._sessionSignalId) {
            Main.sessionMode.disconnect(this._sessionSignalId);
        }

        this._mediaAudioVisualizer?.destroy();
        this._mediaDashBox.destroy();
    }
}