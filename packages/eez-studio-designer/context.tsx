import React from "react";
import { observable, computed, action, reaction, runInAction } from "mobx";
import { Provider } from "mobx-react";

import { Rect, Transform, BoundingRectBuilder } from "eez-studio-shared/geometry";

import {
    IBaseObject,
    IDocument,
    IViewState,
    IViewStatePersistantState,
    IDesignerContext,
    IDesignerOptions
} from "eez-studio-designer/designer-interfaces";

////////////////////////////////////////////////////////////////////////////////

class ViewState implements IViewState {
    @observable
    transform = new Transform({
        scale: 1,
        translate: { x: 0, y: 0 }
    });

    @observable
    isIdle: boolean = true;

    @observable
    _selectedObjects: IBaseObject[] = [];

    constructor(
        private document: IDocument,
        viewStatePersistantState: IViewStatePersistantState,
        onSavePersistantState: (viewStatePersistantState: IViewStatePersistantState) => void,
        lastViewState?: ViewState
    ) {
        if (viewStatePersistantState) {
            if (viewStatePersistantState.transform) {
                this.transform.scale = viewStatePersistantState.transform.scale;
                this.transform.translate = viewStatePersistantState.transform.translate;
            }

            if (viewStatePersistantState.selectedObjects) {
                const selectedObjects: IBaseObject[] = [];
                for (const id of viewStatePersistantState.selectedObjects) {
                    const object = document.findObjectById(id);
                    if (object) {
                        selectedObjects.push(object);
                    }
                }
                this._selectedObjects = selectedObjects;
            }
        }

        if (lastViewState) {
            this.transform.clientRect = lastViewState.transform.clientRect;
        }

        reaction(() => this.persistentState, viewState => onSavePersistantState(viewState));
    }

    get widgetPaletteItem() {
        return this.document.findObjectById("WidgetPaletteItem");
    }

    get selectedObjects() {
        const widgetPaletteItem = this.widgetPaletteItem;
        if (widgetPaletteItem) {
            return [widgetPaletteItem];
        } else {
            return this._selectedObjects;
        }
    }

    @computed
    get persistentState(): IViewStatePersistantState {
        const selectedObjects = this._selectedObjects.map(object => object.id);
        selectedObjects.sort();

        return {
            transform: {
                translate: this.transform.translate,
                scale: this.transform.scale
            },
            selectedObjects
        };
    }

    @action
    resetTransform() {
        if (this.document.resetTransform) {
            this.document.resetTransform(this.transform);
        } else {
            this.transform.scale = 1;
            this.transform.translate = {
                x: 0,
                y: 0
            };
        }
    }

    get isSelectionResizable() {
        for (const object of this.selectedObjects) {
            if (!object.isResizable) {
                return false;
            }
        }
        return true;
    }

    get selectedObjectsBoundingRect(): Rect {
        let boundingRectBuilder = new BoundingRectBuilder();

        for (const object of this.selectedObjects) {
            boundingRectBuilder.addRect(object.boundingRect);
        }

        return boundingRectBuilder.getRect();
    }

    isObjectSelected(object: IBaseObject): boolean {
        return this.selectedObjects.indexOf(object) !== -1;
    }

    selectObject(object: IBaseObject) {
        runInAction(() => {
            this._selectedObjects.push(object);
        });
    }

    selectObjects(objects: IBaseObject[]) {
        this.deselectAllObjects();
        runInAction(() => {
            this._selectedObjects = objects;
        });
    }

    deselectAllObjects(): void {
        runInAction(() => {
            this._selectedObjects = [];
        });
    }
}

export class DesignerContext extends React.Component<{
    document: IDocument;
    viewStatePersistantState: IViewStatePersistantState;
    onSavePersistantState: (viewStatePersistantState: IViewStatePersistantState) => void;
    options?: IDesignerOptions;
}> {
    viewStateCache: ViewState;
    designerContextCache: IDesignerContext;

    get designerContext() {
        if (
            !this.designerContextCache ||
            this.designerContextCache.document !== this.props.document ||
            JSON.stringify(this.props.viewStatePersistantState) !==
                JSON.stringify(this.designerContextCache.viewState.persistentState)
        ) {
            this.designerContextCache = {
                document: this.props.document,
                viewState: new ViewState(
                    this.props.document,
                    this.props.viewStatePersistantState,
                    this.props.onSavePersistantState,
                    this.designerContextCache && (this.designerContextCache.viewState as ViewState)
                ),
                options: this.props.options || {}
            };
        }
        return this.designerContextCache;
    }

    render() {
        return <Provider designerContext={this.designerContext}>{this.props.children}</Provider>;
    }
}
