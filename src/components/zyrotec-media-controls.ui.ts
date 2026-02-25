import Clutter from "gi://Clutter";
import St from "gi://St";
import * as Slider from 'resource:///org/gnome/shell/ui/slider.js';
import { MPRIS_CHANGED_SIGNALS } from "../enums/mpris/mpris-changed-signals.enum.js";
import { MPRIS_LOOP_STATUS } from "../enums/mpris/mpris-loop-status.enum.js";
import { MPRIS_PLAYBACK_STATUS } from "../enums/mpris/mpris-playback-status.enum.js";
import { MprisService } from "../services/mpris/mpris-service.js";
import { MprisMetadata } from "../types/mpris/mpris-metadata.type.js";
import { ZyrotecMarqueeLabel } from "./zyrotec-marquee-label.ui.js";

import { ZyrotecMaxWidthBoxLayout } from "./zyrotec-max-width-box-layout.ui.js";

export class ZyrotecMediaControls {
    private _mprisService!: MprisService;

    private _mediaComponent!: St.BoxLayout;
    private _mediaArtBox!: St.BoxLayout;
    private _mediaAlbumLayerBox!: St.BoxLayout;
    private _mediaAlbumBlurBox!: St.Widget;
    private _mediaAlbumLabelBox!: St.Widget;
    private _mediaControlBox!: St.BoxLayout;
    private _mediaCenterControlBox!: St.BoxLayout;
    private _mediaProgressBox!: St.BoxLayout;
    private _mediaProgressTimeBox!: St.BoxLayout;
    private _mediaLabelBox!: St.BoxLayout;
    private _mediaTitleLabel!: ZyrotecMarqueeLabel;
    private _mediaArtistLabel!: ZyrotecMarqueeLabel;
    private _mediaAlbumLabel!: ZyrotecMarqueeLabel;
    private _mediaProgressLabel!: St.Label;
    private _mediaDurationLabel!: St.Label;
    private _mediaShuffleIcon!: St.Icon;
    private _mediaSkipBackwardIcon!: St.Icon;
    private _mediaPlayIcon!: St.Icon;
    private _mediaSkipIcon!: St.Icon;
    private _mediaRepeatIcon!: St.Icon;
    private _mediaShuffleButton!: St.Button;
    private _mediaSkipBackwardButton!: St.Button;
    private _mediaPlayButton!: St.Button;
    private _mediaSkipButton!: St.Button;
    private _mediaRepeatButton!: St.Button;
    private _mediaAlbumLabelContainerBox!: ZyrotecMaxWidthBoxLayout;
    private _mediaAlbumLabelContainer!: St.Widget;
    private _mediaProgressLabelSpacer!: St.Widget;
    private _mediaProgressSlider!: Slider.Slider;

    private _isMediaProgressSliderDragging: boolean = false;

    private _mediaProgressPosition: number | null = null;
    private _destroyed: boolean = false;
    private _signalIds: number[] = [];
    private _buttonSignalIds: Map<St.Button, number[]> = new Map();
    private _sliderSignalIds: number[] = [];
    private _currentTrackFingerprint: string | null = null;

    constructor(private mprisService: MprisService) {
        this._mprisService = mprisService;
        this._init();
        this._handleMprisSignals();
        this._handlePlaybackButtonEvents();
        this._handlePlaybackProgressEvents();
    }

    private _init(): void {
        this._generateComponent();
    }

    private _generateComponent(): void {
        this._mediaComponent = new St.BoxLayout({
            orientation: Clutter.Orientation.VERTICAL,
            style_class: "zt-media-component"
        });

        this._generateAlbumArtComponent();
        this._generateLabelComponent();
        this._generateProgressComponent();
        this._generateControlComponent();
    }

