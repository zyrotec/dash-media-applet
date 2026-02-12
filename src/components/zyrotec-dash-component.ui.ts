import St from "gi://St";
import Clutter from "gi://Clutter";
import * as Main from "resource:///org/gnome/shell/ui/main.js";
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import { MprisService } from "../services/mpris/mpris-service.js";
import { MPRIS_CHANGED_SIGNALS } from "../enums/mpris/mpris-changed-signals.enum.js";
import { MprisMetadata } from "../types/mpris/mpris-metadata.type.js";

export class ZyrotecDashComponent {
    private _mediaDashBox!: St.BoxLayout;
    private _mediaArtBox!: St.BoxLayout;
    private _mediaLabelBox!: St.BoxLayout;
    private _mediaTitleLabel!: St.Label;
    private _mediaArtistLabel!: St.Label;

    private _mediaArtUrl?: string;
    private _mediaTitle?: string;
    private _mediaArtist?: string;

    constructor() {
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
            orientation: Clutter.Orientation.HORIZONTAL
        });

        this._mediaArtBox = new St.BoxLayout({
            height: this._getDashIconSize() - (this._mediaDashBox.get_theme_node().get_padding(St.Side.TOP) * 2),
            width: this._getDashIconSize() - (this._mediaDashBox.get_theme_node().get_padding(St.Side.LEFT) * 2),
            styleClass: "zt-media-art-box",
            yAlign: Clutter.ActorAlign.CENTER
        });

        this._mediaLabelBox = new St.BoxLayout({
            y_align: Clutter.ActorAlign.CENTER,
            orientation: Clutter.Orientation.VERTICAL,
            styleClass: "zt-media-label-container"
        });

        this._mediaTitleLabel = new St.Label({
            text: "",
            style_class: 'zt-media-title-label',
            yAlign: Clutter.ActorAlign.CENTER
        });

        this._mediaArtistLabel = new St.Label({
            text: "",
            style_class: 'zt-media-artist-label',
            yAlign: Clutter.ActorAlign.CENTER
        });

        this._mediaLabelBox.insert_child_at_index(this._mediaTitleLabel, 0);
        this._mediaLabelBox.insert_child_at_index(this._mediaArtistLabel, 1);

        this._mediaDashBox.insert_child_at_index(this._mediaArtBox, 0);
        this._mediaDashBox.insert_child_at_index(this._mediaLabelBox, 1);
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
        this._mediaTitleLabel.set_text(value ?? "");
    }

    public setMediaArtist(value: string | null): void {
        this._mediaArtistLabel.set_text(value ?? "");
    }

    public getComponent(): St.BoxLayout {
        return this._mediaDashBox;
    }

    public destroy(): void {
        this._mediaDashBox.destroy();
    }
}