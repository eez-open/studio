import { Stream } from "stream";
import React from "react";
import ReactDOM from "react-dom";
import {
    action,
    observable,
    autorun,
    runInAction,
    makeObservable,
    IReactionDisposer,
    computed
} from "mobx";
import { observer } from "mobx-react";

import { FieldComponent } from "eez-studio-ui/generic-dialog";

import type {
    IObjectVariableType,
    IObjectVariableValue,
    ValueType
} from "eez-studio-types";

import { closest } from "eez-studio-shared/dom";

import {
    PropertyType,
    PropertyInfo,
    PropertyProps
} from "project-editor/core/object";
import type { Project, ProjectType } from "project-editor/project/project";
import { ProjectContext } from "project-editor/project/context";
import { getPropertyValue } from "project-editor/ui-components/PropertyGrid/utils";
import type {
    IFlowContext,
    IVariable
} from "project-editor/flow/flow-interfaces";

import type {
    IEnum,
    IEnumMember,
    IStructure,
    IStructureField
} from "project-editor/features/variable/variable";
import { FLOW_ITERATOR_INDEXES_VARIABLE } from "project-editor/features/variable/defs";
import type { ProjectStore } from "project-editor/store";

export type {
    IObjectVariableValueConstructorParams,
    IObjectVariableValue,
    IObjectVariableType,
    BasicType,
    ValueType
} from "eez-studio-types";

import { isArray } from "eez-studio-shared/util";

////////////////////////////////////////////////////////////////////////////////

export const BASIC_TYPE_NAMES = [
    "integer",
    "float",
    "double",
    "boolean",
    "string",
    "date",
    "blob",
    "stream",
    "widget",
    "json",
    "event",
    "any"
];

export const FIRMWARE_BASIC_TYPE_NAMES = [
    "integer",
    "float",
    "double",
    "boolean",
    "string",
    "date",
    "blob",
    "any"
];

export const LVGL_BASIC_TYPE_NAMES = [
    "integer",
    "float",
    "double",
    "boolean",
    "string"
];

export const LVGL_FLOW_BASIC_TYPE_NAMES = [
    "integer",
    "float",
    "double",
    "boolean",
    "string",
    "date",
    "widget",
    "event",
    "any"
];

////////////////////////////////////////////////////////////////////////////////

export const CLICK_EVENT_STRUCT_NAME = "$ClickEvent";
export const CHECKBOX_CHANGE_EVENT_STRUCT_NAME = "$CheckboxChangeEvent";
export const RADIO_CHANGE_EVENT_STRUCT_NAME = "$RadioChangeEvent";
export const TEXT_INPUT_CHANGE_EVENT_STRUCT_NAME = "$TextInputChangeEvent";
export const DROP_DOWN_LIST_CHANGE_EVENT_STRUCT_NAME =
    "$DropDownListChangeEvent";
export const SLIDER_CHANGE_EVENT_STRUCT_NAME = "$SliderChangeEvent";
export const SWITCH_CHANGE_EVENT_STRUCT_NAME = "$SwitchChangeEvent";
export const SCROLLBAR_STATE_STRUCT_NAME = "$ScrollbarState";
export const OBJECT_VARIABLE_STATUS_STRUCT_NAME = "$ObjectVariableStatus";

class SystemStructure implements IStructure {
    name: string;
    fields: IStructureField[];

    constructor(structure: Omit<IStructure, "fieldsMap">) {
        Object.assign(this, structure);

        makeObservable(this, {
            name: observable,
            fields: observable,
            fieldsMap: computed
        });
    }

    get fieldsMap() {
        return new Map<string, IStructureField>(
            this.fields.map(field => [field.name, field])
        );
    }
}

