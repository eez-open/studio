import { TAB, NamingConvention, getName } from "project-editor/build/helper";

import type { Assets, DataBuffer } from "project-editor/build/assets";
import type { Flow } from "project-editor/flow/flow";
import { Component, isFlowProperty } from "project-editor/flow/component";
import {
    getClassesDerivedFrom,
    getClassName,
    getProperty,
    IObjectClassInfo,
    isPropertyHidden,
    MessageType
} from "project-editor/core/object";
import {
    getChildOfObject,
    getClass,
    getClassInfo,
    getHumanReadableObjectPath,
    getObjectPathAsString,
    Section
} from "project-editor/store";
import { visitObjects } from "project-editor/core/search";
import { CommentActionComponent } from "project-editor/flow/components/actions";
import {
    buildAssignableExpression,
    buildExpression,
    operationIndexes,
    templateLiteralToExpression
} from "project-editor/flow/expression";
import {
    buildConstantFlowValue,
    buildVariableFlowValue
} from "project-editor/build/values";
import { makeEndInstruction } from "project-editor/flow/expression/instructions";
import { FIRST_DASHBOARD_COMPONENT_TYPE } from "project-editor/flow/components/component_types";
import {
    basicTypeNames,
    SYSTEM_STRUCTURES,
    ValueType
} from "project-editor/features/variable/value-type";

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

function getFlowComponents(flow: Flow) {
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
    return components;
}

function getComponentIdOfComponent(assets: Assets, component: Component) {
    const classInfo = getClassInfo(component);
    let flowComponentId = classInfo.flowComponentId;

    if (
        flowComponentId == undefined &&
        assets.DocumentStore.project.isDashboardProject
    ) {
        const eezClass = getClass(component);
        const name = getClassName(eezClass);
        if (name) {
            flowComponentId =
                assets.dashboardComponentClassNameToComponentIdMap[name];
            if (flowComponentId == undefined) {
                flowComponentId = assets.nextDashboardComponentId++;
                assets.dashboardComponentClassNameToComponentIdMap[name] =
                    flowComponentId;
                assets.dashboardComponentTypeToNameMap[flowComponentId] = name;
            }
        } else {
            console.error("UNEXPECTED!");
        }
    }

    return flowComponentId;
}

