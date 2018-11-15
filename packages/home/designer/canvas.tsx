import React from "react";
import { observer } from "mobx-react";
//import { DropTarget, DropTargetConnector, DropTargetMonitor } from "react-dnd";

import { getBoundingClientRectOfChildNodes } from "eez-studio-shared/util";
import { rectScale, Transform } from "eez-studio-shared/geometry";

import styled from "eez-studio-ui/styled-components";
import { ITool } from "eez-studio-designer/designer-interfaces";

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

interface DndWorkbenchDocumentProps {
    document: IWorkbenchDocument;
    tool: ITool | undefined;
    selectDefaultTool: () => void;
    //connectDropTarget: any;
    //isOver: boolean;
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
class DndWorkbenchDocument extends React.Component<DndWorkbenchDocumentProps, {}> {
    render() {
        const transform = this.props.document.transform;
        const toolHandler = this.props.tool && this.props.tool.toolHandler;

        return (
            /*this.props.connectDropTarget*/
            <WorkbenchCanvas document={this.props.document} toolHandler={toolHandler}>
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

// export const WorkbenchDocument = DropTarget(
//     "ToolFromToolbox",
//     {
//         drop(props: any, monitor: DropTargetMonitor, documentComponent: DndWorkbenchDocument) {
//             let tool: ITool = props.tool;
//             return tool.toolHandler.drop(
//                 documentComponent.props.document,
//                 documentComponent.transform.clientToModelPoint(monitor.getClientOffset())
//             );
//         },

//         canDrop() {
//             return true;
//         }
//     },
//     (connect: DropTargetConnector, monitor: DropTargetMonitor) => {
//         return {
//             connectDropTarget: connect.dropTarget(),
//             isOver: monitor.isOver(),
//             canDrop: monitor.canDrop()
//         };
//     }
// )(DndWorkbenchDocument);
export const WorkbenchDocument = DndWorkbenchDocument;