export const SYSTEM_STRUCTURES: IStructure[] = [
    new SystemStructure({
        name: CLICK_EVENT_STRUCT_NAME,
        fields: [
            {
                name: "index",
                type: "integer"
            },
            {
                name: "indexes",
                type: "array:integer"
            }
        ]
    }),
    new SystemStructure({
        name: CHECKBOX_CHANGE_EVENT_STRUCT_NAME,
        fields: [
            {
                name: "index",
                type: "integer"
            },
            {
                name: "indexes",
                type: "array:integer"
            },
            {
                name: "value",
                type: "boolean"
            }
        ]
    }),
    new SystemStructure({
        name: TEXT_INPUT_CHANGE_EVENT_STRUCT_NAME,
        fields: [
            {
                name: "index",
                type: "integer"
            },
            {
                name: "indexes",
                type: "array:integer"
            },
            {
                name: "value",
                type: "string"
            }
        ]
    }),
    new SystemStructure({
        name: DROP_DOWN_LIST_CHANGE_EVENT_STRUCT_NAME,
        fields: [
            {
                name: "index",
                type: "integer"
            },
            {
                name: "indexes",
                type: "array:integer"
            },
            {
                name: "selectedIndex",
                type: "integer"
            }
        ]
    }),
    new SystemStructure({
        name: SLIDER_CHANGE_EVENT_STRUCT_NAME,
        fields: [
            {
                name: "index",
                type: "integer"
            },
            {
                name: "indexes",
                type: "array:integer"
            },
            {
                name: "value",
                type: "double"
            }
        ]
    }),
    new SystemStructure({
        name: SWITCH_CHANGE_EVENT_STRUCT_NAME,
        fields: [
            {
                name: "index",
                type: "integer"
            },
            {
                name: "indexes",
                type: "array:integer"
            },
            {
                name: "value",
                type: "boolean"
            }
        ]
    }),
    new SystemStructure({
        name: SCROLLBAR_STATE_STRUCT_NAME,
        fields: [
            {
                name: "numItems",
                type: "integer"
            },
            {
                name: "itemsPerPage",
                type: "integer"
            },
            {
                name: "positionIncrement",
                type: "integer"
            },
            {
                name: "position",
                type: "integer"
            }
        ]
    }),
    new SystemStructure({
        name: OBJECT_VARIABLE_STATUS_STRUCT_NAME,
        fields: [
            {
                name: "label",
                type: "string"
            },
            {
                name: "image",
                type: "string"
            },
            {
                name: "color",
                type: "string"
            },
            {
                name: "error",
                type: "string"
            }
        ]
    }),
    new SystemStructure({
        name: RADIO_CHANGE_EVENT_STRUCT_NAME,
        fields: [
            {
                name: "index",
                type: "integer"
            },
            {
                name: "indexes",
                type: "array:integer"
            },
            {
                name: "checked",
                type: "boolean"
            }
        ]
    })
];

export function registerSystemStructure(
    structure: Omit<IStructure, "fieldsMap">
) {
    SYSTEM_STRUCTURES.push(new SystemStructure(structure));
}

////////////////////////////////////////////////////////////////////////////////

class SystemEnum implements IEnum {
    name: string;
    members: IEnumMember[];
    projectTypes: ProjectType[] | undefined;

    constructor(
        enumDef: Omit<IEnum, "membersMap"> & {
            projectTypes: ProjectType[] | undefined;
        }
    ) {
        Object.assign(this, enumDef);

        makeObservable(this, {
            membersMap: computed
        });
    }

    get membersMap() {
        const map = new Map<string, IEnumMember>();
        for (const member of this.members) {
            map.set(member.name, member);
        }
        return map;
    }
}

export const SYSTEM_ENUMS: SystemEnum[] = [];

export function registerSystemEnum(
    systemEnum: Omit<IEnum, "membersMap"> & {
        projectTypes: ProjectType[] | undefined;
    }
) {
    SYSTEM_ENUMS.push(new SystemEnum(systemEnum));
}

////////////////////////////////////////////////////////////////////////////////

export function getDefaultValueForType(project: Project, type: string): string {
    if (isObjectType(type)) {
        return "null";
    }
    if (isEnumType(type)) {
        const enumType = getEnumFromType(project, type);
        if (enumType) {
            if (enumType.members.length > 0) {
                return `${enumType.name}.${enumType.members[0].name}`;
            }
        }
        return "0";
    }
    if (isStructType(type)) {
        return "null";
    }
    if (isArrayType(type)) {
        return "null";
    }
    if (type == "string") {
        return '""';
    }
    if (type == "boolean") {
        return "false";
    }
    if (type == "integer" || type == "float" || type == "double") {
        return "0";
    }
    return "null";
}

