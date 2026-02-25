import St from "gi://St";
import GLib from "gi://GLib";
import Gio from "gi://Gio";
import Cairo from "cairo";
import { CavaBarColor } from "../types/cava/cava-bar-color.type.js";

const MIN_HEIGHT = 1;
const MIN_ACTIVE_HEIGHT = 3;
const NOISE_FLOOR = 500;
const SILENT_FRAMES_THRESHOLD = 30;
const SILENCE_ZERO_FRAMES = 60;
const ALPHA_RISE = 0.95;
const ALPHA_FALL = 0.6;

export class ZyrotecAudioVisualizer {
    private _audioDrawingArea!: St.DrawingArea;
    private _repaintSignalId?: number;

    private _barCount: number = 14;
    private _prevHeights: number[] = [];
    private _peakValues: number[] = [];
    private _bins: number[] = [];
    private _silentFrames: number = 0;

    private _process: Gio.Subprocess | null = null;
    private _stdout: Gio.InputStream | null = null;
    private _stderr: Gio.InputStream | null = null;
    private _stderrStream: Gio.DataInputStream | null = null;
    private _stdoutCancellable: Gio.Cancellable | null = null;
    private _rawBuffer: Uint8Array = new Uint8Array(8192);
    private _bufferUsed: number = 0;
    private _tmpConfigPath: string | null = null;

    private _audioBarColor: CavaBarColor = {
        red: 255,
        green: 255,
        blue: 255,
        alpha: 1
    };

    private _destroyed: boolean = false;

    constructor(params?: Partial<St.Widget.ConstructorProps>) {
        this._init(params);
    }

    private _init(params?: Partial<St.Widget.ConstructorProps>): void {
        this._prevHeights = new Array(this._barCount).fill(MIN_HEIGHT);
        this._peakValues = new Array(this._barCount).fill(0);
        this._bins = new Array(this._barCount).fill(0);

        this._generateComponent(params);
        this._startCava();
    }

    private _generateComponent(params?: Partial<St.Widget.ConstructorProps>): void {
        this._audioDrawingArea = new St.DrawingArea(params);

        this._repaintSignalId = this._audioDrawingArea.connect(
            'repaint',
            this._onRepaint.bind(this)
        );
    }

    private _startCava(): void {
        if (this._process) return;

        try {
            if (!GLib.find_program_in_path('cava')) return;

            const tmpConfig = `${GLib.get_tmp_dir()}/zyrotec-cava-${GLib.get_monotonic_time()}`;
            const cfg = [
                '[general]',
                `bars = ${this._barCount}`,
                'framerate = 60',
                'autosens = 1',
                '',
                '[input]',
                'method = pulse',
                'source = auto',
                '',
                '[output]',
                'method = raw',
                'bit_format = 16bit',
                'channels = mono',
                'raw_target = /dev/stdout',
            ].join('\n');

            GLib.file_set_contents(tmpConfig, cfg);
            this._tmpConfigPath = tmpConfig;

            this._process = Gio.Subprocess.new(
                ['cava', '-p', tmpConfig],
                Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
            );

            this._stdout = this._process.get_stdout_pipe();
            this._stderr = this._process.get_stderr_pipe();
            this._stdoutCancellable = new Gio.Cancellable();
            this._bufferUsed = 0;

            this._readStdoutBytes();
            this._readStderrLine();
        } catch (e) {}
    }

    private _readStdoutBytes(): void {
        if (!this._stdout) return;

        const readSize = Math.max(4096, this._barCount * 2 * 4);
        this._stdout.read_bytes_async(
            readSize,
            GLib.PRIORITY_DEFAULT,
            this._stdoutCancellable,
            (stream, res) => {
                try {
                    const gbytes = stream!.read_bytes_finish(res);
                    if (!gbytes) return;

                    const chunk = gbytes.get_data ? gbytes.get_data() : null;
                    if (!chunk || chunk.length === 0) {
                        this._readStdoutBytes();
                        return;
                    }

                    // Grow buffer if needed
                    const needed = this._bufferUsed + chunk.length;
                    if (needed > this._rawBuffer.length) {
                        const newBuffer = new Uint8Array(Math.max(needed, this._rawBuffer.length * 2));
                        newBuffer.set(this._rawBuffer.subarray(0, this._bufferUsed));
                        this._rawBuffer = newBuffer;
                    }
                    this._rawBuffer.set(chunk, this._bufferUsed);
                    this._bufferUsed += chunk.length;

                    const frameSize = this._barCount * 2;
                    const totalFrames = Math.floor(this._bufferUsed / frameSize);

                    if (totalFrames > 0) {
                        // Only process the latest frame, skip stale ones
                        const lastFrameOffset = (totalFrames - 1) * frameSize;
                        const dv = new DataView(
                            this._rawBuffer.buffer,
                            this._rawBuffer.byteOffset + lastFrameOffset,
                            frameSize
                        );

                        let maxVal = 1;
                        for (let i = 0; i < this._barCount; i++) {
                            let v = dv.getInt16(i * 2, true);
                            v = v < 0 ? -v : v;
                            this._bins[i] = v;
                            if (v > maxVal) maxVal = v;
                        }

                        // Silence detection
                        if (maxVal < NOISE_FLOOR) {
                            this._silentFrames++;
                        } else {
                            this._silentFrames = 0;
                        }

                        if (this._silentFrames >= SILENCE_ZERO_FRAMES) {
                            for (let i = 0; i < this._barCount; i++) {
                                this._prevHeights[i] = MIN_HEIGHT;
                                this._peakValues[i] = 0;
                            }
                        } else {
                            const invMaxVal = maxVal > 0 ? 1 / maxVal : 0;
                            const totalHeight = this._audioDrawingArea?.get_height() ?? 24;
                            const maxHalfHeight = totalHeight / 2;

                            for (let i = 0; i < this._barCount; i++) {
                                const v = this._bins[i];
                                const norm = v * invMaxVal;

                                let target = Math.max(
                                    MIN_HEIGHT,
                                    Math.round(Math.sqrt(norm) * maxHalfHeight)
                                );

                                if (this._silentFrames === 0 && v > 0 && target < MIN_ACTIVE_HEIGHT) {
                                    target = MIN_ACTIVE_HEIGHT;
                                }

                                const prev = this._prevHeights[i];
                                const alpha = target < prev ? ALPHA_FALL : ALPHA_RISE;
                                const height = Math.round(prev * (1 - alpha) + target * alpha);
                                this._prevHeights[i] = height;

                                // Peak tracking
                                if (height > this._peakValues[i]) {
                                    this._peakValues[i] = height;
                                } else {
                                    this._peakValues[i] -= this._peakValues[i] * 0.06;
                                }
                            }
                        }

                        // Discard all processed frames, keep remainder
                        this._rawBuffer.copyWithin(0, totalFrames * frameSize, this._bufferUsed);
                        this._bufferUsed -= totalFrames * frameSize;

                        // Repaint only when new data arrived
                        this._audioDrawingArea.queue_repaint();
                    }

                    this._readStdoutBytes();
                } catch (e) {}
            }
        );
    }