function buildComponent(
    assets: Assets,
    dataBuffer: DataBuffer,
    flow: Flow,
    component: Component
) {
    const flowIndex = assets.getFlowIndex(flow);
    const componentIndex = assets.getComponentIndex(component);
    assets.map.flows[flowIndex].components[componentIndex] = {
        componentIndex,
        path: getObjectPathAsString(component),
        readablePath: getHumanReadableObjectPath(component),
        inputIndexes: {},
        outputs: [],
        outputIndexes: {},
        properties: [],
        propertyIndexes: {}
    };

    // type
    let flowComponentId = getComponentIdOfComponent(assets, component);
    if (flowComponentId != undefined) {
        dataBuffer.writeUint16(flowComponentId);
    } else {
        assets.DocumentStore.outputSectionsStore.write(
            Section.OUTPUT,
            MessageType.ERROR,
            "Component is not supported for the build target",
            component
        );
        dataBuffer.writeUint16(0);
    }

    // reserved
    dataBuffer.writeUint16(
        assets.DocumentStore.uiStateStore.isBreakpointEnabledForComponent(
            component
        )
            ? 1
            : 0
    );

    // inputs
    dataBuffer.writeNumberArray(component.buildInputs, input => {
        const inputIndex = assets.getComponentInputIndex(component, input.name);

        dataBuffer.writeUint16(inputIndex);

        assets.map.flows[flowIndex].components[componentIndex].inputIndexes[
            input.name
        ] = inputIndex;

        assets.map.flows[flowIndex].componentInputs.push({
            inputIndex,
            componentIndex,
            inputName: input.name,
            inputType: input.type
        });
    });

    // property values
    const properties = getClassInfo(component).properties.filter(propertyInfo =>
        isFlowProperty(propertyInfo, [
            "input",
            "template-literal",
            "assignable"
        ])
    );
    properties.forEach((propertyInfo, propertyValueIndex) =>
        assets.registerComponentProperty(
            component,
            propertyInfo.name,
            componentIndex,
            propertyValueIndex
        )
    );
    dataBuffer.writeArray(properties, (propertyInfo, propertyIndex) => {
        if (!isPropertyHidden(component, propertyInfo)) {
            try {
                let expression = getProperty(component, propertyInfo.name);
                if (propertyInfo.flowProperty == "assignable") {
                    buildAssignableExpression(
                        assets,
                        dataBuffer,
                        component,
                        expression
                    );
                } else {
                    if (propertyInfo.flowProperty == "template-literal") {
                        expression = templateLiteralToExpression(expression);
                    }
                    buildExpression(assets, dataBuffer, component, expression);
                }
            } catch (err) {
                assets.DocumentStore.outputSectionsStore.write(
                    Section.OUTPUT,
                    MessageType.ERROR,
                    err,
                    getChildOfObject(component, propertyInfo.name)
                );

                dataBuffer.writeUint16NonAligned(makeEndInstruction());
            }
        } else {
            dataBuffer.writeUint16NonAligned(makeEndInstruction());
        }

        assets.map.flows[flowIndex].components[componentIndex].properties.push({
            valueTypeIndex: assets.getTypeIndex(propertyInfo.expressionType!)
        });

        assets.map.flows[flowIndex].components[componentIndex].propertyIndexes[
            propertyInfo.name
        ] = propertyIndex;
    });

    // outputs
    const outputs = component.buildOutputs;
    outputs.forEach((output, componentOutputIndex) =>
        assets.registerComponentOutput(
            component,
            output.name,
            componentIndex,
            componentOutputIndex
        )
    );
    dataBuffer.writeArray(outputs, (output, outputIndex) => {
        const connectionLines = flow.connectionLines.filter(
            connectionLine =>
                connectionLine.sourceComponent === component &&
                connectionLine.output == output.name
        );

        const connectionLinesMap: {
            targetComponentIndex: number;
            targetInputIndex: number;
        }[] = [];

        dataBuffer.writeArray(connectionLines, connectionLine => {
            const targetComponentIndex = connectionLine.targetComponent
                ? assets.getComponentIndex(connectionLine.targetComponent)
                : -1;

            const targetInputIndex = connectionLine.targetComponent
                ? assets.getComponentInputIndex(
                      connectionLine.targetComponent,
                      connectionLine.input
                  )
                : -1;

            connectionLinesMap.push({
                targetComponentIndex,
                targetInputIndex
            });

            dataBuffer.writeUint16(targetComponentIndex);
            dataBuffer.writeUint16(targetInputIndex);
        });

        // isSeqOut
        dataBuffer.writeUint32(output.name === "@seqout" ? 1 : 0);

        assets.map.flows[flowIndex].components[componentIndex].outputs.push({
            outputName: output.name,
            valueTypeIndex: assets.getTypeIndex(output.valueType),
            connectionLines: connectionLinesMap
        });

        assets.map.flows[flowIndex].components[componentIndex].outputIndexes[
            output.name
        ] = outputIndex;
    });

    const errorCatchOutputIndex = component.buildOutputs.findIndex(
        buildOutput => buildOutput.name == "@error"
    );
    if (errorCatchOutputIndex != -1) {
        // errorCatchOutput
        dataBuffer.writeInt16(errorCatchOutputIndex);
        dataBuffer.writeUint16(0);
    } else {
        // errorCatchOutput
        dataBuffer.writeInt16(-1);
        dataBuffer.writeUint16(0);
    }

    // specific
    try {
        component.buildFlowComponentSpecific(assets, dataBuffer);
    } catch (err) {
        assets.DocumentStore.outputSectionsStore.write(
            Section.OUTPUT,
            MessageType.ERROR,
            err.toString(),
            component
        );
    }
}

