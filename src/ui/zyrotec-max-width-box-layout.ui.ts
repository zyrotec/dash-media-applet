import GObject from 'gi://GObject';
import St from "gi://St";

class ZyrotecMaxWidthBoxLayoutBase extends St.BoxLayout {
    private _maxWidth!: number;

    constructor(params?: Partial<St.BoxLayout.ConstructorProps>) {
        super(params);
    }

    public setMaxWidth(value: number): void {
        this._maxWidth = value;
    }

    vfunc_get_preferred_width(forHeight: number): [number, number] {
        const [min, nat] = super.vfunc_get_preferred_width(forHeight);

        if (!this._maxWidth)
            return [min, nat];

        const max = this._maxWidth;

        return [
            Math.min(min, max),
            Math.min(nat, max),
        ];
    }
}

export const ZyrotecMaxWidthBoxLayout = GObject.registerClass(
    { GTypeName: 'ZyrotecMaxWidthBoxLayout' },
    ZyrotecMaxWidthBoxLayoutBase
);
export type ZyrotecMaxWidthBoxLayout = InstanceType<typeof ZyrotecMaxWidthBoxLayoutBase>;