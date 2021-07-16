import * as projectBuild from "project-editor/project/build";
import * as output from "project-editor/core/output";

import { Assets } from "project-editor/features/page/build/assets";
import {
    buildListData,
    DataBuffer,
    ObjectList,
    ObjectPtr,
    Struct,
    UInt16,
    UInt32,
    UInt8,
    String,
    StructRef,
    Float
} from "project-editor/features/page/build/pack";
import { Flow } from "project-editor/flow/flow";
import { Component } from "project-editor/flow/component";
import {
    getClassesDerivedFrom,
    getClassInfo,
    getHumanReadableObjectPath,
    getObjectPathAsString,
    IObjectClassInfo
} from "project-editor/core/object";
import { visitObjects } from "project-editor/core/search";

////////////////////////////////////////////////////////////////////////////////

function getComponentName(componentType: IObjectClassInfo) {
    if (componentType.name.endsWith("Component")) {
        return componentType.name.substr(
            0,
            componentType.name.length - "Component".length
        );
    }
    return componentType.name;
}

function getComponentId(componentType: IObjectClassInfo) {
    return componentType.objectClass.classInfo.flowComponentId;
}

function getComponentTypes() {
    return getClassesDerivedFrom(Component)
        .filter(componentType => getComponentId(componentType) != undefined)
        .sort((a, b) => getComponentId(a)! - getComponentId(b)!);
}

function buildComponent(flow: Flow, component: Component, assets: Assets) {
    const componentIndex = assets.getComponentIndex(component);

    const flowIndex = assets.getFlowIndex(flow);
    assets.map.flows[flowIndex].components[componentIndex] = {
        componentIndex,
        path: getObjectPathAsString(component),
        pathReadable: getHumanReadableObjectPath(component),
        inputs: [],
        outputs: []
    };

    let result = new Struct();

    // type
    let flowComponentId = getClassInfo(component).flowComponentId;
    if (flowComponentId != undefined) {
        result.addField(new UInt16(flowComponentId));
    } else {
        assets.DocumentStore.OutputSectionsStore.write(
            output.Section.OUTPUT,
            output.Type.ERROR,
            "Component is not supported for the build target",
            component
        );
        result.addField(new UInt16(0));
    }

    // List of ComponentInput's
    const componentInputs = new ObjectList();
    getComponentInputNames(component).forEach(input => {
        const componentInput = new Struct();

        const valueIndex = assets.getComponentInputValueIndex(component, input);

        const mapInputs: number[] = [];

        mapInputs.push(valueIndex);

        assets.map.flows[flowIndex].components[componentIndex].inputs.push(
            mapInputs
        );

        const values = new ObjectList();

        const value = new Struct();
        value.addField(new UInt16(valueIndex));
        values.addItem(value);

        componentInput.addField(values);

        assets.registerComponentInput(component, input.name, componentInput);

        componentInputs.addItem(componentInput);
    });
    result.addField(componentInputs);

    // List of ComponentOutput's
    const componentOutputs = new ObjectList();
    getComponentOutputNames(component).forEach(output => {
        const componentOutput = new Struct();

        const connections = new ObjectList();

        const mapOutputs: {
            targetComponentIndex: number;
            targetInputIndex: number;
        }[] = [];

        flow.connectionLines
            .filter(
                connectionLine =>
                    connectionLine.sourceComponent === component &&
                    connectionLine.output == output.name
            )
            .forEach(connectionLine => {
                const targetComponentIndex = connectionLine.targetComponent
                    ? assets.getComponentIndex(connectionLine.targetComponent)
                    : -1;

                const targetInputIndex = connectionLine.targetComponent
                    ? assets.getComponentInputIndex(
                          connectionLine.targetComponent,
                          connectionLine.input
                      )
                    : -1;

                mapOutputs.push({ targetComponentIndex, targetInputIndex });

                const connection = new Struct();
                connection.addField(new UInt16(targetComponentIndex));
                connection.addField(new UInt8(targetInputIndex));
                connections.addItem(connection);
            });

        componentOutput.addField(connections);

        assets.map.flows[flowIndex].components[componentIndex].outputs.push(
            mapOutputs
        );

        assets.registerComponentOutput(component, output.name, componentOutput);

        componentOutputs.addItem(componentOutput);
    });
    result.addField(componentOutputs);

    // specific
    try {
        result.addField(
            new ObjectPtr(component.buildFlowComponentSpecific(assets))
        );
    } catch (err) {
        assets.DocumentStore.OutputSectionsStore.write(
            output.Section.OUTPUT,
            output.Type.ERROR,
            err,
            component
        );
        result.addField(new ObjectPtr(undefined));
    }

    return result;
}

