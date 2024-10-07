import { guid } from "eez-studio-shared/guid";
import { action, computed, makeObservable } from "mobx";
import { getParent, IEezObject } from "project-editor/core/object";
import { getProjectStore, getAncestorOfType } from "project-editor/store";
import { Component } from "project-editor/flow/component";
import type { TreeObjectAdapter } from "project-editor/core/objectAdapter";
import { Transform } from "project-editor/flow/editor/transform";
import { IEditorState } from "project-editor/project/ui/EditorComponent";
import { PageTimelineEditorState } from "project-editor/features/page/PageTimeline";
import { ConnectionLine } from "project-editor/flow/connection-line";
import { Flow } from "project-editor/flow/flow";

////////////////////////////////////////////////////////////////////////////////

export abstract class FlowTabState implements IEditorState {
    containerId = guid();

    constructor(public flow: Flow) {
        makeObservable(this, {
            flowState: computed,
            projectStore: computed,
            isRuntime: computed,
            resetTransform: action,
            selectedObject: computed,
            selectedObjects: computed,
            selectObject: action,
            selectObjects: action
        });
    }

    get flowState() {
        if (this.projectStore.runtime) {
            return this.projectStore.runtime.getFlowState(this.flow);
        }
        return undefined;
    }

    get projectStore() {
        return getProjectStore(this.flow);
    }

    get isRuntime() {
        return !!this.projectStore.runtime;
    }

    get timeline(): PageTimelineEditorState | undefined {
        return undefined;
    }

    abstract get widgetContainer(): TreeObjectAdapter;

    abstract get transform(): Transform;
    abstract set transform(transform: Transform);

    resetTransform(transform?: Transform) {
        if (!transform) {
            transform = this.transform;
        }
        transform.scale = 1;
        transform.translate = {
            x: -this.flow.pageRect.width / 2,
            y: -this.flow.pageRect.height / 2
        };
    }

    centerView(transform?: Transform) {
        if (!transform) {
            transform = this.transform;
        }
        transform.translate = {
            x: -(this.flow.pageRect.width * transform.scale) / 2,
            y: -(this.flow.pageRect.height * transform.scale) / 2
        };
    }

    abstract get frontFace(): boolean;
    abstract set frontFace(value: boolean);

    get selectedObject(): IEezObject | undefined {
        return this.widgetContainer.selectedObject || this.flow;
    }

    get selectedObjects() {
        return this.widgetContainer.selectedObjects;
    }

    selectObject(object: IEezObject) {
        let ancestor: IEezObject | undefined;
        for (ancestor = object; ancestor; ancestor = getParent(ancestor)) {
            let item = this.widgetContainer.getObjectAdapter(ancestor);
            if (item) {
                this.widgetContainer.selectItems([item]);
                return;
            }
        }
    }

    selectObjects(objects: IEezObject[]) {
        const items = [];

        for (let i = 0; i < objects.length; i++) {
            const object = objects[i];

            let ancestor: IEezObject | undefined;
            for (ancestor = object; ancestor; ancestor = getParent(ancestor)) {
                let item = this.widgetContainer.getObjectAdapter(ancestor);
                if (item) {
                    items.push(item);
                    break;
                }
            }
        }

        this.widgetContainer.selectItems(items);
    }

    static ensureSelectionVisibleState:
        | {
              startTime: number;
              intervalId: NodeJS.Timer;
              el: HTMLElement | null;
              flowTabState: FlowTabState;
              objects: IEezObject[];
          }
        | undefined;

    selectObjectsAndEnsureVisible = (objects: IEezObject[]) => {
        if (
            objects.length == 1 &&
            !(
                objects[0] instanceof Component ||
                objects[0] instanceof ConnectionLine
            )
        ) {
            const object = getAncestorOfType(objects[0], Component.classInfo);
            if (object) {
                objects = [object];
            }
        }

        if (this.frontFace) {
            this.frontFace = false;
        }

        let state = FlowTabState.ensureSelectionVisibleState;
        if (state) {
            clearInterval(state.intervalId);
            FlowTabState.ensureSelectionVisibleState = undefined;
        }

        const intervalId = setInterval(() => {
            const state = FlowTabState.ensureSelectionVisibleState;
            if (!state) {
                return;
            }

            let objectsAreSelected: boolean = true;
            if (this.selectedObjects.length != state.objects.length) {
                objectsAreSelected = false;
            } else {
                for (let i = 0; i < state.objects.length; i++) {
                    if (this.selectedObjects.indexOf(state.objects[i]) == -1) {
                        objectsAreSelected = false;
                        break;
                    }
                }
            }

            if (objectsAreSelected) {
                if (state.el == null) {
                    state.el = document.getElementById(this.containerId);
                }

                if (state.el != null) {
                    const event = new Event("ensure-selection-visible");
                    state.el.dispatchEvent(event);
                }
            } else {
                this.selectObjects(state.objects);
            }

            const TIMEOUT = 250;
            if (Date.now() - state.startTime >= TIMEOUT) {
                clearInterval(state.intervalId);
                FlowTabState.ensureSelectionVisibleState = undefined;
            }
        }, 5);

        FlowTabState.ensureSelectionVisibleState = state = {
            startTime: Date.now(),
            intervalId,
            el: null,
            flowTabState: this,
            objects
        };

        this.selectObjects(objects);
    };

    onEnsureSelectionVisibleIsDone() {
        let state = FlowTabState.ensureSelectionVisibleState;
        if (state && state.flowTabState == this) {
            clearInterval(state.intervalId);
            FlowTabState.ensureSelectionVisibleState = undefined;
        }
    }
}