export function getValueLabel(
    project: Project,
    value: any,
    type: string | null
) {
    if (value === undefined) {
        return "undefined";
    }

    if (value === null) {
        return "null";
    }

    if (type) {
        if (isEnumType(type)) {
            const enumTypeName = getEnumTypeNameFromType(type);
            if (enumTypeName) {
                const enumType = project.variables.enumsMap.get(enumTypeName);
                if (enumType) {
                    const enumMember = enumType.members.find(
                        member => member.value == value
                    );
                    if (enumMember) {
                        return enumMember.name;
                    }
                }
            }
        }
    }

    if (isArray(value)) {
        return `${value.length} element(s)`;
    }

    if (value instanceof Date) {
        return value.toString();
    }

    if (typeof value == "object") {
        return "";
        // try {
        //     return JSON.stringify(value);
        // } catch (err) {
        //     return "[object]";
        // }
    }

    if (typeof value == "string") {
        return JSON.stringify(value);
    }

    if (value instanceof Stream) {
        return "stream";
    }

    if (type == "json") {
        console.log(value);
        return "json";
    }

    return value.toString();
}

////////////////////////////////////////////////////////////////////////////////

export const VariableTypeSelect = observer(
    class VariableTypeSelect extends React.Component<{
        value: string;
        onChange: (value: string) => void;
        project: Project;
        readOnly?: boolean;
        forwardRef?: any;
    }> {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        buttonRef = React.createRef<HTMLButtonElement>();
        dropDownRef = React.createRef<HTMLDivElement>();
        dropDownOpen: boolean | undefined = false;
        dropDownLeft = 0;
        dropDownTop = 0;
        dropDownWidth = 0;

        constructor(props: any) {
            super(props);

            makeObservable(this, {
                dropDownOpen: observable,
                dropDownLeft: observable,
                dropDownTop: observable,
                dropDownWidth: observable,
                setDropDownOpen: action
            });
        }

        setDropDownOpen(open: boolean) {
            if (this.dropDownOpen === false) {
                document.removeEventListener(
                    "pointerdown",
                    this.onDocumentPointerDown,
                    true
                );
            }

            this.dropDownOpen = open;

            if (this.dropDownOpen) {
                document.addEventListener(
                    "pointerdown",
                    this.onDocumentPointerDown,
                    true
                );
            }
        }

        openDropdown = action(() => {
            const buttonEl = this.buttonRef.current;
            if (!buttonEl) {
                return;
            }

            const dropDownEl = this.dropDownRef.current;
            if (!dropDownEl) {
                return;
            }

            this.setDropDownOpen(!this.dropDownOpen);

            if (this.dropDownOpen) {
                const rectInputGroup =
                    buttonEl.parentElement!.getBoundingClientRect();

                this.dropDownLeft = rectInputGroup.left;
                this.dropDownTop = rectInputGroup.bottom;
                this.dropDownWidth = rectInputGroup.width;

                if (
                    this.dropDownLeft + this.dropDownWidth >
                    window.innerWidth
                ) {
                    this.dropDownLeft = window.innerWidth - this.dropDownWidth;
                }

                const DROP_DOWN_HEIGHT = 270;
                if (
                    this.dropDownTop + DROP_DOWN_HEIGHT + 20 >
                    window.innerHeight
                ) {
                    this.dropDownTop =
                        window.innerHeight - (DROP_DOWN_HEIGHT + 20);
                }
            }
        });

        onDocumentPointerDown = action((event: MouseEvent) => {
            if (this.dropDownOpen) {
                if (
                    !closest(
                        event.target,
                        el =>
                            this.buttonRef.current == el ||
                            this.dropDownRef.current == el
                    )
                ) {
                    event.preventDefault();
                    event.stopPropagation();
                    this.setDropDownOpen(false);
                }
            }
        });

        render() {
            const allTypes = new Set<string>();

            function addType(type: string) {
                allTypes.add(type);
                return type;
            }

            const { value, onChange, project } = this.props;

            const basicTypeNames = this.props.project.projectTypeTraits.isLVGL
                ? this.props.project.projectTypeTraits.hasFlowSupport
                    ? LVGL_FLOW_BASIC_TYPE_NAMES
                    : LVGL_BASIC_TYPE_NAMES
                : this.props.project.projectTypeTraits.isDashboard
                ? BASIC_TYPE_NAMES
                : FIRMWARE_BASIC_TYPE_NAMES;

            const basicTypes = basicTypeNames.map(basicTypeName => {
                return (
                    <li
                        key={basicTypeName}
                        value={addType(basicTypeName)}
                        onClick={action(() => {
                            this.props.onChange(basicTypeName);
                            this.setDropDownOpen(false);
                        })}
                    >
                        {basicTypeName}
                    </li>
                );
            });

            const objectTypes =
                this.props.project.projectTypeTraits.hasFlowSupport &&
                !this.props.project.projectTypeTraits.isLVGL
                    ? [...project._store.objectVariableTypes.keys()].map(
                          name => {
                              return (
                                  <li
                                      key={name}
                                      value={addType(`object:${name}`)}
                                      onClick={action(() => {
                                          this.props.onChange(`object:${name}`);
                                          this.setDropDownOpen(false);
                                      })}
                                  >
                                      {`object:${name}`}
                                  </li>
                              );
                          }
                      )
                    : [];

            const enumTypes = [
                ...project.variables.enums,
                ...SYSTEM_ENUMS.filter(
                    enumDef =>
                        enumDef.projectTypes == undefined ||
                        enumDef.projectTypes.indexOf(
                            this.props.project.settings.general.projectType
                        ) != -1
                )
            ];

            const enums = enumTypes.map(enumDef => (
                <li
                    key={enumDef.name}
                    value={addType(`enum:${enumDef.name}`)}
                    onClick={action(() => {
                        this.props.onChange(`enum:${enumDef.name}`);
                        this.setDropDownOpen(false);
                    })}
                >
                    {`enum:${enumDef.name}`}
                </li>
            ));

            const structureTypes = [
                ...project.variables.structures,
                ...(this.props.project.projectTypeTraits.isLVGL
                    ? []
                    : SYSTEM_STRUCTURES)
            ];

            const structures = this.props.project.projectTypeTraits
                .hasFlowSupport
                ? structureTypes.map(struct => (
                      <li
                          key={struct.name}
                          value={addType(`struct:${struct.name}`)}
                          onClick={action(() => {
                              this.props.onChange(`struct:${struct.name}`);
                              this.setDropDownOpen(false);
                          })}
                      >
                          {`struct:${struct.name}`}
                      </li>
                  ))
                : [];

            const arrayOfBasicTypes =
                !this.props.project.projectTypeTraits.isLVGL ||
                this.props.project.projectTypeTraits.hasFlowSupport
                    ? basicTypeNames.map(basicTypeName => {
                          return (
                              <li
                                  key={`array:${basicTypeName}`}
                                  value={addType(`array:${basicTypeName}`)}
                                  onClick={action(() => {
                                      this.props.onChange(
                                          `array:${basicTypeName}`
                                      );
                                      this.setDropDownOpen(false);
                                  })}
                              >
                                  {`array:${basicTypeName}`}
                              </li>
                          );
                      })
                    : [];

            const arrayOfObjects =
                this.props.project.projectTypeTraits.hasFlowSupport &&
                !this.props.project.projectTypeTraits.isLVGL
                    ? [...project._store.objectVariableTypes.keys()].map(
                          name => {
                              return (
                                  <li
                                      key={name}
                                      value={addType(`array:object:${name}`)}
                                      onClick={action(() => {
                                          this.props.onChange(
                                              `array:object:${name}`
                                          );
                                          this.setDropDownOpen(false);
                                      })}
                                  >
                                      {`array:object:${name}`}
                                  </li>
                              );
                          }
                      )
                    : [];

            const arrayOfEnums = this.props.project.projectTypeTraits
                .hasFlowSupport
                ? project.variables.enums.map(enumDef => (
                      <li
                          key={enumDef.name}
                          value={addType(`array:enum:${enumDef.name}`)}
                          onClick={action(() => {
                              this.props.onChange(`array:enum:${enumDef.name}`);
                              this.setDropDownOpen(false);
                          })}
                      >
                          {`array:enum:${enumDef.name}`}
                      </li>
                  ))
                : [];

            const arrayOfStructures = this.props.project.projectTypeTraits
                .hasFlowSupport
                ? structureTypes.map(struct => (
                      <li
                          key={struct.name}
                          value={addType(`array:struct:${struct.name}`)}
                          onClick={action(() => {
                              this.props.onChange(
                                  `array:struct:${struct.name}`
                              );
                              this.setDropDownOpen(false);
                          })}
                      >
                          {`array:struct:${struct.name}`}
                      </li>
                  ))
                : [];

            const portal = ReactDOM.createPortal(
                <div
                    ref={this.dropDownRef}
                    className="dropdown-menu dropdown-menu-end EezStudio_VariableTypeSelect shadow rounded"
                    style={{
                        display: this.dropDownOpen ? "block" : "none",
                        left: this.dropDownLeft,
                        top: this.dropDownTop,
                        width: this.dropDownWidth
                    }}
                >
                    <div>
                        <ul>
                            <div className="font-monospace">{basicTypes}</div>

                            {objectTypes.length > 0 && (
                                <div>
                                    <div>Objects</div>
                                    <div className="font-monospace">
                                        {objectTypes}
                                    </div>
                                </div>
                            )}

                            {enums.length > 0 && (
                                <div>
                                    <div>Enums</div>
                                    <div className="font-monospace">
                                        {enums}
                                    </div>
                                </div>
                            )}

                            {structures.length > 0 && (
                                <div>
                                    <div>Structures</div>
                                    <div className="font-monospace">
                                        {structures}
                                    </div>
                                </div>
                            )}

                            {arrayOfBasicTypes.length > 0 && (
                                <div>
                                    <div>Arrays</div>
                                    <div className="font-monospace">
                                        {arrayOfBasicTypes}
                                    </div>
                                </div>
                            )}

                            {arrayOfObjects.length > 0 && (
                                <div>
                                    <div>Array of Objects</div>
                                    <div className="font-monospace">
                                        {arrayOfObjects}
                                    </div>
                                </div>
                            )}

                            {arrayOfEnums.length > 0 && (
                                <div>
                                    <div>Array of Enumerations</div>
                                    <div className="font-monospace">
                                        {arrayOfEnums}
                                    </div>
                                </div>
                            )}

                            {arrayOfStructures.length > 0 && (
                                <div>
                                    <div>Array of Structures</div>
                                    <div className="font-monospace">
                                        {arrayOfStructures}
                                    </div>
                                </div>
                            )}
                        </ul>
                    </div>
                </div>,
                document.body
            );

            return (
                <div className="input-group" style={{ position: "relative" }}>
                    <input
                        ref={this.props.forwardRef}
                        className="form-control font-monospace"
                        type="text"
                        value={value || ""}
                        onChange={event => onChange(event.target.value)}
                        readOnly={this.props.readOnly}
                    />
                    {!this.props.readOnly && (
                        <>
                            <button
                                ref={this.buttonRef}
                                className="btn btn-secondary dropdown-toggle EezStudio_VariableTypeSelect_DropdownButton"
                                type="button"
                                onClick={this.openDropdown}
                            />
                            {portal}
                        </>
                    )}
                </div>
            );
        }
    }
);

