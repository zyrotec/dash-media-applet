import Gio from 'gi://Gio';
import GdkPixbuf from 'gi://GdkPixbuf';
import GLib from 'gi://GLib';
import { RGB } from "../../types/color/rgb.type.js";

export class DominantColorService {
    constructor() { }

    private async _getFileStream(file: Gio.File): Promise<Gio.InputStream | null> {
        return new Promise<Gio.InputStream | null>((resolve, reject) => {
            file.read_async(
                GLib.PRIORITY_DEFAULT,
                null,
                (readFile, result) => {
                    try {
                        if (!readFile) {
                            resolve(null);
                        }

                        resolve(readFile!.read_finish(result));
                    } catch (error) {
                        reject(error);
                    }
                }
            );
        });
    }

    private _getImagePixbuf(imageStream: Gio.InputStream): Promise<GdkPixbuf.Pixbuf> {
        return new Promise<GdkPixbuf.Pixbuf>((resolve, reject) => {
            GdkPixbuf.Pixbuf.new_from_stream_async(
                imageStream,
                null,
                (imageSource, result) => {
                    try {
                        resolve(GdkPixbuf.Pixbuf.new_from_stream_finish(result));
                    } catch (error) {
                        reject(error);
                    }
                }
            );
        });
    }

    public async getDominantColorFromImage(imageUrl: string, sampleStep: number = 8): Promise<RGB | null> {
        try {
            const imageFile = Gio.File.new_for_uri(imageUrl);

            const imageStream = await this._getFileStream(imageFile);

            if (!imageStream) {
                return null;
            }

            const imagePixbuf = await this._getImagePixbuf(imageStream);

            const scaledImagePixbuf = imagePixbuf.scale_simple(
                32,
                32,
                GdkPixbuf.InterpType.BILINEAR
            );

            if (!scaledImagePixbuf)
                return null;

            const imagePixels = scaledImagePixbuf.get_pixels();
            const imageChannels = scaledImagePixbuf.get_n_channels();

            let redTotal = 0;
            let greenTotal = 0;
            let blueTotal = 0;
            let count = 0;

            for (let i = 0; i < imagePixels.length; i += imageChannels * sampleStep) {
                const red = imagePixels[i];
                const green = imagePixels[i + 1];
                const blue = imagePixels[i + 2];

                if (imageChannels === 4) {
                    const alpha = imagePixels[i + 3];
                    if (alpha < 128)
                        continue;
                }

                if (red > 240 && green > 240 && blue > 240)
                    continue;

                if (red < 15 && green < 15 && blue < 15)
                    continue;

                redTotal += red;
                greenTotal += green;
                blueTotal += blue;
                count++;
            }

            if (count === 0)
                return null;

            return {
                r: Math.round(redTotal / count),
                g: Math.round(greenTotal / count),
                b: Math.round(blueTotal / count)
            };
        } catch (error) {
            logError(error);
            return null;
        }
    }
}