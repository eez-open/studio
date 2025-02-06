import { computed, observable, makeObservable } from "mobx";
import {
    ClassInfo,
    EezObject,
    getParent,
    IMessage,
    MessageType,
    PropertyType,
    registerClass
} from "project-editor/core/object";
import { getLabel, Message } from "project-editor/store";
import type { Component } from "project-editor/flow/component";
import {
    getInputDisplayName,
    getOutputDisplayName
} from "project-editor/flow/helper";
import { ProjectEditor } from "project-editor/project-editor-interface";
import { activateConnectionLine } from "project-editor/flow/connection-line/real-time-traffic-visualizer";
import { isImplicitConversionPossible } from "project-editor/flow/expression/type";
import type { Flow } from "project-editor/flow/flow";

////////////////////////////////////////////////////////////////////////////////

export class ConnectionLine extends EezObject {
    description: string;
    source: string;
    output: string;
    target: string;
    input: string;
    disabled: boolean;

    _active: boolean;

    static classInfo: ClassInfo = {
        label: (connectionLine: ConnectionLine) => {
            const source = connectionLine.sourceComponent
                ? getLabel(connectionLine.sourceComponent)
                : "UNKNOWN";

            const from =
                connectionLine.output == "@seqout"
                    ? source
                    : `${source}@${getOutputDisplayName(
                          connectionLine.sourceComponent,
                          connectionLine.output
                      )}`;

            const target = connectionLine.targetComponent
                ? getLabel(connectionLine.targetComponent)
                : "UNKNOWN";

            const to =
                connectionLine.input == "@seqin"
                    ? target
                    : `${target}@${getInputDisplayName(
                          connectionLine.targetComponent,
                          connectionLine.input
                      )}`;

            return `${from} ➝ ${to}`;
        },

        properties: [
            {
                name: "description",
                type: PropertyType.String
            },
            {
                name: "source",
                type: PropertyType.String,
                hideInPropertyGrid: true
            },
            {
                name: "output",
                type: PropertyType.String,
                hideInPropertyGrid: true
            },
            {
                name: "target",
                type: PropertyType.String,
                hideInPropertyGrid: true
            },
            {
                name: "input",
                type: PropertyType.String,
                hideInPropertyGrid: true
            },
            {
                name: "disabled",
                type: PropertyType.Boolean,
                checkboxStyleSwitch: true
            }
        ],

        beforeLoadHook(object, jsObject) {
            if (jsObject.disabled == "undefined") {
                jsObject.disabled = false;
            }
        },

        isSelectable: () => true,

        deleteObjectFilterHook: (connectionLine: ConnectionLine) => {
            const page = getParent(getParent(connectionLine)) as Flow;
            return page.connectionLines.indexOf(connectionLine) != -1;
        },

        check: (connectionLine: ConnectionLine, messages: IMessage[]) => {
            if (
                !connectionLine.sourceComponent &&
                !connectionLine.targetComponent
            ) {
                messages.push(
                    new Message(
                        MessageType.ERROR,
                        `Connection line ${getLabel(
                            connectionLine
                        )}: no source and target component`,
                        connectionLine
                    )
                );
            } else if (!connectionLine.sourceComponent) {
                messages.push(
                    new Message(
                        MessageType.ERROR,
                        `Connection line ${getLabel(
                            connectionLine
                        )}: no source component`,
                        connectionLine
                    )
                );
            } else if (!connectionLine.targetComponent) {
                messages.push(
                    new Message(
                        MessageType.ERROR,
                        `Connection line ${getLabel(
                            connectionLine
                        )}: no target component`,
                        connectionLine
                    )
                );
            } else {
                const componentOutput =
                    connectionLine.sourceComponent.outputs.find(
                        componentOutput =>
                            componentOutput.name == connectionLine.output
                    );

                if (!componentOutput) {
                    messages.push(
                        new Message(
                            MessageType.ERROR,
                            `Connection line ${getLabel(
                                connectionLine
                            )}: no source component output`,
                            connectionLine
                        )
                    );
                }

                const componentInput =
                    connectionLine.targetComponent.inputs.find(
                        componentInput =>
                            componentInput.name == connectionLine.input
                    );

                if (!componentInput) {
                    messages.push(
                        new Message(
                            MessageType.ERROR,
                            `Connection line ${getLabel(
                                connectionLine
                            )}: no target component input`,
                            connectionLine
                        )
                    );
                }

                if (componentOutput && componentInput) {
                    if (
                        !isImplicitConversionPossible(
                            componentOutput.type,
                            componentInput.type
                        )
                    ) {
                        messages.push(
                            new Message(
                                MessageType.WARNING,
                                `Connection line incompatible data types: ${componentOutput.type} -> ${componentInput.type}`,
                                connectionLine
                            )
                        );
                    }
                }
            }
        },

        objectsToClipboardData: (components: Component[]) => {
            const flow = ProjectEditor.getFlow(components[0]);
            if (flow) {
                return flow.objectsToClipboardData(components);
            }
            return undefined;
        }
    };

