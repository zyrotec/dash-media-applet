import Clutter from "gi://Clutter";
import GLib from "gi://GLib";
import St from "gi://St";
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import { ZyrotecDashComponent } from './components/zyrotec-dash-component.ui.js';
import { MPRIS_CHANGED_SIGNALS } from './enums/mpris/mpris-changed-signals.enum.js';
import { CavaService } from "./services/cava/cava-service.js";
import { MprisService } from './services/mpris/mpris-service.js';
import { MprisMetadata } from './types/mpris/mpris-metadata.type.js';
import { ZyrotecMediaControls } from "./components/zyrotec-media-controls.ui.js";

export default class MyExtension extends Extension {
  private _mprisService?: MprisService;
  private _cavaService?: CavaService;
  private _zyrotecDashComponent?: ZyrotecDashComponent;
  private _zyrotecMediaControls?: ZyrotecMediaControls;

  private _mediaDashTriggerButton!: St.Button;
  private _mediaPopupMenu?: PopupMenu.PopupMenu;
  private _menuManager?: PopupMenu.PopupMenuManager;
  private _mediaMenuItem?: PopupMenu.PopupBaseMenuItem;

  private _signalIds: number[] = [];
  private _sessionSignalId?: number;

  private _updateMetadata(metadata: MprisMetadata | null): void {
    if (!metadata) {
      return;
    }

    const artUrl = metadata.artUrl ?? "";
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

    this._zyrotecDashComponent?.setMediaArtUrl(artUrl);
    this._zyrotecDashComponent?.setMediaTitle(title);
    this._zyrotecDashComponent?.setMediaArtist(artist);
  }

  private _syncSession(): void {
    if (!this._mprisService || !this._zyrotecDashComponent) {
      return;
    }

    if (!this._mprisService.isMprisConnected()) {
      this._zyrotecDashComponent.getComponent().visible = false;
      this._zyrotecDashComponent.setMediaArtUrl("");
      this._zyrotecDashComponent.setMediaTitle("");
      this._zyrotecDashComponent.setMediaArtist("");
      return;
    }

    this._zyrotecDashComponent.getComponent().visible = true;

    const metadata = this._mprisService.getMprisMetadata();
    this._updateMetadata(metadata);
  }

  private _handleSignals(): void {
    if (!this._mprisService) {
      return;
    }

    const mprisConnectedSignal = this._mprisService.connect(MPRIS_CHANGED_SIGNALS.playerConnected, this._syncSession.bind(this));
    const mprisDisconnectedSignal = this._mprisService.connect(MPRIS_CHANGED_SIGNALS.playerDisconnected, this._syncSession.bind(this));
    const mprisMetaDataSignal = this._mprisService.connect(MPRIS_CHANGED_SIGNALS.metadataChanged, (_, args: MprisMetadata) => {
      this._updateMetadata(args);
    });

    this._signalIds = [...this._signalIds, ...[mprisConnectedSignal, mprisDisconnectedSignal, mprisMetaDataSignal]];

    this._sessionSignalId = Main.sessionMode.connect(
      "updated",
      this._syncSession.bind(this)
    );

    this._mediaDashTriggerButton.connect('clicked', () => {
      this._mediaPopupMenu?.toggle();
    });
  }

  enable() {
    this._mprisService = new MprisService();
    this._cavaService = new CavaService(this._setCavaConfig());
    this._cavaService.cavaStart();

    this._zyrotecDashComponent = new ZyrotecDashComponent(this._cavaService);
    this._zyrotecMediaControls = new ZyrotecMediaControls(this._mprisService);

    this._mediaDashTriggerButton = new St.Button({
      reactive: true,
      can_focus: true,
      track_hover: true,
      child: this._zyrotecDashComponent.getComponent()
    });

    Main.overview.dash._box.add_child(this._mediaDashTriggerButton);

    this._mediaPopupMenu = new PopupMenu.PopupMenu(
      this._mediaDashTriggerButton,
      0.5,
      St.Side.TOP
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

    this._handleSignals();
    this._syncSession();
  }

  disable() {
    for (const signalId of this._signalIds) {
      if (!this._mprisService) {
        continue;
      }

      this._mprisService.disconnect(signalId);
    }

    this._signalIds = [];

    if (this._sessionSignalId) {
      Main.sessionMode.disconnect(this._sessionSignalId);
    }

    this._zyrotecDashComponent?.destroy();
    this._mprisService?.destroy();
    this._zyrotecMediaControls?.destroy();

    this._zyrotecDashComponent = undefined;
    this._mprisService = undefined;
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

    this._cavaService?.cavaStop();
    this._cavaService = undefined;
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
}