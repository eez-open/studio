import React from "react";
import { computed } from "mobx";
import { observer, inject, Provider } from "mobx-react";
import { bind } from "bind-decorator";

import { VerticalHeaderWithBody, Header, Body } from "eez-studio-ui/header-with-body";
import { Splitter } from "eez-studio-ui/splitter";
import { TransitionGroup, BounceEntranceTransition } from "eez-studio-ui/transitions";
import styled from "eez-studio-ui/styled-components";
import { Box } from "eez-studio-ui/box";
import { PanelTitle } from "eez-studio-ui/panel";
import { Toolbar } from "eez-studio-ui/toolbar";
import { ButtonAction } from "eez-studio-ui/action";

import {
    IToolbarButton,
    IDesignerContext,
    IViewStatePersistantState
} from "eez-studio-designer/designer-interfaces";
import { DesignerContext } from "eez-studio-designer/context";
import { Canvas } from "eez-studio-designer/canvas";
import { selectToolHandler } from "eez-studio-designer/select-tool";

import { HistorySection } from "home/history";

import { IWorkbenchObject, workbenchDocument } from "home/designer/store";

////////////////////////////////////////////////////////////////////////////////

@inject("designerContext")
@observer
export class DesignerToolbar extends React.Component<
    {
        designerContext?: IDesignerContext;
        buttons: IToolbarButton[];
    },
    {}
> {
    render() {
        return (
            <Toolbar className="EezStudio_ToolbarHeader">
                {this.props.buttons.map(button => (
                    <ButtonAction
                        key={button.id}
                        text={button.label}
                        title={button.title}
                        className={button.className}
                        onClick={() => button.onClick(this.props.designerContext!)}
                    />
                ))}
            </Toolbar>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

@inject("designerContext")
@observer
export class Properties extends React.Component<{
    designerContext?: IDesignerContext;
    className?: string;
}> {
    get viewStateSelectedObject() {
        return this.props.designerContext!.viewState.selectedObjects;
    }

    render() {
        let className = this.props.className;

        if (this.viewStateSelectedObject.length === 0) {
            return <div className={className} />;
        }

        let history = (
            <Box direction="column" background="panel-header" style={{ height: "100%" }}>
                <PanelTitle title="History" />
                <Box scrollable={true} background="white" grow={1}>
                    <HistorySection
                        oids={this.viewStateSelectedObject.map(
                            selectedObject => (selectedObject as IWorkbenchObject).oid
                        )}
                        simple={true}
                    />
                </Box>
            </Box>
        );

        return (
            <Splitter
                type="vertical"
                sizes={this.viewStateSelectedObject.length === 1 ? "100%|240px" : "100%"}
                className={className}
                persistId={
                    this.viewStateSelectedObject.length === 1
                        ? "home/designer/properties/splitter"
                        : undefined
                }
            >
                {this.viewStateSelectedObject.length === 1 &&
                    (this.viewStateSelectedObject[0] as IWorkbenchObject).details}
                {history}
            </Splitter>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

@inject("designerContext")
@observer
class ObjectComponent extends React.Component<
    {
        designerContext?: IDesignerContext;
        object: IWorkbenchObject;
    },
    {}
> {
    element: Element;
    timeoutId: any;

    componentWillUnmount() {
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
        }
    }

    render() {
        const { object } = this.props;
        return (
            <div
                ref={ref => (this.element = ref!)}
                style={{
                    position: "absolute",
                    left: object.rect.left,
                    top: object.rect.top,
                    width: object.rect.width,
                    height: object.rect.height
                }}
                data-designer-object-id={object.id}
            >
                {object.content}
            </div>
        );
    }
}

const WorkbenchCanvas: typeof Canvas = styled(Canvas)`
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    background-color: white;
` as any;

@observer
export class WorkbenchDocument extends React.Component {
    render() {
        return (
            <WorkbenchCanvas toolHandler={selectToolHandler}>
                <TransitionGroup
                    component="div"
                    className="EezStudio_Layer"
                    style={{ pointerEvents: "none" }}
                >
                    {workbenchDocument.objects.map(obj => (
                        <BounceEntranceTransition key={obj.id}>
                            <ObjectComponent object={obj} />
                        </BounceEntranceTransition>
                    ))}
                </TransitionGroup>
            </WorkbenchCanvas>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

@observer
export class Designer extends React.Component<{}, {}> {
    designerContext: DesignerContext;

    constructor(props: any) {
        super(props);

        this.designerContext = new DesignerContext();

        this.designerContext.set(
            workbenchDocument,
            this.viewStatePersistantState,
            this.onSavePersistantState
        );
    }

    @computed
    get viewStatePersistantState(): IViewStatePersistantState {
        let viewStateJSON = window.localStorage.getItem("home/designer/transform");
        if (viewStateJSON) {
            try {
                const viewState: IViewStatePersistantState = JSON.parse(viewStateJSON);

                if (!viewState.transform) {
                    if (
                        (viewState as any).scale !== undefined &&
                        (viewState as any).translate !== undefined
                    ) {
                        // migration
                        // TODO remove this in the feature
                        viewState.transform = {
                            scale: (viewState as any).scale,
                            translate: (viewState as any).translate
                        };
                        delete (viewState as any).scale;
                        delete (viewState as any).translate;
                    }
                }

                viewState.selectedObjects = [];

                return viewState;
            } catch (err) {
                console.error(err);
            }
        }

        return {
            transform: {
                translate: {
                    x: 0,
                    y: 0
                },
                scale: 1
            },
            selectedObjects: []
        };
    }

    @bind
    onSavePersistantState(viewState: IViewStatePersistantState) {
        window.localStorage.setItem("home/designer/transform", JSON.stringify(viewState));
    }

    render() {
        return (
            <Provider designerContext={this.designerContext}>
                <VerticalHeaderWithBody>
                    <Header>
                        <DesignerToolbar buttons={workbenchDocument.toolbarButtons} />
                    </Header>
                    <Body>
                        <Splitter
                            type="horizontal"
                            sizes={/*"240px|100%|240px"*/ "100%|240px"}
                            persistId="home/designer/splitter"
                        >
                            <WorkbenchDocument />

                            <Properties />
                        </Splitter>
                    </Body>
                </VerticalHeaderWithBody>
            </Provider>
        );
    }
}
