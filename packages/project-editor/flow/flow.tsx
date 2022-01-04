import React from "react";
import { guid } from "eez-studio-shared/guid";
import { action, computed, observable, runInAction } from "mobx";
import {
    ClassInfo,
    EezObject,
    getParent,
    IEezObject,
    isSubclassOf,
    MessageType,
    PropertyInfo,
    PropertyType,
    registerClass,
    SerializedData
} from "project-editor/core/object";
import { visitObjects } from "project-editor/core/search";
import {
    getDocumentStore,
    objectToClipboardData,
    getLabel,
    Message
} from "project-editor/core/store";
import {
    Component,
    getInputDisplayName,
    getOutputDisplayName,
    Widget
} from "project-editor/flow/component";
import type { IFlowContext } from "project-editor/flow/flow-interfaces";
import { Rect } from "eez-studio-shared/geometry";
import { deleteObject, updateObject } from "project-editor/core/store";
import {
    ContainerWidget,
    SelectWidget
} from "project-editor/flow/components/widgets";
import { Variable } from "project-editor/features/variable/variable";
import { ValueType } from "project-editor/features/variable/value-type";
import {
    EndActionComponent,
    InputActionComponent,
    OutputActionComponent,
    StartActionComponent
} from "project-editor/flow/components/actions";
import { ITreeObjectAdapter } from "project-editor/core/objectAdapter";
import { Transform } from "project-editor/flow/editor/transform";
import { cloneObject } from "project-editor/core/store";
import { ProjectEditor } from "project-editor/project-editor-interface";
import { IEditorState } from "project-editor/project/EditorComponent";

////////////////////////////////////////////////////////////////////////////////

export class ConnectionLine extends EezObject {
    @observable source: string;
    @observable output: string;
    @observable target: string;
    @observable input: string;

    @observable _active: boolean;

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
            }
        ],

        isSelectable: () => true,

        deleteObjectFilterHook: (connectionLine: ConnectionLine) => {
            const page = getParent(getParent(connectionLine)) as Flow;
            return page.connectionLines.indexOf(connectionLine) != -1;
        }
    };

    @computed get sourceComponent() {
        const page = getParent(getParent(this)) as Flow;
        return page.wiredComponents.get(this.source);
    }

    @computed get targetComponent() {
        const page = getParent(getParent(this)) as Flow;
        return page.wiredComponents.get(this.target);
    }

    @computed get _sourcePosition() {
        if (!(this.sourceComponent && this.sourceComponent._geometry)) {
            return undefined;
        }

        const outputGeometry =
            this.sourceComponent._geometry.outputs[this.output];
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

    @computed get _targetPosition() {
        if (!(this.targetComponent && this.targetComponent._geometry)) {
            return undefined;
        }
        const inputGeometry = this.targetComponent._geometry.inputs[this.input];
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

    @computed get sourceAndTargetPositions() {
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
            targetPositionX = sourcePositionX + 20;
            targetPositionY = sourcePositionY + 20;
        }

        if (!this._sourcePosition && this._targetPosition) {
            sourcePositionX = targetPositionX - 20;
            sourcePositionY = targetPositionY - 20;
        }

        return {
            sourcePosition: { x: sourcePositionX, y: sourcePositionY },
            targetPosition: { x: targetPositionX, y: targetPositionY }
        };
    }

    @computed get sourcePosition() {
        return this.sourceAndTargetPositions.sourcePosition;
    }

    @computed get targetPosition() {
        return this.sourceAndTargetPositions.targetPosition;
    }

    @computed get sourceRect() {
        if (!(this.sourceComponent && this.sourceComponent._geometry)) {
            return {
                left: 0,
                top: 0,
                width: 0,
                height: 0
            };
        }

        return this.sourceComponent._geometry;
    }

    @computed get targetRect() {
        if (!(this.targetComponent && this.targetComponent._geometry)) {
            return {
                left: 0,
                top: 0,
                width: 0,
                height: 0
            };
        }

        return this.targetComponent._geometry;
    }

    get active() {
        return this._active;
    }

    _setActiveTimeoutId: any;

    @action
    setActive() {
        this._active = true;

        if (this._setActiveTimeoutId) {
            clearTimeout(this._setActiveTimeoutId);
        }

        this._setActiveTimeoutId = setTimeout(() => {
            this._setActiveTimeoutId = undefined;
            runInAction(() => (this._active = false));
        }, 100);
    }
}

