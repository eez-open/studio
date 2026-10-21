import type { Page } from "project-editor/features/page/page";
import type { Widget } from "project-editor/flow/component";
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

    // position and size in the page layout which is built
    let width;
    let height;
    if (object instanceof ProjectEditor.WidgetClass) {
        width = assets.getPropertyValue(object, "width");
        height = assets.getPropertyValue(object, "height");
    } else {
        const pageLayout = assets.getObjectPageLayout(object);
        width = pageLayout ? pageLayout.width : object.width;
        height = pageLayout ? pageLayout.height : object.height;
    }

    // x
    dataBuffer.writeInt16(assets.getPropertyValue(object, "left") || 0);

    // y
    dataBuffer.writeInt16(assets.getPropertyValue(object, "top") || 0);

    // width
    dataBuffer.writeInt16(width || 0);

    // height
    dataBuffer.writeInt16(height || 0);

    // style
    dataBuffer.writeInt16(assets.getStyleIndex(object, "style"));

    // flags
    let flags = 0;
    if (object instanceof ProjectEditor.WidgetClass) {
        const resizing = assets.getPropertyValue(object, "resizing");
        if (resizing) {
            flags |= resizing.pinToEdge;
            flags |= resizing.fixSize << 4;
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
