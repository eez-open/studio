import { observable, action, makeObservable } from "mobx";

import type {
    EezObject,
    IEezObject,
    PropertyInfo
} from "project-editor/core/object";
import type { ProjectStore, UndoManager } from "project-editor/store";

////////////////////////////////////////////////////////////////////////////////

interface IDropObject {}

////////////////////////////////////////////////////////////////////////////////

export class DragAndDropManagerClass {
    dragObject: EezObject | undefined;
    dropObject: IDropObject | undefined;
    projectStore: ProjectStore;
    dragItemDeleted: boolean;
    dropEffect: string | undefined;
    blankDragImage: HTMLImageElement;
    unsetDropObjectAndPositionTimeout: any;

    undoManager?: UndoManager;

    constructor() {
        makeObservable(this, {
            dragObject: observable,
            dropObject: observable,
            start: action,
            setDropObject: action,
            unsetDropObject: action.bound,
            end: action
        });

        this.blankDragImage = new Image();
        this.blankDragImage.src =
            "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAAYdEVYdFNvZnR3YXJlAHBhaW50Lm5ldCA0LjAuOWwzfk4AAAANSURBVBhXY/j//z8DAAj8Av6IXwbgAAAAAElFTkSuQmCC";
    }

    start(event: any, dragObject: EezObject, projectStore: ProjectStore) {
        this.dragObject = dragObject;
        this.dragItemDeleted = false;

        this.undoManager = projectStore.undoManager;
        this.undoManager.setCombineCommands(true);
    }

    setDropObject(object: IDropObject) {
        this.dropObject = object;
    }

    unsetDropObject() {
        this.dropObject = undefined;
    }

    drag(event: any) {}

    setDropEffect(event: any) {
        this.dropEffect =
            event.dataTransfer.effectAllowed == "copyMove" && !event.ctrlKey
                ? "move"
                : "copy";
        event.dataTransfer.dropEffect = this.dropEffect;
    }

    deleteDragItem(options?: { dropPlace?: IEezObject | PropertyInfo }) {
        if (this.dropObject && this.dropEffect == "move") {
            if (this.dragObject) {
                this.undoManager?.projectStore.deleteObject(
                    this.dragObject,
                    options
                );
            }
            this.dropEffect = undefined;
            this.dragItemDeleted = true;
        }
    }

    end(event: any) {
        if (!this.dragItemDeleted) {
            this.dropEffect = event.dataTransfer.dropEffect;
            this.deleteDragItem();
        }
        this.dragObject = undefined;
        this.unsetDropObject();

        if (this.undoManager) {
            this.undoManager.setCombineCommands(false);
            this.undoManager = undefined;
        }
    }
}

export let DragAndDropManager: DragAndDropManagerClass;

try {
    DragAndDropManager = new DragAndDropManagerClass();
} catch (err) {
    console.error(err);
}
