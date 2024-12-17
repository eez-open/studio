import { clipboard } from "electron";
import React from "react";
import {
    computed,
    action,
    observable,
    runInAction,
    toJS,
    makeObservable
} from "mobx";

import { validators } from "eez-studio-shared/validation";
import { validators as validatorsRenderer } from "eez-studio-shared/validation-renderer";

import { showGenericDialog } from "eez-studio-ui/generic-dialog";

import {
    ClassInfo,
    registerClass,
    IEezObject,
    EezObject,
    PropertyType,
    MessageType,
    IMessage,
    PropertyInfo,
    getProperty,
    PropertyProps,
    isPropertyDisabled
} from "project-editor/core/object";
import {
    getChildOfObject,
    Message,
    propertyNotSetMessage,
    createObject,
    isEezObjectArray,
    getAncestorOfType,
    findPropertyByNameInObject
} from "project-editor/store";
import {
    isDashboardProject,
    hasFlowSupport,
    isLVGLProject
} from "project-editor/project/project-type-traits";
import {
    Project,
    findVariableDeep,
    getAssetFullName
} from "project-editor/project/project";
import type {
    IDataContext,
    IVariable
} from "project-editor/flow/flow-interfaces";
import { getProjectStore } from "project-editor/store";
import { evalConstantExpression } from "project-editor/flow//expression";
import {
    variableTypeProperty,
    migrateType,
    VariableTypeFieldComponent,
    isObjectType,
    isIntegerVariable,
    isEnumVariable,
    getEnumValues,
    isValueTypeOf,
    ValueType,
    getObjectVariableTypeFromType,
    SYSTEM_STRUCTURES,
    isValidType,
    getSystemEnums,
    isEnumType,
    getEnumTypeNameFromType
} from "project-editor/features/variable/value-type";
import {
    FLOW_ITERATOR_INDEXES_VARIABLE,
    FLOW_ITERATOR_INDEX_VARIABLE
} from "project-editor/features/variable/defs";
import { ProjectEditor } from "project-editor/project-editor-interface";
import { generalGroup } from "project-editor/ui-components/PropertyGrid/groups";
import { RenderVariableStatusPropertyUI } from "project-editor/features/variable/global-variable-status";
import { VARIABLE_ICON } from "project-editor/ui-components/icons";
import type { ProjectEditorFeature } from "project-editor/store/features";
import type { UserProperty } from "project-editor/flow/user-property";
import type { Flow } from "project-editor/flow/flow";
import { observer } from "mobx-react";
import { ProjectContext } from "project-editor/project/context";
import { Build, getName, NamingConvention } from "project-editor/build/helper";
import { IconAction } from "eez-studio-ui/action";
import { CodeEditor } from "eez-studio-ui/code-editor";
import { Icon } from "eez-studio-ui/icon";

////////////////////////////////////////////////////////////////////////////////

function isGlobalVariable(object: IEezObject) {
    return !ProjectEditor.getFlow(object);
}

export function uniqueForVariableAndUserProperty(
    object: Variable | UserProperty,
    parent: IEezObject,
    propertyInfo?: PropertyInfo
) {
    const flow = getAncestorOfType(
        parent,
        ProjectEditor.FlowClass.classInfo
    ) as Flow;
    if (!flow) {
        return validators.unique(object, parent);
    }

    const oldIdentifier =
        object && propertyInfo
            ? getProperty(object, propertyInfo.name)
            : undefined;

    return (object: any, ruleName: string) => {
        const newIdentifer = object[ruleName];
        if (oldIdentifier != undefined && newIdentifer == oldIdentifier) {
            return null;
        }

        const userPropertyOrLocalVariable =
            flow.userPropertiesAndLocalVariables.find(
                userPropertyOrLocalVariable =>
                    userPropertyOrLocalVariable != object &&
                    userPropertyOrLocalVariable.name === newIdentifer
            );

        if (!userPropertyOrLocalVariable) {
            return null;
        }

        if (userPropertyOrLocalVariable instanceof Variable) {
            return "Local variable with this name already exists";
        } else {
            return "User property with this name already exists";
        }
    };
}

////////////////////////////////////////////////////////////////////////////////

