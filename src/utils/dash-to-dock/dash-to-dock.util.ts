import Gio from 'gi://Gio';
import St from 'gi://St';
import GLib from 'gi://GLib';
import Clutter from 'gi://Clutter';
import * as Main from "resource:///org/gnome/shell/ui/main.js";

export class DashToDockUtil {
    private _dockActor: Clutter.Actor | null = null;
    private _d2dAvailable: boolean = false;
    private _dash: any = null;

    constructor() {
        this._initDockActor();
    }

    private _initDockActor(): void {
        try {
            const stage = global.stage as Clutter.Actor;
            this._dockActor = this._findActorByName(stage, 'dashtodockBox');
            this._d2dAvailable = this._dockActor !== null;

            const container = this._findActorByName(stage, 'dashtodockContainer');
            this._dash = (container as any)?.dash ?? null;
        } catch (error) {
            this._d2dAvailable = false;
            logError(error);
        }
    }

    private _findActorByName(root: Clutter.Actor, name: string): Clutter.Actor | null {
        if (root.name === name) return root;
        for (const child of root.get_children()) {
            const found = this._findActorByName(child, name);
            if (found) return found;
        }
        return null;
    }

    public pinDock(): void {
        if (!this._d2dAvailable) return;
        if (!this._dockActor) this._initDockActor();
        try {
            (<St.BoxLayout>this._dockActor)?.set_hover(true);
            if (this._dash) {
                this._dash.emit('menu-opened');
            };
        } catch (error) {
            logError(error);
        }
    }

    public unpinDock(): void {
        if (!this._d2dAvailable) return;
        try {
            if (this._dash) this._dash.emit('menu-closed');
        } catch (error) {
            logError(error);
        }
    }

    public destroy(): void {
        this.unpinDock();
        this._dockActor = null;
    }
}