import * as projectBuild from "project-editor/project/build";
import * as output from "project-editor/core/output";

import { Assets, DataBuffer } from "project-editor/features/page/build/assets";
import { Flow } from "project-editor/flow/flow";
import { Component } from "project-editor/flow/component";
import {
    getClassesDerivedFrom,
    getClassInfo,
    getHumanReadableObjectPath,
    getObjectPathAsString,
    getProperty,
    IObjectClassInfo
} from "project-editor/core/object";
import { visitObjects } from "project-editor/core/search";
import { Variable } from "project-editor/features/variable/variable";
import { CommentActionComponent } from "project-editor/flow/action-components";
import { buildExpression } from "project-editor/flow/expression";

///////////////////////////////////////////////////////////////////////////////

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

export function buildFlowData(assets: Assets, dataBuffer: DataBuffer) {
    function buildFlow(flow: Flow) {
        function buildComponent(component: Component) {
            const componentIndex = assets.getComponentIndex(component);

            const flowIndex = assets.getFlowIndex(flow);
            assets.map.flows[flowIndex].components[componentIndex] = {
                componentIndex,
                path: getObjectPathAsString(component),
                pathReadable: getHumanReadableObjectPath(component),
                inputs: [],
                outputs: []
            };

            // type
            let flowComponentId = getClassInfo(component).flowComponentId;
            if (flowComponentId != undefined) {
                dataBuffer.writeUint16(flowComponentId);
            } else {
                assets.DocumentStore.OutputSectionsStore.write(
                    output.Section.OUTPUT,
                    output.Type.ERROR,
                    "Component is not supported for the build target",
                    component
                );
                dataBuffer.writeUint16(0);
            }

            // reserved
            dataBuffer.writeUint16(0);

            // inputs
            dataBuffer.writeNumberArray(component.inputs, input => {
                assets.registerComponentInput(
                    component,
                    input.name,
                    dataBuffer.currentOffset
                );

                const inputIndex = assets.getComponentInputIndex(
                    component,
                    input.name
                );

                dataBuffer.writeUint16(inputIndex);

                assets.map.flows[flowIndex].components[
                    componentIndex
                ].inputs.push(inputIndex);
            });

            // property values
            dataBuffer.writeArray(
                getClassInfo(component).properties.filter(
                    propertyInfo => propertyInfo.toggableProperty === "input"
                ),
                propertyInfo => {
                    if (
                        component.asInputProperties &&
                        component.asInputProperties.indexOf(
                            propertyInfo.name
                        ) != -1
                    ) {
                        // as input
                        buildExpression(
                            assets,
                            dataBuffer,
                            component,
                            propertyInfo.name
                        );
                    } else {
                        // as property
                        buildExpression(
                            assets,
                            dataBuffer,
                            component,
                            getProperty(component, propertyInfo.name)
                        );
                    }
                }
            );

            // outputs
            dataBuffer.writeArray(
                getComponentOutputNames(component),
                output => {
                    assets.registerComponentOutput(
                        component,
                        output.name,
                        dataBuffer.currentOffset
                    );

                    const connectionLines = flow.connectionLines.filter(
                        connectionLine =>
                            connectionLine.sourceComponent === component &&
                            connectionLine.output == output.name
                    );

                    const mapOutputs: {
                        targetComponentIndex: number;
                        targetInputIndex: number;
                    }[] = [];

                    dataBuffer.writeArray(connectionLines, connectionLine => {
                        const targetComponentIndex =
                            connectionLine.targetComponent
                                ? assets.getComponentIndex(
                                      connectionLine.targetComponent
                                  )!
                                : -1;

                        const targetInputIndex = connectionLine.targetComponent
                            ? assets.getComponentInputIndex(
                                  connectionLine.targetComponent,
                                  connectionLine.input
                              )
                            : -1;

                        mapOutputs.push({
                            targetComponentIndex,
                            targetInputIndex
                        });

                        dataBuffer.writeUint16(targetComponentIndex);
                        dataBuffer.writeUint8(targetInputIndex);
                    });

                    assets.map.flows[flowIndex].components[
                        componentIndex
                    ].outputs.push(mapOutputs);
                }
            );

            // specific
            try {
                component.buildFlowComponentSpecific(assets, dataBuffer);
            } catch (err) {
                assets.DocumentStore.OutputSectionsStore.write(
                    output.Section.OUTPUT,
                    output.Type.ERROR,
                    err,
                    component
                );
            }
        }

        const flowIndex = assets.getFlowIndex(flow);

        assets.map.flows[flowIndex] = {
            flowIndex,
            path: getObjectPathAsString(flow),
            pathReadable: getHumanReadableObjectPath(flow),
            components: [],
            widgetDataItems: [],
            widgetActions: []
        };

        const components: Component[] = [];
        const v = visitObjects(flow);
        while (true) {
            let visitResult = v.next();
            if (visitResult.done) {
                break;
            }
            if (visitResult.value instanceof Component) {
                const component = visitResult.value;
                if (!(component instanceof CommentActionComponent)) {
                    components.push(component);
                }
            }
        }

        dataBuffer.writeArray(components, buildComponent);

        // localVariables
        dataBuffer.writeArray(flow.localVariables, buildVariable);

        const flowState = assets.getFlowState(flow);

        // widgetDataItems
        dataBuffer.writeArray(
            [...flowState.flowWidgetDataIndexes.keys()],
            (_, i) => {
                const componentInputOffset =
                    flowState.flowWidgetDataIndexComponentInput.get(i);
                if (componentInputOffset != undefined) {
                    dataBuffer.writeUint32(componentInputOffset);
                } else {
                    assets.DocumentStore.OutputSectionsStore.write(
                        output.Section.OUTPUT,
                        output.Type.ERROR,
                        "Widget data item input not found"
                    );
                    dataBuffer.writeUint32(0);
                }
            }
        );

        // widgetActions
        dataBuffer.writeArray(
            [...flowState.flowWidgetActionIndexes.keys()],
            (_, i) => {
                const componentOutputOffset =
                    flowState.flowWidgetActionComponentOutput.get(i);
                if (componentOutputOffset != undefined) {
                    dataBuffer.writeUint32(componentOutputOffset);
                } else {
                    assets.DocumentStore.OutputSectionsStore.write(
                        output.Section.OUTPUT,
                        output.Type.ERROR,
                        "Widget action output not found"
                    );
                    dataBuffer.writeUint32(0);
                }
            }
        );

        // nInputValues
        dataBuffer.writeUint16(
            assets.getFlowState(flow).componentInputIndexes.size
        );
    }

    function buildFlowValue(flowValue: FlowValue) {
        dataBuffer.writeUint8(flowValue.type); // type_
        dataBuffer.writeUint8(0); // unit_
        dataBuffer.writeUint16(0); // options_

        // union
        if (flowValue.type == FLOW_VALUE_TYPE_BOOLEAN) {
            dataBuffer.writeUint32(flowValue.value);
        } else if (flowValue.type == FLOW_VALUE_TYPE_FLOAT) {
            dataBuffer.writeFloat(flowValue.value);
        } else if (flowValue.type == FLOW_VALUE_TYPE_STRING) {
            dataBuffer.writeObjectOffset(() => {
                dataBuffer.writeString(flowValue.value);
            });
        } else {
            dataBuffer.writeUint32(0);
        }
    }

    function buildVariable(variable: Variable) {
        buildFlowValue({
            type: getFlowValueType(variable.defaultValue),
            value: variable.defaultValue
        });
    }

    if (assets.DocumentStore.isAppletProject) {
        dataBuffer.writeObjectOffset(() => {
            // flows
            dataBuffer.writeArray(assets.flows, buildFlow);

            // constants
            dataBuffer.writeArray(assets.constants, buildFlowValue);

            // globalVariables
            dataBuffer.writeArray(assets.globalVariables, buildVariable);
        });
    } else {
        dataBuffer.writeUint32(0);
    }
}