registerClass("ConnectionLine", ConnectionLine);

////////////////////////////////////////////////////////////////////////////////

export abstract class Flow extends EezObject {
    static classInfo: ClassInfo = {
        properties: [
            {
                name: "components",
                type: PropertyType.Array,
                typeClass: Component,
                hideInPropertyGrid: true
            },
            {
                name: "connectionLines",
                type: PropertyType.Array,
                typeClass: ConnectionLine,
                hideInPropertyGrid: true
            },
            {
                name: "localVariables",
                type: PropertyType.Array,
                typeClass: Variable,
                hideInPropertyGrid: true
            }
        ],
        findPastePlaceInside: (
            flow: Flow,
            classInfo: ClassInfo,
            isSingleObject: boolean
        ): IEezObject | PropertyInfo | undefined => {
            if (flow) {
                if (isSubclassOf(classInfo, Component.classInfo)) {
                    return flow.components;
                } else if (classInfo === FlowFragment.classInfo) {
                    return flow;
                }
            }
            return undefined;
        },

        beforeLoadHook: (object: IEezObject, jsObject: any) => {
            if (!jsObject.localVariables) {
                jsObject.localVariables = [];
            }

            if (jsObject.components) {
                for (const component of jsObject.components) {
                    if (component.type === "DeclareVariableActionComponent") {
                        component.type = "SetVariableActionComponent";

                        let localVariable = jsObject.localVariables.find(
                            (localVariable: any) =>
                                localVariable.name === component.variable
                        );

                        if (!localVariable) {
                            let value;
                            try {
                                value = JSON.parse(component.value);
                            } catch (err) {}

                            let type: ValueType | undefined;

                            if (typeof value === "number") {
                                type = "float";
                            } else if (typeof value === "boolean") {
                                type = "boolean";
                            } else if (typeof value === "string") {
                                type = "string";
                            }

                            jsObject.localVariables.push({
                                name: component.variable,
                                type
                            });
                        }
                    }
                }
            }

            if (jsObject.connectionLines) {
                for (let i = 1; i < jsObject.connectionLines.length; i++) {
                    for (let j = 0; j < i; j++) {
                        const a = jsObject.connectionLines[i];
                        const b = jsObject.connectionLines[j];
                        if (
                            a.source == b.source &&
                            a.output == b.output &&
                            a.target == b.target &&
                            a.input == b.input
                        ) {
                            console.log("duplicate", a);
                        }
                    }
                }
            }
        },

        check: (flow: Flow) => {
            let messages: Message[] = [];

            flow.connectionLines.forEach(connectionLine => {
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
                    if (
                        !connectionLine.sourceComponent.outputs.find(
                            componentOutput =>
                                componentOutput.name == connectionLine.output
                        )
                    ) {
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

                    if (
                        !connectionLine.targetComponent.inputs.find(
                            componentInput =>
                                componentInput.name == connectionLine.input
                        )
                    ) {
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
                }
            });

            return messages;
        }
    };

    components: Component[];
    connectionLines: ConnectionLine[];
    localVariables: Variable[];

    @computed get wiredComponents() {
        const components = new Map<string, Component>();

        const v = visitObjects(this.components);
        while (true) {
            let visitResult = v.next();
            if (visitResult.done) {
                break;
            }
            if (visitResult.value instanceof Component) {
                const component = visitResult.value;
                components.set(component.wireID, component);
            }
        }

        return components;
    }

    objectsToClipboardData(objects: IEezObject[]) {
        const flowFragment = new FlowFragment();
        flowFragment.addObjects(this, objects);
        return objectToClipboardData(flowFragment);
    }

    pasteFlowFragment(flowFragment: FlowFragment, object: IEezObject) {
        const DocumentStore = getDocumentStore(this);

        DocumentStore.undoManager.setCombineCommands(true);

        flowFragment.rewire();

        let components: IEezObject[];

        if (flowFragment.connectionLines.length > 0) {
            DocumentStore.addObjects(
                this.connectionLines,
                flowFragment.connectionLines
            );

            components = DocumentStore.addObjects(
                this.components,
                flowFragment.components
            );
        } else {
            if (
                (object instanceof ContainerWidget ||
                    object instanceof SelectWidget) &&
                flowFragment.components.every(
                    component => component instanceof Widget
                )
            ) {
                components = DocumentStore.addObjects(
                    object.widgets,
                    flowFragment.components
                );
            } else {
                components = DocumentStore.addObjects(
                    this.components,
                    flowFragment.components
                );
            }
        }

        DocumentStore.undoManager.setCombineCommands(false);

        return components;
    }

    deleteConnectionLines(component: Component) {
        this.connectionLines
            .filter(
                connectionLine =>
                    connectionLine.sourceComponent == component ||
                    connectionLine.targetComponent == component
            )
            .forEach(connectionLine => deleteObject(connectionLine));
    }

    deleteConnectionLinesToInput(component: Component, input: string) {
        this.connectionLines
            .filter(
                connectionLine =>
                    connectionLine.targetComponent == component &&
                    connectionLine.input == input
            )
            .forEach(connectionLine => deleteObject(connectionLine));
    }

    deleteConnectionLinesFromOutput(component: Component, output: string) {
        this.connectionLines
            .filter(
                connectionLine =>
                    connectionLine.sourceComponent == component &&
                    connectionLine.output == output
            )
            .forEach(connectionLine => deleteObject(connectionLine));
    }

    rerouteConnectionLinesInput(
        component: Component,
        inputBefore: string,
        inputAfter: string
    ) {
        this.connectionLines
            .filter(
                connectionLine =>
                    connectionLine.targetComponent == component &&
                    connectionLine.input == inputBefore
            )
            .forEach(connectionLine =>
                updateObject(connectionLine, {
                    input: inputAfter
                })
            );
    }

    rerouteConnectionLinesOutput(
        component: Component,
        outputBefore: string,
        outputAfter: string
    ) {
        this.connectionLines
            .filter(
                connectionLine =>
                    connectionLine.sourceComponent == component &&
                    connectionLine.output == outputBefore
            )
            .forEach(connectionLine =>
                updateObject(connectionLine, {
                    output: outputAfter
                })
            );
    }

    abstract get pageRect(): Rect;

    @computed get startComponent() {
        return this.components.find(
            component => component instanceof StartActionComponent
        );
    }

    @computed get endComponent() {
        return this.components.find(
            component => component instanceof EndActionComponent
        );
    }

    @computed get inputComponents() {
        return this.components
            .filter(component => component instanceof InputActionComponent)
            .sort((a, b) => a.top - b.top) as InputActionComponent[];
    }

    @computed get outputComponents() {
        return this.components
            .filter(component => component instanceof OutputActionComponent)
            .sort((a, b) => a.top - b.top) as OutputActionComponent[];
    }

    abstract renderComponents(flowContext: IFlowContext): React.ReactNode;
}

////////////////////////////////////////////////////////////////////////////////

export class FlowFragment extends EezObject {
    components: Component[];
    connectionLines: ConnectionLine[];

