import Gio from "gi://Gio";
import GLib from "gi://GLib";
import { Environment } from "../../environment/environment.js";

export class MprisPlayerUtil {
    private _mprisBusName!: string;
    private _mprisPlayerProxy!: Gio.DBusProxy;
    private _mprisLastActivityTime!: number;
    private _propertiesChangedId: number | null = null;

    constructor(mprisBusName: string, mprisPlayerProxy: Gio.DBusProxy) {
        this.setMprisBusName(mprisBusName);
        this.setMprisPlayerProxy(mprisPlayerProxy);
        this.setMprisLastActivityTime(Date.now());
    }

    public connectSignals(callback: (player: MprisPlayerUtil, changed: GLib.Variant) => void): void {
        this._propertiesChangedId = this._mprisPlayerProxy.connect(
            Environment.G_PROPERTIES_CHANGED,
            (_proxy: Gio.DBusProxy, changed: GLib.Variant) => {
                this.setMprisLastActivityTime(Date.now());
                callback(this, changed);
            }
        );
    }

    //Setters
    public setMprisBusName(value: string): void {
        this._mprisBusName = value;;
    }

    public setMprisPlayerProxy(value: Gio.DBusProxy): void {
        this._mprisPlayerProxy = value;
    }

    public setMprisLastActivityTime(value: number): void {
        this._mprisLastActivityTime = value;
    }

    //Getters
    public getMprisBusName(): string {
        return this._mprisBusName;
    }

    public getMprisPlayerProxy(): Gio.DBusProxy {
        return this._mprisPlayerProxy;
    }

    public getMprisLastActivityTime(): number {
        return this._mprisLastActivityTime;
    }

    public getMprisPlayerIdentity(): string {
        const parts = this._mprisBusName.split('.');
        if (parts.length >= 4) {
            const name = parts[3];
            return name.charAt(0).toUpperCase() + name.slice(1);
        }
        return this._mprisBusName;
    }

    //Destroy
    public disconnect(): void {
        if (this._propertiesChangedId && this._mprisPlayerProxy) {
            this._mprisPlayerProxy.disconnect(this._propertiesChangedId);
            this._propertiesChangedId = null;
        }
    }
}