    private _generateAlbumArtComponent(): void {
        this._mediaArtBox = new St.BoxLayout({
            style_class: "zt-media-controls-art-box",
            yAlign: Clutter.ActorAlign.CENTER,
            y_expand: true,
            x_expand: true,
            height: 250,
            width: 250,
            clip_to_allocation: true
        });

        this._mediaAlbumLabelContainerBox = new ZyrotecMaxWidthBoxLayout({
            x_expand: false,
        });

        this._mediaAlbumLabelContainer = new St.Widget({
            layout_manager: new Clutter.BinLayout(),
            style_class: "zt-media-album-label-container",
            yAlign: Clutter.ActorAlign.END,
            x_align: Clutter.ActorAlign.START,
            x_expand: true,
            y_expand: true,
            clip_to_allocation: true,
            style: "border-radius: 8px;"
        });

        this._mediaAlbumBlurBox = new St.BoxLayout({
            style_class: "zt-media-album-blur-box",
            yAlign: Clutter.ActorAlign.FILL,
            x_align: Clutter.ActorAlign.FILL,
            x_expand: true,
            y_expand: true,
            clip_to_allocation: true
        });

        this._mediaAlbumLayerBox = new St.BoxLayout({
            yAlign: Clutter.ActorAlign.FILL,
            x_align: Clutter.ActorAlign.FILL,
            x_expand: true,
            y_expand: true,
            clip_to_allocation: true,
            style: "background: rgba(0,0,0,0.25); border-radius: 8px;"
        });

        this._mediaAlbumLabelBox = new St.BoxLayout({
            style_class: "zt-media-album-label-box",
            yAlign: Clutter.ActorAlign.FILL,
            x_align: Clutter.ActorAlign.FILL,
            x_expand: true,
            y_expand: true,
            clip_to_allocation: true,
        });

        this._mediaAlbumLabel = new ZyrotecMarqueeLabel({
            yAlign: Clutter.ActorAlign.CENTER,
        });

        this._mediaAlbumLabelContainerBox.setMaxWidth(125);

        this._mediaAlbumLabel.setStyleClass("zt-media-album-label");
        this._mediaAlbumLabel.setLabelSpacerGap(16);

        this._mediaAlbumBlurBox.clear_effects();
        this._mediaAlbumBlurBox.set_style('border-radius: 8px;');
        this._mediaAlbumBlurBox.set_offscreen_redirect(Clutter.OffscreenRedirect.ALWAYS);

        this._mediaAlbumLabelBox.add_child(this._mediaAlbumLabel.getComponent());

        this._mediaAlbumLabelContainer.add_child(this._mediaAlbumBlurBox);
        this._mediaAlbumLabelContainer.add_child(this._mediaAlbumLayerBox);
        this._mediaAlbumLabelContainer.add_child(this._mediaAlbumLabelBox);

        this._mediaAlbumLabelContainerBox.add_child(this._mediaAlbumLabelContainer);

        this._mediaArtBox.add_child(this._mediaAlbumLabelContainerBox);
        this._mediaComponent.add_child(this._mediaArtBox);

        this._mediaAlbumBlurBox.connect('notify::size', () => {
            this._mediaAlbumBlurBox.get_effects().forEach(e => e.queue_repaint());
        });
    }

    private _generateLabelComponent(): void {
        this._mediaLabelBox = new St.BoxLayout({
            style_class: "zt-media-controls-label-container",
            orientation: Clutter.Orientation.VERTICAL,
            yAlign: Clutter.ActorAlign.CENTER,
            x_align: Clutter.ActorAlign.CENTER,
            x_expand: true,
            y_expand: false,
        });

        this._mediaTitleLabel = new ZyrotecMarqueeLabel({
            style_class: 'zt-media-controls-title-label',
            yAlign: Clutter.ActorAlign.CENTER
        });
        this._mediaArtistLabel = new ZyrotecMarqueeLabel({
            style_class: 'zt-media-controls-artist-label',
            yAlign: Clutter.ActorAlign.CENTER
        });

        this._mediaTitleLabel.setWidth(250);
        this._mediaArtistLabel.setWidth(250);
        this._mediaTitleLabel.setLabelSpacerGap(24);
        this._mediaArtistLabel.setLabelSpacerGap(20);
        this._mediaTitleLabel.setAlignment(Clutter.ActorAlign.CENTER, Clutter.ActorAlign.CENTER);
        this._mediaArtistLabel.setAlignment(Clutter.ActorAlign.CENTER, Clutter.ActorAlign.CENTER);

        this._mediaTitleLabel.getComponent().clear_effects();
        this._mediaTitleLabel.getComponent().set_offscreen_redirect(Clutter.OffscreenRedirect.ALWAYS);

        this._mediaLabelBox.add_child(this._mediaTitleLabel.getComponent());
        this._mediaLabelBox.add_child(this._mediaArtistLabel.getComponent());
        this._mediaLabelBox.add_child(this._mediaAlbumLabel.getComponent());

        this._mediaComponent.add_child(this._mediaLabelBox);
    }

