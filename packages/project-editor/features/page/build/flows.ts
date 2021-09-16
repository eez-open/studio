import * as projectBuild from "project-editor/project/build";
import * as output from "project-editor/core/output";

import { Assets, DataBuffer } from "project-editor/features/page/build/assets";
import { Flow } from "project-editor/flow/flow";
import { Component, isToggableProperty } from "project-editor/flow/component";
import {
    getChildOfObject,
    getClassesDerivedFrom,
    getClassInfo,
    getHumanReadableObjectPath,
    getObjectPathAsString,
    getProperty,
    IObjectClassInfo
} from "project-editor/core/object";
import { visitObjects } from "project-editor/core/search";
import {
    CommentActionComponent,
    OutputActionComponent
} from "project-editor/flow/action-components";
import {
    buildExpression,
    operationIndexes
} from "project-editor/flow/expression/expression";
import {
    getVariableFlowValue,
    buildConstantFlowValue,
    buildVariableFlowValue
} from "./value";
import { makeEndInstruction } from "project-editor/flow/expression/instructions";

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
    dataBuffer.writeNumberArray(component.buildInputs, input => {
        const inputIndex = assets.getComponentInputIndex(component, input.name);

        dataBuffer.writeUint16(inputIndex);

        assets.map.flows[flowIndex].components[componentIndex].inputs.push(
            inputIndex
        );
    });

    // property values
    const properties = getClassInfo(component).properties.filter(propertyInfo =>
        isToggableProperty(assets.DocumentStore, propertyInfo, "input")
    );
    properties.forEach((propertyInfo, propertyValueIndex) =>
        assets.registerComponentProperty(
            component,
            propertyInfo.name,
            componentIndex,
            propertyValueIndex
        )
    );
    dataBuffer.writeArray(properties, propertyInfo => {
        try {
            if (
                component.asInputProperties &&
                component.asInputProperties.indexOf(propertyInfo.name) != -1
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
        } catch (err) {
            assets.DocumentStore.OutputSectionsStore.write(
                output.Section.OUTPUT,
                output.Type.ERROR,
                err,
                getChildOfObject(component, propertyInfo.name)
            );

            dataBuffer.writeUint16NonAligned(makeEndInstruction());
        }
    });

    // outputs
    const outputs = component.buildOutputs;
    outputs.forEach(output =>
        assets.registerComponentOutput(component, output.name, 0)
    );
    dataBuffer.writeArray(outputs, output => {
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
            const targetComponentIndex = connectionLine.targetComponent
                ? assets.getComponentIndex(connectionLine.targetComponent)
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
            dataBuffer.writeUint8(
                connectionLine.input == "@seqin" &&
                    !(
                        connectionLine.targetComponent instanceof
                        OutputActionComponent
                    )
                    ? 1
                    : 0
            );
        });

        assets.map.flows[flowIndex].components[componentIndex].outputs.push(
            mapOutputs
        );
    });

    const errorCatchOutputIndex = component.buildOutputs.findIndex(
        buildOutput => buildOutput.name == "@error"
    );
    if (errorCatchOutputIndex != -1) {
        // errorCatchOutput
        dataBuffer.writeInt16(errorCatchOutputIndex);

        // logError
        dataBuffer.writeUint16(component.logError ? 1 : 0);
    } else {
        // errorCatchOutput
        dataBuffer.writeInt16(-1);

        // logError
        dataBuffer.writeUint16(1);
    }

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

function buildFlow(assets: Assets, dataBuffer: DataBuffer, flow: Flow) {
    const flowIndex = assets.getFlowIndex(flow);

    assets.map.flows[flowIndex] = {
        flowIndex,
        path: getObjectPathAsString(flow),
        pathReadable: getHumanReadableObjectPath(flow),
        components: [],
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
            buildVariableFlowValue(
                dataBuffer,
                getVariableFlowValue(assets, localVariable)
            ),
        8
    );

    // widgetDataItems
    const flowState = assets.getFlowState(flow);
    dataBuffer.writeArray(
        [...flowState.flowWidgetDataIndexes.keys()],
        (_, i) => {
            const componentPropertyValue =
                flowState.flowWidgetDataIndexToComponentPropertyValue.get(i);
            dataBuffer.writeUint16(componentPropertyValue!.componentIndex);
            dataBuffer.writeUint16(componentPropertyValue!.propertyValueIndex);
        }
    );

    // widgetActions
    dataBuffer.writeNumberArray(
        [...flowState.flowWidgetActionIndexes.keys()],
        (_, i) => {
            dataBuffer.writeFutureValue(
                () => {
                    dataBuffer.writeUint32(0);
                },
                () => {
                    const componentOutputOffset =
                        flowState.flowWidgetActionComponentOutput.get(i);
                    if (componentOutputOffset != undefined) {
                        dataBuffer.writeUint32(componentOutputOffset);
                    } else {
                        assets.DocumentStore.OutputSectionsStore.write(
                            output.Section.OUTPUT,
                            output.Type.ERROR,
                            "Widget action output not found",
                            flowState.flowWidgetFromActionIndex.get(i)
                        );
                        dataBuffer.writeUint32(0);
                    }
                }
            );
        }
    );

    // nInputValues
    dataBuffer.writeFutureValue(
        () => dataBuffer.writeUint16(0),
        () =>
            dataBuffer.writeUint16(
                assets.getFlowState(flow).componentInputIndexes.size
            )
    );
}

export function buildFlowData(assets: Assets, dataBuffer: DataBuffer) {
    if (assets.DocumentStore.isAppletProject) {
        dataBuffer.writeObjectOffset(() => {
            // flows
            dataBuffer.writeArray(assets.flows, flow =>
                buildFlow(assets, dataBuffer, flow)
            );

            // constants
            dataBuffer.writeFutureArray(() =>
                dataBuffer.writeArray(
                    assets.constants,
                    constant => buildConstantFlowValue(dataBuffer, constant),
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
                assets.globalVariables,
                globalVariable =>
                    buildVariableFlowValue(
                        dataBuffer,
                        getVariableFlowValue(assets, globalVariable)
                    ),
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

    // enum Component_X_Properties
    componentTypes.forEach(componentType => {
        const componentName = projectBuild.getName(
            "",
            {
                name: componentType.objectClass.name
            },
            projectBuild.NamingConvention.UnderscoreUpperCase
        );

        const properties =
            componentType.objectClass.classInfo.properties.filter(
                propertyInfo =>
                    isToggableProperty(
                        assets.DocumentStore,
                        propertyInfo,
                        "input"
                    )
            );

        let enumItems = properties.map(
            (propertyInfo, i) =>
                `${projectBuild.TAB}${projectBuild.getName(
                    `${componentName}_PROPERTY_`,
                    {
                        name: propertyInfo.name
                    },
                    projectBuild.NamingConvention.UnderscoreUpperCase
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
                `${projectBuild.TAB}${projectBuild.getName(
                    "OPERATION_TYPE_",
                    {
                        name: operationName
                    },
                    projectBuild.NamingConvention.UnderscoreUpperCase
                )} = ${operationIndexes[operationName]}`
            );
        }
    }

    defs.push(`enum OperationTypes {\n${operationEnumItems.join(",\n")}\n};`);

    return defs.join("\n\n");
}
