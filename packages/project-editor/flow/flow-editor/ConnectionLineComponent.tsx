import { observer } from "mobx-react-lite";
import React from "react";
import classNames from "classnames";

import { theme } from "eez-studio-ui/theme";
import type { IFlowContext } from "project-editor/flow/flow-interfaces";
import { ConnectionLine } from "project-editor/flow/flow";
import { getConnectionLineShape } from "project-editor/flow/flow-editor/connection-line-shape";
import type { ITreeObjectAdapter } from "project-editor/core/objectAdapter";

////////////////////////////////////////////////////////////////////////////////

const lineColor = theme.connectionLineColor;
const selectedLineColor = theme.selectedConnectionLineColor;
const activeLineColor = theme.activeConnectionLineColor;

const strokeWidth = 1.2;
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
        return (
            <path
                d={lineShape}
                style={{
                    fill: "none",
                    strokeWidth,
                    strokeLinecap: "round"
                }}
                className={classNames("connection-line-path", {
                    selected,
                    active:
                        connectionLine.active &&
                        context.document.DocumentStore.RuntimeStore
                            .isRuntimeMode
                })}
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
                data-designer-object-id={connectionLineAdapter.id}
            >
                <path
                    d={lineShape}
                    style={{
                        fill: "none",
                        stroke: "white",
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
                        stroke: "white",
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
            </g>
        );
    }
);

export const LineMarkers = () => (
    <svg style={{ width: 0, height: 0 }}>
        <defs>
            <LineStartMarker id="lineStart" color={lineColor} />
            <LineEndMarker id="lineEnd" color={lineColor} />
            <LineStartMarker id="selectedLineStart" color={selectedLineColor} />
            <LineEndMarker id="selectedLineEnd" color={selectedLineColor} />
            <LineStartMarker id="activeLineStart" color={activeLineColor} />
            <LineEndMarker id="activeLineEnd" color={activeLineColor} />
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
