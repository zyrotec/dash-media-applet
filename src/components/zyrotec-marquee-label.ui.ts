import St from 'gi://St';
import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import Pango from 'gi://Pango';
import Cogl from 'gi://Cogl';

export class ZyrotecMarqueeLabel {
    private _marqueeLabel!: St.Widget;
    private _marqueeLabelContainer!: St.BoxLayout;
    private _labelOne!: St.Label;
    private _labelTwo!: St.Label;
    private _labelSpacer!: St.Widget;

    private _marqueeLabelAnimationDelay = 2000;
    private _marqueeLabelScrollSpeed = 50;
    private _labelSpacerGap = 50;

    private _isAnimating: boolean = false;
    private _animationDelaySource: number | null = null;

    constructor(params?: Partial<St.Widget.ConstructorProps>) {
        this._init(params);
    }

    private _init(params?: Partial<St.Widget.ConstructorProps>): void {
        this._generateComponent(params);
        this._handleSignals();
    }

    private _generateComponent(params?: Partial<St.Widget.ConstructorProps>): void {
        this._marqueeLabel = new St.Widget({
            layout_manager: new Clutter.BinLayout(),
            clip_to_allocation: true,
            y_align: Clutter.ActorAlign.CENTER,
            y_expand: false,
            ...params,
        });

        this._marqueeLabelContainer = new St.BoxLayout({
            orientation: Clutter.Orientation.HORIZONTAL,
            y_align: Clutter.ActorAlign.CENTER,
            y_expand: false,
        });

        this._labelOne = new St.Label({
            text: '',
            y_align: Clutter.ActorAlign.CENTER,
        });

        this._labelTwo = new St.Label({
            text: '',
            y_align: Clutter.ActorAlign.CENTER,
        });

        this._labelSpacer = new St.Widget({
            width: this._labelSpacerGap,
            height: 1
        });

        this._labelOne.clutter_text.set_ellipsize(Pango.EllipsizeMode.NONE);
        this._labelOne.clutter_text.set_single_line_mode(true);
        this._labelOne.clutter_text.set_line_wrap(false);

        this._labelTwo.clutter_text.set_ellipsize(Pango.EllipsizeMode.NONE);
        this._labelTwo.clutter_text.set_single_line_mode(true);
        this._labelTwo.clutter_text.set_line_wrap(false);

        this._marqueeLabelContainer.add_child(this._labelOne);
        this._marqueeLabelContainer.add_child(this._labelSpacer);
        this._marqueeLabelContainer.add_child(this._labelTwo);

        this._marqueeLabel.add_child(this._marqueeLabelContainer);
    }

    private _handleSignals(): void {
        if (!this._marqueeLabel) {
            return;
        }

        this._marqueeLabel.connect('notify::allocation', () => {
            this._checkMarqueeLabelOverflow();
        });
    }

    private _getLabelWidth(): number {
        const [, natural] = this._labelOne.get_preferred_width(-1);
        return natural;
    }

    private _checkMarqueeLabelOverflow(): void {
        if (!this._marqueeLabel.get_stage())
            return;

        const labelWidth = this._getLabelWidth();
        const containerWidth = this._marqueeLabel.width;

        if (labelWidth > containerWidth) {
            this._startMarqueeAnimation();
            this._labelTwo.visible = true;
            this._labelSpacer.visible = true;
        } else {
            this._stopMarqueeAnimation();
            this._marqueeLabelContainer.set_x(0);
            this._labelTwo.visible = false;
            this._labelSpacer.visible = false;
        }
    }

    private _startMarqueeAnimation(): void {
        if (this._isAnimating)
            return;

        this._isAnimating = true;

        this._animationDelaySource = GLib.timeout_add(
            GLib.PRIORITY_DEFAULT,
            this._marqueeLabelAnimationDelay,
            () => {
                this._animationDelaySource = null;
                this._animate();
                return GLib.SOURCE_REMOVE;
            }
        );
    }

    private _stopMarqueeAnimation(): void {
        this._isAnimating = false;

        if (this._animationDelaySource !== null) {
            GLib.source_remove(this._animationDelaySource);
            this._animationDelaySource = null;
        }

        this._marqueeLabelContainer.remove_all_transitions();
    }

    private _animate(): void {
        const labelWidth = this._getLabelWidth();
        if (!labelWidth)
            return;

        const distance = Math.ceil(labelWidth) + this._labelSpacerGap;
        const duration = (distance / this._marqueeLabelScrollSpeed) * 1000;

        this._marqueeLabelContainer.remove_all_transitions();
        this._marqueeLabelContainer.set_x(0);

        this._marqueeLabelContainer.ease({
            x: -distance,
            duration,
            mode: Clutter.AnimationMode.LINEAR,
            repeatCount: -1,
            onComplete: () => {
                if (!this._isAnimating) {
                    return;
                }

                GLib.timeout_add(GLib.PRIORITY_DEFAULT, 50, () => {
                    if (this._isAnimating)
                        this._animate();
                    return GLib.SOURCE_REMOVE;
                });
            },
        });
    }

    public setText(value: string): void {
        this._labelOne.set_text(value);
        this._labelTwo.set_text(value);

        this._stopMarqueeAnimation();
        this._marqueeLabelContainer.set_x(0);

        GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
            this._checkMarqueeLabelOverflow();
            return GLib.SOURCE_REMOVE;
        });
    }

    public setStyleClass(value: string): void {
        this._marqueeLabel.set_style_class_name(value);
    }

    public setMarqueeScrollSpeed(value: number): void {
        this._marqueeLabelScrollSpeed = value;
    }

    public setLabelSpacerGap(value: number): void {
        this._labelSpacerGap = value;
        this._labelSpacer.width = value;
    }

    public setMarqueeAnimationDelay(value: number): void {
        this._marqueeLabelAnimationDelay = value;
    }

    public setWidth(value: number): void {
        this._marqueeLabel.set_width(value);
        this._marqueeLabelContainer.set_width(value);
    }

    public getComponent(): St.Widget {
        return this._marqueeLabel;
    }

    public destroy(): void {
        this._stopMarqueeAnimation();
        this._marqueeLabel.destroy();
    }
}