function buildFlow(flow: Flow, assets: Assets) {
    const flowIndex = assets.getFlowIndex(flow);

    assets.map.flows[flowIndex] = {
        flowIndex,
        path: getObjectPathAsString(flow),
        pathReadable: getHumanReadableObjectPath(flow),
        components: []
    };

    let result = new Struct();

    let componentList = new ObjectList();

    const components = [];

    const v = visitObjects(flow);
    while (true) {
        let visitResult = v.next();
        if (visitResult.done) {
            break;
        }
        if (visitResult.value instanceof Component) {
            const component = visitResult.value;
            components.push(component);
            assets.getComponentIndex(component);
        }
    }

    components.forEach(component => {
        componentList.addItem(buildComponent(flow, component, assets));
    });

    result.addField(componentList);

    return result;
}

function buildFlowValue(flowValue: FlowValue, assets: Assets) {
    let result = new Struct();

    result.addField(new UInt8(flowValue.type)); // type_
    result.addField(new UInt8(0)); // uint_
    result.addField(new UInt16(0)); // options_

    // union
    if (flowValue.type == FLOW_VALUE_TYPE_BOOLEAN) {
        result.addField(new UInt32(flowValue.value));
    } else if (flowValue.type == FLOW_VALUE_TYPE_FLOAT) {
        result.addField(new Float(flowValue.value));
    } else if (flowValue.type == FLOW_VALUE_TYPE_STRING) {
        result.addField(new String(flowValue.value));
    } else {
        result.addField(new UInt32(0));
    }

    return result;
}

///////////////////////////////////////////////////////////////////////////////

export const FLOW_VALUE_TYPE_UNDEFINED = 0;
export const FLOW_VALUE_TYPE_NULL = 1;
export const FLOW_VALUE_TYPE_BOOLEAN = 2;
export const FLOW_VALUE_TYPE_INT8 = 3;
export const FLOW_VALUE_TYPE_UINT8 = 4;
export const FLOW_VALUE_TYPE_INT16 = 5;
export const FLOW_VALUE_TYPE_UINT16 = 6;
export const FLOW_VALUE_TYPE_INT32 = 7;
export const FLOW_VALUE_TYPE_UINT32 = 8;
export const FLOW_VALUE_TYPE_FLOAT = 9;
export const FLOW_VALUE_TYPE_STRING = 10;

export function getComponentInputNames(component: Component) {
    const inputs: { name: string; type: "input" | "property" }[] = [
        { name: "@seqin", type: "input" }
    ];

    for (const propertyInfo of getClassInfo(component).properties) {
        if (propertyInfo.toggableProperty === "input") {
            inputs.push({
                name: propertyInfo.name,
                type:
                    !component.asInputProperties ||
                    component.asInputProperties.indexOf(propertyInfo.name) == -1
                        ? "property"
                        : "input"
            });
        }
    }

    for (const componentInput of component.inputs) {
        if (!inputs.find(input => input.name == componentInput.name)) {
            inputs.push({ name: componentInput.name, type: "input" });
        }
    }

    return inputs;
}

export function getComponentOutputNames(component: Component) {
    const outputs: { name: string; type: "output" | "property" }[] = [
        { name: "@seqout", type: "output" }
    ];

    for (const propertyInfo of getClassInfo(component).properties) {
        if (propertyInfo.toggableProperty === "output") {
            outputs.push({
                name: propertyInfo.name,
                type:
                    !component.asOutputProperties ||
                    component.asOutputProperties.indexOf(propertyInfo.name) ==
                        -1
                        ? "property"
                        : "output"
            });
        }
    }

    for (const componentOutput of component.outputs) {
        if (!outputs.find(output => output.name == componentOutput.name)) {
            outputs.push({ name: componentOutput.name, type: "output" });
        }
    }

    return outputs;
}

export function getFlowValueType(value: any) {
    if (typeof value === "boolean") {
        return FLOW_VALUE_TYPE_BOOLEAN;
    } else if (typeof value === "number") {
        return FLOW_VALUE_TYPE_FLOAT;
    } else if (typeof value === "string") {
        return FLOW_VALUE_TYPE_STRING;
    } else if (typeof value === "undefined") {
        return FLOW_VALUE_TYPE_UNDEFINED;
    }
    return FLOW_VALUE_TYPE_NULL;
}

