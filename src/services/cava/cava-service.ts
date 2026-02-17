
import St from "gi://St";
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import { CavaCallback } from '../../types/cava/cava-callback.type.js';

export class CavaService {
    private _cavaProcess?: Gio.Subprocess;
    private _cavaStdout?: Gio.DataInputStream;
    private _callbacks: Set<CavaCallback> = new Set();
    private _isServiceRunning: boolean = false;

    constructor(private configPath: string) {

    }

    public cavaStart(): void {
        if (this._isServiceRunning) {
            return;
        }

        this._cavaProcess = new Gio.Subprocess({
            argv: ['cava', '-p', this.configPath],
            flags: Gio.SubprocessFlags.STDOUT_PIPE,
        });

        this._cavaProcess.init(null);

        this._cavaStdout = new Gio.DataInputStream({
            base_stream: this._cavaProcess.get_stdout_pipe() ?? undefined,
        });

        this._isServiceRunning = true;
        this._readLoop();
    }

    public cavaStop(): void {
        this._isServiceRunning = false;

        if (this._cavaProcess) {
            this._cavaProcess.force_exit();
            this._cavaProcess = undefined;
        }
    }

    public cavaSubscribe(callback: CavaCallback): void {
        this._callbacks.add(callback);
    }

    public cavaUnsubscribe(callback: CavaCallback): void {
        this._callbacks.delete(callback);
    }

    private _emitCallbacks(values: number[]) {
        for (const callback of this._callbacks) {
            callback(values);
        }

    }

    private _readLoop(): void {
        if (!this._cavaStdout || !this._isServiceRunning) {
            return;
        }

        this._cavaStdout.read_line_async(
            0,
            null,
            (stream, result) => {
                if (!this._isServiceRunning) {
                    return;
                }

                try {
                    if (!stream) {
                        return;
                    }

                    const [line] = stream.read_line_finish(result);

                    if (line) {
                        const values = new TextDecoder()
                            .decode(line)
                            .trim()
                            .split(";")
                            .map(Number);

                        this._emitCallbacks(values);
                    }

                } catch (error) {
                    logError(error);
                }

                this._readLoop();
            }
        );
    }
}