export const VariableTypeUI = observer(
    class VariableTypeUI extends React.Component<PropertyProps> {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        ref = React.createRef<HTMLSelectElement>();

        _type: ValueType;
        updateCounter: number = 0;

        changeDocumentDisposer: IReactionDisposer;

        constructor(props: PropertyProps) {
            super(props);

            makeObservable(this, {
                _type: observable,
                updateCounter: observable,
                componentDidUpdate: action
            });
        }

        componentDidMount() {
            let el = this.ref.current;
            if (el) {
                $(el).on("focus", () => {
                    this.context.undoManager.setCombineCommands(true);
                });

                $(el).on("blur", () => {
                    this.context.undoManager.setCombineCommands(false);
                });
            }

            this.changeDocumentDisposer = autorun(() => {
                this.updateCounter;
                if (this.context.project) {
                    const getPropertyValueResultForType = getPropertyValue(
                        this.props.objects,
                        this.props.propertyInfo
                    );

                    let type = getPropertyValueResultForType
                        ? getPropertyValueResultForType.value
                        : "";

                    if (type == undefined) {
                        type = "";
                    }

                    runInAction(() => {
                        this._type = type;
                    });
                }
            });
        }

        componentDidUpdate() {
            this.updateCounter++;
        }

        componentWillUnmount() {
            this.changeDocumentDisposer();
        }

        onChange = (type: string) => {
            runInAction(() => (this._type = type as ValueType));

            this.props.updateObject({
                [this.props.propertyInfo.name]: type
            });
        };

        render() {
            return (
                <VariableTypeSelect
                    forwardRef={this.ref}
                    value={this._type}
                    onChange={this.onChange}
                    project={this.context.project}
                    readOnly={this.props.readOnly}
                />
            );
        }
    }
);

