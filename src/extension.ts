import St from 'gi://St';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

export default class MyExtension extends Extension {
  private label?: St.Label;

  enable() {
    this.label = new St.Label({
      text: "Zyrotec Media Applet"
    });

    (Main.panel as any)._rightBox.add_child(this.label);
  }

  disable() {
    this.label?.destroy();
    this.label = undefined;
  }
}