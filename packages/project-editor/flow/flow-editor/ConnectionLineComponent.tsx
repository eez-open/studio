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
                <defs>{<LineMarkers />}</defs>
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
                <path
                    d={lineShape}
                    style={{
                        fill: "none",
                        stroke: selected ? selectedLineColor : lineColor,
                        strokeWidth,
                        markerStart: selected
                            ? "url(#selectedLineStart)"
                            : "url(#lineStart)",
                        markerEnd: selected
                            ? "url(#selectedLineEnd)"
                            : "url(#lineEnd)",
                        strokeLinecap: "round"
                    }}
                ></path>
            </g>
        );
    }
);

const LineMarkers = () => (
    <>
        <LineStartMarker id="lineStart" color={lineColor} />
        <LineEndMarker id="lineEnd" color={lineColor} />
        <LineStartMarker id="selectedLineStart" color={selectedLineColor} />
        <LineEndMarker id="selectedLineEnd" color={selectedLineColor} />
    </>
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
