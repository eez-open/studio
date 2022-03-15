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

    // specific
    object.buildFlowWidgetSpecific(assets, dataBuffer);
}
