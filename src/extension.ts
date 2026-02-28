import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { ZyrotecDashTrigger } from "./ui/zyrotec-dash-trigger.ui.js";

export default class MyExtension extends Extension {
  private _zyrotecDashTrigger!: ZyrotecDashTrigger;

  enable() {
    this._zyrotecDashTrigger = new ZyrotecDashTrigger();

    Main.overview.dash._box.add_child(this._zyrotecDashTrigger);
  }

  disable() {
    this._zyrotecDashTrigger.destroy();
  }
}