export const NativeVariableImplementationInfoPropertyUI = observer(
    class NativeVariableImplementationInfoPropertyUI extends React.Component<PropertyProps> {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        codeEditorRef = React.createRef<CodeEditor>();

        componentDidMount() {
            this.codeEditorRef.current?.resize();
        }

        componentDidUpdate() {
            this.codeEditorRef.current?.resize();
        }

        get projectStore() {
            return ProjectEditor.getProjectStore(this.variable);
        }

        get implementationLanguage() {
            return this.projectStore.uiStateStore.implementationLanguage;
        }

        set implementationLanguage(value: string) {
            runInAction(() => {
                this.projectStore.uiStateStore.implementationLanguage = value;
            });
        }

        get hasFlowSupport() {
            return this.projectStore.projectTypeTraits.hasFlowSupport;
        }

        get variable() {
            return this.props.objects[0] as Variable;
        }

        get code() {
            const variable = this.variable;

            const variableName = getName(
                "",
                variable.name,
                NamingConvention.UnderscoreLowerCase
            );

            let nativeType;

            if (variable.type == "integer") {
                nativeType = "int32_t ";
            } else if (variable.type == "float") {
                nativeType = "float ";
            } else if (variable.type == "double") {
                nativeType = "double ";
            } else if (variable.type == "boolean") {
                nativeType = "bool ";
            } else if (variable.type == "string") {
                nativeType = "const char *";
            } else if (isEnumType(variable.type)) {
                const enumType = getEnumTypeNameFromType(variable.type);
                nativeType = `${enumType} `;
            } else {
            }

            const build = new Build();
            build.startBuild();

            if (variable.type == "string") {
                if (this.implementationLanguage == "C") {
                    build.line(`#include <string.h>`);
                } else {
                    build.line(`#include <string>`);
                }
            }

            build.line(`#include "vars.h"`);

            build.line("");

            build.line(
                `${
                    variable.type == "string"
                        ? this.implementationLanguage == "C"
                            ? "char "
                            : "std::string "
                        : nativeType
                }${variableName}${
                    variable.type == "string" &&
                    this.implementationLanguage == "C"
                        ? "[100] = { 0 }"
                        : ""
                };`
            );

            build.line("");

            build.line(
                `${
                    this.implementationLanguage == "C++" ? `extern "C" ` : ""
                }${nativeType}${"get_var_" + variableName}() {`
            );
            build.indent();
            build.line(
                `return ${variableName}${
                    variable.type == "string" &&
                    this.implementationLanguage == "C++"
                        ? ".c_str()"
                        : ""
                };`
            );
            build.unindent();
            build.line(`}`);

            build.line("");

            build.line(
                `${
                    this.implementationLanguage == "C++" ? `extern "C" ` : ""
                }void ${"set_var_" + variableName}(${nativeType}value) {`
            );
            build.indent();
            if (
                variable.type == "string" &&
                this.implementationLanguage == "C"
            ) {
                build.line(
                    `strncpy(${variableName}, value, sizeof(${variableName}) / sizeof(char));`
                );
                build.line(
                    `${variableName}[sizeof(${variableName}) / sizeof(char) - 1] = 0;`
                );
            } else {
                build.line(`${variableName} = value;`);
            }
            build.unindent();
            build.line(`}`);

            return build.result;
        }

        render() {
            const code = this.code;

            return (
                <div className="EezStudio_PropertyGrid_TipBox">
                    <div className="EezStudio_PropertyGrid_TipBox_Description">
                        <div className="EezStudio_PropertyGrid_TipBox_Header">
                            <Icon icon="material:lightbulb_outline" />
                            <span>TIP</span>
                        </div>
                        <div className="EezStudio_PropertyGrid_TipBox_DescriptionText">
                            {this.hasFlowSupport
                                ? "For native variable "
                                : "For variable "}
                            you must provide implementation of get and set
                            functions. Below is a basic implementation code for
                            such functions. You can copy and paste it into some
                            source file in your project.
                        </div>
                        <div className="EezStudio_PropertyGrid_TipBox_Toolbar">
                            <select
                                className="form-select"
                                value={this.implementationLanguage}
                                onChange={event =>
                                    (this.implementationLanguage =
                                        event.target.value)
                                }
                            >
                                <option value="C">C</option>
                                <option value="C++">C++</option>
                            </select>
                            <IconAction
                                icon="material:content_copy"
                                iconSize={20}
                                title="Copy to Clipboard"
                                onClick={() => {
                                    clipboard.writeText(code);
                                }}
                            />
                        </div>
                    </div>
                    <CodeEditor
                        ref={this.codeEditorRef}
                        mode="c_cpp"
                        value={code}
                        onChange={() => {}}
                        readOnly={true}
                        className="form-control"
                        minLines={2}
                        maxLines={50}
                    />
                </div>
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

export class Variable extends EezObject {
    id: number | undefined;
    name: string;
    description?: string;

    type: ValueType;

    defaultValue: string;

    defaultValueList: string;

    usedIn?: string[];

    persistent: boolean;

    native: boolean;

    constructor() {
        super();

        makeObservable(this, {
            fullName: computed
        });
    }

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            id: observable,
            name: observable,
            description: observable,
            type: observable,
            defaultValue: observable,
            defaultValueList: observable,
            usedIn: observable,
            persistent: observable,
            native: observable
        });
    }

    static classInfo: ClassInfo = {
        properties: [
            {
                name: "id",
                type: PropertyType.Number,
                isOptional: true,
                unique: true,
                propertyGridGroup: generalGroup,
                disabled: (variable: Variable) =>
                    !isGlobalVariable(variable) || isLVGLProject(variable)
            },
            {
                name: "name",
                type: PropertyType.String,
                uniqueIdentifier: uniqueForVariableAndUserProperty
            },
            {
                name: "description",
                type: PropertyType.MultilineText
            },
            variableTypeProperty,
            {
                name: "defaultValue",
                type: PropertyType.MultilineText,
                expressionType: "any",
                expressionIsConstant: true,
                flowProperty: "input",
                monospaceFont: true,
                disabled: object => {
                    const project = ProjectEditor.getProject(object);
                    return (
                        project.projectTypeTraits.isLVGL &&
                        !project.projectTypeTraits.hasFlowSupport
                    );
                }
            },
            {
                name: "native",
                type: PropertyType.Boolean,
                disabled: (variable: Variable) =>
                    !isGlobalVariable(variable) ||
                    !hasFlowSupport(variable) ||
                    !ProjectEditor.getProject(
                        variable
                    ).projectTypeTraits.isVariableTypeSupportedAsNative(
                        variable.type
                    ),
                checkboxStyleSwitch: true
            },
            {
                name: "nativeImplementationInfo",
                type: PropertyType.Any,
                computed: true,
                propertyGridRowComponent:
                    NativeVariableImplementationInfoPropertyUI,
                skipSearch: true,
                hideInPropertyGrid: (variable: Variable) => {
                    const projectStore = getProjectStore(variable);
                    return !(
                        isLVGLProject(variable) &&
                        isGlobalVariable(variable) &&
                        (!projectStore.projectTypeTraits.hasFlowSupport ||
                            variable.native)
                    );
                }
            },
            {
                name: "defaultValueList",
                type: PropertyType.MultilineText,
                disabled: object =>
                    isLVGLProject(object) || hasFlowSupport(object),
                monospaceFont: true
            },
            {
                name: "usedIn",
                type: PropertyType.ConfigurationReference,
                referencedObjectCollectionPath: "settings/build/configurations",
                disabled: object =>
                    isDashboardProject(object) || isLVGLProject(object)
            },
            {
                name: "persistent",
                type: PropertyType.Boolean,
                disabled: (variable: Variable) =>
                    isLVGLProject(variable) ||
                    !isGlobalVariable(variable) ||
                    variable.native ||
                    (isObjectType(variable.type) &&
                        !getObjectVariableTypeFromType(
                            ProjectEditor.getProjectStore(variable),
                            variable.type
                        )?.editConstructorParams) ||
                    variable.type == "object:TCPSocket",
                checkboxStyleSwitch: true
            },
            {
                name: "persistedValue",
                type: PropertyType.Any,
                computed: true,
                propertyGridRowComponent: RenderVariableStatusPropertyUI,
                skipSearch: true,
                hideInPropertyGrid: (variable: Variable) =>
                    isLVGLProject(variable) ||
                    !variable.persistent ||
                    !isGlobalVariable(variable) ||
                    variable.type == "object:TCPSocket"
            }
        ],
        icon: VARIABLE_ICON,
        listLabel: (variable: Variable) => {
            return (
                <>
                    {!isPropertyDisabled(
                        variable,
                        findPropertyByNameInObject(variable, "native")!
                    ) &&
                        variable.native && (
                            <span className="EezStudio_ListLabel_Badge">
                                NATIVE
                            </span>
                        )}
                    {!isPropertyDisabled(
                        variable,
                        findPropertyByNameInObject(variable, "persistent")!
                    ) &&
                        variable.persistent && (
                            <span className="EezStudio_ListLabel_Badge">
                                PERSISTENT
                            </span>
                        )}
                    <span>{variable.name}</span>
                    <em
                        className="font-monospace"
                        style={{ opacity: 0.5, marginLeft: 8 }}
                    >
                        {variable.type}
                    </em>
                </>
            );
        },
        propertiesPanelLabel: (variable: Variable) => {
            return `${
                ProjectEditor.getFlow(variable) ? "Local" : "Global"
            } variable: ${variable.name}`;
        },
        beforeLoadHook: (object: Variable, objectJS: any) => {
            migrateType(objectJS);
        },
        newItem: async (parent: IEezObject) => {
            const project = ProjectEditor.getProject(parent);

            function isNativeFlagEnabled(values: any) {
                return (
                    isGlobalVariable(parent) &&
                    hasFlowSupport(parent) &&
                    ProjectEditor.getProject(
                        parent
                    ).projectTypeTraits.isVariableTypeSupportedAsNative(
                        values.type
                    )
                );
            }

            const result = await showGenericDialog({
                dialogDefinition: {
                    title: ProjectEditor.getFlow(parent)
                        ? "New Local Variable"
                        : "New Global Variable",
                    fields: [
                        {
                            name: "name",
                            type: "string",
                            validators: [
                                validators.required,
                                validatorsRenderer.identifierValidator,
                                uniqueForVariableAndUserProperty(
                                    {} as any,
                                    parent
                                )
                            ]
                        },
                        {
                            name: "type",
                            type: VariableTypeFieldComponent,
                            validators: [validators.required]
                        },
                        {
                            name: "defaultValue",
                            type: "string",
                            validators: [validators.required],
                            visible: () =>
                                !project.projectTypeTraits.isLVGL ||
                                project.projectTypeTraits.hasFlowSupport
                        },
                        {
                            name: "native",
                            type: "boolean",
                            visible: isNativeFlagEnabled
                        }
                    ]
                },
                values: {},
                dialogContext: ProjectEditor.getProject(parent)
            });

            let persistent =
                !ProjectEditor.getFlow(parent) &&
                isObjectType(result.values.type) &&
                result.values.type != "object:TCPSocket";

            const variableProperties: Partial<Variable> = {
                name: result.values.name,
                type: result.values.type,
                defaultValue: result.values.defaultValue,
                persistent,
                native: isNativeFlagEnabled(result.values)
                    ? result.values.native
                    : false
            };

            const variable = createObject<Variable>(
                project._store,
                variableProperties,
                Variable
            );

            return variable;
        },
        check: (variable: Variable, messages: IMessage[]) => {
            const projectStore = getProjectStore(variable);

            if (isGlobalVariable(variable)) {
                ProjectEditor.checkAssetId(
                    projectStore,
                    "variables/globalVariables",
                    variable,
                    messages
                );
            }

            if (!variable.type) {
                messages.push(propertyNotSetMessage(variable, "type"));
            }

            // if (
            //     projectStore.projectTypeTraits.hasFlowSupport &&
            //     (variable.type === "any" || variable.type === "array:any")
            // ) {
            //     messages.push(
            //         new Message(MessageType.WARNING, `Any type used`, variable)
            //     );
            // }

            if (!isValidType(projectStore.project, variable.type)) {
                messages.push(
                    new Message(MessageType.ERROR, `Invalid type`, variable)
                );
            }

            if (!variable.defaultValue) {
                messages.push(propertyNotSetMessage(variable, "defaultValue"));
            } else {
                if (projectStore.projectTypeTraits.hasFlowSupport) {
                    try {
                        const { value, valueType } = evalConstantExpression(
                            projectStore.project,
                            variable.defaultValue
                        );

                        const error = isValueTypeOf(
                            projectStore.project,
                            value,
                            valueType,
                            variable.type
                        );
                        if (error) {
                            messages.push(
                                new Message(
                                    MessageType.ERROR,
                                    error,
                                    getChildOfObject(variable, "defaultValue")
                                )
                            );
                        }
                    } catch (err) {
                        messages.push(
                            new Message(
                                MessageType.ERROR,
                                err.toString(),
                                getChildOfObject(variable, "defaultValue")
                            )
                        );
                    }
                }
            }
        },

        addObjectHook: (variable: Variable, parent: IEezObject) => {
            if (
                ProjectEditor.getProject(parent).projectTypeTraits.isDashboard
            ) {
                variable.native = false;
            }
        }
    };

    get fullName() {
        return getAssetFullName<Variable>(this);
    }
}

registerClass("Variable", Variable);

////////////////////////////////////////////////////////////////////////////////

export class DataContext implements IDataContext {
    project: Project;
    parentDataContext: DataContext | undefined;
    defaultValueOverrides: any;
    localVariables: Map<string, IVariable> | undefined = undefined;
    runtimeValues: Map<string, any>;

    constructor(
        project: Project,
        parentDataContext?: DataContext,
        defaultValueOverrides?: any,
        localVariables?: Map<string, IVariable>
    ) {
        makeObservable(this, {
            runtimeValues: observable,
            clear: action
        });

        this.project = project;
        this.parentDataContext = parentDataContext;
        this.defaultValueOverrides = defaultValueOverrides;

        this.runtimeValues = new Map<string, any>();

        this.localVariables = localVariables;
        if (this.localVariables) {
            this.localVariables.forEach(variable => {
                if (this.project._store.runtime) {
                    this.runtimeValues.set(variable.fullName, undefined);
                } else {
                    try {
                        const { value } = evalConstantExpression(
                            project,
                            variable.defaultValue
                        );
                        this.runtimeValues.set(variable.fullName, value);
                    } catch (err) {
                        if (project._store.runtime) {
                            throw err;
                        }
                        this.runtimeValues.set(variable.fullName, undefined);
                    }
                }
            });
        }

        if (!this.parentDataContext) {
            this.initGlobalVariables();
        }
    }

    initGlobalVariables() {
        if (this.project.variables) {
            this.project.allGlobalVariables.forEach(variable => {
                try {
                    const { value } = evalConstantExpression(
                        this.project,
                        variable.defaultValue
                    );
                    this.runtimeValues.set(variable.fullName, value);
                } catch (err) {
                    if (this.project._store.runtime) {
                        throw err;
                    }
                    if (!this.project.projectTypeTraits.hasFlowSupport) {
                        const value = this.project._assets.maps[
                            "name"
                        ].allAssets.get(variable.defaultValue);
                        if (value) {
                            this.runtimeValues.set(variable.fullName, value);
                        } else {
                            this.runtimeValues.set(
                                variable.fullName,
                                variable.defaultValue
                            );
                        }
                    } else {
                        this.runtimeValues.set(variable.fullName, null);
                    }
                }
            });
        }
    }

    createWithDefaultValueOverrides(defaultValueOverrides: any): IDataContext {
        return new DataContext(this.project, this, defaultValueOverrides);
    }

    createWithLocalVariables(variablesArray: IVariable[]) {
        const localVariables = new Map<string, any>();
        variablesArray.forEach(variable => {
            localVariables.set(variable.fullName, variable);
        });
        return new DataContext(this.project, this, undefined, localVariables);
    }

    getDefaultValue(variableName: string): any {
        if (this.defaultValueOverrides) {
            const value = this.defaultValueOverrides[variableName];
            if (value != undefined) {
                return value;
            }
        }
        if (this.parentDataContext) {
            return this.parentDataContext.getDefaultValue(variableName);
        }
        return undefined;
    }

    getRuntimeValue(variable: IVariable | undefined): {
        hasValue: boolean;
        value: any;
    } {
        if (variable) {
            if (this.defaultValueOverrides) {
                const value = this.defaultValueOverrides[variable.fullName];
                if (value != undefined) {
                    return {
                        hasValue: true,
                        value
                    };
                }
            }

            if (this.runtimeValues.has(variable.fullName)) {
                return {
                    hasValue: this.runtimeValues.has(variable.fullName),
                    value: this.runtimeValues.get(variable.fullName)
                };
            }

            if (this.parentDataContext) {
                return this.parentDataContext.getRuntimeValue(variable);
            }
        }

        return { hasValue: false, value: undefined };
    }

    setRuntimeValue(variableName: string, value: any) {
        if (this.localVariables && this.localVariables.has(variableName)) {
            this.runtimeValues.set(variableName, value);
        } else {
            if (this.parentDataContext) {
                this.parentDataContext.setRuntimeValue(variableName, value);
            } else {
                const variable = findVariableDeep(this.project, variableName);
                if (variable) {
                    this.runtimeValues.set(variableName, value);
                } else {
                    throw `variable "${variableName}" not found`;
                }
            }
        }
    }

    clear() {
        this.runtimeValues.clear();
        this.initGlobalVariables();
    }

    set(variableName: string, value: any) {
        // const oldValue = this.get(variableName);
        // if (oldValue) {
        //     const variable = this.findVariable(variableName);
        //     if (variable) {
        //         const objectVariableType = getObjectVariableTypeFromType(
        //             this.project._store,
        //             variable.type
        //         );
        //         if (objectVariableType) {
        //             objectVariableType.destroyValue(oldValue, value);
        //         }
        //     }
        // }

        runInAction(() => this.setRuntimeValue(variableName, value));
    }

    findVariableDefaultValue(variableName: string): any {
        if (this.defaultValueOverrides) {
            const defaultValue = this.defaultValueOverrides[variableName];
            if (defaultValue != undefined) {
                return defaultValue;
            }
        }
        if (this.parentDataContext) {
            return this.parentDataContext.findVariableDefaultValue(
                variableName
            );
        }
        return undefined;
    }

    findVariable(variableName: string): IVariable | undefined {
        let variable: IVariable | undefined;

        // find local variable
        if (this.localVariables && this.localVariables.has(variableName)) {
            variable = this.localVariables.get(variableName);
        }

        if (!variable) {
            if (this.parentDataContext) {
                return this.parentDataContext.findVariable(variableName);
            }
        }

        if (!variable) {
            // find global variable
            variable = findVariableDeep(this.project, variableName);
        }

        return variable;
    }

    has(variableName: string) {
        if (
            variableName == FLOW_ITERATOR_INDEX_VARIABLE ||
            variableName == FLOW_ITERATOR_INDEXES_VARIABLE
        ) {
            return this.get(variableName) !== undefined;
        }
        return !!this.findVariable(variableName);
    }

    get(variableName: string): any {
        if (
            variableName == FLOW_ITERATOR_INDEX_VARIABLE ||
            variableName == FLOW_ITERATOR_INDEXES_VARIABLE
        ) {
            return this.getDefaultValue(variableName);
        }

        if (!variableName) {
            return undefined;
        }

        if (variableName === undefined) {
            return undefined;
        }

        let value: any = undefined;

        const variable = this.findVariable(variableName);
        const { hasValue, value: value_ } = this.getRuntimeValue(variable);

        if (variable) {
            if (hasValue) {
                value = value_;
            } else {
                let defaultValue = this.findVariableDefaultValue(variableName);
                if (defaultValue == undefined) {
                    defaultValue = variable.defaultValue;
                }

                if (defaultValue !== undefined) {
                    if (isIntegerVariable(variable)) {
                        value = parseInt(defaultValue);
                        if (isNaN(value)) {
                            console.error(
                                "Invalid integer default value",
                                variable
                            );
                        }
                    } else if (isEnumVariable(variable)) {
                        // TODO this is invalid check
                        value = defaultValue;
                        if (getEnumValues(variable).indexOf(value) == -1) {
                            console.error(
                                "Invalid enum default value",
                                variable
                            );
                        }
                    } else if (variable.type == "float") {
                        value = parseFloat(defaultValue);
                        if (isNaN(value)) {
                            value = defaultValue;
                            console.error(
                                "Invalid float default value",
                                variable
                            );
                        }
                    } else if (variable.type == "boolean") {
                        defaultValue = defaultValue
                            .toString()
                            .trim()
                            .toLowerCase();
                        if (defaultValue == "1" || defaultValue == "true") {
                            value = true;
                        } else if (
                            defaultValue == "0" ||
                            defaultValue == "false"
                        ) {
                            value = false;
                        } else {
                            value = undefined;
                        }
                    } else if (variable.type == "array") {
                        try {
                            value =
                                typeof defaultValue === "string"
                                    ? JSON.parse(defaultValue)
                                    : defaultValue;
                        } catch (err) {
                            value = [];
                            console.error(
                                "Invalid array default value",
                                variable,
                                err
                            );
                        }
                    } else {
                        value = defaultValue;
                    }
                } else {
                    value = undefined;
                }
            }
        }

        return value;
    }

    getBool(variableName: string): boolean {
        let value = this.get(variableName);

        if (typeof value === "boolean") {
            return value;
        }

        if (typeof value === "number" && Number.isInteger(value)) {
            return value ? true : false;
        }

        return false;
    }

    getEnumValue(variableName: string): number {
        let value = this.get(variableName);

        if (typeof value === "boolean") {
            return value ? 1 : 0;
        } else if (typeof value === "number" && Number.isInteger(value)) {
            return value;
        } else if (typeof value === "string") {
            let variable = this.findVariable(variableName);
            if (variable && isEnumVariable(variable)) {
                // TODO this is invalid check
                value = getEnumValues(variable).indexOf(value);
                if (value == -1) {
                    console.error("Invalid enum value", variable);
                    return 0;
                } else {
                    return value;
                }
            }
        }

        return 0;
    }

    getValueList(variableName: string): string[] {
        let variable = this.findVariable(variableName);
        if (variable) {
            try {
                return JSON.parse(variable.defaultValueList);
            } catch (err) {
                console.error("Invalid value list", variable, err);
                return [];
            }
        }

        return [];
    }

    get debugInfo(): any {
        const runtimeValues: any = {};
        for (const [name, value] of this.runtimeValues) {
            try {
                const valueJS = toJS(value);
                JSON.stringify(valueJS);
                runtimeValues[name] = valueJS;
            } catch (err) {}
        }

        return {
            runtimeValues
        };
    }

    set debugInfo(debugInfo: any) {
        runInAction(() => {
            for (const name in debugInfo.runtimeValues) {
                this.runtimeValues.set(name, debugInfo.runtimeValues[name]);
            }
        });
    }
}

////////////////////////////////////////////////////////////////////////////////

export interface IStructureField {
    name: string;
    type: ValueType;
}

export class StructureField extends EezObject implements IStructureField {
    name: string;
    type: ValueType;

    static classInfo: ClassInfo = {
        properties: [
            {
                name: "name",
                type: PropertyType.String,
                uniqueIdentifier: true
            },
            variableTypeProperty
        ],
        listLabel: (field: StructureField, collapsed: boolean) =>
            collapsed ? (
                <span>
                    {field.name}: <i>{field.type}</i>
                </span>
            ) : (
                ""
            ),

        check: (structureField: StructureField, messages: IMessage[]) => {
            if (!structureField.name) {
                messages.push(propertyNotSetMessage(structureField, "name"));
            }

            if (!structureField.type) {
                messages.push(propertyNotSetMessage(structureField, "type"));
            }

            // if (
            //     structureField.type === "any" ||
            //     structureField.type === "array:any"
            // ) {
            //     messages.push(
            //         new Message(
            //             MessageType.WARNING,
            //             `Any type used`,
            //             getChildOfObject(structureField, "type")
            //         )
            //     );
            // }

            const projectStore = getProjectStore(structureField);
            if (!isValidType(projectStore.project, structureField.type)) {
                messages.push(
                    new Message(
                        MessageType.ERROR,
                        `Invalid type`,
                        structureField
                    )
                );
            }
        },
        beforeLoadHook: (object: Variable, objectJS: any) => {
            migrateType(objectJS);
        },
        defaultValue: {},
        newItem: async (parent: IEezObject) => {
            const result = await showGenericDialog({
                dialogDefinition: {
                    title: "New Structure Field",
                    fields: [
                        {
                            name: "name",
                            type: "string",
                            validators: [
                                validators.required,
                                validatorsRenderer.identifierValidator,
                                validators.unique({}, parent)
                            ]
                        },
                        {
                            name: "type",
                            type: VariableTypeFieldComponent,
                            validators: [validators.required]
                        }
                    ]
                },
                values: {},
                dialogContext: ProjectEditor.getProject(parent)
            });

            const structureFieldProperties: Partial<StructureField> = {
                name: result.values.name,
                type: result.values.type
            };

            const project = ProjectEditor.getProject(parent);

            const structureField = createObject<StructureField>(
                project._store,
                structureFieldProperties,
                StructureField
            );

            return structureField;
        }
    };

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            name: observable,
            type: observable
        });
    }
}