function buildFlow(assets: Assets, dataBuffer: DataBuffer, flow: Flow) {
    const flowIndex = assets.getFlowIndex(flow);

    assets.map.flows[flowIndex] = {
        flowIndex,
        path: getObjectPathAsString(flow),
        readablePath: getHumanReadableObjectPath(flow),
        components: [],
        componentIndexes: {},
        componentInputs: [],
        localVariables: [],
        widgetDataItems: [],
        widgetActions: []
    };

    // components
    const components = getFlowComponents(flow);
    components.sort(
        (a, b) => assets.getComponentIndex(a) - assets.getComponentIndex(b)
    );
    dataBuffer.writeArray(components, component =>
        buildComponent(assets, dataBuffer, flow, component)
    );

    // localVariables
    assets.map.flows[flowIndex].localVariables = flow.localVariables.map(
        (localVariable, index) => ({
            index,
            name: localVariable.name
        })
    );
    dataBuffer.writeArray(
        flow.localVariables,
        localVariable =>
            buildVariableFlowValue(assets, dataBuffer, localVariable),
        8
    );

    const flowState = assets.getFlowState(flow);

    // componentInputs
    dataBuffer.writeFutureArray(() =>
        dataBuffer.writeNumberArray(
            flowState.commponentInputs,
            componentInput => {
                const COMPONENT_INPUT_FLAG_IS_SEQ_INPUT = 1 << 0;
                const COMPONENT_INPUT_FLAG_IS_OPTIONAL = 1 << 1;

                dataBuffer.writeUint8(
                    (componentInput.isSequenceInput
                        ? COMPONENT_INPUT_FLAG_IS_SEQ_INPUT
                        : 0) |
                        (componentInput.isOptionalInput
                            ? COMPONENT_INPUT_FLAG_IS_OPTIONAL
                            : 0)
                );
            }
        )
    );

    // widgetDataItems
    const widgetDataItems = [...flowState.flowWidgetDataIndexes.keys()];
    dataBuffer.writeArray(widgetDataItems, (_, i) => {
        const componentPropertyValue =
            flowState.flowWidgetDataIndexToComponentPropertyValue.get(i);
        if (componentPropertyValue) {
            dataBuffer.writeInt16(componentPropertyValue.componentIndex);
            dataBuffer.writeInt16(componentPropertyValue.propertyValueIndex);
        } else {
            assets.DocumentStore.outputSectionsStore.write(
                Section.OUTPUT,
                MessageType.ERROR,
                "Widget data item not found",
                flowState.flowWidgetFromDataIndex.get(i)
            );
            dataBuffer.writeInt16(-1);
            dataBuffer.writeInt16(-1);
        }
    });

    // widgetActions
    const widgetActions = [...flowState.flowWidgetActionIndexes.keys()];
    dataBuffer.writeArray(widgetActions, (_, i) => {
        const componentOutput =
            flowState.flowWidgetActionIndexToComponentOutput.get(i);
        if (componentOutput) {
            dataBuffer.writeInt16(componentOutput.componentIndex);
            dataBuffer.writeInt16(componentOutput.componentOutputIndex);
        } else {
            assets.DocumentStore.outputSectionsStore.write(
                Section.OUTPUT,
                MessageType.ERROR,
                "Widget action output not found",
                flowState.flowWidgetFromActionIndex.get(i)
            );
            dataBuffer.writeInt16(-1);
            dataBuffer.writeInt16(-1);
        }
    });
}

export function buildFlowData(assets: Assets, dataBuffer: DataBuffer) {
    if (
        assets.DocumentStore.project.isDashboardProject ||
        assets.DocumentStore.project.isAppletProject ||
        assets.DocumentStore.project.isFirmwareWithFlowSupportProject
    ) {
        dataBuffer.writeObjectOffset(() => {
            // flows
            dataBuffer.writeArray(assets.flows, flow => {
                if (flow) {
                    buildFlow(assets, dataBuffer, flow);
                }
            });

            // constants
            dataBuffer.writeFutureArray(() =>
                dataBuffer.writeArray(
                    assets.constants,
                    constant =>
                        buildConstantFlowValue(assets, dataBuffer, constant),
                    8
                )
            );

            // globalVariables
            assets.map.globalVariables = assets.globalVariables.map(
                (globalVariable, index) => ({
                    index,
                    name: globalVariable.name
                })
            );
            dataBuffer.writeArray(
                assets.globalVariables.filter(
                    globalVariable =>
                        !(
                            assets.option == "buildFiles" &&
                            globalVariable.native
                        ) // only non-native variables
                ),
                globalVariable =>
                    buildVariableFlowValue(assets, dataBuffer, globalVariable),
                8
            );
        });
    } else {
        dataBuffer.writeUint32(0);
    }
}

