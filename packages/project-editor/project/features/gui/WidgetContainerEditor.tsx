import { toJS } from "mobx";
import { observer } from "mobx-react";

import { Rect, rectContains } from "eez-studio-shared/geometry";

import { isObjectInstanceOf, getProperty } from "eez-studio-shared/model/object";
import { getEezStudioDataFromDragEvent } from "eez-studio-shared/model/clipboard";
import {
    DisplayItem,
    reduceUntilCommonParent,
    TreeObjectAdapter
} from "eez-studio-shared/model/objectAdapter";
import { UIStateStore, DocumentStore } from "eez-studio-shared/model/store";

import { Widget, SelectWidget, ObjectGeometryChange } from "eez-studio-page-editor/widget";
import { TreeNode, createWidgetTree } from "eez-studio-page-editor/widget-tree";

import {
    CanvasEditor,
    CanvasEditorProps,
    CanvasEditorUIState
} from "project-editor/project/features/gui/page-editor/CanvasEditor";

////////////////////////////////////////////////////////////////////////////////

@observer
export class WidgetContainerEditor extends CanvasEditor {
    constructor(props: CanvasEditorProps) {
        super(
            props,
            UIStateStore.getFeatureParam<CanvasEditorUIState>(
                "gui",
                "WidgetContainerEditor",
                new CanvasEditorUIState(1.0)
            ),
            1.0
        );
    }

    createTree() {
        return createWidgetTree(this.props.displaySelection as TreeObjectAdapter, true);
    }

    applyGeometryChanges(geometryChanges: ObjectGeometryChange[]) {
        for (let i = 0; i < geometryChanges.length; i++) {
            let geometryChange = geometryChanges[i];
            let widget = geometryChange.object as Widget;
            widget.applyGeometryChange(geometryChange.changedProperties, geometryChanges);
        }
    }

    getItemsInsideRect(r: Rect) {
        let items: DisplayItem[] = [];

        function findItemsInsideRect(node: TreeNode) {
            if (isObjectInstanceOf(node.item.object, Widget.classInfo)) {
                if (rectContains(r, node.rect)) {
                    items.push(node.item);
                }
            }

            for (let i = 0; i < node.children.length; i++) {
                findItemsInsideRect(node.children[i]);
            }
        }

        findItemsInsideRect(this.tree);

        return reduceUntilCommonParent(this.props.displaySelection, items);
    }

    hitTestFilter(nodes: TreeNode[]): TreeNode[] {
        if (nodes.length > 1) {
            let i = nodes.length - 1;
            while (i > 0 && nodes[i - 1].item.object instanceof SelectWidget) {
                i--;
            }
            return [nodes[i]];
        } else {
            return nodes;
        }
    }

    findSnapLinesFilter(node: TreeNode) {
        let type = (node.item.object as Widget).type;
        return type != "Container" && type != "List" && type != "Select";
    }

    selectAllItems() {
        this.replaceSelection(this.props.displaySelection.children as DisplayItem[]);
    }

    onNodeDoubleClicked(node: TreeNode) {}

    dropItem: TreeNode | undefined;

    onDragEnter(event: any) {
        let data = getEezStudioDataFromDragEvent(event);
        const object = data && data.object;
        if (object) {
            if (
                isObjectInstanceOf(object, Widget.classInfo) &&
                event.dataTransfer.effectAllowed == "copy"
            ) {
                event.preventDefault();
                event.stopPropagation();

                let p = this.mouseToDocument(event.nativeEvent);

                this.props.displaySelection.selectItems([]);

                setTimeout(() => {
                    let rect = {
                        left: Math.round(p.x),
                        top: Math.round(p.y),
                        width: (object as Widget).width,
                        height: (object as Widget).height
                    };

                    let dropItem: TreeNode = {
                        id: object._id,

                        parent: this.tree,
                        children: [],

                        rect: rect,
                        selected: false,
                        selectable: true,
                        movable: true,
                        resizable: true,

                        item: {
                            object: object,
                            selected: false,
                            children: []
                        },

                        image: (object as Widget).draw(rect)
                    };

                    this.tree.children.push(dropItem);

                    this.dropItem = dropItem;

                    this.redraw();
                });
            }
        }
    }

    onDragOver(event: any) {
        if (this.dropItem) {
            event.preventDefault();
            event.stopPropagation();

            let p = this.mouseToDocument(event.nativeEvent);

            this.dropItem.rect.left = Math.round(p.x);
            this.dropItem.rect.top = Math.round(p.y);

            this.redraw();
        }
    }

    onDrop(event: any) {
        if (this.dropItem) {
            let dropItemWidgetObj = toJS(this.dropItem.item.object) as Widget;

            dropItemWidgetObj.x = this.dropItem.rect.left;
            dropItemWidgetObj.y = this.dropItem.rect.top;
            DocumentStore.addObject(
                getProperty(this.props.displaySelection.object, "widgets"),
                dropItemWidgetObj
            );
        }
    }

    onDragLeave(event: any) {
        if (this.dropItem) {
            this.tree.children.splice(this.tree.children.indexOf(this.dropItem), 1);
            this.dropItem = undefined;
            this.redraw();
        }
    }
}
