import type { Page } from "project-editor/features/page/page";
import type { Widget } from "project-editor/flow/component";
import type { EasingFunction } from "project-editor/flow/timeline";
import type { Assets, DataBuffer } from "project-editor/build/assets";
import { ProjectEditor } from "project-editor/project-editor-interface";

export function buildWidget(
    object: Widget | Page,
    assets: Assets,
    dataBuffer: DataBuffer
) {
    // type
    dataBuffer.writeUint16(object.getWidgetType());

    // data
    let data = 0;
    if (object instanceof ProjectEditor.WidgetClass) {
        data = assets.getWidgetDataItemIndex(object, "data");
    }
    dataBuffer.writeInt16(data);

    // visible
    let visible = 0;
    if (object instanceof ProjectEditor.WidgetClass) {
        visible = assets.getWidgetDataItemIndex(object, "visible");
    }
    dataBuffer.writeInt16(visible);

    // action
    let action: number = 0;
    if (object instanceof ProjectEditor.WidgetClass) {
        action = assets.getWidgetActionIndex(object, "action");
    }
    dataBuffer.writeInt16(action);

    // x
    dataBuffer.writeInt16(object.left || 0);

    // y
    dataBuffer.writeInt16(object.top || 0);

    // width
    dataBuffer.writeInt16(object.width || 0);

    // height
    dataBuffer.writeInt16(object.height || 0);

    // style
    dataBuffer.writeInt16(assets.getStyleIndex(object, "style"));

    // flags
    let flags = 0;
    if (object instanceof ProjectEditor.WidgetClass) {
        if (object.resizing) {
            flags |= object.resizing.pinToEdge;
            flags |= object.resizing.fixSize << 4;
        }
    }
    dataBuffer.writeUint16(flags);

    // timeline
    if (object instanceof ProjectEditor.WidgetClass) {
        dataBuffer.writeArray(object.timeline, keyframe => {
            keyframe.build(dataBuffer);
        });
    } else {
        dataBuffer.writeArray([], keyframe => {});
    }

    // specific
    object.buildFlowWidgetSpecific(assets, dataBuffer);
}

export function getEasingFunctionCode(easingFunction: EasingFunction) {
    const EASING_FUNC_LINEAR = 0;
    const EASING_FUNC_IN_QUAD = 1;
    const EASING_FUNC_OUT_QUAD = 2;
    const EASING_FUNC_IN_OUT_QUAD = 3;
    const EASING_FUNC_IN_CUBIC = 4;
    const EASING_FUNC_OUT_CUBIC = 5;
    const EASING_FUNC_IN_OUT_CUBIC = 6;
    const EASING_FUNC_IN__QUART = 7;
    const EASING_FUNC_OUT_QUART = 8;
    const EASING_FUNC_IN_OUT_QUART = 9;
    const EASING_FUNC_IN_QUINT = 10;
    const EASING_FUNC_OUT_QUINT = 11;
    const EASING_FUNC_IN_OUT_QUINT = 12;
    const EASING_FUNC_IN_SINE = 13;
    const EASING_FUNC_OUT_SINE = 14;
    const EASING_FUNC_IN_OUT_SINE = 15;
    const EASING_FUNC_IN_EXPO = 16;
    const EASING_FUNC_OUT_EXPO = 17;
    const EASING_FUNC_IN_OUT_EXPO = 18;
    const EASING_FUNC_IN_CIRC = 19;
    const EASING_FUNC_OUT_CIRC = 20;
    const EASING_FUNC_IN_OUT_CIRC = 21;
    const EASING_FUNC_IN_BACK = 22;
    const EASING_FUNC_OUT_BACK = 23;
    const EASING_FUNC_IN_OUT_BACK = 24;
    const EASING_FUNC_IN_ELASTIC = 25;
    const EASING_FUNC_OUT_ELASTIC = 26;
    const EASING_FUNC_IN_OUT_ELASTIC = 27;
    const EASING_FUNC_IN_BOUNCE = 28;
    const EASING_FUNC_OUT_BOUNCE = 29;
    const EASING_FUNC_IN_OUT_BOUNCE = 30;

    const toCode = {
        linear: EASING_FUNC_LINEAR,
        easeInQuad: EASING_FUNC_IN_QUAD,
        easeOutQuad: EASING_FUNC_OUT_QUAD,
        easeInOutQuad: EASING_FUNC_IN_OUT_QUAD,
        easeInCubic: EASING_FUNC_IN_CUBIC,
        easeOutCubic: EASING_FUNC_OUT_CUBIC,
        easeInOutCubic: EASING_FUNC_IN_OUT_CUBIC,
        easeInQuart: EASING_FUNC_IN__QUART,
        easeOutQuart: EASING_FUNC_OUT_QUART,
        easeInOutQuart: EASING_FUNC_IN_OUT_QUART,
        easeInQuint: EASING_FUNC_IN_QUINT,
        easeOutQuint: EASING_FUNC_OUT_QUINT,
        easeInOutQuint: EASING_FUNC_IN_OUT_QUINT,
        easeInSine: EASING_FUNC_IN_SINE,
        easeOutSine: EASING_FUNC_OUT_SINE,
        easeInOutSine: EASING_FUNC_IN_OUT_SINE,
        easeInExpo: EASING_FUNC_IN_EXPO,
        easeOutExpo: EASING_FUNC_OUT_EXPO,
        easeInOutExpo: EASING_FUNC_IN_OUT_EXPO,
        easeInCirc: EASING_FUNC_IN_CIRC,
        easeOutCirc: EASING_FUNC_OUT_CIRC,
        easeInOutCirc: EASING_FUNC_IN_OUT_CIRC,
        easeInBack: EASING_FUNC_IN_BACK,
        easeOutBack: EASING_FUNC_OUT_BACK,
        easeInOutBack: EASING_FUNC_IN_OUT_BACK,
        easeInElastic: EASING_FUNC_IN_ELASTIC,
        easeOutElastic: EASING_FUNC_OUT_ELASTIC,
        easeInOutElastic: EASING_FUNC_IN_OUT_ELASTIC,
        easeInBounce: EASING_FUNC_IN_BOUNCE,
        easeOutBounce: EASING_FUNC_OUT_BOUNCE,
        easeInOutBounce: EASING_FUNC_IN_OUT_BOUNCE
    };

    return toCode[easingFunction] ?? EASING_FUNC_LINEAR;
}