    static classInfo: ClassInfo = {
        properties: [
            {
                name: "components",
                type: PropertyType.Array,
                typeClass: Component
            },
            {
                name: "connectionLines",
                type: PropertyType.Array,
                typeClass: ConnectionLine
            }
        ],

        beforeLoadHook: (object: IEezObject, jsObject: any) => {
            if (jsObject.widgets) {
                jsObject.components = jsObject.widgets;
                delete jsObject.widgets;
            }
        },

        pasteItemHook: (
            object: IEezObject,
            clipboardData: {
                serializedData: SerializedData;
                pastePlace: EezObject;
            }
        ) => {
            const flow = ProjectEditor.getFlow(clipboardData.pastePlace);
            return flow.pasteFlowFragment(
                clipboardData.serializedData.object as FlowFragment,
                object
            );
        }
    };

    addObjects(flow: Flow, objects: IEezObject[]) {
        this.components = [];
        this.connectionLines = [];

        const DocumentStore = getDocumentStore(flow);

        const wireIDMap = new Set<string>();

        objects.forEach((object: Component) => {
            const clone = cloneObject(DocumentStore, object) as Component;
            this.components.push(clone);

            wireIDMap.add(object.wireID);

            const v = visitObjects(object);
            while (true) {
                let visitResult = v.next();
                if (visitResult.done) {
                    break;
                }
                if (
                    visitResult.value != object &&
                    visitResult.value instanceof Component
                ) {
                    wireIDMap.add(visitResult.value.wireID);
                }
            }
        });

        flow.connectionLines.forEach(connectionLine => {
            if (
                wireIDMap.has(connectionLine.source) &&
                wireIDMap.has(connectionLine.target)
            ) {
                const clone = cloneObject(
                    DocumentStore,
                    connectionLine
                ) as ConnectionLine;
                this.connectionLines.push(clone);
            }
        });
    }

