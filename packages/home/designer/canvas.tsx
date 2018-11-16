import React from "react";
import { observer } from "mobx-react";

import { getBoundingClientRectOfChildNodes } from "eez-studio-shared/util";
import { rectScale, Transform } from "eez-studio-shared/geometry";

import styled from "eez-studio-ui/styled-components";
import { IToolHandler } from "eez-studio-designer/designer-interfaces";

import {
    TransitionGroup,
    BounceEntranceTransition,
    BOUNCE_ENTRANCE_TRANSITION_DURATION
} from "eez-studio-ui/transitions";

import { Canvas } from "eez-studio-designer/canvas";

import { IWorkbenchObject, IWorkbenchDocument } from "home/designer/designer-store";

////////////////////////////////////////////////////////////////////////////////

@observer
class ObjectComponent extends React.Component<
    {
        object: IWorkbenchObject;
        transform: Transform;
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
                        this.props.transform.clientToModelRect(
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

interface WorkbenchDocumentProps {
    document: IWorkbenchDocument;
    toolHandler: IToolHandler;
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
export class WorkbenchDocument extends React.Component<WorkbenchDocumentProps, {}> {
    render() {
        const transform = this.props.document.transform;

        return (
            /*this.props.connectDropTarget*/
            <WorkbenchCanvas document={this.props.document} toolHandler={this.props.toolHandler}>
                <TransitionGroup
                    component="g"
                    className="EezStudio_Layer"
                    style={{ pointerEvents: "none" }}
                >
                    {this.props.document.objects.map(obj => (
                        <BounceEntranceTransition key={obj.id}>
                            <ObjectComponent object={obj} transform={transform} />
                        </BounceEntranceTransition>
                    ))}
                </TransitionGroup>
            </WorkbenchCanvas>
        );
    }
}