registerClass("StructureField", StructureField);

////////////////////////////////////////////////////////////////////////////////

export interface IStructure {
    name: string;
    fields: IStructureField[];
    get fieldsMap(): Map<string, IStructureField>;
}

export class Structure extends EezObject implements IStructure {
    name: string;
    fields: StructureField[];

    static classInfo: ClassInfo = {
        properties: [
            {
                name: "name",
                type: PropertyType.String,
                uniqueIdentifier: true
            },
            {
                name: "fields",
                type: PropertyType.Array,
                typeClass: StructureField
            }
        ],
        propertiesPanelLabel: (structure: Structure) => {
            return `Structure: ${structure.name}`;
        },
        newItem: async (parent: IEezObject) => {
            const result = await showGenericDialog({
                dialogDefinition: {
                    title: "New Structure",
                    fields: [
                        {
                            name: "name",
                            type: "string",
                            validators: [
                                validators.required,
                                validatorsRenderer.identifierValidator,
                                validators.unique({}, parent)
                            ]
                        }
                    ]
                },
                values: {}
            });

            const structureProperties: Partial<Structure> = {
                name: result.values.name
            };

            const project = ProjectEditor.getProject(parent);

            const structure = createObject<Structure>(
                project._store,
                structureProperties,
                Structure
            );

            return structure;
        },
        icon: (
            <svg viewBox="0 0 24 24" fill="currentcolor">
                <path d="M12 7h8a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1h-8a1 1 0 0 0-1 1v1H5V2a1 1 0 0 0-2 0v18a1 1 0 0 0 1 1h7v1a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-4a1 1 0 0 0-1-1h-8a1 1 0 0 0-1 1v1H5v-6h6v1a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-4a1 1 0 0 0-1-1h-8a1 1 0 0 0-1 1v1H5V5h6v1a1 1 0 0 0 1 1m1 12h6v2h-6Zm0-8h6v2h-6Zm0-8h6v2h-6Z" />
            </svg>
        )
    };