    private _generateProgressComponent(): void {
        this._mediaProgressBox = new St.BoxLayout({
            style_class: "zt-media-progress-container",
            orientation: Clutter.Orientation.VERTICAL
        });

        this._mediaProgressTimeBox = new St.BoxLayout({
            orientation: Clutter.Orientation.HORIZONTAL,
            x_expand: true,
        });

        this._mediaProgressSlider = new Slider.Slider(0);

        this._mediaProgressLabelSpacer = new St.Widget({
            x_expand: true
        });

        this._mediaProgressLabel = new St.Label({
            text: "00:00",
            style_class: "zt-media-progress-label"
        });

        this._mediaDurationLabel = new St.Label({
            text: "00:00",
            style_class: "zt-media-progress-label"
        });

        this._mediaProgressSlider.set_style_class_name("zt-media-progress-slider");

        this._mediaProgressTimeBox.add_child(this._mediaProgressLabel);
        this._mediaProgressTimeBox.add_child(this._mediaProgressLabelSpacer);
        this._mediaProgressTimeBox.add_child(this._mediaDurationLabel);

        this._mediaProgressBox.add_child(this._mediaProgressSlider);
        this._mediaProgressBox.add_child(this._mediaProgressTimeBox);

        this._mediaComponent.add_child(this._mediaProgressBox);
    }

    private _generateControlComponent(): void {
        this._mediaControlBox = new St.BoxLayout({
            orientation: Clutter.Orientation.HORIZONTAL,
            yAlign: Clutter.ActorAlign.CENTER,
            y_expand: false,
            x_expand: true,
            style_class: "zt-media-controls-container"
        });

        this._mediaCenterControlBox = new St.BoxLayout({
            orientation: Clutter.Orientation.HORIZONTAL,
            yAlign: Clutter.ActorAlign.CENTER,
            x_align: Clutter.ActorAlign.CENTER,
            y_expand: false,
            x_expand: true,
            style_class: "zt-media-center-controls-container"
        });

        this._mediaShuffleIcon = new St.Icon({
            icon_name: 'media-playlist-shuffle-symbolic',
            icon_size: 16,
        });
        this._mediaSkipBackwardIcon = new St.Icon({
            icon_name: 'media-skip-backward-symbolic',
            icon_size: 16,
        });
        this._mediaPlayIcon = new St.Icon({
            icon_name: 'media-playback-start-symbolic',
            icon_size: 24,
        });
        this._mediaSkipIcon = new St.Icon({
            icon_name: 'media-skip-forward-symbolic',
            icon_size: 16,
        });
        this._mediaRepeatIcon = new St.Icon({
            icon_name: 'media-playlist-repeat-symbolic',
            icon_size: 16,
        });

        this._mediaShuffleButton = new St.Button({
            child: this._mediaShuffleIcon,
            style_class: "zt-media-control-button",
            y_expand: false,
            x_expand: false,
            yAlign: Clutter.ActorAlign.CENTER,
            x_align: Clutter.ActorAlign.CENTER,
        });
        this._mediaSkipBackwardButton = new St.Button({
            child: this._mediaSkipBackwardIcon,
            style_class: "zt-media-control-button",
            y_expand: false,
            x_expand: false,
            yAlign: Clutter.ActorAlign.CENTER,
            x_align: Clutter.ActorAlign.CENTER,
        });
        this._mediaPlayButton = new St.Button({
            child: this._mediaPlayIcon,
            style_class: "zt-media-control-main-button",
            y_expand: false,
            x_expand: false,
            yAlign: Clutter.ActorAlign.CENTER,
            x_align: Clutter.ActorAlign.CENTER,
        });
        this._mediaSkipButton = new St.Button({
            child: this._mediaSkipIcon,
            style_class: "zt-media-control-button",
            y_expand: false,
            x_expand: false,
            yAlign: Clutter.ActorAlign.CENTER,
            x_align: Clutter.ActorAlign.CENTER,
        });
        this._mediaRepeatButton = new St.Button({
            child: this._mediaRepeatIcon,
            style_class: "zt-media-control-button",
            y_expand: false,
            x_expand: false,
            yAlign: Clutter.ActorAlign.CENTER,
            x_align: Clutter.ActorAlign.CENTER
        });

        this._mediaCenterControlBox.add_child(this._mediaSkipBackwardButton);
        this._mediaCenterControlBox.add_child(this._mediaPlayButton);
        this._mediaCenterControlBox.add_child(this._mediaSkipButton);

        this._mediaControlBox.add_child(this._mediaShuffleButton);
        this._mediaControlBox.add_child(this._mediaCenterControlBox);
        this._mediaControlBox.add_child(this._mediaRepeatButton);

        this._mediaComponent.add_child(this._mediaControlBox);
    }