export interface FlowValue {
    index: number;
    type: number;
    value: any;
}

export function buildFlowDefs(assets: Assets) {
    const defs = [];

    const componentTypes = getComponentTypes();

    // enum ComponentTypes
    let componentTypeEnumItems = componentTypes.map(
        (componentType, i) =>
            `${projectBuild.TAB}${projectBuild.getName(
                "COMPONENT_TYPE_",
                {
                    name: getComponentName(componentType)
                },
                projectBuild.NamingConvention.UnderscoreUpperCase
            )} = ${getComponentId(componentType)}`
    );

    componentTypeEnumItems.unshift(
        `${projectBuild.TAB}COMPONENT_TYPE_NONE = 0`
    );

    defs.push(
        `enum ComponentTypes {\n${componentTypeEnumItems.join(",\n")}\n};`
    );

    // enum Component_X_Inputs
    componentTypes.forEach(componentType => {
        const componentName = projectBuild.getName(
            "",
            {
                name: componentType.objectClass.name
            },
            projectBuild.NamingConvention.UnderscoreUpperCase
        );

        let enumItems = componentType.objectClass.classInfo.properties
            .filter(propertyInfo => propertyInfo.toggableProperty === "input")
            .map(
                (propertyInfo, i) =>
                    `${projectBuild.TAB}${projectBuild.getName(
                        `${componentName}_INPUT_`,
                        {
                            name: propertyInfo.name
                        },
                        projectBuild.NamingConvention.UnderscoreUpperCase
                    )} = ${i + 1}`
            );

        if (enumItems.length > 0) {
            defs.push(
                `enum Component_${componentName}_Inputs {\n${enumItems.join(
                    ",\n"
                )}\n};`
            );
        }
    });

    // enum Component_X_Outputs
    componentTypes.forEach(componentType => {
        const componentName = projectBuild.getName(
            "",
            {
                name: componentType.objectClass.name
            },
            projectBuild.NamingConvention.UnderscoreUpperCase
        );

        let enumItems = componentType.objectClass.classInfo.properties
            .filter(propertyInfo => propertyInfo.toggableProperty === "output")
            .map(
                (propertyInfo, i) =>
                    `${projectBuild.TAB}${projectBuild.getName(
                        `${componentName}_OUTPUT_`,
                        {
                            name: propertyInfo.name
                        },
                        projectBuild.NamingConvention.UnderscoreUpperCase
                    )} = ${i + 1}`
            );

        if (enumItems.length > 0) {
            defs.push(
                `enum Component_${componentName}_Outputs {\n${enumItems.join(
                    ",\n"
                )}\n};`
            );
        }
    });

    return defs.join("\n\n");
}

export function buildFlowData(assets: Assets, dataBuffer: DataBuffer | null) {
    return buildListData((document: Struct) => {
        let flows = new ObjectList();
        let flowValues = new ObjectList();
        let widgetDataItems = new ObjectList();
        let widgetActions = new ObjectList();

        if (assets.DocumentStore.isAppletProject) {
            assets.flows.forEach(flow => {
                flows.addItem(buildFlow(flow, assets));
            });

            assets.flowValues.forEach(flowValue => {
                flowValues.addItem(buildFlowValue(flowValue, assets));
            });

            for (let i = 0; i < assets.flowWidgetDataIndexes.size; i++) {
                const componentInput =
                    assets.flowWidgetDataIndexComponentInput.get(i);
                if (componentInput) {
                    widgetDataItems.addItem(new StructRef(componentInput));
                } else {
                    assets.DocumentStore.OutputSectionsStore.write(
                        output.Section.OUTPUT,
                        output.Type.ERROR,
                        "Widget data item input not found"
                    );
                }
            }

            for (let i = 0; i < assets.flowWidgetActionIndexes.size; i++) {
                const componentOutput =
                    assets.flowWidgetActionComponentOutput.get(i);
                if (componentOutput) {
                    widgetActions.addItem(new StructRef(componentOutput));
                } else {
                    assets.DocumentStore.OutputSectionsStore.write(
                        output.Section.OUTPUT,
                        output.Type.ERROR,
                        "Widget action output not found"
                    );
                }
            }
        }

        document.addField(flows);
        document.addField(flowValues);
        document.addField(widgetDataItems);
        document.addField(widgetActions);
    }, dataBuffer);
}
