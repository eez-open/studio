import { observer } from "mobx-react";
import React from "react";
import classNames from "classnames";

import { theme } from "eez-studio-ui/theme";
import type { IFlowContext } from "project-editor/flow/flow-interfaces";
import type { ConnectionLine } from "project-editor/flow/flow";
import { getConnectionLineShape } from "project-editor/flow/editor/connection-line-shape";
import type { ITreeObjectAdapter } from "project-editor/core/objectAdapter";
import { OutputActionComponent } from "project-editor/flow/components/actions";
import { SvgLabel } from "eez-studio-ui/svg-label";
import { getValueLabel } from "project-editor/features/variable/value-type";
import type { ComponentInput } from "project-editor/flow/component";
import { registerPath, unregisterPath } from "./real-time-traffic-visualizer";

////////////////////////////////////////////////////////////////////////////////

const lineColor = () => theme().connectionLineColor;
const seqLineColor = () => theme().seqConnectionLineColor;
const selectedLineColor = () => theme().selectedConnectionLineColor;
const selectedLineColorInViewer = () => theme().selectionBackgroundColor;

export const strokeWidth = 1.2;
const seqStrokeWidth = 1.2;
const strokeOutlineWidth = 1.5;
const strokeBackgroundWidth = 8;

////////////////////////////////////////////////////////////////////////////////

export const ConnectionLines = observer(
    ({
        connectionLines,
        context,
        selected = false
    }: {
        connectionLines: ITreeObjectAdapter[];
        context: IFlowContext;
        selected?: boolean;
    }) => {
        return (
            <>
                {connectionLines.map(connectionLineAdapter => (
                    <ConnectionLineShape
                        key={connectionLineAdapter.id}
                        connectionLineAdapter={connectionLineAdapter}
                        context={context}
                        selected={selected}
                    />
                ))}
            </>
        );
    }
);

class VisiblePath extends React.Component<{
    lineShape: string;
    selected: boolean;
    connectionLine: ConnectionLine;
    context: IFlowContext;
    targetInput: ComponentInput | undefined;
}> {
    ref = React.createRef<SVGPathElement>();

    componentDidMount() {
        if (this.ref.current) {
            registerPath(this.props.connectionLine, this.ref.current);
        }
    }

    componentWillUnmount() {
        if (this.ref.current) {
            unregisterPath(this.props.connectionLine, this.ref.current);
        }
    }

    render() {
        const { lineShape, selected, connectionLine, targetInput } = this.props;

        const seq =
            targetInput?.isSequenceInput &&
            !(connectionLine.targetComponent instanceof OutputActionComponent);

        return (
            <path
                ref={this.ref}
                d={lineShape}
                style={{
                    fill: "none",
                    strokeWidth: seq ? seqStrokeWidth : strokeWidth,
                    strokeLinecap: "round"
                }}
                className={classNames("connection-line-path", {
                    selected,
                    seq
                })}
                vectorEffect={selected ? "non-scaling-stroke" : "none"}
            ></path>
        );
    }
}