export function buildFlowDefs(assets: Assets) {
    const defs = [];

    const componentTypes = getComponentTypes();

    // enum ComponentTypes
    let componentTypeEnumItems = componentTypes.map(
        (componentType, i) =>
            `${TAB}${getName(
                "COMPONENT_TYPE_",
                {
                    name: getComponentName(componentType)
                },
                NamingConvention.UnderscoreUpperCase
            )} = ${getComponentId(componentType)}`
    );

    componentTypeEnumItems.unshift(`${TAB}COMPONENT_TYPE_NONE = 0`);

    componentTypeEnumItems.push(
        `${TAB}FIRST_DASHBOARD_COMPONENT_TYPE = ${FIRST_DASHBOARD_COMPONENT_TYPE}`
    );

    defs.push(
        `enum ComponentTypes {\n${componentTypeEnumItems.join(",\n")}\n};`
    );

    // enum Component_X_Properties
    componentTypes.forEach(componentType => {
        const componentName = getName(
            "",
            {
                name: componentType.objectClass.name
            },
            NamingConvention.UnderscoreUpperCase
        );

        const properties =
            componentType.objectClass.classInfo.properties.filter(
                propertyInfo =>
                    isFlowProperty(propertyInfo, [
                        "input",
                        "template-literal",
                        "assignable"
                    ])
            );

        let enumItems = properties.map(
            (propertyInfo, i) =>
                `${TAB}${getName(
                    `${componentName}_PROPERTY_`,
                    {
                        name: propertyInfo.name
                    },
                    NamingConvention.UnderscoreUpperCase
                )} = ${i}`
        );

        if (enumItems.length > 0) {
            defs.push(
                `enum Component_${componentName}_Properties {\n${enumItems.join(
                    ",\n"
                )}\n};`
            );
        }
    });

    // enum OperationTypes
    const operationEnumItems = [];
    for (const operationName in operationIndexes) {
        if (operationIndexes.hasOwnProperty(operationName)) {
            operationEnumItems.push(
                `${TAB}${getName(
                    "OPERATION_TYPE_",
                    {
                        name: operationName
                    },
                    NamingConvention.UnderscoreUpperCase
                )} = ${operationIndexes[operationName]}`
            );
        }
    }

    defs.push(`enum OperationTypes {\n${operationEnumItems.join(",\n")}\n};`);

    // enum SystemStructures
    const systemStructureEnumItems = [];
    for (const structure of SYSTEM_STRUCTURES) {
        systemStructureEnumItems.push(
            `${TAB}${getName(
                "SYSTEM_STRUCTURE_",
                {
                    name: structure.name
                },
                NamingConvention.UnderscoreUpperCase
            )} = ${assets.DocumentStore.typesStore.getValueTypeIndex(
                `struct:${structure.name}`
            )}`
        );
    }

    defs.push(
        `enum SystemStructures {\n${systemStructureEnumItems.join(",\n")}\n};`
    );

    for (const structure of SYSTEM_STRUCTURES) {
        const fieldEnumItems = [];
        for (const field of structure.fields) {
            fieldEnumItems.push(
                `${TAB}${getName(
                    "SYSTEM_STRUCTURE_",
                    {
                        name: structure.name
                    },
                    NamingConvention.UnderscoreUpperCase
                )}_${getName(
                    "FIELD_",
                    {
                        name: field.name
                    },
                    NamingConvention.UnderscoreUpperCase
                )} = ${assets.DocumentStore.typesStore.getFieldIndex(
                    `struct:${structure.name}`,
                    field.name
                )}`
            );
        }

        fieldEnumItems.push(
            `${TAB}${getName(
                "SYSTEM_STRUCTURE_",
                {
                    name: structure.name
                },
                NamingConvention.UnderscoreUpperCase
            )}_NUM_FIELDS`
        );

        defs.push(
            `enum ${structure.name.substring(
                1
            )}SystemStructureFields {\n${fieldEnumItems.join(",\n")}\n};`
        );
    }

    // enum ArrayType
    const arrayTypeEnumItems = [];
    for (const basicType of basicTypeNames) {
        arrayTypeEnumItems.push(
            `${TAB}${getName(
                "ARRAY_TYPE_",
                {
                    name: basicType
                },
                NamingConvention.UnderscoreUpperCase
            )} = ${assets.DocumentStore.typesStore.getValueTypeIndex(
                `array:${basicType}` as ValueType
            )}`
        );
    }

    defs.push(`enum ArrayTypes {\n${arrayTypeEnumItems.join(",\n")}\n};`);

    return defs.join("\n\n");
}
