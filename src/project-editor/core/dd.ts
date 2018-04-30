import { observable, action } from "mobx";

import { UndoManager, deleteObject } from "project-editor/core/store";
import { EezObject } from "project-editor/core/metaData";

////////////////////////////////////////////////////////////////////////////////

export enum DropPosition {
    DROP_NONE,
    DROP_BEFORE,
    DROP_INSIDE
}

////////////////////////////////////////////////////////////////////////////////

class DragAndDropManagerClass {
    @observable dragObject: EezObject | undefined;
    @observable dropObject: any | undefined;
    @observable dropPosition: DropPosition | undefined;
    dragItemDeleted: boolean;
    dropEffect: string | undefined;
    blankDragImage: HTMLImageElement;
    timeoutID: any;

    constructor() {
        this.blankDragImage = new Image();
        this.blankDragImage.src =
            "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAAYdEVYdFNvZnR3YXJlAHBhaW50Lm5ldCA0LjAuOWwzfk4AAAANSURBVBhXY/j//z8DAAj8Av6IXwbgAAAAAElFTkSuQmCC";
    }

    @action
    start(event: any, dragObject: EezObject) {
        this.dragObject = dragObject;
        this.dragItemDeleted = false;

        UndoManager.setCombineCommands(true);
    }

    @action
    setDropObjectAndPosition(object: any, position: DropPosition) {
        this.dropObject = object;
        this.dropPosition = position;
    }

    @action
    unsetDropObjectAndPosition() {
        this.dropObject = undefined;
        this.dropPosition = undefined;
    }

    drag(event: any) {}

    setDropEffect(event: any) {
        this.dropEffect =
            event.dataTransfer.effectAllowed == "copyMove" && !event.ctrlKey ? "move" : "copy";
        event.dataTransfer.dropEffect = this.dropEffect;
    }

    deleteDragItem() {
        if (this.dropEffect == "move") {
            if (this.dragObject) {
                deleteObject(this.dragObject);
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

        this.unsetDropObjectAndPosition();

        UndoManager.setCombineCommands(false);
    }

    delayedOnDragOver(callback: () => void) {
        if (this.timeoutID) {
            clearTimeout(this.timeoutID);
        }
        this.timeoutID = setTimeout(() => {
            this.timeoutID = undefined;
            callback();
        });
    }
}

export let DragAndDropManager = new DragAndDropManagerClass();