    private _handleMprisSignals(): void {
        const playbackStatusSignal = this._mprisService.connect(MPRIS_CHANGED_SIGNALS.playbackStatusChanged, (service, args) => {
            if (this._destroyed) {
                return;
            }

            try {
                switch (args) {
                    case MPRIS_PLAYBACK_STATUS.playing:
                        this._mediaPlayIcon.set_icon_name("media-playback-pause-symbolic");
                        break;
                    case MPRIS_PLAYBACK_STATUS.paused:
                        this._mediaPlayIcon.set_icon_name("media-playback-start-symbolic");
                        break;
                    case MPRIS_PLAYBACK_STATUS.stopped:
                        this._mediaPlayIcon.set_icon_name("media-playback-start-symbolic");
                        break;
                    default:
                        break;
                }
            } catch (error) { }
        });
        this._signalIds.push(playbackStatusSignal);

        const shuffleSignal = this._mprisService.connect(MPRIS_CHANGED_SIGNALS.shuffleChanged, (service, args) => {
            if (this._destroyed) {
                return;
            }

            try {
                this._mediaShuffleIcon.set_icon_name((args === true) ? "media-playlist-consecutive-symbolic" : "media-playlist-shuffle-symbolic");
            } catch (error) { }
        });
        this._signalIds.push(shuffleSignal);

        const loopStatusSignal = this._mprisService.connect(MPRIS_CHANGED_SIGNALS.loopStatusChanged, (service, args) => {
            if (this._destroyed) {
                return;
            }

            try {
                switch (args) {
                    case MPRIS_LOOP_STATUS.track:
                        this._mediaRepeatIcon.set_icon_name("media-playlist-repeat-song-symbolic");
                        this._mediaRepeatButton.set_style("color: rgb(255,255,255)");
                        break;
                    case MPRIS_LOOP_STATUS.playlist:
                        this._mediaRepeatIcon.set_icon_name("media-playlist-repeat-symbolic");
                        this._mediaRepeatButton.set_style("color: rgb(255,255,255)");
                        break;
                    case MPRIS_LOOP_STATUS.none:
                        this._mediaRepeatIcon.set_icon_name("media-playlist-repeat-symbolic");
                        this._mediaRepeatButton.set_style("color: rgb(100,100,100)");
                        break;
                    default:
                        this._mediaRepeatIcon.set_icon_name("media-playlist-repeat-symbolic");
                        this._mediaRepeatButton.set_style("color: rgb(100,100,100)");
                        break;
                }
            } catch (error) { }
        });
        this._signalIds.push(loopStatusSignal);

        const positionSignal = this._mprisService.connect(MPRIS_CHANGED_SIGNALS.positionChanged, (service, args) => {
            if (this._destroyed) {
                return;
            }

            try {
                const metadata = this._mprisService.getMprisMetadata();

                if (!metadata?.length || typeof metadata.length !== 'number' || metadata.length <= 0) {
                    return;
                }

                if (!Number.isFinite(args) || args < 0) {
                    return;
                }

                if (this._mediaProgressPosition !== null) {
                    const diff = Math.abs(args - this._mediaProgressPosition);
                    if (diff > 1000000) {
                        this._mediaProgressLabel.text = this._formatPositionTime(this._mediaProgressPosition, metadata?.length);
                        return;
                    };
                    this._mediaProgressPosition = null;
                    return;
                }

                if (!this._isMediaProgressSliderDragging) {
                    this._mediaProgressSlider.value = args / metadata.length;
                    this._mediaProgressLabel.text = this._formatPositionTime(args, metadata?.length);
                }

                this._mediaDurationLabel.text = this._formatPositionTime(metadata.length);
            } catch (error) { }
        });
        this._signalIds.push(positionSignal);

        const metadataSignal = this._mprisService.connect(MPRIS_CHANGED_SIGNALS.metadataChanged, (service, args: MprisMetadata) => {
            if (this._destroyed) return;

            try {
                const metadata = this._mprisService.getMprisMetadata();

                this._setMediaArtUrl(metadata);
                this._setMediaText(metadata);

                if (!metadata?.length || typeof metadata.length !== 'number' || metadata.length <= 0) {
                    return;
                };

                const fingerprint = this._getTrackFingerprint(metadata);
                const isNewTrack = fingerprint !== this._currentTrackFingerprint;
                this._currentTrackFingerprint = fingerprint;

                if (isNewTrack) {
                    this._mediaProgressSlider.value = 0;
                    this._mediaProgressLabel.text = "0:00";
                }

                this._mediaDurationLabel.text = this._formatPositionTime(metadata.length);
            } catch (error) { }
        });
        this._signalIds.push(metadataSignal);
    }

