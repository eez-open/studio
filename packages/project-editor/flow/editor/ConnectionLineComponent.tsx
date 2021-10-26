import { observer } from "mobx-react-lite";
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

const VisiblePath = observer(
    ({
        lineShape,
        selected,
        connectionLine,
        context,
        targetInput
    }: {
        lineShape: string;
        selected: boolean;
        connectionLine: ConnectionLine;
        context: IFlowContext;
        targetInput: ComponentInput | undefined;
    }) => {
        const seq =
            targetInput?.isSequenceInput &&
            !(connectionLine.targetComponent instanceof OutputActionComponent);

        const active =
            connectionLine.active && context.document.DocumentStore.runtime;

        return (
            <path
                d={lineShape}
                style={{
                    fill: "none",
                    strokeWidth: seq ? seqStrokeWidth : strokeWidth,
                    strokeLinecap: "round",
                    strokeDashoffset: active
                        ? Math.ceil(
                              ((performance.now() / 1000) * 120) % 12000000
                          ) * -1
                        : undefined
                }}
                className={classNames("connection-line-path", {
                    selected,
                    seq,
                    active
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
            targetInput &&
            !targetInput.isSequenceInput
        ) {
            const inputValue = context.flowState.getInputValue(
                connectionLine.targetComponent,
                connectionLine.input
            );
            if (inputValue != undefined) {
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