    rewire() {
        const wireIDMap = new Map<string, string>();

        this.components.forEach((object: Component) => {
            const wireID = guid();
            wireIDMap.set(object.wireID, wireID);
            object.wireID = wireID;

            const v = visitObjects(object);
            while (true) {
                let visitResult = v.next();
                if (visitResult.done) {
                    break;
                }

                if (
                    visitResult.value != object &&
                    visitResult.value instanceof Component
                ) {
                    const wireID = guid();
                    wireIDMap.set(visitResult.value.wireID, wireID);
                    visitResult.value.wireID = wireID;
                }
            }
        });

        this.connectionLines.forEach(connectionLine => {
            const newSource = wireIDMap.get(connectionLine.source)!;
            const newTarget = wireIDMap.get(connectionLine.target)!;
            connectionLine.source = newSource;
            connectionLine.target = newTarget;
        });
    }
}

registerClass("FlowFragment", FlowFragment);

////////////////////////////////////////////////////////////////////////////////

export abstract class FlowTabState implements IEditorState {
    containerId = guid();

    constructor(public flow: Flow) {}

    @computed get flowState() {
        if (this.DocumentStore.runtime) {
            return this.DocumentStore.runtime.getFlowState(this.flow);
        }
        return undefined;
    }

    @computed get DocumentStore() {
        return getDocumentStore(this.flow);
    }

    @computed get isRuntime() {
        return !!this.DocumentStore.runtime;
    }

    abstract loadState(state: any): void;
    abstract saveState(): any;

    abstract get widgetContainer(): ITreeObjectAdapter;

    abstract get transform(): Transform;
    abstract set transform(transform: Transform);

    @action
    resetTransform(transform?: Transform) {
        if (!transform) {
            transform = this.transform;
        }
        transform.scale = 1;
        transform.translate = {
            x: -this.flow.pageRect.width / 2,
            y: -this.flow.pageRect.height / 2
        };
    }

    abstract get frontFace(): boolean;
    abstract set frontFace(value: boolean);

    @computed
    get selectedObject(): IEezObject | undefined {
        return this.widgetContainer.selectedObject || this.flow;
    }

    @computed
    get selectedObjects() {
        return this.widgetContainer.selectedObjects;
    }

    @action
    selectObject(object: IEezObject) {
        let ancestor: IEezObject | undefined;
        for (ancestor = object; ancestor; ancestor = getParent(ancestor)) {
            let item = this.widgetContainer.getObjectAdapter(ancestor);
            if (item) {
                this.widgetContainer.selectItems([item]);
                return;
            }
        }
    }

    @action
    selectObjects(objects: IEezObject[]) {
        const items: ITreeObjectAdapter[] = [];

        for (let i = 0; i < objects.length; i++) {
            const object = objects[i];

            let ancestor: IEezObject | undefined;
            for (ancestor = object; ancestor; ancestor = getParent(ancestor)) {
                let item = this.widgetContainer.getObjectAdapter(ancestor);
                if (item) {
                    items.push(item);
                    break;
                }
            }
        }

        this.widgetContainer.selectItems(items);
    }

    ensureSelectionVisible = () => {
        if (this.frontFace) {
            this.frontFace = false;
        }

        setTimeout(() => {
            const el = document.getElementById(this.containerId);
            if (el) {
                const event = new Event("ensure-selection-visible");
                el.dispatchEvent(event);

                setTimeout(() => {
                    const el = document.getElementById(this.containerId);
                    if (el) {
                        const event = new Event("ensure-selection-visible");
                        el.dispatchEvent(event);
                    }
                }, 50);
            }
        }, 50);
    };
}