    constructor() {
        super();

        makeObservable(this, {
            fieldsMap: computed({ keepAlive: true })
        });
    }

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            name: observable,
            fields: observable
        });
    }

    get fieldsMap() {
        const fieldsMap = new Map<string, IStructureField>();
        this.fields.forEach(field => fieldsMap.set(field.name, field));
        return fieldsMap;
    }
}

registerClass("Structure", Structure);

////////////////////////////////////////////////////////////////////////////////

export interface IEnumMember {
    name: string;
    value: number;
}

export class EnumMember extends EezObject implements IEnumMember {
    name: string;
    value: number;

    static classInfo: ClassInfo = {
        properties: [
            {
                name: "name",
                type: PropertyType.String,
                uniqueIdentifier: true
            },
            {
                name: "value",
                type: PropertyType.Number
            }
        ],
        listLabel: (member: EnumMember, collapsed: boolean) =>
            collapsed ? `${member.name}: ${member.value}` : "",
        check: (enumMember: EnumMember, messages: IMessage[]) => {
            if (!enumMember.name) {
                messages.push(propertyNotSetMessage(enumMember, "name"));
            }

            if (enumMember.value == undefined) {
                messages.push(propertyNotSetMessage(enumMember, "value"));
            }
        },
        defaultValue: {},
        newItem: async (parent: IEezObject) => {
            const result = await showGenericDialog({
                dialogDefinition: {
                    title: "New Enum Member",
                    fields: [
                        {
                            name: "name",
                            type: "string",
                            validators: [
                                validators.required,
                                validatorsRenderer.identifierValidator,
                                validators.unique({}, parent)
                            ]
                        }
                    ]
                },
                values: {}
            });

            const enumMemberProperties: Partial<EnumMember> = {
                name: result.values.name,
                value:
                    isEezObjectArray(parent) && parent.length > 0
                        ? (parent[parent.length - 1] as EnumMember).value + 1
                        : 0
            };

            const project = ProjectEditor.getProject(parent);

            const enumMember = createObject<EnumMember>(
                project._store,
                enumMemberProperties,
                EnumMember
            );

            return enumMember;
        }
    };

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            name: observable,
            value: observable
        });
    }
}