    private _readStderrLine(): void {
        if (!this._stderr) return;

        if (!this._stderrStream)
            this._stderrStream = new Gio.DataInputStream({ base_stream: this._stderr });

        this._stderrStream.read_line_async(GLib.PRIORITY_DEFAULT, null, (stream, res) => {
            try {
                const [line] = stream!.read_line_finish(res);
                if (line !== null) this._readStderrLine();
            } catch (e) {}
        });
    }

    private _stopCava(): void {
        if (this._stdoutCancellable && !this._stdoutCancellable.is_cancelled()) {
            this._stdoutCancellable.cancel();
        }
        this._stdoutCancellable = null;

        if (this._process) {
            try { this._process.force_exit(); } catch (e) {}
            this._process = null;
        }

        if (this._stderrStream) {
            try { this._stderrStream.close(null); } catch (e) {}
            this._stderrStream = null;
        }

        if (this._stdout) {
            try { this._stdout.close(null); } catch (e) {}
            this._stdout = null;
        }

        if (this._stderr) {
            try { this._stderr.close(null); } catch (e) {}
            this._stderr = null;
        }

        if (this._tmpConfigPath) {
            try {
                const file = Gio.File.new_for_path(this._tmpConfigPath);
                if (file.query_exists(null)) file.delete(null);
            } catch (e) {}
            this._tmpConfigPath = null;
        }

        this._bufferUsed = 0;
    }

    private _onRepaint(): void {
        if (this._destroyed) return;

        const cr = this._audioDrawingArea.get_context();

        const totalWidth = this._audioDrawingArea.get_width();
        const totalHeight = this._audioDrawingArea.get_height();
        if (totalWidth <= 0 || totalHeight <= 0) return;

        // Clear previous frame
        cr.save();
        cr.setOperator(Cairo.Operator.CLEAR);
        cr.paint();
        cr.restore();
        cr.setOperator(Cairo.Operator.OVER);

        const barWidth = 2;
        const gap = 2;
        const totalBarWidth = this._barCount * (barWidth + gap) - gap;
        const offsetX = (totalWidth - totalBarWidth) / 2;
        const centerY = totalHeight / 2;

        const { red, green, blue, alpha } = this._audioBarColor;
        const r = red / 255;
        const g = green / 255;
        const b = blue / 255;

        const isSilent = this._silentFrames >= SILENT_FRAMES_THRESHOLD;

        for (let i = 0; i < this._barCount; i++) {
            const halfHeight = Math.max(MIN_HEIGHT, this._prevHeights[i]);
            const x = offsetX + i * (barWidth + gap);

            // Edge fade for depth
            const edgeFade = 1 - (Math.abs(i - (this._barCount - 1) / 2) / ((this._barCount - 1) / 2)) * 0.35;
            const barAlpha = isSilent ? alpha * edgeFade * 0.3 : alpha * edgeFade;

            // Main bar — grows symmetrically from center
            cr.setSourceRGBA(r, g, b, barAlpha);
            cr.rectangle(x, centerY - halfHeight, barWidth, halfHeight * 2);
            cr.fill();

            if (!isSilent) {
                const peak = Math.max(MIN_HEIGHT, this._peakValues[i]);

                // Top peak line
                cr.setSourceRGBA(r, g, b, barAlpha * 0.55);
                cr.rectangle(x, centerY - peak - 1, barWidth, 1);
                cr.fill();

                // Bottom peak line — mirrored
                cr.rectangle(x, centerY + peak, barWidth, 1);
                cr.fill();
            }
        }

        cr.$dispose();
    }

    public setAudioBarColor(value: CavaBarColor): void {
        this._audioBarColor = { ...value };
    }

    public getComponent(): St.Widget {
        return this._audioDrawingArea;
    }

    public destroy(): void {
        if (this._destroyed) return;
        this._destroyed = true;

        this._stopCava();

        if (this._audioDrawingArea) {
            if (this._repaintSignalId) {
                this._audioDrawingArea.disconnect(this._repaintSignalId);
                this._repaintSignalId = undefined;
            }
            this._audioDrawingArea.destroy();
        }
    }
}