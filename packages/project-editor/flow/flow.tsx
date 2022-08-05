import React from "react";
import { guid } from "eez-studio-shared/guid";
import { action, computed, observable, makeObservable, toJS } from "mobx";
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
    Message,
    getAncestorOfType,
    ProjectEditorStore,
    createObject,
    getClass
} from "project-editor/store";
import {
    ActionComponent,
    Component,
    getInputDisplayName,
    getOutputDisplayName,
    Widget
} from "project-editor/flow/component";
import type { IFlowContext } from "project-editor/flow/flow-interfaces";
import { Rect } from "eez-studio-shared/geometry";
import { deleteObject, updateObject } from "project-editor/store";
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
import { ProjectEditor } from "project-editor/project-editor-interface";
import { IEditorState } from "project-editor/project/EditorComponent";
import { activateConnectionLine } from "project-editor/flow/editor/real-time-traffic-visualizer";
import { isImplicitConversionPossible } from "project-editor/flow/expression/type";

////////////////////////////////////////////////////////////////////////////////

export class ConnectionLine extends EezObject {
    description: string;
    source: string;
    output: string;
    target: string;
    input: string;

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
            }
        ],

        isSelectable: () => true,

        deleteObjectFilterHook: (connectionLine: ConnectionLine) => {
            const page = getParent(getParent(connectionLine)) as Flow;
            return page.connectionLines.indexOf(connectionLine) != -1;
        },

        check: (connectionLine: ConnectionLine) => {
            let messages: Message[] = [];

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

            return messages;
        }
    };

    constructor() {
        super();

        makeObservable(this, {
            description: observable,
            source: observable,
            output: observable,
            target: observable,
            input: observable,
            _active: observable,
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
        }
    };

    components: Component[] = [];
    connectionLines: ConnectionLine[] = [];
    localVariables: Variable[] = [];

    constructor() {
        super();

        makeObservable(this, {
            components: observable,
            connectionLines: observable,
            localVariables: observable,

            actionComponents: computed,
            startComponent: computed,
            endComponent: computed,
            inputComponents: computed,
            outputComponents: computed
        });
    }

    get actionComponents() {
        const components = [];

        const v = visitObjects(this.components);
        while (true) {
            let visitResult = v.next();
            if (visitResult.done) {
                break;
            }
            if (visitResult.value instanceof ActionComponent) {
                const component = visitResult.value;
                components.push(component);
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
        const projectEditorStore = getDocumentStore(this);

        projectEditorStore.undoManager.setCombineCommands(true);

        flowFragment.rewire();

        let components: EezObject[];

        if (flowFragment.connectionLines.length > 0) {
            projectEditorStore.addObjects(
                this.connectionLines,
                flowFragment.connectionLines
            );

            components = projectEditorStore.addObjects(
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
                components = projectEditorStore.addObjects(
                    object.widgets,
                    flowFragment.components
                );
            } else {
                components = projectEditorStore.addObjects(
                    this.components,
                    flowFragment.components
                );
            }
        }

        projectEditorStore.undoManager.setCombineCommands(false);

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

    get startComponent() {
        return this.components.find(
            component => component instanceof StartActionComponent
        );
    }

    get endComponent() {
        return this.components.find(
            component => component instanceof EndActionComponent
        );
    }

    get inputComponents() {
        return this.components
            .filter(component => component instanceof InputActionComponent)
            .sort((a, b) => a.top - b.top) as InputActionComponent[];
    }

    get outputComponents() {
        return this.components
            .filter(component => component instanceof OutputActionComponent)
            .sort((a, b) => a.top - b.top) as OutputActionComponent[];
    }

    abstract renderWidgetComponents(flowContext: IFlowContext): React.ReactNode;
    abstract renderActionComponents(flowContext: IFlowContext): React.ReactNode;
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

        const projectEditorStore = getDocumentStore(flow);

        const objIDMap = new Set<string>();

        function cloneObject<T extends EezObject>(
            projectEditorStore: ProjectEditorStore,
            obj: T
        ) {
            return createObject<T>(
                projectEditorStore,
                toJS(obj),
                getClass(obj),
                undefined,
                false // createNewObjectobjIDs
            );
        }

        objects.forEach((object: Component) => {
            const clone = cloneObject(projectEditorStore, object) as Component;
            this.components.push(clone);

            objIDMap.add(object.objID);

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
                    objIDMap.add(visitResult.value.objID);
                }
            }
        });

        flow.connectionLines.forEach(connectionLine => {
            if (
                objIDMap.has(connectionLine.source) &&
                objIDMap.has(connectionLine.target)
            ) {
                const clone = cloneObject(
                    projectEditorStore,
                    connectionLine
                ) as ConnectionLine;
                this.connectionLines.push(clone);
            }
        });
    }

    rewire() {
        const objIDMap = new Map<string, string>();

        this.components.forEach((object: Component) => {
            const objID = guid();
            objIDMap.set(object.objID, objID);
            object.objID = objID;

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
                    const objID = guid();
                    objIDMap.set(visitResult.value.objID, objID);
                    visitResult.value.objID = objID;
                }
            }
        });

        this.connectionLines.forEach(connectionLine => {
            const newSource = objIDMap.get(connectionLine.source)!;
            const newTarget = objIDMap.get(connectionLine.target)!;
            connectionLine.source = newSource;
            connectionLine.target = newTarget;
        });
    }
}