registerClass("EnumMember", EnumMember);

////////////////////////////////////////////////////////////////////////////////

export interface IEnum {
    name: string;
    members: IEnumMember[];
    get membersMap(): Map<string, IEnumMember>;
}

export class Enum extends EezObject implements IEnum {
    name: string;
    members: EnumMember[];

    static classInfo: ClassInfo = {
        properties: [
            {
                name: "name",
                type: PropertyType.String,
                uniqueIdentifier: true
            },
            {
                name: "members",
                type: PropertyType.Array,
                typeClass: EnumMember
            }
        ],
        icon: (
            <svg viewBox="0 0 32 32">
                <defs>
                    <style>{".cls-2{stroke-width:0}"}</style>
                </defs>
                <path
                    className="cls-2"
                    d="M19.533 16.07c0-.964.877-1.445 1.788-1.445 1.049 0 1.479.653 1.479 1.925V22H25v-5.673c0-2.235-1.031-3.507-2.871-3.507-1.392 0-2.149.74-2.51 1.702h-.086v-1.496h-2.2V22h2.2zm-4.625 3.918H9.269v-3.06h4.986v-2.011H9.269v-2.905h5.639V10H7v12h7.908z"
                />
                <path
                    className="cls-2"
                    d="M2 4v24a2 2 0 0 0 2 2h24a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2m26 24H4V4h24z"
                />
                <path
                    id="_Transparent_Rectangle_"
                    data-name="&amp;lt;Transparent Rectangle&amp;gt;"
                    style={{
                        fill: "none",
                        strokeWidth: 0
                    }}
                    d="M0 0h32v32H0z"
                />
            </svg>
        ),
        propertiesPanelLabel: (enumObject: Enum) => {
            return `Enum: ${enumObject.name}`;
        },
        newItem: async (parent: IEezObject) => {
            const result = await showGenericDialog({
                dialogDefinition: {
                    title: "New Enum",
                    fields: [
                        {
                            name: "name",
                            type: "string",
                            validators: [
                                validators.required,
                                validatorsRenderer.identifierValidator,
                                validators.unique({}, parent)
                            ]
                        }
                    ]
                },
                values: {}
            });

            const enumProperties: Partial<Enum> = {
                name: result.values.name
            };

            const project = ProjectEditor.getProject(parent);

            const enumObject = createObject<Enum>(
                project._store,
                enumProperties,
                Enum
            );

            return enumObject;
        }
    };

