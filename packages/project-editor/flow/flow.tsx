import React from "react";
import { computed, observable, makeObservable, toJS } from "mobx";
import {
    ClassInfo,
    EezObject,
    getParent,
    IEezObject,
    isAncestor,
    isSubclassOf,
    PropertyInfo,
    PropertyType,
    registerClass,
    SerializedData,
    setParent
} from "project-editor/core/object";
import { visitObjects } from "project-editor/core/search";
import {
    getProjectStore,
    getAncestorOfType,
    ProjectStore,
    createObject,
    getClass,
    objectToClipboardData
} from "project-editor/store";
import {
    ActionComponent,
    Component,
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
import { ProjectEditor } from "project-editor/project-editor-interface";
import type { LVGLWidget } from "project-editor/lvgl/widgets";
import { ConnectionLine } from "project-editor/flow/connection-line";
import {
    userPropertiesProperty,
    UserProperty
} from "project-editor/flow/user-property";

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
            },
            userPropertiesProperty
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

            if (!jsObject.userProperties) {
                jsObject.userProperties = [];
            }
        }
    };

    components: Component[] = [];
    connectionLines: ConnectionLine[] = [];
    localVariables: Variable[] = [];
    userProperties: UserProperty[];

    get userPropertiesAndLocalVariables() {
        return [...this.userProperties, ...this.localVariables];
    }

    constructor() {
        super();

        makeObservable(this, {
            actionComponents: computed,
            startComponent: computed,
            endComponent: computed,
            inputComponents: computed,
            outputComponents: computed,
            userPropertiesAndLocalVariables: computed
        });
    }

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            components: observable,
            connectionLines: observable,
            localVariables: observable,
            userProperties: observable
        });
    }

    get actionComponents() {
        const components = [];

        for (const component of visitObjects(this.components)) {
            if (component instanceof ActionComponent) {
                components.push(component);
            }
        }

        return components;
    }

    objectsToClipboardData(objects: IEezObject[]) {
        const flowFragment = new FlowFragment();
        flowFragment.addObjects(this, objects);
        setParent(flowFragment, this);
        return objectToClipboardData(
            ProjectEditor.getProjectStore(this),
            flowFragment
        );
    }

    deleteConnectionLines(component: Component) {
        this.connectionLines
            .filter(
                connectionLine =>
                    isAncestor(connectionLine.sourceComponent, component) ||
                    isAncestor(connectionLine.targetComponent, component)
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
        icon: (
            <svg viewBox="0 0 36 36">
                <path
                    className="clr-i-outline clr-i-outline-path-1"
                    d="M9.8 18.8h16.4v3.08h1.6V17.2h-9V14h-1.6v3.2h-9v4.68h1.6z"
                />
                <path
                    d="M14 23H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2M4 31v-6h10v6Z"
                    className="clr-i-outline clr-i-outline-path-2"
                />
                <path
                    d="M32 23H22a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2m-10 8v-6h10v6Z"
                    className="clr-i-outline clr-i-outline-path-3"
                />
                <path
                    d="M13 13h10a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2H13a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2m0-8h10v6H13Z"
                    className="clr-i-outline clr-i-outline-path-4"
                />
                <path fill="none" d="M0 0h36v36H0z" />
            </svg>
        ),

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
            const pasteFlowFragment = clipboardData.serializedData
                .object as FlowFragment;
            const projectStore = getProjectStore(flow);

            return FlowFragment.paste(
                projectStore,
                flow,
                pasteFlowFragment,
                object
            );
        }
    };

    static paste(
        projectStore: ProjectStore,
        flow: Flow,
        pasteFlowFragment: FlowFragment,
        object: IEezObject
    ) {
        const flowFragment = createObject(
            projectStore,
            pasteFlowFragment,
            FlowFragment,
            undefined,
            false
        );

        let closeCombineCommands = false;
        if (!projectStore.undoManager.combineCommands) {
            projectStore.undoManager.setCombineCommands(true);
            closeCombineCommands = true;
        }

        let components: EezObject[] = [];

        if (flowFragment.connectionLines.length > 0) {
            flowFragment.connectionLines.forEach(connectionLine =>
                projectStore.addObject(flow.connectionLines, connectionLine)
            );

            flowFragment.components.forEach(component => {
                components.push(
                    projectStore.addObject(flow.components, component)
                );
            });
        } else {
            if (
                (object instanceof Widget ||
                    object instanceof ProjectEditor.LVGLWidgetClass) &&
                flowFragment.components.every(
                    component => component instanceof Widget
                )
            ) {
                let containerAncestor:
                    | ContainerWidget
                    | SelectWidget
                    | LVGLWidget
                    | undefined = getAncestorOfType(
                    getParent(getParent(object)),
                    ContainerWidget.classInfo
                ) as ContainerWidget | undefined;

                if (!containerAncestor) {
                    containerAncestor = getAncestorOfType(
                        getParent(getParent(object)),
                        SelectWidget.classInfo
                    ) as SelectWidget | undefined;
                    if (!containerAncestor) {
                        containerAncestor = getAncestorOfType(
                            getParent(getParent(object)),
                            ProjectEditor.LVGLWidgetClass.classInfo
                        ) as LVGLWidget | undefined;
                    }
                }

                if (containerAncestor) {
                    const parent =
                        containerAncestor instanceof
                        ProjectEditor.LVGLWidgetClass
                            ? containerAncestor.children
                            : containerAncestor.widgets;

                    flowFragment.components.forEach(component => {
                        components.push(
                            projectStore.addObject(parent, component)
                        );
                    });
                } else {
                    flowFragment.components.forEach(component => {
                        components.push(
                            projectStore.addObject(flow.components, component)
                        );
                    });
                }
            } else {
                flowFragment.components.forEach(component => {
                    components.push(
                        projectStore.addObject(flow.components, component)
                    );
                });
            }
        }

        if (closeCombineCommands) {
            projectStore.undoManager.setCombineCommands(false);
        }

        return components;
    }

    addObjects(flow: Flow, objects: IEezObject[]) {
        this.components = [];
        this.connectionLines = [];

        const projectStore = getProjectStore(flow);

        const objIDMap = new Set<string>();

        function cloneObject<T extends EezObject>(
            projectStore: ProjectStore,
            obj: T
        ) {
            return createObject<T>(
                projectStore,
                toJS(obj),
                getClass(obj),
                undefined,
                false // createNewObjectobjIDs
            );
        }

        objects.forEach((object: Component) => {
            if (!(object instanceof Component)) {
                return;
            }
            const clone = cloneObject(projectStore, object) as Component;
            this.components.push(clone);

            objIDMap.add(object.objID);

            for (const object2 of visitObjects(object)) {
                if (object2 != object && object2 instanceof Component) {
                    objIDMap.add(object2.objID);
                }
            }
        });

        flow.connectionLines.forEach(connectionLine => {
            if (
                objIDMap.has(connectionLine.source) &&
                objIDMap.has(connectionLine.target)
            ) {
                const clone = cloneObject(
                    projectStore,
                    connectionLine
                ) as ConnectionLine;
                this.connectionLines.push(clone);
            }
        });
    }
}

registerClass("FlowFragment", FlowFragment);