registerClass("FlowFragment", FlowFragment);

////////////////////////////////////////////////////////////////////////////////

export abstract class FlowTabState implements IEditorState {
    containerId = guid();

    constructor(public flow: Flow) {
        makeObservable(this, {
            flowState: computed,
            projectEditorStore: computed,
            isRuntime: computed,
            resetTransform: action,
            selectedObject: computed,
            selectedObjects: computed,
            selectObject: action,
            selectObjects: action
        });
    }

    get flowState() {
        if (this.projectEditorStore.runtime) {
            return this.projectEditorStore.runtime.getFlowState(this.flow);
        }
        return undefined;
    }

    get projectEditorStore() {
        return getDocumentStore(this.flow);
    }

    get isRuntime() {
        return !!this.projectEditorStore.runtime;
    }

    abstract get widgetContainer(): ITreeObjectAdapter;

    abstract get transform(): Transform;
    abstract set transform(transform: Transform);

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

    get selectedObject(): IEezObject | undefined {
        return this.widgetContainer.selectedObject || this.flow;
    }

    get selectedObjects() {
        return this.widgetContainer.selectedObjects;
    }

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

    static ensureSelectionVisibleState:
        | {
              startTime: number;
              intervalId: NodeJS.Timer;
              el: HTMLElement | null;
              flowTabState: FlowTabState;
              objects: IEezObject[];
          }
        | undefined;

    selectObjectsAndEnsureVisible = (objects: IEezObject[]) => {
        if (
            objects.length == 1 &&
            !(
                objects[0] instanceof Component ||
                objects[0] instanceof ConnectionLine
            )
        ) {
            const object = getAncestorOfType(objects[0], Component.classInfo);
            if (object) {
                objects = [object];
            }
        }

        if (this.frontFace) {
            this.frontFace = false;
        }

        let state = FlowTabState.ensureSelectionVisibleState;
        if (state) {
            clearInterval(state.intervalId);
            FlowTabState.ensureSelectionVisibleState = undefined;
        }

        const intervalId = setInterval(() => {
            const state = FlowTabState.ensureSelectionVisibleState;
            if (!state) {
                return;
            }

            let objectsAreSelected: boolean = true;
            if (this.selectedObjects.length != state.objects.length) {
                objectsAreSelected = false;
            } else {
                for (let i = 0; i < state.objects.length; i++) {
                    if (this.selectedObjects.indexOf(state.objects[i]) == -1) {
                        objectsAreSelected = false;
                        break;
                    }
                }
            }

            if (objectsAreSelected) {
                if (state.el == null) {
                    state.el = document.getElementById(this.containerId);
                }

                if (state.el != null) {
                    const event = new Event("ensure-selection-visible");
                    state.el.dispatchEvent(event);
                }
            } else {
                this.selectObjects(state.objects);
            }

            const TIMEOUT = 250;
            if (Date.now() - state.startTime >= TIMEOUT) {
                clearInterval(state.intervalId);
                FlowTabState.ensureSelectionVisibleState = undefined;
            }
        }, 5);

        FlowTabState.ensureSelectionVisibleState = state = {
            startTime: Date.now(),
            intervalId,
            el: null,
            flowTabState: this,
            objects
        };

        this.selectObjects(objects);
    };

    onEnsureSelectionVisibleIsDone() {
        let state = FlowTabState.ensureSelectionVisibleState;
        if (state && state.flowTabState == this) {
            clearInterval(state.intervalId);
            FlowTabState.ensureSelectionVisibleState = undefined;
        }
    }
}