    constructor() {
        super();

        makeObservable(this, {
            membersMap: computed
        });
    }

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            name: observable,
            members: observable
        });
    }

    get membersMap() {
        const map = new Map<string, EnumMember>();
        for (const member of this.members) {
            map.set(member.name, member);
        }
        return map;
    }
}

registerClass("Enum", Enum);

export class ProjectVariables extends EezObject {
    globalVariables: Variable[];
    structures: Structure[];
    enums: Enum[];

    static classInfo: ClassInfo = {
        label: () => "Variables",
        properties: [
            {
                name: "globalVariables",
                type: PropertyType.Array,
                typeClass: Variable,
                hideInPropertyGrid: true
            },
            {
                name: "structures",
                type: PropertyType.Array,
                typeClass: Structure,
                hideInPropertyGrid: true
            },
            {
                name: "enums",
                type: PropertyType.Array,
                typeClass: Enum,
                hideInPropertyGrid: true
            }
        ],
        icon: VARIABLE_ICON,
        defaultValue: {
            globalVariables: [],
            structures: [],
            enums: []
        }
    };

    constructor() {
        super();

        makeObservable(this, {
            enumsMap: computed({ keepAlive: true }),
            structsMap: computed({ keepAlive: true })
        });
    }

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            globalVariables: observable,
            structures: observable,
            enums: observable
        });
    }

    get enumsMap() {
        const map = new Map<string, IEnum>();

        for (const enumDef of this.enums) {
            map.set(enumDef.name, enumDef);
        }

        const projectStore = ProjectEditor.getProjectStore(this);
        const systemEnums = getSystemEnums(projectStore);
        for (const enumDef of systemEnums) {
            map.set(enumDef.name, enumDef);
        }
        return map;
    }

    get structsMap() {
        const map = new Map<string, IStructure>();
        for (const structure of this.structures) {
            map.set(structure.name, structure);
        }
        for (const structure of SYSTEM_STRUCTURES) {
            map.set(structure.name, structure);
        }
        return map;
    }
}

registerClass("ProjectVariables", ProjectVariables);

////////////////////////////////////////////////////////////////////////////////

const feature: ProjectEditorFeature = {
    name: "eezstudio-project-feature-variables",
    version: "0.1.0",
    description: "Variables, Structures and Enums",
    author: "EEZ",
    authorLogo: "../eez-studio-ui/_images/eez_logo.png",
    displayName: "Variables",
    mandatory: true,
    key: "variables",
    type: PropertyType.Object,
    typeClass: ProjectVariables,
    icon: VARIABLE_ICON,
    create: () => {
        return {
            globalVariables: [],
            structures: [],
            enums: []
        };
    },
    check: (projectStore, object: EezObject[], messages: IMessage[]) => {
        if (object.length > 32000) {
            messages.push(
                new Message(
                    MessageType.ERROR,
                    "Max. 32000 global variables are supported",
                    object
                )
            );
        }
    }
};

export default feature;
