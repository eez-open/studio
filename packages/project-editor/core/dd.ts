import { observable, action } from "mobx";

import type { IEezObject } from "project-editor/core/object";
import type {
    DocumentStoreClass,
    UndoManager
} from "project-editor/core/store";

////////////////////////////////////////////////////////////////////////////////

interface IDropObject {}

////////////////////////////////////////////////////////////////////////////////

export class DragAndDropManagerClass {
    @observable dragObject: IEezObject | undefined;
    @observable dropObject: IDropObject | undefined;
    DocumentStore: DocumentStoreClass;
    dragItemDeleted: boolean;
    dropEffect: string | undefined;
    blankDragImage: HTMLImageElement;
    unsetDropObjectAndPositionTimeout: any;

    undoManager?: UndoManager;

    constructor() {
        this.blankDragImage = new Image();
        this.blankDragImage.src =
            "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAAYdEVYdFNvZnR3YXJlAHBhaW50Lm5ldCA0LjAuOWwzfk4AAAANSURBVBhXY/j//z8DAAj8Av6IXwbgAAAAAElFTkSuQmCC";
    }

    @action
    start(
        event: any,
        dragObject: IEezObject,
        DocumentStore: DocumentStoreClass
    ) {
        this.dragObject = dragObject;
        this.dragItemDeleted = false;

        this.undoManager = DocumentStore.undoManager;
        this.undoManager.setCombineCommands(true);
    }

    @action
    setDropObject(object: IDropObject) {
        this.dropObject = object;
    }

    @action.bound
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

    deleteDragItem(options?: { dropPlace?: IEezObject }) {
        if (this.dropObject && this.dropEffect == "move") {
            if (this.dragObject) {
                this.undoManager?.DocumentStore.deleteObject(
                    this.dragObject,
                    options
                );
            }
            this.dropEffect = undefined;
            this.dragItemDeleted = true;
        }
    }

    @action
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