    constructor() {
        super();

        makeObservable(this, {
            sourceComponent: computed,
            targetComponent: computed,
            _sourcePosition: computed,
            _targetPosition: computed,
            sourceAndTargetPositions: computed,
            sourcePosition: computed,
            targetPosition: computed,
            sourceRect: computed,
            targetRect: computed
        });
    }

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            description: observable,
            source: observable,
            output: observable,
            target: observable,
            input: observable,
            _active: observable,
            disabled: observable,
            isVisible: computed
        });
    }

    get isValidTarget() {
        return (
            this.targetComponent &&
            this.targetComponent.inputs.find(input => input.name == this.input)
        );
    }

    get isValidSource() {
        return (
            this.sourceComponent &&
            this.sourceComponent.outputs.find(
                output => output.name == this.output
            )
        );
    }

    get sourceComponent() {
        const project = ProjectEditor.getProject(this);
        return project._objectsMap.get(this.source) as Component;
    }

    get targetComponent() {
        const project = ProjectEditor.getProject(this);
        return project._objectsMap.get(this.target) as Component;
    }

    get _sourcePosition() {
        if (!this.sourceComponent) {
            return undefined;
        }

        const outputGeometry =
            this.sourceComponent.geometry.outputs[this.output];
        if (!outputGeometry) {
            return undefined;
        }

        return {
            x:
                this.sourceComponent.absolutePositionPoint.x +
                outputGeometry.position.x,
            y:
                this.sourceComponent.absolutePositionPoint.y +
                outputGeometry.position.y
        };
    }

    get _targetPosition() {
        if (!this.targetComponent) {
            return undefined;
        }
        const inputGeometry = this.targetComponent.geometry.inputs[this.input];
        if (!inputGeometry) {
            return undefined;
        }

        return {
            x:
                this.targetComponent.absolutePositionPoint.x +
                inputGeometry.position.x,
            y:
                this.targetComponent.absolutePositionPoint.y +
                inputGeometry.position.y
        };
    }

    get sourceAndTargetPositions() {
        let sourcePositionX = 0;
        let sourcePositionY = 0;
        let targetPositionX = 100;
        let targetPositionY = 100;

        if (this._sourcePosition) {
            sourcePositionX = this._sourcePosition.x;
            sourcePositionY = this._sourcePosition.y;
        }

        if (this._targetPosition) {
            targetPositionX = this._targetPosition.x;
            targetPositionY = this._targetPosition.y;
        }

        if (this._sourcePosition && !this._targetPosition) {
            targetPositionX = sourcePositionX + 50;
            targetPositionY = sourcePositionY;
        }

        if (!this._sourcePosition && this._targetPosition) {
            sourcePositionX = targetPositionX - 50;
            sourcePositionY = targetPositionY;
        }

        return {
            sourcePosition: { x: sourcePositionX, y: sourcePositionY },
            targetPosition: { x: targetPositionX, y: targetPositionY }
        };
    }

    get sourcePosition() {
        return this.sourceAndTargetPositions.sourcePosition;
    }

    get targetPosition() {
        return this.sourceAndTargetPositions.targetPosition;
    }

    get sourceRect() {
        if (!this.sourceComponent) {
            return {
                left: 0,
                top: 0,
                width: 1,
                height: 1
            };
        }

        return this.sourceComponent.geometry;
    }

    get targetRect() {
        if (!this.targetComponent) {
            return {
                left: 0,
                top: 0,
                width: 1,
                height: 1
            };
        }

        return this.targetComponent.geometry;
    }

    setActive() {
        activateConnectionLine(this);
    }

    get isVisible() {
        return !(
            (this.sourceComponent instanceof ProjectEditor.WidgetClass &&
                this.sourceComponent.isHiddenInEditorDeep) ||
            (this.targetComponent instanceof ProjectEditor.WidgetClass &&
                this.targetComponent.isHiddenInEditorDeep)
        );
    }
}

registerClass("ConnectionLine", ConnectionLine);
