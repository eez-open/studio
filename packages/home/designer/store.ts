import { computed, runInAction, values } from "mobx";

const { Menu, MenuItem } = EEZStudio.electron.remote;

import {
    Rect,
    Point,
    BoundingRectBuilder,
    pointInRect,
    isRectInsideRect
} from "eez-studio-shared/geometry";
import { beginTransaction, commitTransaction } from "eez-studio-shared/store";
import { humanize } from "eez-studio-shared/string";

import { extensionsToolbarButtons } from "eez-studio-shared/extensions/extensions";

import { BOUNCE_ENTRANCE_TRANSITION_DURATION } from "eez-studio-ui/transitions";

import {
    IBaseObject,
    IDocument,
    IContextMenu,
    IContextMenuItem,
    IContextMenuPopupOptions
} from "eez-studio-designer/designer-interfaces";

import {
    store,
    workbenchObjects,
    findWorkbenchObjectById,
    deleteWorkbenchObject,
    WorkbenchObject
} from "home/store";

////////////////////////////////////////////////////////////////////////////////

export interface IWorkbenchObject extends IBaseObject {
    oid: string;

    content: JSX.Element | null;
    details: JSX.Element | null;

    setBoundingRect(rect: Rect): void;

    isEditable: boolean;
    openEditor?(target: "tab" | "window" | "default"): void;

    saveRect(): void;
}

////////////////////////////////////////////////////////////////////////////////

class WorkbenchDocument implements IDocument {
    @computed
    get objects() {
        return Array.from(workbenchObjects.values());
    }

    @computed
    get selectedObjects() {
        return values(workbenchObjects).filter(object => object.selected);
    }

    @computed
    get boundingRect() {
        let boundingRectBuilder = new BoundingRectBuilder();

        for (let i = 0; i < this.objects.length; i++) {
            boundingRectBuilder.addRect(this.objects[i].rect);
        }

        return boundingRectBuilder.getRect();
    }

    selectObject(object: IWorkbenchObject) {
        runInAction(() => (object.selected = true));
    }

    selectObjectsInsideRect(rect: Rect) {
        for (let i = 0; i < this.objects.length; i++) {
            let object = this.objects[i];
            runInAction(() => (object.selected = isRectInsideRect(object.rect, rect)));
        }
    }

    deleteSelectedObjects() {
        if (this.selectedObjects.length > 0) {
            beginTransaction("Delete workbench items");
        } else {
            beginTransaction("Delete workbench item");
        }

        this.selectedObjects.forEach(object => deleteWorkbenchObject(object as WorkbenchObject));

        commitTransaction();
    }

    @computed
    get toolbarButtons() {
        return extensionsToolbarButtons.get();
    }

    createObject(params: any) {
        let objectId = store.createObject(params);
        setTimeout(() => {
            let object = findWorkbenchObjectById(objectId);
            if (object) {
                this.selectObject(object);
            }
        }, BOUNCE_ENTRANCE_TRANSITION_DURATION);
    }

    objectFromPoint(point: Point) {
        let objects = this.objects;
        for (let i = objects.length - 1; i >= 0; i--) {
            let object = objects[i];
            if (pointInRect(point, object.rect)) {
                return object;
            }
        }

        return undefined;
    }

    get selectedObjectsBoundingRect() {
        let boundingRectBuilder = new BoundingRectBuilder();

        for (let i = 0; i < this.selectedObjects.length; i++) {
            boundingRectBuilder.addRect(this.selectedObjects[i].boundingRect);
        }

        return boundingRectBuilder.getRect();
    }

    get selectionResizable() {
        for (let i = 0; i < this.selectedObjects.length; i++) {
            if (!this.selectedObjects[i].isResizable) {
                return false;
            }
        }
        return true;
    }

    deselectAllObjects() {
        runInAction(() => {
            this.selectedObjects.forEach(object => (object.selected = false));
        });
    }

    onDragStart(op: "move" | "resize"): void {}

    onDragEnd(op: "move" | "resize", changed: boolean): void {
        if (changed) {
            let objects = this.selectedObjects;

            if (objects.length > 0) {
                beginTransaction(`${humanize(op)} workbench items`);
            } else {
                beginTransaction(`${humanize(op)} workbench item`);
            }

            for (let i = 0; i < objects.length; i++) {
                objects[i].saveRect();
            }

            commitTransaction();
        }
    }

    createContextMenu(): IContextMenu {
        const menu = new Menu();

        if (this.selectedObjects.length === 1) {
            const object = this.selectedObjects[0] as IWorkbenchObject;

            if (object.isEditable) {
                menu.append(
                    new MenuItem({
                        label: "Open in Tab",
                        click: () => {
                            object.openEditor!("tab");
                        }
                    })
                );

                menu.append(
                    new MenuItem({
                        label: "Open in Window",
                        click: () => {
                            object.openEditor!("window");
                        }
                    })
                );

                menu.append(
                    new MenuItem({
                        type: "separator"
                    })
                );
            }
        }

        return {
            appendMenuItem: (menuItem: IContextMenuItem) => {
                menu.append(new MenuItem(menuItem));
            },
            popup: (options: IContextMenuPopupOptions) => {
                menu.popup(options);
            }
        };
    }
}

////////////////////////////////////////////////////////////////////////////////

export const workbenchDocument = new WorkbenchDocument();
