import React from "react";
import { observable, action, reaction } from "mobx";
import { Provider } from "mobx-react";

import { Transform } from "eez-studio-shared/geometry";
import {
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

    constructor(viewStatePersistanceHandler: IViewStatePersistanceHandler) {
        const viewState = viewStatePersistanceHandler.load();

        if (viewState && viewState.transform) {
            this.transform.scale = viewState.transform.scale;
            this.transform.translate = viewState.transform.translate;
        }

        reaction(
            () => ({
                transform: {
                    translate: this.transform.translate,
                    scale: this.transform.scale
                }
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
                viewState: new ViewState(this.props.viewStatePersistanceHandler)
            };
        }
        return this.designerContextCache;
    }

    render() {
        return <Provider designerContext={this.designerContext}>{this.props.children}</Provider>;
    }
}
