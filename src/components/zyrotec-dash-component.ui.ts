import St from "gi://St";
import Clutter from "gi://Clutter";
import * as Main from "resource:///org/gnome/shell/ui/main.js";

import { ZyrotecMarqueeLabel } from "./zyrotec-marquee-label.ui.js";
import { ZyrotecAudioVisualizer } from "./zyrotec-audio-visualizer.ui.js";
import { CavaService } from "../services/cava/cava-service.js";

export class ZyrotecDashComponent {
    private _mediaDashBox!: St.BoxLayout;
    private _mediaArtBox!: St.BoxLayout;
    private _mediaLabelBox!: St.BoxLayout;
    private _mediaVisualizerBox!: St.BoxLayout;
    private _mediaVisualizerWrapper!: St.Bin;
    private _mediaTitleLabel!: ZyrotecMarqueeLabel;
    private _mediaArtistLabel!: ZyrotecMarqueeLabel;
    private _mediaAudioVisualizer?: ZyrotecAudioVisualizer;

    constructor(private _cavaService: CavaService) {
        this._init();
    }

    public _init(): void {
        this._generateComponent();
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

    private _getDashIconSize(): number {
        const iconSize = Main.overview.dash.iconSize;
        return iconSize;
    }

    public setMediaArtUrl(value: string | null): void {
        let uri = value;

        if (!uri?.startsWith('file://') &&
            !uri?.startsWith('http://') &&
            !uri?.startsWith('https://')) {
            uri = `file://${decodeURI(uri ?? "")}`;
        }

        this._mediaArtBox.set_style(`background-image: url("${uri ?? ''}");`);
    }

    public setMediaTitle(value: string | null): void {
        this._mediaTitleLabel.setText(value ?? "");
    }

    public setMediaArtist(value: string | null): void {
        this._mediaArtistLabel.setText(value ?? "");
    }

    public getComponent(): St.BoxLayout {
        return this._mediaDashBox;
    }

    public destroy(): void {
        this._mediaAudioVisualizer?.destroy();
        this._mediaDashBox.destroy();
    }
}