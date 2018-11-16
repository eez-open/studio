import React from "react";
import { observable, action, reaction, runInAction } from "mobx";
import { Provider } from "mobx-react";

import { Rect, Transform, BoundingRectBuilder } from "eez-studio-shared/geometry";

import {
    IBaseObject,
    IDocument,
    IViewState,
    IViewStatePersistanceHandler,
    IDesignerContext
} from "eez-studio-designer/designer-interfaces";

////////////////////////////////////////////////////////////////////////////////

class ViewState implements IViewState {
    @observable
    transform: Transform = new Transform({
        scale: 1,
        translate: { x: 0, y: 0 }
    });

    constructor(document: IDocument, viewStatePersistanceHandler: IViewStatePersistanceHandler) {
        const viewState = viewStatePersistanceHandler.load();

        if (viewState) {
            if (viewState.transform) {
                this.transform.scale = viewState.transform.scale;
                this.transform.translate = viewState.transform.translate;
            }

            if (viewState.selectedObjects) {
                this.selectedObjects = viewState.selectedObjects
                    .map((id: string) => document.findObjectById(id))
                    .filter((object: IBaseObject | undefined) => !!object);
            }
        }

        reaction(
            () => ({
                transform: {
                    translate: this.transform.translate,
                    scale: this.transform.scale
                },
                selectedObjects: this.selectedObjects.map(object => object.id)
            }),
            viewState => viewStatePersistanceHandler.save(viewState)
        );
    }

    @action
    resetTransform() {
        this.transform.scale = 1;
        this.transform.translate = {
            x: 0,
            y: 0
        };
    }

    @observable
    isIdle: boolean = true;

    @observable
    selectedObjects: IBaseObject[] = [];

    get isSelectionResizable() {
        for (const object of this.selectedObjects) {
            if (!object.isResizable) {
                return false;
            }
        }
        return true;
    }

    get selectedObjectsBoundingRect(): Rect | undefined {
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
            this.selectedObjects.push(object);
        });
    }

    selectObjects(objects: IBaseObject[]) {
        this.deselectAllObjects();
        runInAction(() => {
            this.selectedObjects = objects;
        });
    }

    deselectAllObjects(): void {
        runInAction(() => {
            this.selectedObjects = [];
        });
    }
}

export class DesignerContext extends React.Component<{
    document: IDocument;
    viewStatePersistanceHandler: IViewStatePersistanceHandler;
}> {
    designerContextCache: IDesignerContext;

    get designerContext() {
        if (
            !this.designerContextCache ||
            this.designerContextCache.document !== this.props.document
        ) {
            this.designerContextCache = {
                document: this.props.document,
                viewState: new ViewState(
                    this.props.document,
                    this.props.viewStatePersistanceHandler
                )
            };
        }
        return this.designerContextCache;
    }

    render() {
        return <Provider designerContext={this.designerContext}>{this.props.children}</Provider>;
    }
}
