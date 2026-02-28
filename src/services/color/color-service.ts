import { HSL } from "../../types/color/hsl.type";
import { RGB } from "../../types/color/rgb.type";

export class ColorService {
    public getLuminanceColor(
        color: RGB,
        luminanceThreshold: number = 0.5,
        adjustmentFactor: number = 0.2
    ): RGB {
        const luminance = this._calculateLuminance(color);

        if (luminance < luminanceThreshold) {
            return this._lighten(color, adjustmentFactor);
        }

        return this._darken(color, adjustmentFactor);
    }

    public getInvertedLuminanceColor(
        baseColor: RGB,
        luminanceSource: RGB,
        minLuminanceDiff: number = 0.35
    ): RGB {

        const baseHsl = this._rgbToHsl(baseColor);
        const sourceHsl = this._rgbToHsl(luminanceSource);

        let newLuminance = 1 - sourceHsl.l;

        let result = this._hslToRgb({
            h: baseHsl.h,
            s: baseHsl.s,
            l: newLuminance
        });

        const sourceLum = this._calculateLuminance(luminanceSource);
        let resultLum = this._calculateLuminance(result);

        const diff = Math.abs(resultLum - sourceLum);

        if (diff < minLuminanceDiff) {

            if (sourceLum > 0.5) {
                newLuminance = Math.max(0, newLuminance - (minLuminanceDiff - diff));
            } else {
                newLuminance = Math.min(1, newLuminance + (minLuminanceDiff - diff));
            }

            result = this._hslToRgb({
                h: baseHsl.h,
                s: baseHsl.s,
                l: newLuminance
            });
        }

        return result;
    }

    private _calculateLuminance(color: RGB): number {
        const normalize = (value: number): number => {
            const v = value / 255;
            return v <= 0.03928
                ? v / 12.92
                : Math.pow((v + 0.055) / 1.055, 2.4);
        };

        const r = normalize(color.r);
        const g = normalize(color.g);
        const b = normalize(color.b);

        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    }

    private _rgbToHsl({ r, g, b }: RGB): HSL {
        r /= 255;
        g /= 255;
        b /= 255;

        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const delta = max - min;

        let h = 0;
        let s = 0;
        const l = (max + min) / 2;

        if (delta !== 0) {
            s = delta / (1 - Math.abs(2 * l - 1));

            switch (max) {
                case r:
                    h = ((g - b) / delta) % 6;
                    break;
                case g:
                    h = (b - r) / delta + 2;
                    break;
                case b:
                    h = (r - g) / delta + 4;
                    break;
            }

            h *= 60;
            if (h < 0) h += 360;
        }

        return { h, s, l };
    }

    private _hslToRgb({ h, s, l }: HSL): RGB {
        const c = (1 - Math.abs(2 * l - 1)) * s;
        const x = c * (1 - Math.abs((h / 60) % 2 - 1));
        const m = l - c / 2;

        let r = 0, g = 0, b = 0;

        if (h < 60) { r = c; g = x; }
        else if (h < 120) { r = x; g = c; }
        else if (h < 180) { g = c; b = x; }
        else if (h < 240) { g = x; b = c; }
        else if (h < 300) { r = x; b = c; }
        else { r = c; b = x; }

        return {
            r: Math.round((r + m) * 255),
            g: Math.round((g + m) * 255),
            b: Math.round((b + m) * 255)
        };
    }

    private _lighten(color: RGB, factor: number): RGB {
        return {
            r: this._clamp(color.r + (255 - color.r) * factor),
            g: this._clamp(color.g + (255 - color.g) * factor),
            b: this._clamp(color.b + (255 - color.b) * factor),
        };
    }

    private _darken(color: RGB, factor: number): RGB {
        return {
            r: this._clamp(color.r * (1 - factor)),
            g: this._clamp(color.g * (1 - factor)),
            b: this._clamp(color.b * (1 - factor)),
        };
    }

    private _clamp(value: number): number {
        return Math.max(0, Math.min(255, Math.round(value)));
    }
}