    private _handlePlaybackButtonEvents(): void {
        const shuffleSignal = this._mediaShuffleButton.connect("clicked", () => {
            if (!this._destroyed) {
                try {
                    this._mprisService.toggleMprisShuffle();
                } catch (error) { }
            }
        });
        if (!this._buttonSignalIds.has(this._mediaShuffleButton)) {
            this._buttonSignalIds.set(this._mediaShuffleButton, []);
        }
        this._buttonSignalIds.get(this._mediaShuffleButton)?.push(shuffleSignal);

        const skipBackwardSignal = this._mediaSkipBackwardButton.connect("clicked", () => {
            if (!this._destroyed) {
                try {
                    this._mprisService.previous();
                } catch (error) { }
            }
        });
        if (!this._buttonSignalIds.has(this._mediaSkipBackwardButton)) {
            this._buttonSignalIds.set(this._mediaSkipBackwardButton, []);
        }
        this._buttonSignalIds.get(this._mediaSkipBackwardButton)?.push(skipBackwardSignal);

        const playSignal = this._mediaPlayButton.connect("clicked", () => {
            if (!this._destroyed) {
                try {
                    this._mprisService.playPause();
                } catch (error) { }
            }
        });
        if (!this._buttonSignalIds.has(this._mediaPlayButton)) {
            this._buttonSignalIds.set(this._mediaPlayButton, []);
        }
        this._buttonSignalIds.get(this._mediaPlayButton)?.push(playSignal);

        const skipSignal = this._mediaSkipButton.connect("clicked", () => {
            if (!this._destroyed) {
                try {
                    this._mprisService.next();
                } catch (error) { }
            }
        });
        if (!this._buttonSignalIds.has(this._mediaSkipButton)) {
            this._buttonSignalIds.set(this._mediaSkipButton, []);
        }
        this._buttonSignalIds.get(this._mediaSkipButton)?.push(skipSignal);

        const repeatSignal = this._mediaRepeatButton.connect("clicked", () => {
            if (!this._destroyed) {
                try {
                    this._mprisService.cycleMprisLoopStatus();
                } catch (error) { }
            }
        });
        if (!this._buttonSignalIds.has(this._mediaRepeatButton)) {
            this._buttonSignalIds.set(this._mediaRepeatButton, []);
        }
        this._buttonSignalIds.get(this._mediaRepeatButton)?.push(repeatSignal);
    }

