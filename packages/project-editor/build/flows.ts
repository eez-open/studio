import {
    TAB,
    NamingConvention,
    getName,
    Build
} from "project-editor/build/helper";

import type { Assets, DataBuffer } from "project-editor/build/assets";
import type { Flow } from "project-editor/flow/flow";
import { Component, isFlowProperty } from "project-editor/flow/component";
import {
    getClassesDerivedFrom,
    getProperty,
    IObjectClassInfo,
    isPropertyHidden,
    MessageType,
    isFlowPropertyBuildable
} from "project-editor/core/object";
import {
    getChildOfObject,
    getClassInfo,
    getHumanReadableObjectPath,
    getObjectPathAsString,
    ProjectStore,
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
import {
    FIRST_DASHBOARD_ACTION_COMPONENT_TYPE,
    FIRST_DASHBOARD_WIDGET_COMPONENT_TYPE,
    FIRST_LVGL_WIDGET_COMPONENT_TYPE
} from "project-editor/flow/components/component-types";
import {
    BASIC_TYPE_NAMES,
    SYSTEM_STRUCTURES,
    ValueType,
    isStructType,
    getStructTypeNameFromType,
    getStructureFromType,
    isArrayType,
    getArrayElementTypeFromType,
    isEnumType,
    getEnumTypeNameFromType,
    objectVariableTypes
} from "project-editor/features/variable/value-type";
import type { Structure } from "project-editor/features/variable/variable";
import { ProjectEditor } from "project-editor/project-editor-interface";

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

function getComponentTypes(projectStore: ProjectStore) {
    return getClassesDerivedFrom(projectStore, Component)
        .filter(componentType => getComponentId(componentType) != undefined)
        .sort((a, b) => getComponentId(a)! - getComponentId(b)!);
}

function getFlowComponents(flow: Flow) {
    const components: Component[] = [];
    for (const component of visitObjects(flow)) {
        if (
            component instanceof Component &&
            !(component instanceof CommentActionComponent)
        ) {
            components.push(component);
        }
    }
    return components;
}

function getComponentIdOfComponent(assets: Assets, component: Component) {
    const classInfo = getClassInfo(component);
    let flowComponentId = classInfo.flowComponentId;

    if (
        flowComponentId == undefined &&
        (assets.projectStore.projectTypeTraits.isDashboard ||
            assets.projectStore.projectTypeTraits.isLVGL)
    ) {
        const name = component.type;
        if (name) {
            flowComponentId =
                assets.dashboardComponentClassNameToComponentIdMap[name];
            if (flowComponentId == undefined) {
                if (component instanceof ProjectEditor.ActionComponentClass) {
                    flowComponentId = assets.nextDashboardActionComponentId++;
                } else {
                    if (assets.projectStore.projectTypeTraits.isLVGL) {
                        flowComponentId = assets.nextLVGLWidgetComponentId++;
                    } else {
                        flowComponentId =
                            assets.nextDashboardWidgetComponentId++;
                    }
                }
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
        assets.projectStore.outputSectionsStore.write(
            Section.OUTPUT,
            MessageType.ERROR,
            "Component is not supported for the build target",
            component
        );
        dataBuffer.writeUint16(0);
    }

    // reserved
    dataBuffer.writeUint16(
        assets.projectStore.uiStateStore?.isBreakpointEnabledForComponent(
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
    const properties = assets.getComponentProperties(component);
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
                if (isFlowPropertyBuildable(component, propertyInfo)) {
                    let expression = getProperty(component, propertyInfo.name);

                    let flowProperty;
                    if (propertyInfo.flowProperty) {
                        if (typeof propertyInfo.flowProperty == "string") {
                            flowProperty = propertyInfo.flowProperty;
                        } else {
                            flowProperty = propertyInfo.flowProperty(component);
                        }
                    }

                    if (flowProperty == "assignable") {
                        buildAssignableExpression(
                            assets,
                            dataBuffer,
                            component,
                            expression
                        );
                    } else {
                        if (flowProperty == "template-literal") {
                            expression =
                                templateLiteralToExpression(expression);
                        }
                        buildExpression(
                            assets,
                            dataBuffer,
                            component,
                            expression
                        );
                    }
                } else {
                    dataBuffer.writeUint16NonAligned(makeEndInstruction());
                }
            } catch (err) {
                assets.projectStore.outputSectionsStore.write(
                    Section.OUTPUT,
                    MessageType.ERROR,
                    err.toString(),
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
    outputs.forEach((output, componentOutputIndex) => {
        if (output.type == "output") {
            // output to flow
            assets.registerComponentOutput(
                component,
                output.name,
                componentIndex,
                componentOutputIndex
            );
        } else {
            // output to action flow
            assets.registerComponentOutput(
                component,
                output.name,
                -1,
                assets.getFlowIndexFromEventHandler(component, output.name)
            );
        }
    });
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
            actionFlowIndex:
                output.type == "property"
                    ? assets.getFlowIndexFromEventHandler(
                          component,
                          output.name
                      )
                    : -1,
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
        assets.projectStore.outputSectionsStore.write(
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
    assets.map.flows[flowIndex].localVariables =
        flow.userPropertiesAndLocalVariables.map((localVariable, index) => ({
            index,
            name: localVariable.name
        }));
    dataBuffer.writeArray(
        flow.userPropertiesAndLocalVariables,
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
            assets.projectStore.outputSectionsStore.write(
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
            assets.projectStore.outputSectionsStore.write(
                Section.OUTPUT,
                MessageType.ERROR,
                "Widget action output not found",
                flowState.flowWidgetFromActionIndex.get(i)
            );
            dataBuffer.writeInt16(-1);
            dataBuffer.writeInt16(-1);
        }
    });

    // userPropertiesAssignable
    dataBuffer.writeNumberArray(flow.userProperties, userProperty => {
        dataBuffer.writeUint8(userProperty.assignable ? 1 : 0);
    });
}

export function buildFlowData(assets: Assets, dataBuffer: DataBuffer) {
    if (assets.projectStore.projectTypeTraits.hasFlowSupport) {
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
                    name: globalVariable.fullName,
                    type: globalVariable.type
                })
            );
            dataBuffer.writeArray(
                assets.globalVariables.filter(
                    globalVariable =>
                        !(
                            (assets.option == "buildFiles" ||
                                globalVariable.id != undefined) &&
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

    const componentTypes = getComponentTypes(assets.projectStore);

    // enum ComponentTypes
    let componentTypeEnumItems = componentTypes.map(
        (componentType, i) =>
            `${TAB}${getName(
                "COMPONENT_TYPE_",
                getComponentName(componentType),
                NamingConvention.UnderscoreUpperCase
            )} = ${getComponentId(componentType)}`
    );

    componentTypeEnumItems.unshift(`${TAB}COMPONENT_TYPE_NONE = 0`);

    componentTypeEnumItems.push(
        `${TAB}FIRST_DASHBOARD_ACTION_COMPONENT_TYPE = ${FIRST_DASHBOARD_ACTION_COMPONENT_TYPE}`
    );

    componentTypeEnumItems.push(
        `${TAB}FIRST_DASHBOARD_WIDGET_COMPONENT_TYPE = ${FIRST_DASHBOARD_WIDGET_COMPONENT_TYPE}`
    );

    componentTypeEnumItems.push(
        `${TAB}FIRST_LVGL_WIDGET_COMPONENT_TYPE = ${FIRST_LVGL_WIDGET_COMPONENT_TYPE}`
    );

    defs.push(
        `enum ComponentTypes {\n${componentTypeEnumItems.join(",\n")}\n};`
    );

    // enum Component_X_Properties
    componentTypes.forEach(componentType => {
        const componentName = getName(
            "",
            componentType.objectClass.name,
            NamingConvention.UnderscoreUpperCase
        );

        const properties =
            componentType.objectClass.classInfo.properties.filter(
                propertyInfo =>
                    isFlowProperty(undefined, propertyInfo, [
                        "input",
                        "template-literal",
                        "assignable"
                    ])
            );

        let enumItems = properties.map(
            (propertyInfo, i) =>
                `${TAB}${getName(
                    `${componentName}_PROPERTY_`,
                    propertyInfo.name,
                    NamingConvention.UnderscoreUpperCase
                )} = ${i}`
        );

        if (enumItems.length > 0) {
            if (
                componentType.objectClass ==
                    ProjectEditor.UserWidgetWidgetClass ||
                componentType.objectClass ==
                    ProjectEditor.LVGLUserWidgetWidgetClass
            ) {
                enumItems.push(
                    `${TAB}${`${componentName}_USER_PROPERTIES_START`} = ${
                        enumItems.length
                    }`
                );
            }

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
                    operationName,
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
                structure.name,
                NamingConvention.UnderscoreUpperCase
            )} = ${assets.projectStore.typesStore.getValueTypeIndex(
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
                    structure.name,
                    NamingConvention.UnderscoreUpperCase
                )}_${getName(
                    "FIELD_",
                    field.name,
                    NamingConvention.UnderscoreUpperCase
                )} = ${assets.projectStore.typesStore.getFieldIndex(
                    `struct:${structure.name}`,
                    field.name
                )}`
            );
        }

        fieldEnumItems.push(
            `${TAB}${getName(
                "SYSTEM_STRUCTURE_",
                structure.name,
                NamingConvention.UnderscoreUpperCase
            )}_NUM_FIELDS`
        );

        defs.push(
            `enum ${structure.name.substring(
                1
            )}SystemStructureFields {\n${fieldEnumItems.join(",\n")}\n};`
        );
    }

    // enum object types
    const objectTypeEnumItems = [];
    let valueTypeIndex = 0;
    for (const [objectTypeName, _] of objectVariableTypes) {
        valueTypeIndex = assets.projectStore.typesStore.getValueTypeIndex(
            `object:${objectTypeName}`
        )!;

        if (objectTypeEnumItems.length == 0) {
            objectTypeEnumItems.push(
                `${TAB}FIRST_OBJECT_TYPE = ${valueTypeIndex}`
            );
        }

        objectTypeEnumItems.push(
            `${TAB}${getName(
                "OBJECT_TYPE_",
                objectTypeName,
                NamingConvention.UnderscoreUpperCase
            )} = ${valueTypeIndex}`
        );
    }

    if (objectTypeEnumItems.length == 0) {
        objectTypeEnumItems.push(`${TAB}FIRST_OBJECT_TYPE = ${valueTypeIndex}`);
    }

    objectTypeEnumItems.push(`${TAB}LAST_OBJECT_TYPE = ${valueTypeIndex}`);

    defs.push(`enum ObjectTypes {\n${objectTypeEnumItems.join(",\n")}\n};`);

    for (const [objectTypeName, objectType] of objectVariableTypes) {
        const fieldEnumItems = [];
        for (const field of objectType.valueFieldDescriptions) {
            fieldEnumItems.push(
                `${TAB}${getName(
                    "OBJECT_TYPE_",
                    objectTypeName,
                    NamingConvention.UnderscoreUpperCase
                )}_${getName(
                    "FIELD_",
                    field.name,
                    NamingConvention.UnderscoreUpperCase
                )} = ${assets.projectStore.typesStore.getFieldIndex(
                    `object:${objectTypeName}`,
                    field.name
                )}`
            );
        }

        fieldEnumItems.push(
            `${TAB}${getName(
                "OBJECT_TYPE_",
                objectTypeName,
                NamingConvention.UnderscoreUpperCase
            )}_NUM_FIELDS`
        );

        defs.push(
            `enum ${objectTypeName}ObjectTypeFields {\n${fieldEnumItems.join(
                ",\n"
            )}\n};`
        );
    }

    // enum ArrayType
    const arrayTypeEnumItems = [];
    for (const basicType of BASIC_TYPE_NAMES) {
        arrayTypeEnumItems.push(
            `${TAB}${getName(
                "ARRAY_TYPE_",
                basicType,
                NamingConvention.UnderscoreUpperCase
            )} = ${assets.projectStore.typesStore.getValueTypeIndex(
                `array:${basicType}` as ValueType
            )}`
        );
    }

    defs.push(`enum ArrayTypes {\n${arrayTypeEnumItems.join(",\n")}\n};`);

    return defs.join("\n\n");
}

export function buildFlowStructs(assets: Assets) {
    if (
        assets.projectStore.projectTypeTraits.isLVGL &&
        !assets.projectStore.projectTypeTraits.hasFlowSupport
    ) {
        return "";
    }

    const defs = [];

    // enum FlowStructures
    const structureEnumItems = [];
    for (const structure of assets.projectStore.project.variables.structures) {
        structureEnumItems.push(
            `${TAB}${getName(
                "FLOW_STRUCTURE_",
                structure.name,
                NamingConvention.UnderscoreUpperCase
            )} = ${assets.projectStore.typesStore.getValueTypeIndex(
                `struct:${structure.name}`
            )}`
        );
    }

    if (structureEnumItems.length > 0) {
        defs.push(
            `enum FlowStructures {\n${structureEnumItems.join(",\n")}\n};`
        );
    }

    // enum FlowArrayOfStructures
    const arrayOfStructureEnumItems = [];
    for (const structure of assets.projectStore.project.variables.structures) {
        arrayOfStructureEnumItems.push(
            `${TAB}${getName(
                "FLOW_ARRAY_OF_STRUCTURE_",
                structure.name,
                NamingConvention.UnderscoreUpperCase
            )} = ${assets.projectStore.typesStore.getValueTypeIndex(
                `array:struct:${structure.name}`
            )}`
        );
    }
    if (arrayOfStructureEnumItems.length > 0) {
        defs.push(
            `enum FlowArrayOfStructures {\n${arrayOfStructureEnumItems.join(
                ",\n"
            )}\n};`
        );
    }

    for (const structure of assets.projectStore.project.variables.structures) {
        const fieldEnumItems = [];
        for (const field of structure.fields) {
            fieldEnumItems.push(
                `${TAB}${getName(
                    "FLOW_STRUCTURE_",
                    structure.name,
                    NamingConvention.UnderscoreUpperCase
                )}_${getName(
                    "FIELD_",
                    field.name,
                    NamingConvention.UnderscoreUpperCase
                )} = ${assets.projectStore.typesStore.getFieldIndex(
                    `struct:${structure.name}`,
                    field.name
                )}`
            );
        }

        fieldEnumItems.push(
            `${TAB}${getName(
                "FLOW_STRUCTURE_",
                structure.name,
                NamingConvention.UnderscoreUpperCase
            )}_NUM_FIELDS`
        );

        defs.push(
            `enum ${structure.name}FlowStructureFields {\n${fieldEnumItems.join(
                ",\n"
            )}\n};`
        );
    }

    return defs.join("\n\n");
}

export function buildFlowStructValues(assets: Assets) {
    if (
        assets.projectStore.projectTypeTraits.isLVGL &&
        !assets.projectStore.projectTypeTraits.hasFlowSupport
    ) {
        return "";
    }

    const build = new Build();

    build.startBuild();

    const builded = new Set<string>();

    function buildStructure(structure: Structure) {
        if (builded.has(structure.name)) {
            return;
        }

        builded.add(structure.name);

        for (const field of structure.fields) {
            const fieldStructure = getStructureFromType(
                assets.projectStore.project,
                field.type
            );
            if (fieldStructure) {
                buildStructure(fieldStructure as Structure);
            } else {
                const elementType = getArrayElementTypeFromType(field.type);
                if (elementType) {
                    const fieldStructure = getStructureFromType(
                        assets.projectStore.project,
                        elementType
                    );
                    if (fieldStructure) {
                        buildStructure(fieldStructure as Structure);
                    }
                }
            }
        }

        build.line(`struct ${structure.name}Value {`);
        build.indent();

        build.line(`Value value;`);

        build.line("");

        build.line(`${structure.name}Value() {`);
        build.indent();

        build.line(
            `value = Value::makeArrayRef(${getName(
                "FLOW_STRUCTURE_",
                structure.name,
                NamingConvention.UnderscoreUpperCase
            )}_NUM_FIELDS, ${getName(
                "FLOW_STRUCTURE_",
                structure.name,
                NamingConvention.UnderscoreUpperCase
            )}, 0);`
        );

        build.unindent();
        build.line("}");

        build.line("");

        build.line(`${structure.name}Value(Value value) : value(value) {}`);

        build.line("");

        build.line(`operator Value() const { return value; }`);

        build.line("");

        build.line(`operator bool() const { return value.isArray(); }`);

        structure.fields.forEach(field => {
            const filedIndex = `${getName(
                "FLOW_STRUCTURE_",
                structure.name,
                NamingConvention.UnderscoreUpperCase
            )}_${getName(
                "FIELD_",
                field.name,
                NamingConvention.UnderscoreUpperCase
            )}`;

            let nativeType;
            let get;
            let set;
            let castGet;

            if (field.type == "integer") {
                nativeType = "int ";
                get = ".getInt()";
                set = `IntegerValue(${field.name})`;
            } else if (field.type == "float") {
                nativeType = "float ";
                get = ".getFloat()";
                set = `FloatValue(${field.name})`;
            } else if (field.type == "double") {
                nativeType = "double ";
                get = ".getDoulbe()";
                set = `DoubleValue(${field.name})`;
            } else if (field.type == "boolean") {
                nativeType = "bool ";
                get = ".getBoolean()";
                set = `BooleanValue(${field.name})`;
            } else if (field.type == "string") {
                nativeType = "const char *";
                get = ".getString()";
                set = `StringValue(${field.name})`;
            } else if (isEnumType(field.type)) {
                const enumType = getEnumTypeNameFromType(field.type);
                nativeType = `${enumType} `;
                get = ".getInt()";
                set = `IntegerValue((int)${field.name})`;
                castGet = `(${enumType})`;
            } else if (isArrayType(field.type)) {
                const elementType = getArrayElementTypeFromType(field.type)!;
                if (isStructType(elementType)) {
                    nativeType = `ArrayOf${getStructTypeNameFromType(
                        elementType
                    )}Value `;
                    get = "";
                    set = `${field.name}.value`;
                } else if (elementType == "integer") {
                    nativeType = "ArrayOfInteger ";
                    get = "";
                    set = `${field.name}.value`;
                } else if (elementType == "float") {
                    nativeType = "ArrayOfFloat ";
                    get = "";
                    set = `${field.name}.value`;
                } else if (elementType == "double") {
                    nativeType = "ArrayOfDouble ";
                    get = "";
                    set = `${field.name}.value`;
                } else if (elementType == "boolean") {
                    nativeType = "ArrayOfBoolean ";
                    get = "";
                    set = `${field.name}.value`;
                } else if (elementType == "string") {
                    nativeType = "ArrayOfString ";
                    get = "";
                    set = `${field.name}.value`;
                } else {
                    nativeType = "Value ";
                    get = "";
                    set = `${field.name}`;
                }
            } else if (isStructType(field.type)) {
                nativeType = `${getStructTypeNameFromType(field.type)}Value `;
                get = "";
                set = `${field.name}`;
            } else {
                nativeType = "Value ";
                get = "";
                set = `${field.name}`;
            }

            build.line("");

            build.line(`${nativeType}${field.name}() {`);
            build.indent();
            build.line(
                `return ${
                    castGet ? castGet : ""
                }value.getArray()->values[${filedIndex}]${get};`
            );
            build.unindent();
            build.line("}");

            build.line(`void ${field.name}(${nativeType}${field.name}) {`);
            build.indent();
            build.line(`value.getArray()->values[${filedIndex}] = ${set};`);
            build.unindent();
            build.line("}");
        });

        build.unindent();
        build.line("};");

        build.line("");

        build.line(
            `typedef ArrayOf<${structure.name}Value, ${getName(
                "FLOW_ARRAY_OF_STRUCTURE_",
                structure.name,
                NamingConvention.UnderscoreUpperCase
            )}> ArrayOf${structure.name}Value;`
        );
    }

    for (const structure of assets.projectStore.project.variables.structures) {
        buildStructure(structure);
    }

    return build.result;
}

export function buildFlowEnums(assets: Assets) {
    const defs: string[] = [];

    for (const enumObject of assets.projectStore.project.variables.enums) {
        const enumItems: string[] = [];

        for (const item of enumObject.members) {
            enumItems.push(
                `${TAB}${enumObject.name}_${item.name} = ${item.value}`
            );
        }

        defs.push(
            `typedef enum {\n${enumItems.join(",\n")}\n} ${enumObject.name};`
        );
    }

    return defs.join("\n\n");
}
