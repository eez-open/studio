import React from "react";
import { observable, computed, action } from "mobx";
import { observer, inject } from "mobx-react";
import { bind } from "bind-decorator";

import { getBoundingClientRectOfChildNodes } from "eez-studio-shared/util";
import { rectScale } from "eez-studio-shared/geometry";

import { VerticalHeaderWithBody, Header, Body } from "eez-studio-ui/header-with-body";
import { Splitter } from "eez-studio-ui/splitter";
import {
    TransitionGroup,
    BounceEntranceTransition,
    BOUNCE_ENTRANCE_TRANSITION_DURATION
} from "eez-studio-ui/transitions";
import styled from "eez-studio-ui/styled-components";
import { Box } from "eez-studio-ui/box";
import { PanelTitle } from "eez-studio-ui/panel";
import { Toolbar } from "eez-studio-ui/toolbar";
import { ButtonAction } from "eez-studio-ui/action";

import {
    IBaseObject,
    IToolbarButton,
    IDesignerContext
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

const CONF_SHOW_HISTORY_DELAY = 500;

@inject("designerContext")
@observer
export class Properties extends React.Component<{
    designerContext?: IDesignerContext;
    className?: string;
}> {
    get viewStateSelectedObject() {
        return this.props.designerContext!.viewState.selectedObjects;
    }

    ///////////////////////////////////////////////////////////////////
    // Show history if selectedObjects doesn't change after some period
    // of time (CONF_SHOW_HISTORY_DELAY).
    // TODO let's hope that React hooks will make this much simpler.
    @observable.shallow
    selectedObjects: IBaseObject[];

    @computed
    get showHistory() {
        return (
            JSON.stringify(this.selectedObjects) === JSON.stringify(this.viewStateSelectedObject)
        );
    }

    showHistoryAfterDelay() {
        setTimeout(
            action(() => {
                this.selectedObjects = this.viewStateSelectedObject;
            }),
            CONF_SHOW_HISTORY_DELAY
        );
    }

    componentDidMount() {
        this.showHistoryAfterDelay();
    }

    componentDidUpdate() {
        this.showHistoryAfterDelay();
    }
    ///////////////////////////////////////////////////////////////////

    render() {
        let className = this.props.className;

        if (this.viewStateSelectedObject.length === 0) {
            return <div className={className} />;
        }

        let history = (
            <Box direction="column" background="panel-header" style={{ height: "100%" }}>
                <PanelTitle title="History" />
                <Box scrollable={true} background="white">
                    {this.props.designerContext!.viewState.isIdle && this.showHistory && (
                        <div>
                            <HistorySection
                                oids={this.viewStateSelectedObject.map(
                                    selectedObject => (selectedObject as IWorkbenchObject).oid
                                )}
                                simple={true}
                            />
                        </div>
                    )}
                </Box>
            </Box>
        );

        if (this.viewStateSelectedObject.length === 1) {
            return (
                <Splitter
                    type="vertical"
                    sizes="100%|240px"
                    className={className}
                    persistId="home/designer/properties/splitter"
                >
                    {(this.viewStateSelectedObject[0] as IWorkbenchObject).details}
                    {history}
                </Splitter>
            );
        }

        return <div className={className}>{history}</div>;
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

    setBoundingRect(timeout: number) {
        if (!this.timeoutId) {
            this.timeoutId = setTimeout(() => {
                this.timeoutId = undefined;

                const rect = getBoundingClientRectOfChildNodes(this.element);
                if (rect) {
                    this.props.object.setBoundingRect(
                        this.props.designerContext!.viewState.transform.clientToModelRect(
                            rectScale(rect, 1 / window.devicePixelRatio)
                        )
                    );
                }
            }, timeout);
        }
    }

    componentDidMount() {
        this.setBoundingRect(BOUNCE_ENTRANCE_TRANSITION_DURATION);
    }

    componentDidUpdate() {
        this.setBoundingRect(10);
    }

    componentWillUnmount() {
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
        }
    }

    render() {
        return (
            <g style={{ transformOrigin: "50% 50%" }}>
                <foreignObject
                    ref={ref => (this.element = ref!)}
                    data-oid={this.props.object.id}
                    x={this.props.object.rect.left}
                    y={this.props.object.rect.top}
                    width={this.props.object.rect.width}
                    height={this.props.object.rect.height}
                >
                    {this.props.object.content}
                </foreignObject>
            </g>
        );
    }
}

const WorkbenchCanvas = styled(Canvas)`
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    background-color: white;
`;

@observer
export class WorkbenchDocument extends React.Component {
    render() {
        return (
            <WorkbenchCanvas toolHandler={selectToolHandler}>
                <TransitionGroup
                    component="g"
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
    @bind
    loadViewState() {
        let viewStateJSON = window.localStorage.getItem("home/designer/transform");
        if (viewStateJSON) {
            try {
                const viewState = JSON.parse(viewStateJSON);

                if (!viewState.transform) {
                    if (viewState.scale !== undefined && viewState.translate !== undefined) {
                        // migration
                        // TODO remove this in the feature
                        viewState.transform = {
                            scale: viewState.scale,
                            translate: viewState.translate
                        };
                        delete viewState.scale;
                        delete viewState.translate;
                    }
                }

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
            }
        };
    }

    @bind
    saveViewState(viewState: any) {
        window.localStorage.setItem("home/designer/transform", JSON.stringify(viewState));
    }

    render() {
        return (
            <DesignerContext
                document={workbenchDocument}
                viewStatePersistanceHandler={{
                    load: this.loadViewState,
                    save: this.saveViewState
                }}
            >
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
            </DesignerContext>
        );
    }
}
