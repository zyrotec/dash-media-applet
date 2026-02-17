import St from "gi://St";
import GLib from "gi://GLib";
import { CavaService } from "../services/cava/cava-service.js";
import { CavaBarColor } from "../types/cava/cava-bar-color.type.js";

export class ZyrotecAudioVisualizer {
    private _audioDrawingArea!: St.DrawingArea;
    private _audioBars: number[] = [];
    private _audioFrameTick?: number;
    private _peakValues: number[] = new Array(6).fill(0);

    private _lastBeatTime = 0;
    private _beatIntervals: number[] = [];
    private _estimatedBPM = 120;
    private _lowEnergyHistory: number[] = [];

    private _audioBarColor: CavaBarColor = {
        red: 1,
        green: 1,
        blue: 1,
        alpha: 1
    };

    private _destroyed: boolean = false;

    constructor(private _cavaService: CavaService, params?: Partial<St.Widget.ConstructorProps>) {
        this._init();
    }

    private _init(params?: Partial<St.Widget.ConstructorProps>): void {
        this._generateComponent(params);
    }

    private _generateComponent(params?: Partial<St.Widget.ConstructorProps>): void {
        this._audioDrawingArea = new St.DrawingArea(params);
        this._audioDrawingArea.set_size(16, 12);

        this._audioDrawingArea.connect('repaint', this._onRepaint.bind(this));

        this._cavaService.cavaSubscribe(values => {
            this._audioBars = values;
        });

        this._audioFrameTick = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 16, () => {
            if (this._destroyed || !this._audioDrawingArea) {
                return GLib.SOURCE_REMOVE;
            }

            this._audioDrawingArea.queue_repaint();
            return GLib.SOURCE_CONTINUE;
        });
    }

    private _onRepaint() {
        const cr = this._audioDrawingArea.get_context();
        if (!this._audioBars.length) {
            return;
        }

        const totalWidth = 16;
        const totalHeight = 12;
        const bars = 6;

        const barWidth = totalWidth / 9.75;
        const gap = barWidth * 0.75;
        const centerY = totalHeight / 2;

        const usableLength = Math.floor(this._audioBars.length / 2);

        const now = Date.now();

        const { red, blue, green, alpha } = this._audioBarColor;

        let bass = 0;

        for (let i = 0; i < 8; i++) {
            bass += this._audioBars[i] ?? 0;
        }

        bass /= 8;

        this._lowEnergyHistory.push(bass);
        if (this._lowEnergyHistory.length > 20)
            this._lowEnergyHistory.shift();

        const avgBass =
            this._lowEnergyHistory.reduce((a, b) => a + b, 0) /
            this._lowEnergyHistory.length;

        if (bass > avgBass * 1.35 && now - this._lastBeatTime > 250) {

            const interval = now - this._lastBeatTime;
            this._lastBeatTime = now;

            if (interval > 300 && interval < 1500) {
                this._beatIntervals.push(interval);
                if (this._beatIntervals.length > 8)
                    this._beatIntervals.shift();

                const avgInterval =
                    this._beatIntervals.reduce((a, b) => a + b, 0) /
                    this._beatIntervals.length;

                this._estimatedBPM = 60000 / avgInterval;
            }
        }

        for (let i = 0; i < bars; i++) {
            const logMax = Math.log(usableLength + 1);

            const start = Math.floor(
                Math.exp((i / bars) * logMax) - 1
            );

            const end = Math.floor(
                Math.exp(((i + 1) / bars) * logMax) - 1
            );

            let sum = 0;
            let count = 0;

            for (let j = start; j < end; j++) {
                sum += this._audioBars[j] ?? 0;
                count++;
            }

            const raw = count > 0 ? sum / count : 0;

            const lowBoost = 1.2 - (i / bars) * 0.3;
            const weighted = raw * lowBoost;

            const normalized = Math.min(weighted / 100, 1);

            const minHalfHeight = barWidth / 2;
            const maxHalfHeight = totalHeight / 2;

            const halfHeight =
                minHalfHeight +
                normalized * (maxHalfHeight - minHalfHeight);

            const x = i * (barWidth + gap);
            const y = centerY - halfHeight;
            const height = halfHeight * 2;

            cr.setSourceRGBA(red, green, blue, alpha);
            this._roundedRect(
                cr,
                x,
                y,
                barWidth,
                height,
                barWidth / 2
            );
            cr.fill();

            if (halfHeight > this._peakValues[i]) {
                this._peakValues[i] = halfHeight;
            } else {
                this._peakValues[i] -=
                    this._peakValues[i];
            }

            const peakY = centerY - this._peakValues[i];

            cr.setSourceRGBA(red, green, blue, alpha);
            this._roundedRect(
                cr,
                x,
                peakY - 1,
                barWidth,
                2,
                1
            );
            cr.fill();
        }
    }

    private _roundedRect(
        cr: any,
        x: number,
        y: number,
        w: number,
        h: number,
        r: number
    ) {
        cr.newSubPath();
        cr.arc(x + w - r, y + r, r, -Math.PI / 2, 0);
        cr.arc(x + w - r, y + h - r, r, 0, Math.PI / 2);
        cr.arc(x + r, y + h - r, r, Math.PI / 2, Math.PI);
        cr.arc(x + r, y + r, r, Math.PI, 1.5 * Math.PI);
        cr.closePath();
    }

    public setAudioBarColor(value: CavaBarColor): void {
        const redValue = value.red / 255;
        const greeValue = value.green / 255;
        const blueValue = value.blue / 255;

        this._audioBarColor = {
            red: redValue,
            green: greeValue,
            blue: blueValue,
            alpha: value.alpha
        };
    }

    public getComponent(): St.Widget {
        return this._audioDrawingArea;
    }

    public destroy(): void {
        if (this._destroyed) return;
        this._destroyed = true;

        if (this._audioFrameTick)
            GLib.source_remove(this._audioFrameTick);

        if (this._audioDrawingArea) {
            this._audioDrawingArea.destroy();
        }
    }
}