export const VariableTypeFieldComponent = observer(
    class VariableTypeFieldComponent extends FieldComponent {
        get project() {
            return this.props.dialogContext as Project;
        }

        render() {
            return (
                <VariableTypeSelect
                    value={
                        this.props.values[this.props.fieldProperties.name] ?? ""
                    }
                    onChange={(value: string) => {
                        runInAction(() => {
                            this.props.values["defaultValue"] =
                                getDefaultValueForType(this.project, value);
                        });
                        this.props.onChange(value);
                    }}
                    project={this.project}
                    readOnly={false}
                />
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

export const variableTypeProperty: PropertyInfo = {
    name: "type",
    type: PropertyType.String,
    propertyGridColumnComponent: VariableTypeUI,
    monospaceFont: true,
    disableSpellcheck: true
};

////////////////////////////////////////////////////////////////////////////////

export function migrateType(objectJS: any, propName?: string) {
    if (!propName) {
        propName = "type";
    }

    if (!objectJS[propName]) {
        return;
    }

    if (objectJS[propName] == "list") {
        objectJS[propName] = "array";
    } else if (objectJS[propName].startsWith("custom:")) {
        objectJS[propName] = `object:${objectJS[propName].substring(
            "custom:".length
        )}`;
    } else if (objectJS[propName] == "struct") {
        objectJS[propName] = `struct:${objectJS.structure}`;
        delete objectJS.structure;
    } else if (objectJS[propName] == "enum") {
        objectJS[propName] = `enum:${objectJS.enum}`;
        delete objectJS.enum;
    } else if (objectJS[propName] == "struct:$ActionParams") {
        objectJS[propName] = "struct:$ClickEvent";
    } else if (objectJS[propName] == "struct:$CheckboxActionParams") {
        objectJS[propName] = "struct:$CheckboxChangeEvent";
    } else if (objectJS[propName] == "struct:$TextInputActionParams") {
        objectJS[propName] = "struct:$TextInputChangeEvent";
    } else if (objectJS[propName] == "struct:$DropDownListActionParams") {
        objectJS[propName] = "struct:$DropDownListChangeEvent";
    } else if (objectJS[propName] == "object:TCPConnection") {
        objectJS[propName] = "object:TCPSocket";
    }
}

////////////////////////////////////////////////////////////////////////////////

const ENUM_TYPE_REGEXP = /^enum:(.*)/;
const STRUCT_TYPE_REGEXP = /^struct:(.*)/;
const DYNAMIC_TYPE_REGEXP = /^dynamic:(.*)/;
const ARRAY_TYPE_REGEXP = /^array:(.*)/;
const OBJECT_TYPE_REGEXP = /^object:(.*)/;

export function isIntegerType(type: string) {
    return type == "integer";
}

export function isBasicType(type: string) {
    return BASIC_TYPE_NAMES.indexOf(type) != -1;
}

export function isEnumType(type: string) {
    return type && type.match(ENUM_TYPE_REGEXP) != null;
}

export function isStructType(type: string) {
    return type && type.match(STRUCT_TYPE_REGEXP) != null;
}

export function isDynamicType(type: string) {
    return type && type.match(DYNAMIC_TYPE_REGEXP) != null;
}

export function isArrayType(type: string) {
    return type ? type.match(ARRAY_TYPE_REGEXP) != null : false;
}

export function isObjectType(type: string) {
    return type && type.match(OBJECT_TYPE_REGEXP) != null ? true : false;
}

export function getObjectType(type: string) {
    const result = type.match(OBJECT_TYPE_REGEXP);
    if (result == null) {
        return null;
    }
    return result[1];
}

export function getArrayElementTypeFromType(type: string) {
    const result = type.match(ARRAY_TYPE_REGEXP);
    if (result == null) {
        return null;
    }
    return result[1] as ValueType;
}

export function getStructTypeNameFromType(type: string) {
    const result = type.match(STRUCT_TYPE_REGEXP);
    if (result == null) {
        return null;
    }
    return result[1];
}

export function getStructureFromType(
    project: Project,
    type: string
): IStructure | undefined {
    const structTypeName = getStructTypeNameFromType(type);
    if (!structTypeName) {
        return undefined;
    }
    return project.variables.structsMap.get(structTypeName);
}

export function getDynamicTypeNameFromType(type: string) {
    const result = type.match(DYNAMIC_TYPE_REGEXP);
    if (result == null) {
        return null;
    }
    return result[1];
}

export function getEnumTypeNameFromType(type: string) {
    const result = type.match(ENUM_TYPE_REGEXP);
    if (result == null) {
        return null;
    }
    return result[1];
}

export function getEnumFromType(project: Project, type: string) {
    const enumTypeName = getEnumTypeNameFromType(type);
    if (!enumTypeName) {
        return undefined;
    }
    return project.variables.enumsMap.get(enumTypeName);
}

export function getObjectVariableTypeFromType(
    projectStore: ProjectStore,
    type: string
) {
    const result = type.match(OBJECT_TYPE_REGEXP);
    if (result == null) {
        return undefined;
    }

    const objectVariableTypeName = result[1];

    return projectStore.objectVariableTypes.get(objectVariableTypeName);
}

export function isIntegerVariable(variable: IVariable) {
    return isIntegerType(variable.type);
}

export function isEnumVariable(variable: IVariable) {
    return isEnumType(variable.type);
}

export function isStructVariable(variable: IVariable) {
    return isStructType(variable.type);
}

export function isArrayVariable(variable: IVariable) {
    return isArrayType(variable.type);
}

export function getEnumTypeNameFromVariable(variable: IVariable) {
    return getEnumTypeNameFromType(variable.type);
}

export function getEnumValues(variable: IVariable): any[] {
    return [];
}

export function isValueTypeOf(
    project: Project,
    value: any,
    valueType: ValueType,
    type: string
): string | null {
    if (value == null) {
        return null;
    }
    if (type == "integer") {
        if (Number.isInteger(value)) return null;
    } else if (type == "float" || type == "double") {
        if (typeof value == "number") return null;
    } else if (type == "boolean") {
        if (typeof value == "boolean" || Number.isInteger(value)) return null;
    } else if (type == "string") {
        if (typeof value == "string") return null;
    } else if (type == "date") {
        return null;
    } else if (isArrayType(type)) {
        if (isArray(value)) {
            const arrayElementType = getArrayElementTypeFromType(type);

            for (let i = 0; i < value.length; i++) {
                const result = isValueTypeOf(
                    project,
                    value[i],
                    "any",
                    arrayElementType!
                );
                if (result) {
                    return `${result} => array element ${
                        i + 1
                    } is not an ${type}`;
                }
            }

            return null;
        }
    } else if (isStructType(type)) {
        if (typeof value == "object") {
            const structure = getStructureFromType(project, type);
            if (!structure) {
                return `'${type}' not found`;
            }

            const keys = [];

            for (const key in value) {
                const field = structure.fieldsMap.get(key);
                if (!field) {
                    return `unknown field '${key}'`;
                }

                const result = isValueTypeOf(
                    project,
                    value[key],
                    "any",
                    field.type
                );
                if (result) {
                    return `${result} => field '${key}' should be of type '${field.type}'`;
                }

                keys.push(key);
            }

            // const result = _difference(
            //     structure.fields.map(field => field.name),
            //     keys
            // );

            // if (result.length > 0) {
            //     return `missing field(s): ${result.join(",")}`;
            // }

            return null;
        }
    } else if (isEnumType(type)) {
        if (!Number.isInteger(value)) {
            return `not an integer`;
        }

        const enumTypeName = getEnumTypeNameFromType(type);
        if (!enumTypeName) {
            return "enum name expected";
        }

        const enumType = project.variables.enumsMap.get(enumTypeName);
        if (!enumType) {
            return `enum '${enumTypeName}' not found`;
        }

        if (!enumType.members.find(member => member.value == value)) {
            return `value not in enum '${enumTypeName}'`;
        }

        return null;
    } else if (type == "json") {
        if (valueType == type) {
            return null;
        }
    }

    return `not a ${type}`;
}

export function isValidType(project: Project, valueType: ValueType): boolean {
    if (valueType == "undefined") {
        return true;
    }
    if (valueType == "null") {
        return true;
    }

    if (isBasicType(valueType)) {
        return true;
    }

    if (getEnumFromType(project, valueType)) {
        return true;
    }

    if (getStructureFromType(project, valueType)) {
        return true;
    }

    const objectType = getObjectType(valueType);
    if (objectType) {
        if (project._store.objectVariableTypes.get(objectType)) {
            return true;
        }
    }

    const arrayElement = getArrayElementTypeFromType(valueType);
    if (arrayElement) {
        return isValidType(project, arrayElement);
    }

    return false;
}

////////////////////////////////////////////////////////////////////////////////

export const objectVariableTypes = new Map<string, IObjectVariableType>();

export function createObjectVariableType(
    objectVariableType: IObjectVariableType
) {
    const temp = Object.assign({}, objectVariableType);

    temp.valueFieldDescriptions = [
        ...temp.valueFieldDescriptions,
        {
            name: "status",
            valueType: [
                {
                    name: "label",
                    valueType: "string",
                    getFieldValue: (value: any): string => {
                        return value.label;
                    }
                },
                {
                    name: "image",
                    valueType: "string",
                    getFieldValue: (value: any): string => {
                        return value.image;
                    }
                },
                {
                    name: "color",
                    valueType: "string",
                    getFieldValue: (value: any): string => {
                        return value.color;
                    }
                },
                {
                    name: "error",
                    valueType: "string",
                    getFieldValue: (value: any): string => {
                        return value.error;
                    }
                }
            ],
            getFieldValue: (value: IObjectVariableValue) => {
                return value.status;
            }
        }
    ];

    return temp;
}

export function registerObjectVariableType(
    name: string,
    objectVariableType: IObjectVariableType
) {
    objectVariableTypes.set(name, createObjectVariableType(objectVariableType));
}

////////////////////////////////////////////////////////////////////////////////

interface ActionParamsValue {
    index: number;
    indexes: number[];
}

export function makeActionParamsValue(
    flowContext: IFlowContext
): ActionParamsValue {
    let actionParamsValue: ActionParamsValue;

    let indexes = flowContext.dataContext.get(FLOW_ITERATOR_INDEXES_VARIABLE);
    if (indexes) {
        actionParamsValue = {
            index: indexes[0],
            indexes
        };
    } else {
        actionParamsValue = {
            index: 0,
            indexes: [0]
        };
    }

    return actionParamsValue;
}

interface CheckboxActionParamsValue {
    index: number;
    indexes: number[];
    value: boolean;
}

export function makeCheckboxActionParamsValue(
    flowContext: IFlowContext,
    value: boolean
): CheckboxActionParamsValue {
    return { ...makeActionParamsValue(flowContext), value };
}

export function makeRadioActionParamsValue(
    flowContext: IFlowContext,
    value: boolean
): CheckboxActionParamsValue {
    return { ...makeActionParamsValue(flowContext), value };
}

interface TextInputActionParamsValue {
    index: number;
    indexes: number[];
    value: string;
}

export function makeTextInputActionParamsValue(
    flowContext: IFlowContext,
    value: string
): TextInputActionParamsValue {
    return { ...makeActionParamsValue(flowContext), value };
}

interface DropDownListActionParamsValue {
    index: number;
    indexes: number[];
    selectedIndex: number;
}

export function makeDropDownListActionParamsValue(
    flowContext: IFlowContext,
    selectedIndex: number
): DropDownListActionParamsValue {
    return { ...makeActionParamsValue(flowContext), selectedIndex };
}

interface SliderActionParamsValue {
    index: number;
    indexes: number[];
    value: number;
}

export function makeSliderActionParamsValue(
    flowContext: IFlowContext,
    value: number
): SliderActionParamsValue {
    return { ...makeActionParamsValue(flowContext), value };
}
