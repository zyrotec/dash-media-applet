import GLib from "gi://GLib";
import St from "gi://St";
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import { ZyrotecDashComponent } from './components/zyrotec-dash-component.ui.js';
import { ZyrotecMediaControls } from "./components/zyrotec-media-controls.ui.js";
import { CavaService } from "./services/cava/cava-service.js";
import { ColorService } from "./services/color/color-service.js";
import { DominantColorService } from "./services/dominant-color/dominant-color-service.js";
import { MprisService } from './services/mpris/mpris-service.js';

export default class MyExtension extends Extension {
  private _mprisService?: MprisService;
  private _cavaService?: CavaService;
  private _dominantColorService?: DominantColorService;
  private _colorService?: ColorService;
  private _zyrotecDashComponent?: ZyrotecDashComponent;
  private _zyrotecMediaControls?: ZyrotecMediaControls;

  private _mediaDashTriggerButton!: St.Button;
  private _mediaPopupMenu?: PopupMenu.PopupMenu;
  private _menuManager?: PopupMenu.PopupMenuManager;
  private _mediaMenuItem?: PopupMenu.PopupBaseMenuItem;

  private _handleTriggerButtonClick(): void {
    this._mediaDashTriggerButton.connect('clicked', () => {
      this._mediaPopupMenu?.toggle();
    });
  }

  enable() {
    this._mprisService = new MprisService();
    this._cavaService = new CavaService(this._setCavaConfig());
    this._dominantColorService = new DominantColorService();
    this._colorService = new ColorService();
    this._cavaService.cavaStart();

    this._zyrotecDashComponent = new ZyrotecDashComponent(
      this._mprisService,
      this._dominantColorService,
      this._colorService
    );

    this._zyrotecMediaControls = new ZyrotecMediaControls(
      this._mprisService,
      this._dominantColorService,
      this._colorService
    );

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

    this._handleTriggerButtonClick();
  }

  disable() {
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