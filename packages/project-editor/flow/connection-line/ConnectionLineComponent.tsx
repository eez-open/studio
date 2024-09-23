import { observer } from "mobx-react";
import React from "react";
import classNames from "classnames";

import { theme } from "eez-studio-ui/theme";
import { SvgLabel } from "eez-studio-ui/svg-label";

import { TreeObjectAdapter } from "project-editor/core/objectAdapter";
import type { IFlowContext } from "project-editor/flow/flow-interfaces";
import { ConnectionLine } from "project-editor/flow/connection-line";

import { getValueLabel } from "project-editor/features/variable/value-type";
import type { ComponentInput } from "project-editor/flow/component";

import { getConnectionLineShape } from "project-editor/flow/connection-line/connection-line-shape";
import {
    registerPath,
    unregisterPath
} from "project-editor/flow/connection-line/real-time-traffic-visualizer";
import { ProjectEditor } from "project-editor/project-editor-interface";

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
        connectionLines: TreeObjectAdapter[];
        context: IFlowContext;
        selected?: boolean;
    }) => {
        return (
            <>
                {connectionLines
                    .filter(
                        connectionLineAdapter =>
                            context.flowState ||
                            context.projectStore.project.settings.general
                                .lockedWidgetLinesOption != "hidden" ||
                            (connectionLineAdapter.object as ConnectionLine)
                                .isVisible
                    )
                    .map(connectionLineAdapter => (
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

export const ConnectionLineDebugValues = observer(
    ({
        connectionLines,
        context,
        selected = false
    }: {
        connectionLines: TreeObjectAdapter[];
        context: IFlowContext;
        selected?: boolean;
    }) => {
        return (
            <>
                {connectionLines.map(connectionLineAdapter => (
                    <ConnectionLineDebugValue
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

export const ConnectionLineShape = observer(
    ({
        connectionLineAdapter,
        context,
        selected,
        shadow
    }: {
        connectionLineAdapter: TreeObjectAdapter;
        context: IFlowContext;
        selected: boolean;
        shadow?: { color: string };
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
                style={{
                    filter: shadow
                        ? `drop-shadow(0px 0px 3px ${shadow.color})`
                        : undefined,
                    opacity:
                        context.flowState ||
                        context.projectStore.project.settings.general
                            .lockedWidgetLinesOption == "visible" ||
                        (connectionLineAdapter.object as ConnectionLine)
                            .isVisible
                            ? 1
                            : context.projectStore.project.settings.general
                                  .dimmedLinesOpacity / 100
                }}
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
                    shadow={shadow}
                />
                {context.projectStore.uiStateStore.showComponentDescriptions &&
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

const ConnectionLineDebugValue = observer(
    ({
        connectionLineAdapter,
        context,
        selected
    }: {
        connectionLineAdapter: TreeObjectAdapter;
        context: IFlowContext;
        selected: boolean;
    }) => {
        const connectionLine = connectionLineAdapter.object as ConnectionLine;

        const targetInput = connectionLine.targetComponent?.inputs.find(
            input => input.name == connectionLine.input
        );

        return (
            <g
                className={classNames("connection-line", { selected })}
                data-eez-flow-object-id={connectionLineAdapter.id}
            >
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

class VisiblePath extends React.Component<{
    lineShape: string;
    selected: boolean;
    connectionLine: ConnectionLine;
    context: IFlowContext;
    targetInput: ComponentInput | undefined;
    shadow: { color: string } | undefined;
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
            !(
                connectionLine.targetComponent instanceof
                ProjectEditor.OutputActionComponentClass
            );

        return (
            <path
                ref={this.ref}
                d={lineShape}
                style={{
                    fill: "none",
                    strokeWidth: this.props.shadow
                        ? 2
                        : seq
                        ? seqStrokeWidth
                        : strokeWidth,
                    strokeLinecap: "round",
                    stroke: this.props.shadow?.color
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
            context.document.projectStore.runtime &&
            context.document.projectStore.runtime.isDebuggerActive &&
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
                    context.projectStore.project,
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
            <AnimationCurveEndMarker />
            <pattern
                id="page-background"
                patternUnits="userSpaceOnUse"
                width="16"
                height="16"
            >
                <image
                    href="../eez-studio-ui/_images/image_background.png"
                    x="0"
                    y="0"
                    width="16"
                    height="16"
                    imageRendering="pixelated"
                />
            </pattern>
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

function AnimationCurveEndMarker() {
    return (
        <marker
            id="timelineAnimationCurveEndMarker"
            markerWidth="20"
            markerHeight="20"
            refX="13"
            refY="8"
            orient="auto"
            markerUnits="userSpaceOnUse"
        >
            <path
                d="M4,4 L4,12 L14,8 L4,4 L4,12"
                style={{
                    stroke: "#337bb7",
                    fill: "#337bb7",
                    strokeLinecap: "butt",
                    strokeLinejoin: "round"
                }}
            />
        </marker>
    );
}