const ConnectionLineShape = observer(
    ({
        connectionLineAdapter,
        context,
        selected
    }: {
        connectionLineAdapter: ITreeObjectAdapter;
        context: IFlowContext;
        selected: boolean;
    }) => {
        const connectionLine = connectionLineAdapter.object as ConnectionLine;
        const { lineShape, center } = getConnectionLineShape(
            context,
            connectionLine
        );

        if (!lineShape) {
            return null;
        }

        const targetInput = connectionLine.targetComponent?.inputs.find(
            input => input.name == connectionLine.input
        );

        const scale = context.viewState.transform.scale;

        return (
            <g
                className={classNames("connection-line", { selected })}
                data-eez-flow-object-id={connectionLineAdapter.id}
            >
                <path
                    d={lineShape}
                    className="connection-line-path"
                    style={{
                        fill: "none",
                        stroke: theme().backgroundColor,
                        strokeOpacity: 0,
                        strokeWidth: scale
                            ? strokeBackgroundWidth / scale
                            : strokeBackgroundWidth
                    }}
                ></path>
                <path
                    d={lineShape}
                    className="connection-line-path"
                    style={{
                        fill: "none",
                        stroke: theme().backgroundColor,
                        strokeOpacity: 0.4,
                        strokeWidth: strokeOutlineWidth,
                        strokeLinecap: "round"
                    }}
                ></path>
                <VisiblePath
                    lineShape={lineShape}
                    selected={selected}
                    connectionLine={connectionLine}
                    context={context}
                    targetInput={targetInput}
                />
                <DebugValue
                    context={context}
                    connectionLine={connectionLine}
                    selected={selected}
                    id={connectionLineAdapter.id}
                    targetInput={targetInput}
                />
                {context.DocumentStore.uiStateStore.showComponentDescriptions &&
                    connectionLine.description && (
                        <SvgLabel
                            text={connectionLine.description}
                            x={center.x}
                            y={center.y}
                            horizontalAlignment="center"
                            verticalAlignment="center"
                            backgroundColor="#fff5c2"
                            textColor={"#212529"}
                            border={{ color: "#fff5c2" }}
                        />
                    )}
            </g>
        );
    }
);

const DebugValue = observer(
    ({
        connectionLine,
        context,
        selected,
        id,
        targetInput
    }: {
        connectionLine: ConnectionLine;
        context: IFlowContext;
        selected: boolean;
        id: string;
        targetInput: ComponentInput | undefined;
    }) => {
        let valueStr: string | undefined;

        if (
            context.flowState &&
            context.document.DocumentStore.runtime &&
            context.document.DocumentStore.runtime.isDebuggerActive &&
            connectionLine.targetComponent &&
            targetInput
        ) {
            const inputValue = context.flowState.getInputValue(
                connectionLine.targetComponent,
                connectionLine.input
            );
            if (
                inputValue !== undefined &&
                (!targetInput.isSequenceInput || inputValue != null)
            ) {
                valueStr = getValueLabel(
                    context.DocumentStore.project,
                    inputValue,
                    targetInput.type
                );
            }
        }

        if (!valueStr) {
            return null;
        }

        if (valueStr.length > 50) {
            valueStr = valueStr.substring(0, 50) + "...";
        }

        return (
            <SvgLabel
                text={valueStr}
                x={connectionLine.targetPosition!.x - 15}
                y={connectionLine.targetPosition!.y}
                horizontalAlignment="right"
                verticalAlignment="center"
                border={{ size: 1, color: "#fff740", radius: 4 }}
                padding={{ left: 4, top: 2, right: 4, bottom: 0 }}
                backgroundColor="#feff9c"
                textColor={selected ? theme().selectionBackgroundColor : "#333"}
                textWeight={selected ? "bold" : "normal"}
            />
        );
    }
);

export const LineMarkers = () => (
    <svg style={{ width: 0, height: 0 }}>
        <defs>
            <LineEndMarker id="lineEnd" color={lineColor()} />
            <LineEndMarker id="seqLineEnd" color={seqLineColor()} />
            <LineEndMarker id="selectedLineEnd" color={selectedLineColor()} />
            <LineEndMarker
                id="selectedLineEndInViewer"
                color={selectedLineColorInViewer()}
            />
        </defs>
    </svg>
);

function LineEndMarker({ id, color }: { id: string; color: string }) {
    return (
        <marker
            id={id}
            markerWidth="10"
            markerHeight="10"
            refX="6"
            refY="4"
            orient="auto"
            markerUnits="userSpaceOnUse"
        >
            <path
                d="M2,2 L2,6 L7,4 L2,2 L2,6"
                style={{
                    stroke: color,
                    fill: color,
                    strokeLinecap: "butt",
                    strokeLinejoin: "miter"
                }}
            />
        </marker>
    );
}
