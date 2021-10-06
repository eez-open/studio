import { observer } from "mobx-react-lite";
import React from "react";
import classNames from "classnames";

import { theme } from "eez-studio-ui/theme";
import type { IFlowContext } from "project-editor/flow/flow-interfaces";
import { ConnectionLine } from "project-editor/flow/flow";
import { getConnectionLineShape } from "project-editor/flow/flow-editor/connection-line-shape";
import type { ITreeObjectAdapter } from "project-editor/core/objectAdapter";
import { OutputActionComponent } from "../action-components";
import { SvgLabel } from "eez-studio-ui/svg-label";

////////////////////////////////////////////////////////////////////////////////

const lineColor = () => theme().connectionLineColor;
const seqLineColor = () => theme().seqConnectionLineColor;
const selectedLineColor = () => theme().selectedConnectionLineColor;
const selectedLineColorInViewer = () => theme().selectionBackgroundColor;
const activeLineColor = () => theme().activeConnectionLineColor;

const strokeWidth = 1.2;
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

const VisiblePath = observer(
    ({
        lineShape,
        selected,
        connectionLine,
        context
    }: {
        lineShape: string;
        selected: boolean;
        connectionLine: ConnectionLine;
        context: IFlowContext;
    }) => {
        const seq =
            connectionLine.input === "@seqin" &&
            !(connectionLine.targetComponent instanceof OutputActionComponent);

        return (
            <path
                d={lineShape}
                style={{
                    fill: "none",
                    strokeWidth: seq ? seqStrokeWidth : strokeWidth,
                    strokeLinecap: "round"
                }}
                className={classNames("connection-line-path", {
                    selected,
                    seq,
                    active:
                        connectionLine.active &&
                        context.document.DocumentStore.runtime
                })}
                vectorEffect={selected ? "non-scaling-stroke" : "none"}
            ></path>
        );
    }
);

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
        const lineShape = getConnectionLineShape(context, connectionLine);

        if (!lineShape) {
            return null;
        }

        const scale = context.viewState.transform.scale;

        return (
            <g
                className={classNames("connection-line", { selected })}
                data-eez-flow-object-id={connectionLineAdapter.id}
            >
                <path
                    d={lineShape}
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
                    style={{
                        fill: "none",
                        stroke: theme().backgroundColor,
                        strokeOpacity: 0.4,
                        strokeWidth: strokeOutlineWidth
                    }}
                ></path>
                <VisiblePath
                    lineShape={lineShape}
                    selected={selected}
                    connectionLine={connectionLine}
                    context={context}
                />
                <DebugValue
                    context={context}
                    connectionLine={connectionLine}
                    selected={selected}
                    id={connectionLineAdapter.id}
                />
            </g>
        );
    }
);

const DebugValue = observer(
    ({
        connectionLine,
        context,
        selected,
        id
    }: {
        connectionLine: ConnectionLine;
        context: IFlowContext;
        selected: boolean;
        id: string;
    }) => {
        let valueStr: string | undefined;

        if (
            context.flowState &&
            context.document.DocumentStore.runtime &&
            context.document.DocumentStore.runtime.isDebuggerActive &&
            connectionLine.targetComponent &&
            connectionLine.input !== "@seqin"
        ) {
            const inputValue = context.flowState.getInputValue(
                connectionLine.targetComponent,
                connectionLine.input
            );
            if (inputValue !== undefined) {
                try {
                    valueStr = JSON.stringify(inputValue).substr(0, 50);
                } catch (err) {
                    valueStr = "err!";
                }
            }
        }

        if (!valueStr) {
            return null;
        }

        return (
            <SvgLabel
                text={valueStr}
                x={connectionLine.targetPosition!.x - 15}
                y={connectionLine.targetPosition!.y}
                horizontalAlignement="right"
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
            <LineStartMarker id="lineStart" color={lineColor()} />
            <LineEndMarker id="lineEnd" color={lineColor()} />
            <LineStartMarker id="seqLineStart" color={seqLineColor()} />
            <LineEndMarker id="seqLineEnd" color={seqLineColor()} />
            <LineStartMarker
                id="selectedLineStart"
                color={selectedLineColor()}
            />
            <LineStartMarker
                id="selectedLineStartInViewer"
                color={selectedLineColorInViewer()}
            />
            <LineEndMarker id="selectedLineEnd" color={selectedLineColor()} />
            <LineEndMarker
                id="selectedLineEndInViewer"
                color={selectedLineColorInViewer()}
            />
            <LineStartMarker id="activeLineStart" color={activeLineColor()} />
            <LineEndMarker id="activeLineEnd" color={activeLineColor()} />
        </defs>
    </svg>
);

function LineStartMarker({ id, color }: { id: string; color: string }) {
    return (
        <marker
            id={id}
            markerWidth="8"
            markerHeight="8"
            refX="4"
            refY="5"
            orient="auto"
            markerUnits="userSpaceOnUse"
        >
            <circle
                cx="5"
                cy="5"
                r="1.6"
                style={{ stroke: "none", fill: color }}
            />
        </marker>
    );
}

function LineEndMarker({ id, color }: { id: string; color: string }) {
    return (
        <marker
            id={id}
            markerWidth="10"
            markerHeight="10"
            refX="7"
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
