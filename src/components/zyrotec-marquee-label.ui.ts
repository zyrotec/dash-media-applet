import St from 'gi://St';
import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import Pango from 'gi://Pango';

export class ZyrotecMarqueeLabel {
    private _marqueeWidget!: St.Widget;
    private _marqueeBox!: St.BoxLayout;
    private _labelOne!: St.Label;
    private _labelTwo!: St.Label;
    private _labelSpacer!: St.Widget;

    private _marqueeLabelAnimationDelay: number = 2000;
    private _marqueeLabelScrollSpeed: number = 50;
    private _labelSpacerGap: number = 50;

    private _isAnimating: boolean = false;
    private _animationDelaySource: number | null = null;
    private _overflowCheckSource: number | null = null;

    private _xAlign: Clutter.ActorAlign = Clutter.ActorAlign.START;
    private _yAlign: Clutter.ActorAlign = Clutter.ActorAlign.CENTER;

    constructor(params?: Partial<St.Widget.ConstructorProps>) {
        this._init(params);
    }

    private _init(params?: Partial<St.Widget.ConstructorProps>): void {
        this._generateComponent(params);
        this._handleSignals();
    }

    private _generateComponent(params?: Partial<St.Widget.ConstructorProps>): void {
        this._marqueeWidget = new St.Widget({
            layout_manager: new Clutter.BinLayout(),
            clip_to_allocation: true,
            yAlign: Clutter.ActorAlign.CENTER,
            ...params,
        });

        // _marqueeBox fills full width of the widget so x_align on labelOne works
        this._marqueeBox = new St.BoxLayout({
            orientation: Clutter.Orientation.HORIZONTAL,
            yAlign: Clutter.ActorAlign.CENTER,
            x_align: Clutter.ActorAlign.FILL,
            x_expand: true,
            y_expand: false,
        });

        this._labelOne = new St.Label({
            text: '',
            yAlign: Clutter.ActorAlign.CENTER,
            x_align: Clutter.ActorAlign.START,
            x_expand: true,
        });

        this._labelTwo = new St.Label({
            text: '',
            yAlign: Clutter.ActorAlign.CENTER,
            x_align: Clutter.ActorAlign.START,
            x_expand: false,
            visible: false,
        });

        this._labelSpacer = new St.Widget({
            width: this._labelSpacerGap,
            height: 1,
            visible: false,
        });

        this._labelOne.clutter_text.set_ellipsize(Pango.EllipsizeMode.NONE);
        this._labelOne.clutter_text.set_single_line_mode(true);
        this._labelOne.clutter_text.set_line_wrap(false);

        this._labelTwo.clutter_text.set_ellipsize(Pango.EllipsizeMode.NONE);
        this._labelTwo.clutter_text.set_single_line_mode(true);
        this._labelTwo.clutter_text.set_line_wrap(false);

        this._marqueeBox.add_child(this._labelOne);
        this._marqueeBox.add_child(this._labelSpacer);
        this._marqueeBox.add_child(this._labelTwo);

        this._marqueeWidget.add_child(this._marqueeBox);
    }

    private _handleSignals(): void {
        this._marqueeWidget.connect('notify::allocation', () => {
            this._scheduleOverflowCheck();
        });
    }

    private _scheduleOverflowCheck(): void {
        if (this._overflowCheckSource !== null) {
            return;
        }

        this._overflowCheckSource = GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
            this._overflowCheckSource = null;
            this._checkMarqueeLabelOverflow();
            return GLib.SOURCE_REMOVE;
        });
    }

    private _getLabelWidth(): number {
        const [, natural] = this._labelOne.get_preferred_width(-1);
        return natural;
    }

    private _getWidgetWidth(): number {
        return this._marqueeWidget.width;
    }

    private _applyStaticAlignment(): void {
        this._labelOne.set_x_align(this._xAlign);
        this._marqueeBox.set_x(0);
    }

    private _checkMarqueeLabelOverflow(): void {
        if (!this._marqueeWidget.get_stage()) {
            return;
        }

        const labelWidth = this._getLabelWidth();
        const widgetWidth = this._getWidgetWidth();

        if (labelWidth > widgetWidth) {
            this._labelTwo.visible = true;
            this._labelSpacer.visible = true;
            // For marquee: labelOne must not expand, so the box scrolls naturally
            this._labelOne.set_x_expand(false);
            this._labelOne.set_x_align(Clutter.ActorAlign.START);
            this._startMarqueeAnimation();
        } else {
            this._labelTwo.visible = false;
            this._labelSpacer.visible = false;
            this._stopMarqueeAnimation();
            // Restore expand so alignment works
            this._labelOne.set_x_expand(true);
            this._applyStaticAlignment();
        }
    }

    private _startMarqueeAnimation(): void {
        if (this._isAnimating) {
            return;
        }

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

        this._marqueeBox.remove_all_transitions();
    }

    private _animate(): void {
        if (!this._isAnimating) {
            return;
        }

        const labelWidth = this._getLabelWidth();
        if (!labelWidth) {
            return;
        }

        const distance = Math.ceil(labelWidth) + this._labelSpacerGap;
        const duration = (distance / this._marqueeLabelScrollSpeed) * 1000;

        this._marqueeBox.remove_all_transitions();
        this._marqueeBox.set_x(0);

        this._marqueeBox.ease({
            x: -distance,
            duration,
            mode: Clutter.AnimationMode.LINEAR,
            repeatCount: -1,
        });
    }

    public setText(value: string): void {
        this._labelOne.set_text(value);
        this._labelTwo.set_text(value);

        this._stopMarqueeAnimation();
        this._labelOne.set_x_expand(true);
        this._applyStaticAlignment();
        this._scheduleOverflowCheck();
    }

    public setStyleClass(value: string): void {
        this._marqueeWidget.set_style_class_name(value);
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
        this._marqueeWidget.set_width(value);
    }

    public setMaxWidth(value: number): void {
        let minWidth = -1;

        if(this._getLabelWidth() > value) {
            minWidth = this._getLabelWidth();
        } else {
            minWidth = -1;
        }

        this._marqueeWidget.set_width(Math.min(minWidth, value));
    }

    public setAlignment(xAlign: Clutter.ActorAlign = Clutter.ActorAlign.START, yAlign: Clutter.ActorAlign = Clutter.ActorAlign.CENTER): void {
        this._xAlign = xAlign;
        this._yAlign = yAlign;
        this._marqueeWidget.set_y_align(yAlign);

        if (!this._isAnimating) {
            this._labelOne.set_x_expand(true);
            this._applyStaticAlignment();
        }
    }

    public getComponent(): St.Widget {
        return this._marqueeWidget;
    }

    public destroy(): void {
        if (this._overflowCheckSource !== null) {
            GLib.source_remove(this._overflowCheckSource);
            this._overflowCheckSource = null;
        }

        this._stopMarqueeAnimation();
        this._marqueeWidget.destroy();
    }
}