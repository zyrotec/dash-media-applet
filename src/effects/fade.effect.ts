import Clutter from "gi://Clutter";
import GObject from 'gi://GObject';

const _fadeStore = new Map<number, { fadePixels: number; }>();
let _fadeNextId = 0;

export class FadeEffectBase extends Clutter.ShaderEffect {
    private _id: number = 0;

    _init(): void {
        super._init({ 'shader-type': 1 });
        this._id = _fadeNextId++;
        _fadeStore.set(this._id, { fadePixels: 32 });

        this.set_shader_source(`
            uniform sampler2D tex;
            uniform float width;
            uniform float height;
            uniform float fade_pixels;

            void main(void) {
                vec2 uv = cogl_tex_coord_in[0].xy;
                vec4 color = texture2D(tex, uv);

                float pos_x = uv.x * width;

                float left_alpha = smoothstep(0.0, fade_pixels, pos_x);
                float right_alpha = smoothstep(0.0, fade_pixels, width - pos_x);

                float alpha = min(left_alpha, right_alpha);

                cogl_color_out = vec4(color.rgb * alpha, color.a * alpha);
            }
        `);
    }

    setFadePixels(fadePixels: number): void {
        _fadeStore.set(this._id, { fadePixels });
    }

    vfunc_paint_target(paintNode: Clutter.PaintNode, paintContext: Clutter.PaintContext): void {
        const actor = this.get_actor();
        if (actor) {
            const { fadePixels } = _fadeStore.get(this._id)!;

            const set = (name: string, val: number) => {
                const v = new GObject.Value();
                v.init(GObject.TYPE_FLOAT);
                v.set_float(val);
                this.set_uniform_value(name, v);
            };

            set('width', actor.get_width());
            set('height', actor.get_height());
            set('fade_pixels', fadePixels);
        }
        super.vfunc_paint_target(paintNode, paintContext);
    }
}

export const FadeEffect = GObject.registerClass(
    { GTypeName: 'FadeEffect' },
    FadeEffectBase
);
export type FadeEffect = InstanceType<typeof FadeEffectBase>;