    private _handlePlaybackProgressEvents(): void {
        const dragBeginSignal = this._mediaProgressSlider.connect("drag-begin", (args) => {
            this._isMediaProgressSliderDragging = true;
        });
        this._sliderSignalIds.push(dragBeginSignal);

        const dragEndSignal = this._mediaProgressSlider.connect("drag-end", (args, button) => {
            if (this._destroyed) {
                this._isMediaProgressSliderDragging = false;
                return;
            }

            try {
                const metadata = this._mprisService.getMprisMetadata();

                if (!metadata?.length || typeof metadata.length !== 'number' || metadata.length <= 0) {
                    this._isMediaProgressSliderDragging = false;
                    return;
                }

                if (!metadata.trackId) {
                    this._isMediaProgressSliderDragging = false;
                    return;
                }

                const newPosition = this._mediaProgressSlider.value * metadata.length;
                if (!Number.isFinite(newPosition) || newPosition < 0) {
                    this._isMediaProgressSliderDragging = false;
                    return;
                }

                this._mediaProgressPosition = newPosition;
                this.mprisService.setPosition(metadata.trackId, newPosition);
            } catch (error) { } finally {
                this._isMediaProgressSliderDragging = false;
            }
        });
        this._sliderSignalIds.push(dragEndSignal);

        const notifyValueSignal = this._mediaProgressSlider.connect("notify::value", (slider) => {
            if (this._destroyed || !this._isMediaProgressSliderDragging) {
                return;
            }

            try {
                const metadata = this._mprisService.getMprisMetadata();
                if (!metadata?.length || typeof metadata.length !== 'number' || metadata.length <= 0) {
                    return;
                }

                const currentPosition = slider.value * metadata.length;
                if (!Number.isFinite(currentPosition) || currentPosition < 0) {
                    return;
                }

                this._mediaProgressLabel.text = this._formatPositionTime(currentPosition, metadata?.length);
            } catch (error) { }
        });
        this._sliderSignalIds.push(notifyValueSignal);
    }

    private _getTrackFingerprint(metadata: MprisMetadata): string {
        return `${metadata.trackId ?? ''}|${metadata.title ?? ''}|${metadata.length ?? ''}`;
    }

    private _formatPositionTime(microseconds: number, totalLength?: number): string {
        if (!Number.isFinite(microseconds) || microseconds < 0) {
            return "00:00";
        }

        const totalSeconds = Math.floor(microseconds / 1000000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        const shouldShowHours =
            hours > 0 ||
            (totalLength && Math.floor(totalLength / 1000000) >= 3600);

        if (shouldShowHours) {
            return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }

        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    private _setMediaText(metadata: MprisMetadata | null): void {
        if (!metadata) {
            return;
        }

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

        this._mediaTitleLabel.setText(title);
        this._mediaArtistLabel.setText(artist);
        this._mediaAlbumLabel.setText(album);
        this._mediaAlbumLabel.setMaxWidth(125 - 16);
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
        this._mediaAlbumBlurBox.set_style(`background-image: url("${uri ?? ''}");`);
    }

    public getComponent(): St.BoxLayout {
        return this._mediaComponent;
    }

    public destroy(): void {
        this._destroyed = true;

        for (const signalId of this._signalIds) {
            try {
                this._mprisService.disconnect(signalId);
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

        for (const signalId of this._sliderSignalIds) {
            try {
                this._mediaProgressSlider.disconnect(signalId);
            } catch (error) { }
        }
        this._sliderSignalIds = [];

        this._mediaComponent.destroy();
    }
}