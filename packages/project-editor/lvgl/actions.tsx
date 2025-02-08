import React from "react";
import { computed, makeObservable, observable, runInAction } from "mobx";

import {
    registerClass,
    makeDerivedClassInfo,
    PropertyType,
    EezObject,
    ClassInfo,
    MessageType,
    getId,
    getParent,
    IMessage,
    PropertyInfo,
    EnumItem,
    getClassByName
} from "project-editor/core/object";

import {
    ActionComponent,
    isFlowProperty,
    makeAssignableExpressionProperty
} from "project-editor/flow/component";

import {
    ValueType,
    getEnumFromType
} from "project-editor/features/variable/value-type";
import { COMPONENT_TYPE_LVGL_ACTION_API } from "project-editor/flow/components/component-types";
import type { IFlowContext } from "project-editor/flow/flow-interfaces";
import { specificGroup } from "project-editor/ui-components/PropertyGrid/groups";
import { humanize } from "eez-studio-shared/string";
import {
    createObject,
    getAncestorOfType,
    getChildOfObject,
    getClassInfo,
    getListLabel,
    Message,
    ProjectStore,
    propertyNotFoundMessage,
    propertyNotSetMessage,
    Section
} from "project-editor/store";
import {
    findBitmap,
    findLvglStyle,
    findPage,
    Project,
    ProjectType
} from "project-editor/project/project";
import { Assets, DataBuffer } from "project-editor/build/assets";
import { ProjectEditor } from "project-editor/project-editor-interface";
import { makeLvglExpressionProperty } from "project-editor/lvgl/expression-property";
import {
    buildAssignableExpression,
    buildExpression
} from "project-editor/flow/expression";
import { escapeCString } from "./widget-common";
import { makeEndInstruction } from "project-editor/flow/expression/instructions";
import { RightArrow } from "project-editor/ui-components/icons";
import { Dialog, showDialog } from "eez-studio-ui/dialog";
import { observer } from "mobx-react";
import { SearchInput } from "eez-studio-ui/search-input";
import { IListNode, List, ListContainer, ListItem } from "eez-studio-ui/list";

////////////////////////////////////////////////////////////////////////////////

type LvglActionPropertyType =
    | "boolean"
    | "integer"
    | "string"
    | `enum:${string}`
    | "screen"
    | "widget"
    | `widget:${string}`
    | "group"
    | "style"
    | "image";

export interface IActionPropertyDefinition {
    name: string;
    type: LvglActionPropertyType;
    isAssignable?: boolean;
    helpText: string;
}

function getValueTypeFromActionPropertyType(
    actionPropertyType: LvglActionPropertyType
): ValueType {
    if (actionPropertyType == "screen") {
        return "integer";
    }

    if (actionPropertyType.startsWith("widget:")) {
        return "widget";
    }

    if (actionPropertyType == "group") {
        return "integer";
    }

    if (actionPropertyType == "style") {
        return "integer";
    }

    if (actionPropertyType == "image") {
        return "string";
    }

    return actionPropertyType as ValueType;
}

////////////////////////////////////////////////////////////////////////////////

export interface IActionDefinition {
    id: number;
    name: string;
    group: string;
    properties: IActionPropertyDefinition[];
    defaults: any;
    label?: (
        propertyValues: string[],
        propertyNames: string[]
    ) => React.ReactNode;
    helpText: string;
    disabled?: (project: Project) => string | false;
}

export const actionDefinitions: IActionDefinition[] = [];
const actionClasses = new Map<string, typeof LVGLActionType>();
const actionNameToActionId = new Map<string, number>();
const actionIdToActionName = new Map<number, string>();

function getActionDisplayName(actionDefinition: IActionDefinition) {
    return humanize(actionDefinition.name)
        .split(" ")
        .map(word =>
            word == "to" ? word : word[0].toUpperCase() + word.substring(1)
        )
        .join(" ");
}

export function registerAction(actionDefinition: IActionDefinition) {
    actionDefinitions.push(actionDefinition);

    if (actionNameToActionId.has(actionDefinition.name)) {
        throw "duplicate LVGL action name";
    }
    if (actionIdToActionName.has(actionDefinition.id)) {
        throw "duplicate LVGL action name";
    }

    actionNameToActionId.set(actionDefinition.name, actionDefinition.id);
    actionIdToActionName.set(actionDefinition.id, actionDefinition.name);

    const properties: PropertyInfo[] = [];

    for (const actionProperty of actionDefinition.properties) {
        const expressionType = getValueTypeFromActionPropertyType(
            actionProperty.type
        );

        if (actionProperty.isAssignable) {
            properties.push(
                makeAssignableExpressionProperty(
                    {
                        name: actionProperty.name,
                        displayName: `Store ${actionProperty.name} into`,
                        type: PropertyType.MultilineText
                    },
                    expressionType
                )
            );
        } else {
            let enumItems:
                | ((actionType: LVGLActionType) => EnumItem[])
                | undefined;
            let enumDisallowUndefined = true;

            let referencedObjectCollectionPath: string | undefined;

            if (actionProperty.type.startsWith("enum:")) {
                enumItems = (actionType: LVGLActionType) => {
                    let enumItems = [];

                    const enumType = getEnumFromType(
                        ProjectEditor.getProject(actionType),
                        actionProperty.type
                    );
                    if (enumType) {
                        for (const member of enumType.members) {
                            enumItems.push({
                                id: member.name,
                                label: member.name
                            });
                        }
                    }

                    return enumItems;
                };
            } else if (actionProperty.type == "screen") {
                referencedObjectCollectionPath = "userPages";
            } else if (actionProperty.type.startsWith("widget")) {
                enumItems = (actionType: LVGLActionType) => {
                    let lvglIdentifiers = ProjectEditor.getProjectStore(
                        actionType
                    ).lvglIdentifiers.getIdentifiersVisibleFromFlow(
                        ProjectEditor.getFlow(actionType)
                    );

                    const widgetType = actionProperty.type.slice(
                        "widget:".length
                    );

                    lvglIdentifiers = lvglIdentifiers.filter(lvglIdentifier => {
                        if (lvglIdentifier.widgets.length > 1) {
                            return false;
                        }

                        const widget = lvglIdentifier.widgets[0];

                        if (!widgetType) {
                            return (
                                widget instanceof ProjectEditor.LVGLWidgetClass
                            );
                        } else {
                            const lvglWidgetClassName = `LVGL${widgetType}Widget`;

                            const projectStore =
                                ProjectEditor.getProjectStore(actionType);

                            const lvglWidgetClass = getClassByName(
                                projectStore,
                                lvglWidgetClassName
                            )!;

                            return widget instanceof lvglWidgetClass;
                        }
                    });

                    lvglIdentifiers.sort((a, b) =>
                        a.identifier.localeCompare(b.identifier)
                    );

                    return lvglIdentifiers.map(lvglIdentifier => ({
                        id: lvglIdentifier.identifier,
                        label: lvglIdentifier.identifier
                    }));
                };
                referencedObjectCollectionPath = "";
            } else if (actionProperty.type == "style") {
                referencedObjectCollectionPath = "allLvglStyles";
            } else if (actionProperty.type == "image") {
                referencedObjectCollectionPath = "bitmaps";
            } else if (actionProperty.type == "group") {
                referencedObjectCollectionPath = "lvglGroups/groups";
            }

            const lvglExpressionProperty = makeLvglExpressionProperty(
                actionProperty.name,
                expressionType,
                "input",
                ["literal", "expression"],
                {
                    dynamicType: () => {
                        if (referencedObjectCollectionPath != undefined) {
                            return PropertyType.ObjectReference;
                        }

                        if (enumItems != undefined) {
                            return PropertyType.Enum;
                        }

                        return expressionType == "integer" ||
                            expressionType == "float" ||
                            expressionType == "double"
                            ? PropertyType.Number
                            : expressionType == "boolean"
                            ? PropertyType.Boolean
                            : PropertyType.MultilineText;
                    },
                    enumItems,
                    enumDisallowUndefined,
                    checkboxStyleSwitch: true,
                    referencedObjectCollectionPath,
                    lvglActionPropertyType: actionProperty.type
                }
            );

            properties.push(...lvglExpressionProperty);
        }
    }

    const defaultValue = Object.assign({}, actionDefinition.defaults);

    actionDefinition.properties.forEach(propertyDefinition => {
        if (!propertyDefinition.isAssignable) {
            defaultValue[propertyDefinition.name + "Type"] = "literal";
        }
    });

    const actionDisplayName = getActionDisplayName(actionDefinition);

    const actionClass = class extends LVGLActionType {
        static classInfo = makeDerivedClassInfo(LVGLActionType.classInfo, {
            properties,
            label: () => actionDisplayName,
            defaultValue,
            listLabel: (action: LVGLActionType, collapsed: boolean) => {
                if (!collapsed) {
                    return actionDisplayName;
                }

                const propertyNames = actionDefinition.properties.map(
                    actionProperty => humanize(actionProperty.name)
                );
                const propertyValues = actionDefinition.properties.map(
                    actionProperty => {
                        let value = (action as any)[actionProperty.name];

                        if (typeof value == "boolean") {
                            value = value ? "ON" : "OFF";
                        } else if (
                            actionProperty.isAssignable ||
                            (action as any)[actionProperty.name + "Type"] ==
                                "expression"
                        ) {
                            value = `{${value}}`;
                        }

                        return value;
                    }
                );

                let propertiesDescription: React.ReactNode;
                if (actionDefinition.label) {
                    propertiesDescription = actionDefinition.label(
                        propertyValues,
                        propertyNames
                    );
                } else {
                    propertiesDescription = actionDefinition.properties.map(
                        (actionProperty, i) => {
                            return (
                                <>
                                    <i>{propertyNames[i]}</i>
                                    {actionProperty.isAssignable ? (
                                        <RightArrow />
                                    ) : (
                                        "="
                                    )}
                                    {propertyValues[i]}
                                    {i <
                                        actionDefinition.properties.length -
                                            1 && ", "}
                                </>
                            );
                        }
                    );
                }

                return (
                    <>
                        <b>{actionDisplayName}</b>&nbsp;
                        {propertiesDescription}
                    </>
                );
            },

            updateObjectValueHook(object, values) {
                const projectStore = ProjectEditor.getProjectStore(object);

                for (const key of Object.keys(values)) {
                    if (key.endsWith("Type")) {
                        const propertyName = key.slice(0, -"Type".length);
                        const propertyDefinition =
                            actionDefinition.properties.find(
                                propertyDefinition =>
                                    propertyDefinition.name == propertyName
                            );
                        if (propertyDefinition) {
                            if (propertyDefinition.type.startsWith("enum:")) {
                                const enumName = propertyDefinition.type.slice(
                                    "enum:".length
                                );

                                if (
                                    values[key] == "expression" &&
                                    (object as any)[key] == "literal"
                                ) {
                                    projectStore.updateObject(object, {
                                        [propertyName]: `${enumName}.${
                                            (object as any)[propertyName]
                                        }`
                                    });
                                } else if (
                                    values[key] == "literal" &&
                                    (object as any)[key] == "expression"
                                ) {
                                    if (
                                        (object as any)[
                                            propertyName
                                        ].startsWith(enumName + ".")
                                    ) {
                                        let value = (object as any)[
                                            propertyName
                                        ].slice((enumName + ".").length);

                                        const enumType = getEnumFromType(
                                            projectStore.project,
                                            `enum:${enumName}`
                                        );
                                        if (enumType) {
                                            if (
                                                !enumType.members.find(
                                                    member =>
                                                        member.name == value
                                                )
                                            ) {
                                                value =
                                                    enumType.members[0].name;
                                            }
                                        } else {
                                            value = "";
                                        }

                                        projectStore.updateObject(object, {
                                            [propertyName]: value
                                        });
                                    }
                                }
                            }
                        }
                    }
                }
            },

            check: (object: LVGLActionType, messages: IMessage[]) => {
                const projectStore = ProjectEditor.getProjectStore(object);

                if (actionDefinition.disabled) {
                    const errorMessage = actionDefinition.disabled(
                        projectStore.project
                    );
                    if (errorMessage !== false) {
                        messages.push(
                            new Message(MessageType.ERROR, errorMessage, object)
                        );
                        return;
                    }
                }

                const component = getAncestorOfType<LVGLActionComponent>(
                    object,
                    LVGLActionComponent.classInfo
                );
                if (component) {
                    for (const propertyInfo of properties) {
                        if (propertyInfo.expressionType == undefined) {
                            continue;
                        }

                        if (
                            (object as any)[propertyInfo.name + "Type"] ==
                                "expression" ||
                            isFlowProperty(object, propertyInfo, ["assignable"])
                        ) {
                            ProjectEditor.checkProperty(
                                projectStore,
                                component,
                                messages,
                                object,
                                propertyInfo
                            );
                        } else {
                            const project = ProjectEditor.getProject(object);
                            const value = (object as any)[propertyInfo.name];

                            if (
                                propertyInfo.lvglActionPropertyType == "screen"
                            ) {
                                if (!value) {
                                    messages.push(
                                        propertyNotSetMessage(
                                            object,
                                            propertyInfo.name
                                        )
                                    );
                                } else {
                                    let page = findPage(project, value);
                                    if (!page) {
                                        messages.push(
                                            propertyNotFoundMessage(
                                                object,
                                                propertyInfo.name
                                            )
                                        );
                                    }
                                }
                            } else if (
                                propertyInfo.lvglActionPropertyType?.startsWith(
                                    "widget"
                                )
                            ) {
                                if (!value) {
                                    messages.push(
                                        propertyNotSetMessage(
                                            object,
                                            propertyInfo.name
                                        )
                                    );
                                } else {
                                    const lvglIdentifier =
                                        ProjectEditor.getProjectStore(
                                            object
                                        ).lvglIdentifiers.getIdentifierByName(
                                            ProjectEditor.getFlow(object),
                                            value
                                        );

                                    if (lvglIdentifier == undefined) {
                                        messages.push(
                                            propertyNotFoundMessage(
                                                object,
                                                propertyInfo.name
                                            )
                                        );
                                    } else if (
                                        lvglIdentifier.widgets.length > 1
                                    ) {
                                        messages.push(
                                            new Message(
                                                MessageType.ERROR,
                                                `Multiple widgets with the same name`,
                                                getChildOfObject(
                                                    object,
                                                    propertyInfo.name
                                                )
                                            )
                                        );
                                    } else {
                                        const widget =
                                            lvglIdentifier.widgets[0];

                                        const widgetType =
                                            propertyInfo.lvglActionPropertyType.slice(
                                                "widget:".length
                                            );
                                        if (widgetType) {
                                            const classInfo =
                                                getClassInfo(widget);
                                            const expectedClassInfo =
                                                getClassByName(
                                                    project._store,
                                                    `LVGL${widgetType}Widget`
                                                )?.classInfo;

                                            if (
                                                classInfo != expectedClassInfo
                                            ) {
                                                messages.push(
                                                    new Message(
                                                        MessageType.ERROR,
                                                        `Invalid widget type`,
                                                        getChildOfObject(
                                                            widget,
                                                            propertyInfo.name
                                                        )
                                                    )
                                                );
                                            }
                                        }
                                    }
                                }
                            } else if (
                                propertyInfo.lvglActionPropertyType == "group"
                            ) {
                                if (value) {
                                    if (
                                        !projectStore.project.lvglGroups.groups.some(
                                            group => group.name == value
                                        )
                                    ) {
                                        messages.push(
                                            propertyNotFoundMessage(
                                                object,
                                                propertyInfo.name
                                            )
                                        );
                                    }
                                } else {
                                    messages.push(
                                        propertyNotSetMessage(
                                            object,
                                            propertyInfo.name
                                        )
                                    );
                                }
                            } else if (
                                propertyInfo.lvglActionPropertyType == "style"
                            ) {
                                if (value) {
                                    const lvglStyle = findLvglStyle(
                                        projectStore.project,
                                        value
                                    );

                                    if (!lvglStyle) {
                                        messages.push(
                                            propertyNotFoundMessage(
                                                object,
                                                propertyInfo.name
                                            )
                                        );
                                    }
                                } else {
                                    messages.push(
                                        propertyNotSetMessage(
                                            object,
                                            propertyInfo.name
                                        )
                                    );
                                }
                            } else if (
                                propertyInfo.lvglActionPropertyType == "image"
                            ) {
                                if (value) {
                                    const bitmap = findBitmap(
                                        ProjectEditor.getProject(object),
                                        value
                                    );

                                    if (!bitmap) {
                                        messages.push(
                                            propertyNotFoundMessage(
                                                object,
                                                propertyInfo.name
                                            )
                                        );
                                    }
                                } else {
                                    messages.push(
                                        propertyNotSetMessage(
                                            object,
                                            propertyInfo.name
                                        )
                                    );
                                }
                            } else if (
                                propertyInfo.lvglActionPropertyType?.startsWith(
                                    "enum:"
                                )
                            ) {
                                if (value) {
                                    const enumType = getEnumFromType(
                                        project,
                                        propertyInfo.lvglActionPropertyType
                                    );
                                    if (
                                        !enumType ||
                                        !enumType.members.find(
                                            member => member.name == value
                                        )
                                    ) {
                                        messages.push(
                                            propertyNotFoundMessage(
                                                object,
                                                propertyInfo.name
                                            )
                                        );
                                    }
                                } else {
                                    messages.push(
                                        propertyNotSetMessage(
                                            object,
                                            propertyInfo.name
                                        )
                                    );
                                }
                            } else if (value == undefined) {
                                messages.push(
                                    propertyNotSetMessage(
                                        object,
                                        propertyInfo.name
                                    )
                                );
                            }
                        }
                    }
                }
            }
        });

        override makeEditable() {
            super.makeEditable();

            const observables: any = {};

            actionDefinition.properties.forEach(propertyInfo => {
                (this as any)[propertyInfo.name] = undefined;
                observables[propertyInfo.name] = observable;

                if (!propertyInfo.isAssignable) {
                    (this as any)[propertyInfo.name + "Type"] = undefined;
                    observables[propertyInfo.name + "Type"] = observable;
                }
            });

            makeObservable(this, observables);
        }
    };

    actionClasses.set(actionDefinition.name, actionClass);
}

////////////////////////////////////////////////////////////////////////////////

async function showNewLVGLActionDialog(project: Project) {
    return new Promise<string | null>(resolve => {
        const onOk = (value: string) => {
            resolve(value);
        };

        const onCancel = () => {
            resolve(null);
        };

        runInAction(() => {
            newLVGLActionDialogState.project = project;
            newLVGLActionDialogState.searchText = "";
            newLVGLActionDialogState._selectedActionName = undefined;
        });

        showDialog(<NewLVGLActionDialog onOk={onOk} onCancel={onCancel} />);
    });
}

////////////////////////////////////////////////////////////////////////////////

class NewLVGLActionDialogState {
    project: Project;
    searchText: string = "";
    _selectedGroup: string | undefined;
    _selectedActionName: string | undefined;

    constructor() {
        makeObservable(this, {
            project: observable,
            searchText: observable,
            _selectedGroup: observable,
            _selectedActionName: observable,
            groups: computed,
            searchFilteredActionDefinitions: computed,
            filteredActionDefinitions: computed
        });
    }

    onSearchChange = (event: any) => {
        runInAction(() => {
            this.searchText = $(event.target).val() as string;
            this._selectedActionName = this.filteredActionDefinitions[0]?.name;
        });
    };

    get groups() {
        const groups: string[] = [];

        for (const actionDefinition of actionDefinitions) {
            if (
                this.searchFilteredActionDefinitions.indexOf(
                    actionDefinition
                ) != -1 &&
                groups.indexOf(actionDefinition.group) == -1
            ) {
                groups.push(actionDefinition.group);
            }
        }
        return groups;
    }

    get selectedGroup() {
        if (
            this._selectedGroup &&
            this.groups.indexOf(this._selectedGroup) != -1
        ) {
            return this._selectedGroup;
        }
        return this.groups[0];
    }

    set selectedGroup(group: string) {
        runInAction(() => {
            this._selectedGroup = group;
        });
    }

    get selectedActionName() {
        return (
            this._selectedActionName || this.filteredActionDefinitions[0]?.name
        );
    }

    set selectedActionName(name: string) {
        runInAction(() => {
            this._selectedActionName = name;
        });
    }

    get searchFilteredActionDefinitions() {
        return actionDefinitions.filter(actionDefinition => {
            if (actionDefinition.disabled) {
                if (actionDefinition.disabled(this.project) !== false) {
                    return false;
                }
            }

            return getActionDisplayName(actionDefinition)
                .toLowerCase()
                .includes(this.searchText.toLowerCase());
        });
    }

    get filteredActionDefinitions() {
        return this.searchFilteredActionDefinitions.filter(
            actionDefinition => actionDefinition.group == this.selectedGroup
        );
    }
}

const newLVGLActionDialogState = new NewLVGLActionDialogState();

const NewLVGLActionDialog = observer(
    class NewLVGLActionDialog extends React.Component<{
        onOk: (value: string) => void;
        onCancel: () => void;
    }> {
        ref = React.createRef<HTMLDivElement>();

        open: boolean = true;

        constructor(props: any) {
            super(props);

            makeObservable(this, {
                open: observable,
                nodes: computed
            });
        }

        get groupNodes() {
            const nodes: IListNode<string>[] = [];

            for (const group of newLVGLActionDialogState.groups) {
                nodes.push({
                    id: group,
                    label: group,
                    data: group,
                    selected: group == newLVGLActionDialogState.selectedGroup
                });
            }

            return nodes;
        }

        get nodes() {
            const nodes: IListNode<IActionDefinition>[] = [];

            for (const actionDefinition of newLVGLActionDialogState.filteredActionDefinitions) {
                const actionDisplayName =
                    getActionDisplayName(actionDefinition);

                if (
                    actionDisplayName
                        .toLowerCase()
                        .indexOf(
                            newLVGLActionDialogState.searchText.toLowerCase()
                        ) == -1
                ) {
                    continue;
                }

                nodes.push({
                    id: actionDefinition.name,
                    label: actionDisplayName,
                    data: actionDefinition,
                    selected:
                        actionDefinition.name ==
                        newLVGLActionDialogState.selectedActionName
                });
            }

            return nodes;
        }

        onOkEnabled = () => {
            return !!newLVGLActionDialogState.selectedActionName;
        };

        onOk = () => {
            this.props.onOk(newLVGLActionDialogState.selectedActionName);
            return true;
        };

        onDoubleClick = () => {
            if (newLVGLActionDialogState.selectedActionName) {
                this.onOk();
                runInAction(() => {
                    this.open = false;
                });
            }
        };

        componentDidMount(): void {
            const element = this.ref.current?.querySelector(
                ".EezStudio_ListItem.EezStudio_Selected"
            );
            if (element) {
                element.scrollIntoView({
                    block: "nearest",
                    behavior: "auto"
                });
            }
        }

        render() {
            return (
                <Dialog
                    open={this.open}
                    modal={true}
                    title={"Add a New LVGL Action"}
                    okEnabled={this.onOkEnabled}
                    onOk={this.onOk}
                    onCancel={this.props.onCancel}
                >
                    <div
                        ref={this.ref}
                        className="EezStudio_NewLVGLActionDialog"
                    >
                        <SearchInput
                            searchText={newLVGLActionDialogState.searchText}
                            onClear={() => {
                                newLVGLActionDialogState.searchText = "";
                            }}
                            onChange={newLVGLActionDialogState.onSearchChange}
                            onKeyDown={newLVGLActionDialogState.onSearchChange}
                        />
                        <div className="EezStudio_NewLVGLActionDialog_Content">
                            <ListContainer tabIndex={0}>
                                <List
                                    nodes={this.groupNodes}
                                    renderNode={(node: IListNode<string>) => {
                                        return <ListItem label={node.label} />;
                                    }}
                                    selectNode={(node: IListNode<string>) => {
                                        newLVGLActionDialogState.selectedGroup =
                                            node.data;
                                    }}
                                ></List>
                            </ListContainer>
                            <ListContainer tabIndex={0}>
                                <List
                                    nodes={this.nodes}
                                    renderNode={(
                                        node: IListNode<IActionDefinition>
                                    ) => {
                                        return <ListItem label={node.label} />;
                                    }}
                                    selectNode={(
                                        node: IListNode<IActionDefinition>
                                    ) => {
                                        newLVGLActionDialogState.selectedActionName =
                                            node.data.name;
                                    }}
                                    onDoubleClick={this.onDoubleClick}
                                ></List>
                            </ListContainer>
                        </div>
                    </div>
                </Dialog>
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

interface IBuildProperties {
    name: string;
    expression: string;
    isAssignable: boolean;
    isHidden: boolean;
    isBuildable: boolean;
}

export class LVGLActionType extends EezObject {
    action: string;

    static classInfo: ClassInfo = {
        getClass: function (projectStore: ProjectStore, jsObject: any) {
            if (jsObject.action == "ObjectSetX") jsObject.action = "objSetX";

            const actionClass = actionClasses.get(jsObject.action);
            if (actionClass) {
                return actionClass;
            }

            return LVGLActionType;
        },

        properties: [
            {
                name: "action",
                displayName: (object: LVGLActionType) => {
                    const actions = getParent(object) as LVGLActionType[];
                    if (actions.length < 2) {
                        return "Action";
                    }
                    return `Action #${actions.indexOf(object) + 1}`;
                },
                type: PropertyType.Enum,
                enumItems: [...actionClasses.keys()].map(id => ({
                    id
                })),
                enumDisallowUndefined: true,
                hideInPropertyGrid: true
            }
        ],

        newItem: async (object: LVGLActionType[]) => {
            const project = ProjectEditor.getProject(object);

            const action = await showNewLVGLActionDialog(project);

            if (!action) {
                return undefined;
            }

            const actionTypeProperties = {
                action
            };

            let actionTypeObject;

            const ActionClass = actionClasses.get(action)!;

            actionTypeObject = createObject<LVGLActionType>(
                project._store,
                Object.assign(
                    actionTypeProperties,

                    ActionClass.classInfo.defaultValue
                ),
                ActionClass
            );

            return actionTypeObject;
        }
    };

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            action: observable
        });
    }

    getExpression(assets: Assets, propertyInfo: PropertyInfo) {
        let value = (this as any)[propertyInfo.name];

        if (isFlowProperty(this, propertyInfo, ["assignable"])) {
            return value;
        }

        let valueType = (this as any)[propertyInfo.name + "Type"] ?? "literal";

        if (typeof value == "number") {
            return value.toString();
        }

        if (typeof value == "boolean") {
            return value ? "true" : "false";
        }

        if (valueType == "literal") {
            if (propertyInfo.lvglActionPropertyType == "boolean") {
                return value ? "true" : "false";
            } else if (propertyInfo.lvglActionPropertyType == "integer") {
                return value;
            } else if (propertyInfo.lvglActionPropertyType == "string") {
                return escapeCString(value ?? "");
            } else if (
                propertyInfo.lvglActionPropertyType?.startsWith("enum:")
            ) {
                const enumType = getEnumFromType(
                    assets.projectStore.project,
                    propertyInfo.expressionType!
                );
                if (enumType) {
                    const enumMember = enumType.members.find(
                        member => member.name == value
                    );
                    if (enumMember) {
                        return enumMember.value.toString();
                    }
                }
                return 0;
            } else if (propertyInfo.lvglActionPropertyType == "screen") {
                return assets.getPageIndex(this, propertyInfo.name);
            } else if (
                propertyInfo.lvglActionPropertyType?.startsWith("widget")
            ) {
                return assets.lvglBuild.getWidgetObjectIndexByName(this, value);
            } else if (propertyInfo.lvglActionPropertyType == "group") {
                return assets.projectStore.project.lvglGroups.groups.findIndex(
                    group => group.name == value
                );
            } else if (propertyInfo.lvglActionPropertyType == "style") {
                const lvglStyle = findLvglStyle(
                    assets.projectStore.project,
                    value
                );

                if (lvglStyle) {
                    return assets.projectStore.lvglIdentifiers.styles.indexOf(
                        lvglStyle
                    );
                } else {
                    return -1;
                }
            } else if (propertyInfo.lvglActionPropertyType == "image") {
                return escapeCString(value ?? "");
            }
        }
        return value;
    }

    getBuildProperties(assets: Assets): IBuildProperties[] {
        const classInfo = getClassInfo(this);
        return classInfo.properties
            .filter(propertyInfo => propertyInfo.expressionType != undefined)
            .map(propertyInfo => ({
                name: propertyInfo.name,
                expression: this.getExpression(assets, propertyInfo),
                isAssignable: isFlowProperty(this, propertyInfo, [
                    "assignable"
                ]),
                isHidden: false,
                isBuildable: true
            }));
    }
}

////////////////////////////////////////////////////////////////////////////////

export class LVGLActionComponent extends ActionComponent {
    actions: LVGLActionType[];

    static classInfo = makeDerivedClassInfo(ActionComponent.classInfo, {
        flowComponentId: COMPONENT_TYPE_LVGL_ACTION_API,
        componentPaletteGroupName: "!2LVGL",
        componentPaletteLabel: "LVGL",
        enabledInComponentPalette: (projectType: ProjectType) =>
            projectType === ProjectType.LVGL,
        properties: [
            {
                name: "actions",
                type: PropertyType.Array,
                typeClass: LVGLActionType,
                propertyGridGroup: specificGroup,
                partOfNavigation: false,
                enumerable: false,
                defaultValue: []
            }
        ],
        beforeLoadHook: (object: LVGLActionComponent, objectJs: any) => {
            if (objectJs.action != undefined) {
                if (objectJs.action == "CHANGE_SCREEN") {
                    let action: any = {
                        action: objectJs.action
                    };

                    action.screen =
                        objectJs.changeScreenTarget ?? objectJs.screen;
                    action.fadeMode =
                        objectJs.changeScreenFadeMode ?? objectJs.fadeMode;
                    action.speed = objectJs.changeScreenSpeed ?? objectJs.speed;
                    action.delay = objectJs.changeScreenDelay ?? objectJs.delay;

                    objectJs.actions = [action];
                } else if (objectJs.action == "PLAY_ANIMATION") {
                    objectJs.actions = objectJs.animItems.map((item: any) => {
                        let action: any = {
                            action: objectJs.action
                        };

                        action.target = objectJs.animTarget;
                        action.property = item.property;
                        action.start = item.start;
                        action.end = item.end;
                        action.delay = objectJs.animDelay + item.delay;
                        action.time = item.time;
                        action.relative = item.relative;
                        action.instant = item.instant;
                        action.path = item.path;

                        return action;
                    });
                } else if (objectJs.action == "SET_PROPERTY") {
                    let action: any = {
                        action: objectJs.action
                    };

                    action.targetType = objectJs.setPropTargetType;
                    action.target = objectJs.setPropTarget;
                    action.property = objectJs.setPropProperty;
                    action.value = objectJs.setPropValue;
                    action.valueType = objectJs.setPropValueType;
                    action.animated = objectJs.setPropAnim;

                    objectJs.actions = [action];
                }

                delete objectJs.screen;
                delete objectJs.changeScreenTarget;
                delete objectJs.fadeMode;
                delete objectJs.changeScreenFadeMode;
                delete objectJs.speed;
                delete objectJs.changeScreenSpeed;
                delete objectJs.delay;
                delete objectJs.changeScreenDelay;

                delete objectJs.animTarget;
                delete objectJs.animDelay;
                delete objectJs.animItems;

                delete objectJs.setPropTargetType;
                delete objectJs.setPropTarget;
                delete objectJs.setPropProperty;
                delete objectJs.setPropAnim;
                delete objectJs.setPropValue;
                delete objectJs.setPropValueType;
            }

            for (const actionJs of objectJs.actions) {
                switch (actionJs.action) {
                    case "CHANGE_SCREEN":
                        if (actionJs.showPreviousScreen == true) {
                            actionJs.action = "changeToPreviousScreen";
                        } else {
                            actionJs.action = "changeScreen";
                            actionJs.screenType = "literal";
                        }
                        actionJs.fadeModeType = "literal";
                        actionJs.speedType = "literal";
                        actionJs.delayType = "literal";
                        break;
                    case "PLAY_ANIMATION":
                        switch (actionJs.property) {
                            case "POSITION_X":
                                actionJs.action = "animX";
                                break;
                            case "POSITION_Y":
                                actionJs.action = "animY";
                                break;
                            case "WIDTH":
                                actionJs.action = "animWidth";
                                break;
                            case "HEIGHT":
                                actionJs.action = "animHeight";
                                break;
                            case "OPACITY":
                                actionJs.action = "animOpacity";
                                break;
                            case "IMAGE_ZOOM":
                                actionJs.action = "animImageZoom";
                                break;
                            case "IMAGE_ANGLE":
                                actionJs.action = "animImageAngle";
                                break;
                        }
                        delete actionJs.property;

                        actionJs.object = actionJs.target;
                        delete actionJs.target;
                        actionJs.objectType = "literal";

                        actionJs.startType = "literal";
                        actionJs.endType = "literal";
                        actionJs.delayType = "literal";
                        actionJs.timeType = "literal";
                        actionJs.relative = actionJs.relative ?? false;
                        actionJs.relativeType = "literal";
                        actionJs.instant = actionJs.instant ?? false;
                        actionJs.instantType = "literal";
                        if (!actionJs.path) {
                            actionJs.path = "LINEAR";
                        }
                        actionJs.pathType = "literal";
                        break;
                    case "SET_PROPERTY":
                        switch (actionJs.targetType) {
                            case "arc":
                                actionJs.action = "arcSetValue";
                                break;
                            case "bar":
                                actionJs.action = "barSetValue";
                                actionJs.animatedType = "literal";
                                break;
                            case "basic":
                                switch (actionJs.property) {
                                    case "x":
                                        actionJs.action = "objSetX";
                                        actionJs.x = actionJs.value;
                                        delete actionJs.value;
                                        actionJs.xType = actionJs.valueType;
                                        delete actionJs.valueType;
                                        break;
                                    case "y":
                                        actionJs.action = "objSetY";
                                        actionJs.y = actionJs.value;
                                        delete actionJs.value;
                                        actionJs.yType = actionJs.valueType;
                                        delete actionJs.valueType;
                                        break;
                                    case "width":
                                        actionJs.action = "objSetWidth";
                                        actionJs.width = actionJs.value;
                                        delete actionJs.value;
                                        actionJs.widthType = actionJs.valueType;
                                        delete actionJs.valueType;
                                        break;
                                    case "height":
                                        actionJs.action = "objSetHeight";
                                        actionJs.height = actionJs.value;
                                        delete actionJs.value;
                                        actionJs.heightType =
                                            actionJs.valueType;
                                        delete actionJs.valueType;
                                        break;
                                    case "opacity":
                                        actionJs.action = "objSetStyleOpa";
                                        actionJs.opacity = actionJs.value;
                                        delete actionJs.value;
                                        actionJs.opacityType =
                                            actionJs.valueType;
                                        delete actionJs.valueType;
                                        break;
                                    case "hidden":
                                        actionJs.action = "objSetFlagHidden";
                                        actionJs.hidden =
                                            actionJs.value ?? false;
                                        delete actionJs.value;
                                        actionJs.hiddenType =
                                            actionJs.valueType;
                                        delete actionJs.valueType;
                                        break;
                                    case "checked":
                                        actionJs.action = "objSetStateChecked";
                                        actionJs.checked =
                                            actionJs.value ?? false;
                                        delete actionJs.value;
                                        actionJs.checkedType =
                                            actionJs.valueType;
                                        delete actionJs.valueType;
                                        break;
                                    case "disabled":
                                        actionJs.action = "objSetStateDisabled";
                                        actionJs.disabled =
                                            actionJs.value ?? false;
                                        delete actionJs.value;
                                        actionJs.disabledType =
                                            actionJs.valueType;
                                        delete actionJs.valueType;
                                        break;
                                }
                                break;
                            case "dropdown":
                                actionJs.action = "dropdownSetSelected";
                                actionJs.selected = actionJs.value;
                                delete actionJs.value;
                                actionJs.selectedType = actionJs.valueType;
                                delete actionJs.valueType;
                                break;
                            case "image":
                                switch (actionJs.property) {
                                    case "image":
                                        actionJs.action = "imageSetSrc";
                                        actionJs.src = actionJs.value;
                                        delete actionJs.value;
                                        actionJs.srcType = actionJs.valueType;
                                        delete actionJs.valueType;
                                        break;
                                    case "angle":
                                        actionJs.action = "imageSetAngle";
                                        actionJs.angle = actionJs.value;
                                        delete actionJs.value;
                                        actionJs.angleType = actionJs.valueType;
                                        delete actionJs.valueType;
                                        break;
                                    case "zoom":
                                        actionJs.action = "imageSetZoom";
                                        actionJs.zoom = actionJs.value;
                                        delete actionJs.value;
                                        actionJs.zoomType = actionJs.valueType;
                                        delete actionJs.valueType;
                                        break;
                                }
                                break;
                            case "label":
                                actionJs.action = "labelSetText";
                                actionJs.text = actionJs.value;
                                delete actionJs.value;
                                actionJs.textType = actionJs.valueType;
                                delete actionJs.valueType;
                                break;
                            case "roller":
                                actionJs.action = "rollerSetSelected";

                                actionJs.selected = actionJs.value;
                                delete actionJs.value;
                                actionJs.selectedType = actionJs.valueType;
                                delete actionJs.valueType;

                                actionJs.animatedType = "literal";
                                break;
                            case "slider":
                                actionJs.action = "sliderSetValue";

                                actionJs.animatedType = "literal";
                                break;
                            case "keyboard":
                                actionJs.action = "keyboardSetTextarea";

                                actionJs.textarea = actionJs.textarea;
                                actionJs.textareaType = "literal";
                                break;
                        }
                        delete actionJs.targetType;
                        delete actionJs.property;

                        actionJs.object = actionJs.target;
                        delete actionJs.target;
                        actionJs.objectType = "literal";
                        break;
                    case "ADD_STYLE":
                        actionJs.action = "objAddStyle";
                        actionJs.object = actionJs.target;
                        delete actionJs.target;
                        actionJs.objectType = "literal";
                        actionJs.styleType = "literal";
                        break;
                    case "REMOVE_STYLE":
                        actionJs.action = "objRemoveStyle";
                        actionJs.object = actionJs.target;
                        delete actionJs.target;
                        actionJs.objectType = "literal";
                        actionJs.styleType = "literal";
                        break;
                    case "ADD_FLAG":
                        actionJs.action = "objAddFlag";
                        actionJs.object = actionJs.target;
                        delete actionJs.target;
                        actionJs.objectType = "literal";
                        actionJs.flagType = "literal";
                        break;
                    case "CLEAR_FLAG":
                        actionJs.action = "objClearFlag";
                        actionJs.object = actionJs.target;
                        delete actionJs.target;
                        actionJs.objectType = "literal";
                        actionJs.flagType = "literal";
                        break;
                    case "ADD_STATE":
                        actionJs.action = "objAddState";
                        actionJs.object = actionJs.target;
                        delete actionJs.target;
                        actionJs.objectType = "literal";
                        actionJs.stateType = "literal";
                        break;
                    case "CLEAR_STATE":
                        actionJs.action = "objClearState";
                        actionJs.object = actionJs.target;
                        delete actionJs.target;
                        actionJs.objectType = "literal";
                        actionJs.stateType = "literal";
                        break;
                    case "GROUP":
                        switch (actionJs.groupAction) {
                            case "SET_WRAP":
                                actionJs.action = "groupSetWrap";

                                actionJs.group = actionJs.target;
                                delete actionJs.target;
                                actionJs.groupType = "literal";

                                actionJs.enabled = actionJs.enable ?? false;
                                delete actionJs.enable;
                                actionJs.enabledType = "literal";
                                break;
                            case "FOCUS_OBJ":
                                actionJs.action = "groupFocusObj";
                                actionJs.object = actionJs.target;
                                delete actionJs.target;
                                actionJs.objectType = "literal";
                                break;
                            case "FOCUS_NEXT":
                                actionJs.action = "groupFocusNext";
                                actionJs.group = actionJs.target;
                                delete actionJs.target;
                                actionJs.groupType = "literal";
                                break;
                            case "FOCUS_PREVIOUS":
                                actionJs.action = "groupFocusPrev";
                                actionJs.group = actionJs.target;
                                delete actionJs.target;
                                actionJs.groupType = "literal";
                                break;
                            case "FOCUS_FREEZE":
                                actionJs.action = "groupFocusFreeze";

                                actionJs.group = actionJs.target;
                                delete actionJs.target;
                                actionJs.groupType = "literal";

                                actionJs.enabled = actionJs.enable ?? false;
                                delete actionJs.enable;
                                actionJs.enabledType = "literal";
                                break;
                            case "SET_EDITING":
                                actionJs.action = "groupSetEditing";

                                actionJs.group = actionJs.target;
                                delete actionJs.target;
                                actionJs.groupType = "literal";

                                actionJs.enabled = actionJs.enable ?? false;
                                delete actionJs.enable;
                                actionJs.enabledType = "literal";
                                break;
                        }
                        delete actionJs.groupAction;
                        break;
                }
            }

            for (const actionJs of objectJs.actions) {
                if (
                    actionJs.action == "changeScreen" &&
                    actionJs.useStack === undefined
                ) {
                    actionJs.useStack = true;
                    actionJs.useStackType = "literal";
                }
            }
        },
        icon: (
            <img src="data:image/png;base64,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" />
        ),
        componentHeaderColor: "#FBDEDE",
        defaultValue: {
            actions: []
        }
    });

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            actions: observable
        });
    }

    getInputs() {
        return [
            {
                name: "@seqin",
                type: "any" as ValueType,
                isSequenceInput: true,
                isOptionalInput: true
            },
            ...super.getInputs()
        ];
    }

    getOutputs() {
        return [
            {
                name: "@seqout",
                type: "null" as ValueType,
                isSequenceOutput: true,
                isOptionalOutput: true
            },
            ...super.getOutputs()
        ];
    }

    getBody(flowContext: IFlowContext): React.ReactNode {
        return (
            <div className="body">
                {this.actions.map((action, i) => (
                    <pre key={getId(action)}>
                        {this.actions.length > 1 ? `#${i + 1} ` : ""}
                        {getListLabel(action, true)}
                    </pre>
                ))}
            </div>
        );
    }

    buildFlowComponentSpecific(assets: Assets, dataBuffer: DataBuffer) {
        dataBuffer.writeArray(this.actions, action => {
            // action
            dataBuffer.writeUint32(actionNameToActionId.get(action.action)!);

            // properties
            const buildProperties = action.getBuildProperties(assets);
            //console.log(buildProperties);
            dataBuffer.writeArray(buildProperties, buildProperty => {
                if (!buildProperty.isHidden) {
                    try {
                        if (buildProperty.isBuildable) {
                            let expression = buildProperty.expression;

                            if (buildProperty.isAssignable) {
                                buildAssignableExpression(
                                    assets,
                                    dataBuffer,
                                    this,
                                    expression
                                );
                            } else {
                                buildExpression(
                                    assets,
                                    dataBuffer,
                                    this,
                                    expression
                                );
                            }
                        } else {
                            dataBuffer.writeUint16NonAligned(
                                makeEndInstruction()
                            );
                        }
                    } catch (err) {
                        assets.projectStore.outputSectionsStore.write(
                            Section.OUTPUT,
                            MessageType.ERROR,
                            err.toString(),
                            getChildOfObject(action, buildProperty.name)
                        );

                        dataBuffer.writeUint16NonAligned(makeEndInstruction());
                    }
                } else {
                    dataBuffer.writeUint16NonAligned(makeEndInstruction());
                }
            });
        });
    }
}

registerClass("LVGLActionComponent", LVGLActionComponent);

////////////////////////////////////////////////////////////////////////////////

export function generateLVGLActionsMarkdown() {
    let result =
        "List of actions to be executed. The following actions are available:\n\n";

    for (const actionDefinition of actionDefinitions) {
        result += `- **${getActionDisplayName(actionDefinition)}**: ${
            actionDefinition.helpText
        }\n`;

        for (const actionProperty of actionDefinition.properties) {
            result += `  - *${
                actionProperty.isAssignable
                    ? `Store ${actionProperty.name} into`
                    : humanize(actionProperty.name)
            }*: ${actionProperty.helpText}\n`;
        }

        result += "\n";
    }

    result += "\n";

    return result;
}

////////////////////////////////////////////////////////////////////////////////

import "./actions-catalog";

/*

////////////////////////////////////////////////////////////////////////////////

const LVGL_ACTIONS = {
    CHANGE_SCREEN: 0,
    PLAY_ANIMATION: 1,
    SET_PROPERTY: 2,
    ADD_STYLE: 3,
    REMOVE_STYLE: 4,
    ADD_FLAG: 5,
    CLEAR_FLAG: 6,
    ADD_STATE: 8,
    CLEAR_STATE: 9,
    GROUP: 7
};

////////////////////////////////////////////////////////////////////////////////

export class LVGLActionType extends EezObject {
    action: keyof typeof LVGL_ACTIONS;

    static classInfo: ClassInfo = {
        getClass: function (projectStore: ProjectStore, jsObject: any) {
            if (jsObject.action == "CHANGE_SCREEN")
                return LVGLChangeScreenActionType;
            else if (jsObject.action == "PLAY_ANIMATION")
                return LVGLPlayAnimationActionType;
            else if (jsObject.action == "SET_PROPERTY")
                return LVGLSetPropertyActionType;
            else if (jsObject.action == "ADD_STYLE")
                return LVGLAddStyleActionType;
            else if (jsObject.action == "REMOVE_STYLE")
                return LVGLRemoveStyleActionType;
            else if (jsObject.action == "ADD_FLAG")
                return LVGLAddFlagActionType;
            else if (jsObject.action == "CLEAR_FLAG")
                return LVGLClearFlagActionType;
            else if (jsObject.action == "ADD_STATE")
                return LVGLAddStateActionType;
            else if (jsObject.action == "CLEAR_STATE")
                return LVGLClearStateActionType;
            else return LVGLGroupActionType;
        },

        properties: [
            {
                name: "action",
                displayName: (object: LVGLActionType) => {
                    const actions = getParent(object) as LVGLActionType[];
                    if (actions.length < 2) {
                        return "Action";
                    }
                    return `Action #${actions.indexOf(object) + 1}`;
                },
                type: PropertyType.Enum,
                enumItems: Object.keys(LVGL_ACTIONS).map(id => ({
                    id
                })),
                enumDisallowUndefined: true,
                hideInPropertyGrid: true
            }
        ],

        newItem: async (object: LVGLActionType[]) => {
            const project = ProjectEditor.getProject(object);

            const result = await showGenericDialog({
                dialogDefinition: {
                    title: "New LVGL Action",
                    fields: [
                        {
                            name: "action",
                            displayName: "Action type",
                            type: "enum",
                            enumItems: Object.keys(LVGL_ACTIONS).map(id => ({
                                id,
                                label: humanize(id)
                            }))
                        }
                    ]
                },
                values: {
                    action: "CHANGE_SCREEN"
                },
                dialogContext: project
            });

            const actionTypeProperties = {
                action: result.values.action
            };

            let actionTypeObject;

            if (result.values.action == "CHANGE_SCREEN") {
                actionTypeObject = createObject<LVGLChangeScreenActionType>(
                    project._store,
                    Object.assign(
                        actionTypeProperties,
                        LVGLChangeScreenActionType.classInfo.defaultValue
                    ),
                    LVGLChangeScreenActionType
                );
            } else if (result.values.action == "PLAY_ANIMATION") {
                actionTypeObject = createObject<LVGLPlayAnimationActionType>(
                    project._store,
                    Object.assign(
                        actionTypeProperties,
                        LVGLPlayAnimationActionType.classInfo.defaultValue
                    ),
                    LVGLPlayAnimationActionType
                );
            } else if (result.values.action == "SET_PROPERTY") {
                actionTypeObject = createObject<LVGLSetPropertyActionType>(
                    project._store,
                    Object.assign(
                        actionTypeProperties,
                        LVGLSetPropertyActionType.classInfo.defaultValue
                    ),
                    LVGLSetPropertyActionType
                );
            } else if (result.values.action == "ADD_STYLE") {
                actionTypeObject = createObject<LVGLAddStyleActionType>(
                    project._store,
                    Object.assign(
                        actionTypeProperties,
                        LVGLAddStyleActionType.classInfo.defaultValue
                    ),
                    LVGLAddStyleActionType
                );
            } else if (result.values.action == "REMOVE_STYLE") {
                actionTypeObject = createObject<LVGLRemoveStyleActionType>(
                    project._store,
                    Object.assign(
                        actionTypeProperties,
                        LVGLRemoveStyleActionType.classInfo.defaultValue
                    ),
                    LVGLRemoveStyleActionType
                );
            } else if (result.values.action == "ADD_FLAG") {
                actionTypeObject = createObject<LVGLAddFlagActionType>(
                    project._store,
                    Object.assign(
                        actionTypeProperties,
                        LVGLAddFlagActionType.classInfo.defaultValue
                    ),
                    LVGLAddFlagActionType
                );
            } else if (result.values.action == "CLEAR_FLAG") {
                actionTypeObject = createObject<LVGLClearFlagActionType>(
                    project._store,
                    Object.assign(
                        actionTypeProperties,
                        LVGLClearFlagActionType.classInfo.defaultValue
                    ),
                    LVGLClearFlagActionType
                );
            } else if (result.values.action == "ADD_STATE") {
                actionTypeObject = createObject<LVGLAddStateActionType>(
                    project._store,
                    Object.assign(
                        actionTypeProperties,
                        LVGLAddStateActionType.classInfo.defaultValue
                    ),
                    LVGLAddStateActionType
                );
            } else if (result.values.action == "CLEAR_STATE") {
                actionTypeObject = createObject<LVGLClearStateActionType>(
                    project._store,
                    Object.assign(
                        actionTypeProperties,
                        LVGLClearStateActionType.classInfo.defaultValue
                    ),
                    LVGLClearStateActionType
                );
            } else if (result.values.action == "GROUP") {
                actionTypeObject = createObject<LVGLGroupActionType>(
                    project._store,
                    Object.assign(
                        actionTypeProperties,
                        LVGLGroupActionType.classInfo.defaultValue
                    ),
                    LVGLGroupActionType
                );
            }

            return actionTypeObject;
        }
    };

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            action: observable
        });
    }

    build(assets: Assets, dataBuffer: DataBuffer) {}
}

////////////////////////////////////////////////////////////////////////////////

const FADE_MODES = {
    NONE: 0,
    OVER_LEFT: 1,
    OVER_RIGHT: 2,
    OVER_TOP: 3,
    OVER_BOTTOM: 4,
    MOVE_LEFT: 5,
    MOVE_RIGHT: 6,
    MOVE_TOP: 7,
    MOVE_BOTTOM: 8,
    FADE_IN: 9,
    FADE_OUT: 10,
    OUT_LEFT: 11,
    OUT_RIGHT: 12,
    OUT_TOP: 13,
    OUT_BOTTOM: 14
};

export class LVGLChangeScreenActionType extends LVGLActionType {
    showPreviousScreen: boolean;
    screen: string;
    fadeMode: keyof typeof FADE_MODES;
    speed: number;
    delay: number;

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            showPreviousScreen: observable,
            screen: observable,
            fadeMode: observable,
            speed: observable,
            delay: observable
        });
    }

    static classInfo = makeDerivedClassInfo(LVGLActionType.classInfo, {
        properties: [
            {
                name: "showPreviousScreen",
                displayName: "Previous screen",
                type: PropertyType.Boolean,
                checkboxStyleSwitch: true
            },
            {
                name: "screen",
                type: PropertyType.ObjectReference,
                referencedObjectCollectionPath: "userPages",
                disabled: (action: LVGLChangeScreenActionType) =>
                    action.showPreviousScreen
            },
            {
                name: "fadeMode",
                type: PropertyType.Enum,
                enumItems: Object.keys(FADE_MODES).map(id => ({
                    id
                })),
                enumDisallowUndefined: true
            },
            {
                name: "speed",
                displayName: "Speed (ms)",
                type: PropertyType.Number
            },
            {
                name: "delay",
                displayName: "Delay (ms)",
                type: PropertyType.Number
            }
        ],
        defaultValue: {
            fadeMode: "FADE_IN",
            showPreviousScreen: false,
            speed: 200,
            delay: 0
        },
        listLabel: (action: LVGLChangeScreenActionType, collapsed: boolean) => {
            if (!collapsed) {
                return "Change screen";
            }
            let singleItem =
                (getParent(action) as LVGLActionType[]).length == 1;
            return `${singleItem ? "" : "Change screen: "}${
                action.showPreviousScreen
                    ? "Previous Screen"
                    : `Screen=${action.screen}`
            }, Speed=${action.speed} ms, Delay=${action.delay} ms`;
        },
        check: (object: LVGLChangeScreenActionType, messages: IMessage[]) => {
            if (!object.showPreviousScreen) {
                if (!object.screen) {
                    messages.push(propertyNotSetMessage(object, "screen"));
                } else {
                    let page = findPage(getProject(object), object.screen);
                    if (!page) {
                        messages.push(
                            propertyNotFoundMessage(object, "screen")
                        );
                    }
                }
            }
        }
    });

    override build(assets: Assets, dataBuffer: DataBuffer) {
        // screen
        let screen: number;
        if (this.showPreviousScreen) {
            screen = -1;
        } else {
            if (this.screen) {
                screen = assets.getPageIndex(this, "screen");
            } else {
                screen = 0;
            }
        }
        dataBuffer.writeInt32(screen);

        // fadeMode
        dataBuffer.writeUint32(FADE_MODES[this.fadeMode]);

        // speed
        dataBuffer.writeUint32(this.speed);

        // delay
        dataBuffer.writeUint32(this.delay);
    }
}

registerClass("LVGLChangeScreenActionType", LVGLChangeScreenActionType);

////////////////////////////////////////////////////////////////////////////////

const ANIM_PROPERTIES = {
    POSITION_X: 0,
    POSITION_Y: 1,
    WIDTH: 2,
    HEIGHT: 3,
    OPACITY: 4,
    IMAGE_ZOOM: 5,
    IMAGE_ANGLE: 6
};

const ANIM_PATHS = {
    LINEAR: 0,
    EASE_IN: 1,
    EASE_OUT: 2,
    EASE_IN_OUT: 3,
    OVERSHOOT: 4,
    BOUNCE: 5
};

export class LVGLPlayAnimationActionType extends LVGLActionType {
    target: string;
    property: keyof typeof ANIM_PROPERTIES;
    start: number;
    end: number;
    delay: number;
    time: number;
    relative: boolean;
    instant: boolean;
    path: keyof typeof ANIM_PATHS;

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            target: observable,
            property: observable,
            start: observable,
            end: observable,
            delay: observable,
            time: observable,
            relative: observable,
            instant: observable,
            path: observable
        });
    }

    static classInfo = makeDerivedClassInfo(LVGLActionType.classInfo, {
        properties: [
            {
                name: "target",
                type: PropertyType.Enum,
                enumItems: (component: LVGLActionComponent) => {
                    return ProjectEditor.getProjectStore(component)
                        .lvglIdentifiers.getIdentifiersVisibleFromFlow(
                            ProjectEditor.getFlow(component)
                        )
                        .map(lvglIdentifier => ({
                            id: lvglIdentifier.identifier,
                            label: lvglIdentifier.displayName
                        }));
                }
            },
            {
                name: "property",
                type: PropertyType.Enum,
                enumItems: Object.keys(ANIM_PROPERTIES).map(id => ({ id })),
                enumDisallowUndefined: true
            },
            {
                name: "start",
                type: PropertyType.Number
            },
            {
                name: "end",
                type: PropertyType.Number
            },
            {
                name: "delay",
                displayName: "Delay (ms)",
                type: PropertyType.Number
            },
            {
                name: "time",
                displayName: "Time (ms)",
                type: PropertyType.Number
            },
            {
                name: "relative",
                type: PropertyType.Boolean,
                checkboxStyleSwitch: true
            },
            {
                name: "instant",
                type: PropertyType.Boolean,
                checkboxStyleSwitch: true
            },
            {
                name: "path",
                type: PropertyType.Enum,
                enumItems: Object.keys(ANIM_PATHS).map(id => ({ id })),
                enumDisallowUndefined: true
            }
        ],
        defaultValue: {
            property: "POSITION_X",
            start: 0,
            end: 100,
            delay: 0,
            time: 1000,
            relative: true,
            instant: false,
            path: ""
        },
        listLabel: (
            action: LVGLPlayAnimationActionType,
            collapsed: boolean
        ) => {
            if (!collapsed) {
                return "Play animation";
            }
            let singleItem =
                (getParent(action) as LVGLActionType[]).length == 1;
            return `${singleItem ? "" : "Play animation: "}Target=${
                action.target
            }, Property=${action.property}, Start=${action.start}, End=${
                action.end
            }, Delay=${action.delay} ms, Time=${action.time} ms, Relative=${
                action.relative ? "On" : "Off"
            }, Instant=${action.instant ? "On" : "Off"} ${action.path}`;
        },
        check: (object: LVGLPlayAnimationActionType, messages: IMessage[]) => {
            if (!object.target) {
                messages.push(propertyNotSetMessage(object, "target"));
            } else {
                if (
                    ProjectEditor.getProjectStore(
                        object
                    ).lvglIdentifiers.getIdentifierByName(
                        ProjectEditor.getFlow(object),
                        object.target
                    ) == undefined
                ) {
                    messages.push(propertyNotFoundMessage(object, "target"));
                }
            }
        }
    });

    override build(assets: Assets, dataBuffer: DataBuffer) {
        // target
        dataBuffer.writeInt32(
            assets.projectStore.lvglIdentifiers.getIdentifierByName(
                ProjectEditor.getFlow(this),
                this.target
            )?.index ?? -1
        );

        // property
        dataBuffer.writeUint32(ANIM_PROPERTIES[this.property]);

        // start
        dataBuffer.writeInt32(this.start);

        // end
        dataBuffer.writeInt32(this.end);

        // delay
        dataBuffer.writeUint32(this.delay);

        // time
        dataBuffer.writeUint32(this.time);

        // flags
        const ANIMATION_ITEM_FLAG_RELATIVE = 1 << 0;
        const ANIMATION_ITEM_FLAG_INSTANT = 1 << 1;
        dataBuffer.writeUint32(
            (this.relative ? ANIMATION_ITEM_FLAG_RELATIVE : 0) |
                (this.instant ? ANIMATION_ITEM_FLAG_INSTANT : 0)
        );

        // path
        dataBuffer.writeUint32(ANIM_PATHS[this.path]);
    }
}

registerClass("LVGLPlayAnimationActionType", LVGLPlayAnimationActionType);

////////////////////////////////////////////////////////////////////////////////

const enum PropertyCode {
    NONE,

    ARC_VALUE,

    BAR_VALUE,

    BASIC_X,
    BASIC_Y,
    BASIC_WIDTH,
    BASIC_HEIGHT,
    BASIC_OPACITY,
    BASIC_HIDDEN,
    BASIC_CHECKED,
    BASIC_DISABLED,

    DROPDOWN_SELECTED,

    IMAGE_IMAGE,
    IMAGE_ANGLE,
    IMAGE_ZOOM,

    LABEL_TEXT,

    ROLLER_SELECTED,

    SLIDER_VALUE,

    KEYBOARD_TEXTAREA
}

type PropertiesType = {
    [targetType: string]: {
        [propName: string]: {
            code: PropertyCode;
            type: "number" | "string" | "boolean" | "image" | "textarea";
            animated: boolean;
        };
    };
};

const PROPERTIES = {
    arc: {
        value: {
            code: PropertyCode.ARC_VALUE,
            type: "number" as const,
            animated: false
        }
    },
    bar: {
        value: {
            code: PropertyCode.BAR_VALUE,
            type: "number" as const,
            animated: true
        }
    },
    basic: {
        x: {
            code: PropertyCode.BASIC_X,
            type: "number" as const,
            animated: false
        },
        y: {
            code: PropertyCode.BASIC_Y,
            type: "number" as const,
            animated: false
        },
        width: {
            code: PropertyCode.BASIC_WIDTH,
            type: "number" as const,
            animated: false
        },
        height: {
            code: PropertyCode.BASIC_HEIGHT,
            type: "number" as const,
            animated: false
        },
        opacity: {
            code: PropertyCode.BASIC_OPACITY,
            type: "number" as const,
            animated: false
        },
        hidden: {
            code: PropertyCode.BASIC_HIDDEN,
            type: "boolean" as const,
            animated: false
        },
        checked: {
            code: PropertyCode.BASIC_CHECKED,
            type: "boolean" as const,
            animated: false
        },
        disabled: {
            code: PropertyCode.BASIC_DISABLED,
            type: "boolean" as const,
            animated: false
        }
    },
    dropdown: {
        selected: {
            code: PropertyCode.DROPDOWN_SELECTED,
            type: "number" as const,
            animated: false
        }
    },
    image: {
        image: {
            code: PropertyCode.IMAGE_IMAGE,
            type: "image" as const,
            animated: false
        },
        angle: {
            code: PropertyCode.IMAGE_ANGLE,
            type: "number" as const,
            animated: false
        },
        zoom: {
            code: PropertyCode.IMAGE_ZOOM,
            type: "number" as const,
            animated: false
        }
    },
    label: {
        text: {
            code: PropertyCode.LABEL_TEXT,
            type: "string" as const,
            animated: false
        }
    },
    roller: {
        selected: {
            code: PropertyCode.ROLLER_SELECTED,
            type: "number" as const,
            animated: true
        }
    },
    slider: {
        value: {
            code: PropertyCode.SLIDER_VALUE,
            type: "number" as const,
            animated: true
        }
    },
    keyboard: {
        textarea: {
            code: PropertyCode.KEYBOARD_TEXTAREA,
            type: "textarea" as const,
            animated: false
        }
    }
};

function filterSetPropertyTarget(
    actionType: LVGLSetPropertyActionType,
    object: Page | LVGLWidget
) {
    if (actionType.targetType == "arc") {
        return object instanceof LVGLArcWidget;
    } else if (actionType.targetType == "bar") {
        return object instanceof LVGLBarWidget;
    } else if (actionType.targetType == "basic") {
        return true;
    } else if (actionType.targetType == "dropdown") {
        return object instanceof LVGLDropdownWidget;
    } else if (actionType.targetType == "image") {
        return object instanceof LVGLImageWidget;
    } else if (actionType.targetType == "label") {
        return object instanceof LVGLLabelWidget;
    } else if (actionType.targetType == "roller") {
        return object instanceof LVGLRollerWidget;
    } else if (actionType.targetType == "slider") {
        return object instanceof LVGLSliderWidget;
    } else if (actionType.targetType == "keyboard") {
        return object instanceof LVGLKeyboardWidget;
    } else {
        return false;
    }
}

export class LVGLSetPropertyActionType extends LVGLActionType {
    targetType: keyof typeof PROPERTIES;
    target: string;
    property: string;
    animated: boolean;
    value: number | string | boolean;
    valueType: LVGLPropertyType;
    textarea: string;

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            targetType: observable,
            target: observable,
            property: observable,
            animated: observable,
            value: observable,
            valueType: observable,
            textarea: observable
        });
    }

    static classInfo = makeDerivedClassInfo(LVGLActionType.classInfo, {
        properties: [
            {
                name: "targetType",
                type: PropertyType.Enum,
                enumItems: Object.keys(PROPERTIES).map(id => ({
                    id
                })),
                enumDisallowUndefined: true
            },
            {
                name: "target",
                displayName: "Target",
                type: PropertyType.Enum,
                enumItems: (actionType: LVGLSetPropertyActionType) => {
                    const lvglIdentifiers = ProjectEditor.getProjectStore(
                        actionType
                    ).lvglIdentifiers.getIdentifiersVisibleFromFlow(
                        ProjectEditor.getFlow(actionType)
                    );

                    return lvglIdentifiers
                        .filter(lvglIdentifier =>
                            filterSetPropertyTarget(
                                actionType,
                                lvglIdentifier.object
                            )
                        )
                        .map(lvglIdentifier => ({
                            id: lvglIdentifier.identifier,
                            label: lvglIdentifier.identifier
                        }));
                }
            },
            {
                name: "property",
                type: PropertyType.Enum,
                enumItems: (actionType: LVGLSetPropertyActionType) => {
                    return Object.keys(PROPERTIES[actionType.targetType]).map(
                        id => ({
                            id
                        })
                    );
                },
                enumDisallowUndefined: true
            },
            ...makeLvglExpressionProperty(
                "value",
                "any",
                "input",
                ["literal", "expression"],
                {
                    dynamicType: (actionType: LVGLSetPropertyActionType) => {
                        const type = actionType.propertyInfo.type;
                        return type == "image"
                            ? PropertyType.ObjectReference
                            : type == "number"
                            ? PropertyType.Number
                            : type == "boolean"
                            ? PropertyType.Boolean
                            : PropertyType.MultilineText;
                    },
                    checkboxStyleSwitch: true,
                    dynamicTypeReferencedObjectCollectionPath: (
                        actionType: LVGLSetPropertyActionType
                    ) => {
                        const type = actionType.propertyInfo.type;
                        return type == "image" ? "bitmaps" : undefined;
                    },
                    displayName: (actionType: LVGLSetPropertyActionType) => {
                        if (actionType.propertyInfo.type == "image") {
                            return "Image";
                        }
                        return "Value";
                    },
                    disabled: (actionType: LVGLSetPropertyActionType) =>
                        actionType.propertyInfo.type == "textarea"
                }
            ),
            {
                name: "textarea",
                type: PropertyType.Enum,
                enumItems: (actionType: LVGLSetPropertyActionType) => {
                    const page = getAncestorOfType(
                        actionType,
                        ProjectEditor.PageClass.classInfo
                    ) as Page;
                    return page._lvglWidgets
                        .filter(
                            lvglWidget =>
                                lvglWidget instanceof LVGLTextareaWidget &&
                                lvglWidget.identifier
                        )
                        .map(lvglWidget => ({
                            id: lvglWidget.identifier,
                            label: lvglWidget.identifier
                        }));
                },
                disabled: (actionType: LVGLSetPropertyActionType) =>
                    actionType.propertyInfo.type != "textarea"
            },
            {
                name: "animated",
                type: PropertyType.Boolean,
                checkboxStyleSwitch: true,
                disabled: (actionType: LVGLSetPropertyActionType) =>
                    !actionType.propertyInfo.animated
            }
        ],
        defaultValue: {
            targetType: "bar",
            property: "value",
            animated: false,
            valueType: "literal"
        },
        listLabel: (action: LVGLSetPropertyActionType, collapsed: boolean) => {
            if (!collapsed) {
                return "Set property";
            }
            let singleItem =
                (getParent(action) as LVGLActionType[]).length == 1;
            return (
                <>
                    {`${singleItem ? "" : "Set property: "}${action.target}.${
                        action.propertyInfo.code != PropertyCode.NONE
                            ? humanize(action.property)
                            : "<not set>"
                    }`}
                    <LeftArrow />
                    {action.propertyInfo.type != "textarea"
                        ? action.valueExpr
                        : action.textarea
                        ? action.textarea
                        : "<null>"}
                    {action.propertyInfo.animated
                        ? `, Animated=${action.animated ? "On" : "Off"}`
                        : ""}
                </>
            );
        },
        updateObjectValueHook: (
            actionType: LVGLSetPropertyActionType,
            values: Partial<LVGLSetPropertyActionType>
        ) => {
            if (values.targetType != undefined) {
                if (
                    (PROPERTIES as PropertiesType)[values.targetType][
                        actionType.property
                    ] == undefined
                ) {
                    ProjectEditor.getProjectStore(actionType).updateObject(
                        actionType,
                        {
                            property: Object.keys(
                                (PROPERTIES as PropertiesType)[
                                    values.targetType
                                ]
                            )[0]
                        }
                    );
                }
            }
        },
        check: (object: LVGLSetPropertyActionType, messages: IMessage[]) => {
            if (!object.target) {
                messages.push(propertyNotSetMessage(object, "target"));
            } else {
                const lvglIdentifier = ProjectEditor.getProjectStore(
                    object
                ).lvglIdentifiers.getIdentifierByName(
                    ProjectEditor.getFlow(object),
                    object.target
                );

                if (lvglIdentifier == undefined) {
                    messages.push(propertyNotFoundMessage(object, "target"));
                } else {
                    if (
                        !filterSetPropertyTarget(object, lvglIdentifier.object)
                    ) {
                        messages.push(
                            new Message(
                                MessageType.ERROR,
                                `Invalid target type`,
                                getChildOfObject(object, "target")
                            )
                        );
                    }
                }
            }

            if (object.propertyInfo.code == PropertyCode.NONE) {
                messages.push(propertyNotSetMessage(object, "property"));
            }

            if (object.valueType == "literal") {
                if (object.propertyInfo.type == "image") {
                    if (object.value) {
                        const bitmap = findBitmap(
                            ProjectEditor.getProject(object),
                            object.value
                        );

                        if (!bitmap) {
                            messages.push(
                                propertyNotFoundMessage(object, "value")
                            );
                        }
                    } else {
                        messages.push(propertyNotSetMessage(object, "value"));
                    }
                }
            }

            if (object.propertyInfo.type == "textarea") {
                if (object.textarea) {
                    const lvglIdentifier = ProjectEditor.getProjectStore(
                        object
                    ).lvglIdentifiers.getIdentifierByName(
                        ProjectEditor.getFlow(object),
                        object.textarea
                    );

                    if (lvglIdentifier == undefined) {
                        messages.push(
                            propertyNotFoundMessage(object, "textarea")
                        );
                    } else {
                        if (
                            !(
                                lvglIdentifier.object instanceof
                                LVGLTextareaWidget
                            )
                        ) {
                            messages.push(
                                new Message(
                                    MessageType.ERROR,
                                    `Not a textarea widget`,
                                    getChildOfObject(object, "textarea")
                                )
                            );
                        }
                    }
                }
            }
        }
    });

    get propertyInfo() {
        return (
            (PROPERTIES as PropertiesType)[this.targetType][this.property] ?? {
                code: PropertyCode.NONE,
                type: "integer",
                animated: false
            }
        );
    }

    get valueExpr() {
        if (typeof this.value == "number") {
            return this.value.toString();
        }

        if (typeof this.value == "boolean") {
            return this.value ? "true" : "false";
        }

        if (this.valueType == "literal") {
            if (this.propertyInfo.type == "boolean") {
                return this.value ? "true" : "false";
            }
        }

        if (this.valueType == "expression") {
            return this.value as string;
        }

        return escapeCString(this.value ?? "");
    }

    override build(assets: Assets, dataBuffer: DataBuffer) {
        // target
        dataBuffer.writeInt32(
            ProjectEditor.getProjectStore(
                this
            ).lvglIdentifiers.getIdentifierByName(
                ProjectEditor.getFlow(this),
                this.target
            )?.index ?? -1
        );

        // property
        dataBuffer.writeUint32(this.propertyInfo.code);

        // value
        dataBuffer.writeObjectOffset(() =>
            buildExpression(
                assets,
                dataBuffer,
                getAncestorOfType(
                    this,
                    LVGLActionComponent.classInfo
                ) as LVGLActionComponent,
                this.valueExpr
            )
        );

        // textarea
        if (this.textarea) {
            dataBuffer.writeInt32(
                ProjectEditor.getProjectStore(
                    this
                ).lvglIdentifiers.getIdentifierByName(
                    ProjectEditor.getFlow(this),
                    this.textarea
                )?.index ?? -1
            );
        } else {
            dataBuffer.writeInt32(-1);
        }

        // animated
        dataBuffer.writeUint32(this.animated ? 1 : 0);
    }
}

registerClass("LVGLSetPropertyActionType", LVGLSetPropertyActionType);

////////////////////////////////////////////////////////////////////////////////

export class LVGLAddStyleActionType extends LVGLActionType {
    target: string;
    style: string;

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            target: observable,
            style: observable
        });
    }

    static classInfo = makeDerivedClassInfo(LVGLActionType.classInfo, {
        properties: [
            {
                name: "target",
                displayName: "Target",
                type: PropertyType.Enum,
                enumItems: (actionType: LVGLAddStyleActionType) => {
                    const lvglIdentifiers = ProjectEditor.getProjectStore(
                        actionType
                    ).lvglIdentifiers.getIdentifiersVisibleFromFlow(
                        ProjectEditor.getFlow(actionType)
                    );

                    return lvglIdentifiers.map(lvglIdentifier => ({
                        id: lvglIdentifier.identifier,
                        label: lvglIdentifier.identifier
                    }));
                }
            },
            {
                name: "style",
                type: PropertyType.ObjectReference,
                referencedObjectCollectionPath: "allLvglStyles"
            }
        ],
        defaultValue: {},
        listLabel: (action: LVGLAddStyleActionType, collapsed: boolean) => {
            if (!collapsed) {
                return "Add style";
            }
            let singleItem =
                (getParent(action) as LVGLActionType[]).length == 1;
            if (singleItem) {
                return (
                    <>
                        {action.style} to {action.target}
                    </>
                );
            } else {
                return (
                    <>
                        Add style {action.style} to {action.target}
                    </>
                );
            }
        },
        check: (object: LVGLAddStyleActionType, messages: IMessage[]) => {
            const projectStore = ProjectEditor.getProjectStore(object);

            if (object.target) {
                const lvglIdentifier =
                    projectStore.lvglIdentifiers.getIdentifierByName(
                        ProjectEditor.getFlow(object),
                        object.target
                    );

                if (lvglIdentifier == undefined) {
                    messages.push(propertyNotFoundMessage(object, "target"));
                }
            } else {
                messages.push(propertyNotSetMessage(object, "target"));
            }

            if (object.style) {
                const lvglStyle = findLvglStyle(
                    projectStore.project,
                    object.style
                );

                if (!lvglStyle) {
                    messages.push(propertyNotFoundMessage(object, "style"));
                }
            } else {
                messages.push(propertyNotSetMessage(object, "style"));
            }
        }
    });

    override build(assets: Assets, dataBuffer: DataBuffer) {
        // target
        dataBuffer.writeInt32(
            ProjectEditor.getProjectStore(
                this
            ).lvglIdentifiers.getIdentifierByName(
                ProjectEditor.getFlow(this),
                this.target
            )?.index ?? -1
        );

        // style
        if (this.style) {
            const lvglStyle = findLvglStyle(
                assets.projectStore.project,
                this.style
            );

            if (lvglStyle) {
                dataBuffer.writeInt32(
                    assets.projectStore.lvglIdentifiers.styles.indexOf(
                        lvglStyle
                    )
                );
            } else {
                dataBuffer.writeInt32(-1);
            }
        } else {
            dataBuffer.writeInt32(-1);
        }
    }
}

registerClass("LVGLAddStyleActionType", LVGLAddStyleActionType);

////////////////////////////////////////////////////////////////////////////////

export class LVGLRemoveStyleActionType extends LVGLActionType {
    target: string;
    style: string;

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            target: observable,
            style: observable
        });
    }

    static classInfo = makeDerivedClassInfo(LVGLActionType.classInfo, {
        properties: [
            {
                name: "target",
                displayName: "Target",
                type: PropertyType.Enum,
                enumItems: (actionType: LVGLRemoveStyleActionType) => {
                    const lvglIdentifiers = ProjectEditor.getProjectStore(
                        actionType
                    ).lvglIdentifiers.getIdentifiersVisibleFromFlow(
                        ProjectEditor.getFlow(actionType)
                    );

                    return lvglIdentifiers.map(lvglIdentifier => ({
                        id: lvglIdentifier.identifier,
                        label: lvglIdentifier.identifier
                    }));
                }
            },
            {
                name: "style",
                type: PropertyType.ObjectReference,
                referencedObjectCollectionPath: "allLvglStyles"
            }
        ],
        defaultValue: {},
        listLabel: (action: LVGLRemoveStyleActionType, collapsed: boolean) => {
            if (!collapsed) {
                return "Remove style";
            }
            let singleItem =
                (getParent(action) as LVGLActionType[]).length == 1;
            if (singleItem) {
                return (
                    <>
                        {action.style} from {action.target}
                    </>
                );
            } else {
                return (
                    <>
                        Remove style {action.style} from {action.target}
                    </>
                );
            }
        },
        check: (object: LVGLRemoveStyleActionType, messages: IMessage[]) => {
            const projectStore = ProjectEditor.getProjectStore(object);

            if (object.target) {
                const lvglIdentifier =
                    projectStore.lvglIdentifiers.getIdentifierByName(
                        ProjectEditor.getFlow(object),
                        object.target
                    );

                if (lvglIdentifier == undefined) {
                    messages.push(propertyNotFoundMessage(object, "target"));
                }
            } else {
                messages.push(propertyNotSetMessage(object, "target"));
            }

            if (object.style) {
                const lvglStyle = findLvglStyle(
                    projectStore.project,
                    object.style
                );

                if (!lvglStyle) {
                    messages.push(propertyNotFoundMessage(object, "style"));
                }
            } else {
                messages.push(propertyNotSetMessage(object, "style"));
            }
        }
    });

    override build(assets: Assets, dataBuffer: DataBuffer) {
        // target
        dataBuffer.writeInt32(
            assets.projectStore.lvglIdentifiers.getIdentifierByName(
                ProjectEditor.getFlow(this),
                this.target
            )?.index ?? -1
        );

        // style
        if (this.style) {
            const lvglStyle = findLvglStyle(
                assets.projectStore.project,
                this.style
            );

            if (lvglStyle) {
                dataBuffer.writeInt32(
                    assets.projectStore.lvglIdentifiers.styles.indexOf(
                        lvglStyle
                    )
                );
            } else {
                dataBuffer.writeInt32(-1);
            }
        } else {
            dataBuffer.writeInt32(-1);
        }
    }
}

registerClass("LVGLRemoveStyleActionType", LVGLRemoveStyleActionType);

////////////////////////////////////////////////////////////////////////////////

export class LVGLAddFlagActionType extends LVGLActionType {
    target: string;
    flag: keyof typeof LVGL_FLAG_CODES;

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            target: observable,
            flag: observable
        });
    }

    static classInfo = makeDerivedClassInfo(LVGLActionType.classInfo, {
        properties: [
            {
                name: "target",
                displayName: "Target",
                type: PropertyType.Enum,
                enumItems: (actionType: LVGLAddFlagActionType) => {
                    const lvglIdentifiers = ProjectEditor.getProjectStore(
                        actionType
                    ).lvglIdentifiers.getIdentifiersVisibleFromFlow(
                        ProjectEditor.getFlow(actionType)
                    );

                    return lvglIdentifiers.map(lvglIdentifier => ({
                        id: lvglIdentifier.identifier,
                        label: lvglIdentifier.identifier
                    }));
                }
            },
            {
                name: "flag",
                type: PropertyType.Enum,
                enumItems: (actionType: LVGLAddFlagActionType) => {
                    return Object.keys(getLvglFlagCodes(actionType)).map(
                        flag => ({
                            id: flag,
                            label: flag
                        })
                    );
                }
            }
        ],
        defaultValue: {},
        listLabel: (action: LVGLAddFlagActionType, collapsed: boolean) => {
            if (!collapsed) {
                return "Add flag";
            }
            let singleItem =
                (getParent(action) as LVGLActionType[]).length == 1;
            if (singleItem) {
                return (
                    <>
                        {action.flag} in {action.target}
                    </>
                );
            } else {
                return (
                    <>
                        Add flag {action.flag} in {action.target}
                    </>
                );
            }
        },
        check: (object: LVGLAddFlagActionType, messages: IMessage[]) => {
            const projectStore = ProjectEditor.getProjectStore(object);

            if (object.target) {
                const lvglIdentifier =
                    projectStore.lvglIdentifiers.getIdentifierByName(
                        ProjectEditor.getFlow(object),
                        object.target
                    );

                if (lvglIdentifier == undefined) {
                    messages.push(propertyNotFoundMessage(object, "target"));
                }
            } else {
                messages.push(propertyNotSetMessage(object, "target"));
            }
        }
    });

    override build(assets: Assets, dataBuffer: DataBuffer) {
        // target
        dataBuffer.writeInt32(
            assets.projectStore.lvglIdentifiers.getIdentifierByName(
                ProjectEditor.getFlow(this),
                this.target
            )?.index ?? -1
        );

        // flag
        dataBuffer.writeUint32(getLvglFlagCodes(this)[this.flag] ?? 0);
    }
}

registerClass("LVGLAddFlagActionType", LVGLAddFlagActionType);

////////////////////////////////////////////////////////////////////////////////

export class LVGLClearFlagActionType extends LVGLActionType {
    target: string;
    flag: keyof typeof LVGL_FLAG_CODES;

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            target: observable,
            flag: observable
        });
    }

    static classInfo = makeDerivedClassInfo(LVGLActionType.classInfo, {
        properties: [
            {
                name: "target",
                displayName: "Target",
                type: PropertyType.Enum,
                enumItems: (actionType: LVGLClearFlagActionType) => {
                    const lvglIdentifiers = ProjectEditor.getProjectStore(
                        actionType
                    ).lvglIdentifiers.getIdentifiersVisibleFromFlow(
                        ProjectEditor.getFlow(actionType)
                    );

                    return lvglIdentifiers.map(lvglIdentifier => ({
                        id: lvglIdentifier.identifier,
                        label: lvglIdentifier.identifier
                    }));
                }
            },
            {
                name: "flag",
                type: PropertyType.Enum,
                enumItems: (actionType: LVGLClearFlagActionType) => {
                    return Object.keys(getLvglFlagCodes(actionType)).map(
                        flag => ({
                            id: flag,
                            label: flag
                        })
                    );
                }
            }
        ],
        defaultValue: {},
        listLabel: (action: LVGLClearFlagActionType, collapsed: boolean) => {
            if (!collapsed) {
                return "Clear flag";
            }
            let singleItem =
                (getParent(action) as LVGLActionType[]).length == 1;
            if (singleItem) {
                return (
                    <>
                        {action.flag} in {action.target}
                    </>
                );
            } else {
                return (
                    <>
                        Clear flag {action.flag} in {action.target}
                    </>
                );
            }
        },
        check: (object: LVGLClearFlagActionType, messages: IMessage[]) => {
            const projectStore = ProjectEditor.getProjectStore(object);

            if (object.target) {
                const lvglIdentifier =
                    projectStore.lvglIdentifiers.getIdentifierByName(
                        ProjectEditor.getFlow(object),
                        object.target
                    );

                if (lvglIdentifier == undefined) {
                    messages.push(propertyNotFoundMessage(object, "target"));
                }
            } else {
                messages.push(propertyNotSetMessage(object, "target"));
            }
        }
    });

    override build(assets: Assets, dataBuffer: DataBuffer) {
        // target
        dataBuffer.writeInt32(
            assets.projectStore.lvglIdentifiers.getIdentifierByName(
                ProjectEditor.getFlow(this),
                this.target
            )?.index ?? -1
        );

        // flag
        dataBuffer.writeUint32(getLvglFlagCodes(this)[this.flag] ?? 0);
    }
}

registerClass("LVGLClearFlagActionType", LVGLClearFlagActionType);

////////////////////////////////////////////////////////////////////////////////

export class LVGLAddStateActionType extends LVGLActionType {
    target: string;
    state: keyof typeof LVGL_STATE_CODES;

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            target: observable,
            state: observable
        });
    }

    static classInfo = makeDerivedClassInfo(LVGLActionType.classInfo, {
        properties: [
            {
                name: "target",
                displayName: "Target",
                type: PropertyType.Enum,
                enumItems: (actionType: LVGLAddStateActionType) => {
                    const lvglIdentifiers = ProjectEditor.getProjectStore(
                        actionType
                    ).lvglIdentifiers.getIdentifiersVisibleFromFlow(
                        ProjectEditor.getFlow(actionType)
                    );

                    return lvglIdentifiers.map(lvglIdentifier => ({
                        id: lvglIdentifier.identifier,
                        label: lvglIdentifier.identifier
                    }));
                }
            },
            {
                name: "state",
                type: PropertyType.Enum,
                enumItems: (actionType: LVGLAddStateActionType) => {
                    return Object.keys(LVGL_STATE_CODES).map(state => ({
                        id: state,
                        label: state
                    }));
                }
            }
        ],
        defaultValue: {},
        listLabel: (action: LVGLAddStateActionType, collapsed: boolean) => {
            if (!collapsed) {
                return "Add state";
            }
            let singleItem =
                (getParent(action) as LVGLActionType[]).length == 1;
            if (singleItem) {
                return (
                    <>
                        {action.state} in {action.target}
                    </>
                );
            } else {
                return (
                    <>
                        Add state {action.state} in {action.target}
                    </>
                );
            }
        },
        check: (object: LVGLAddStateActionType, messages: IMessage[]) => {
            const projectStore = ProjectEditor.getProjectStore(object);

            if (object.target) {
                const lvglIdentifier =
                    projectStore.lvglIdentifiers.getIdentifierByName(
                        ProjectEditor.getFlow(object),
                        object.target
                    );

                if (lvglIdentifier == undefined) {
                    messages.push(propertyNotFoundMessage(object, "target"));
                }
            } else {
                messages.push(propertyNotSetMessage(object, "target"));
            }
        }
    });

    override build(assets: Assets, dataBuffer: DataBuffer) {
        // target
        dataBuffer.writeInt32(
            assets.projectStore.lvglIdentifiers.getIdentifierByName(
                ProjectEditor.getFlow(this),
                this.target
            )?.index ?? -1
        );

        // state
        dataBuffer.writeUint32(LVGL_STATE_CODES[this.state] ?? 0);
    }
}

registerClass("LVGLAddStateActionType", LVGLAddStateActionType);

////////////////////////////////////////////////////////////////////////////////

export class LVGLClearStateActionType extends LVGLActionType {
    target: string;
    state: keyof typeof LVGL_STATE_CODES;

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            target: observable,
            state: observable
        });
    }

    static classInfo = makeDerivedClassInfo(LVGLActionType.classInfo, {
        properties: [
            {
                name: "target",
                displayName: "Target",
                type: PropertyType.Enum,
                enumItems: (actionType: LVGLClearStateActionType) => {
                    const lvglIdentifiers = ProjectEditor.getProjectStore(
                        actionType
                    ).lvglIdentifiers.getIdentifiersVisibleFromFlow(
                        ProjectEditor.getFlow(actionType)
                    );

                    return lvglIdentifiers.map(lvglIdentifier => ({
                        id: lvglIdentifier.identifier,
                        label: lvglIdentifier.identifier
                    }));
                }
            },
            {
                name: "state",
                type: PropertyType.Enum,
                enumItems: (actionType: LVGLClearStateActionType) => {
                    return Object.keys(LVGL_STATE_CODES).map(state => ({
                        id: state,
                        label: state
                    }));
                }
            }
        ],
        defaultValue: {},
        listLabel: (action: LVGLClearStateActionType, collapsed: boolean) => {
            if (!collapsed) {
                return "Clear state";
            }
            let singleItem =
                (getParent(action) as LVGLActionType[]).length == 1;
            if (singleItem) {
                return (
                    <>
                        {action.state} in {action.target}
                    </>
                );
            } else {
                return (
                    <>
                        Clear state {action.state} in {action.target}
                    </>
                );
            }
        },
        check: (object: LVGLClearStateActionType, messages: IMessage[]) => {
            const projectStore = ProjectEditor.getProjectStore(object);

            if (object.target) {
                const lvglIdentifier =
                    projectStore.lvglIdentifiers.getIdentifierByName(
                        ProjectEditor.getFlow(object),
                        object.target
                    );

                if (lvglIdentifier == undefined) {
                    messages.push(propertyNotFoundMessage(object, "target"));
                }
            } else {
                messages.push(propertyNotSetMessage(object, "target"));
            }
        }
    });

    override build(assets: Assets, dataBuffer: DataBuffer) {
        // target
        dataBuffer.writeInt32(
            assets.projectStore.lvglIdentifiers.getIdentifierByName(
                ProjectEditor.getFlow(this),
                this.target
            )?.index ?? -1
        );

        // state
        dataBuffer.writeUint32(LVGL_STATE_CODES[this.state] ?? 0);
    }
}

registerClass("LVGLClearStateActionType", LVGLClearStateActionType);

////////////////////////////////////////////////////////////////////////////////

const GROUP_ACTIONS = {
    SET_WRAP: 0,
    FOCUS_OBJ: 1,
    FOCUS_NEXT: 2,
    FOCUS_PREVIOUS: 3,
    FOCUS_FREEZE: 4,
    SET_EDITING: 5
};

export class LVGLGroupActionType extends LVGLActionType {
    groupAction: keyof typeof GROUP_ACTIONS;
    target: string;
    enable: boolean;

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            groupAction: observable,
            target: observable,
            enable: observable
        });
    }

    static classInfo = makeDerivedClassInfo(LVGLActionType.classInfo, {
        properties: [
            {
                name: "groupAction",
                type: PropertyType.Enum,
                enumItems: Object.keys(GROUP_ACTIONS).map(id => ({
                    id
                })),
                enumDisallowUndefined: true
            },
            {
                name: "target",
                displayName: (actionType: LVGLGroupActionType) =>
                    actionType.groupAction == "FOCUS_OBJ"
                        ? "Target widget"
                        : "Target group",
                type: PropertyType.Enum,
                enumItems: (actionType: LVGLGroupActionType) => {
                    const projectStore =
                        ProjectEditor.getProjectStore(actionType);
                    if (actionType.groupAction == "FOCUS_OBJ") {
                        const lvglIdentifiers =
                            projectStore.lvglIdentifiers.getIdentifiersVisibleFromFlow(
                                ProjectEditor.getFlow(actionType)
                            );

                        return lvglIdentifiers.map(lvglIdentifier => ({
                            id: lvglIdentifier.identifier,
                            label: lvglIdentifier.identifier
                        }));
                    } else {
                        return projectStore.project.lvglGroups.groups.map(
                            group => ({
                                id: group.name,
                                label: group.name
                            })
                        );
                    }
                }
            },
            {
                name: "enable",
                type: PropertyType.Boolean,
                checkboxStyleSwitch: true,
                disabled: (actionType: LVGLGroupActionType) =>
                    !(
                        actionType.groupAction == "SET_WRAP" ||
                        actionType.groupAction == "FOCUS_FREEZE" ||
                        actionType.groupAction == "SET_EDITING"
                    )
            }
        ],
        defaultValue: {
            groupAction: "SET_WRAP"
        },
        listLabel: (action: LVGLGroupActionType, collapsed: boolean) => {
            if (!collapsed) {
                return "Group";
            }
            if (action.groupAction == "SET_WRAP") {
                return (
                    <>
                        Set wrap to {action.enable ? "ON" : "OFF"} for group "
                        {action.target}"
                    </>
                );
            } else if (action.groupAction == "FOCUS_OBJ") {
                return <>Set focus to widget "{action.target}"</>;
            } else if (action.groupAction == "FOCUS_NEXT") {
                return <>Focus next for group "{action.target}"</>;
            } else if (action.groupAction == "FOCUS_PREVIOUS") {
                return <>Focus previous for group "{action.target}"</>;
            } else if (action.groupAction == "FOCUS_FREEZE") {
                return <>Freeze focus for group "{action.target}"</>;
            } else {
                return (
                    <>
                        Set editing to {action.enable ? "ON" : "OFF"} for group
                        "{action.target}"
                    </>
                );
            }
        },
        check: (object: LVGLGroupActionType, messages: IMessage[]) => {
            const projectStore = ProjectEditor.getProjectStore(object);

            if (object.target) {
                if (object.groupAction == "FOCUS_OBJ") {
                    const lvglIdentifier =
                        projectStore.lvglIdentifiers.getIdentifierByName(
                            ProjectEditor.getFlow(object),
                            object.target
                        );

                    if (lvglIdentifier == undefined) {
                        messages.push(
                            propertyNotFoundMessage(object, "target")
                        );
                    }
                } else {
                    if (
                        !projectStore.project.lvglGroups.groups.some(
                            group => group.name == object.target
                        )
                    ) {
                        messages.push(
                            propertyNotFoundMessage(object, "target")
                        );
                    }
                }
            } else {
                messages.push(propertyNotSetMessage(object, "target"));
            }
        }
    });

    override build(assets: Assets, dataBuffer: DataBuffer) {
        // groupAction
        dataBuffer.writeUint32(GROUP_ACTIONS[this.groupAction]);

        // target
        if (this.groupAction == "FOCUS_OBJ") {
            dataBuffer.writeInt32(
                assets.projectStore.lvglIdentifiers.getIdentifierByName(
                    ProjectEditor.getFlow(this),
                    this.target
                )?.index ?? -1
            );
        } else {
            const index =
                assets.projectStore.project.lvglGroups.groups.findIndex(
                    group => group.name == this.target
                );

            dataBuffer.writeInt32(index);
        }

        // style
        dataBuffer.writeUint32(this.enable ? 1 : 0);
    }
}

registerClass("LVGLGroupActionType", LVGLGroupActionType);

////////////////////////////////////////////////////////////////////////////////

export class LVGLActionComponent extends ActionComponent {
    actions: LVGLActionType[];

    static classInfo = makeDerivedClassInfo(ActionComponent.classInfo, {
        flowComponentId: COMPONENT_TYPE_LVGL_ACTION,
        componentPaletteGroupName: "!2LVGL",
        componentPaletteLabel: "LVGL",
        enabledInComponentPalette: (projectType: ProjectType) =>
            projectType === ProjectType.LVGL,
        label: (component: LVGLActionComponent) => {
            if (component.actions.length == 1) {
                return `LVGL ${humanize(component.actions[0].action)}`;
            }
            return "LVGL";
        },
        properties: [
            {
                name: "actions",
                type: PropertyType.Array,
                typeClass: LVGLActionType,
                propertyGridGroup: specificGroup,
                partOfNavigation: false,
                enumerable: false,
                defaultValue: []
            }
        ],
        beforeLoadHook: (object: LVGLActionComponent, objectJs: any) => {
            if (objectJs.action != undefined) {
                if (objectJs.action == "CHANGE_SCREEN") {
                    let action: Partial<LVGLChangeScreenActionType> = {
                        action: objectJs.action
                    };

                    action.screen =
                        objectJs.changeScreenTarget ?? objectJs.screen;
                    action.fadeMode =
                        objectJs.changeScreenFadeMode ?? objectJs.fadeMode;
                    action.speed = objectJs.changeScreenSpeed ?? objectJs.speed;
                    action.delay = objectJs.changeScreenDelay ?? objectJs.delay;

                    objectJs.actions = [action];
                } else if (objectJs.action == "PLAY_ANIMATION") {
                    objectJs.actions = objectJs.animItems.map((item: any) => {
                        let action: Partial<LVGLPlayAnimationActionType> = {
                            action: objectJs.action
                        };

                        action.target = objectJs.animTarget;
                        action.property = item.property;
                        action.start = item.start;
                        action.end = item.end;
                        action.delay = objectJs.animDelay + item.delay;
                        action.time = item.time;
                        action.relative = item.relative;
                        action.instant = item.instant;
                        action.path = item.path;

                        return action;
                    });
                } else if (objectJs.action == "SET_PROPERTY") {
                    let action: Partial<LVGLSetPropertyActionType> = {
                        action: objectJs.action
                    };

                    action.targetType = objectJs.setPropTargetType;
                    action.target = objectJs.setPropTarget;
                    action.property = objectJs.setPropProperty;
                    action.value = objectJs.setPropValue;
                    action.valueType = objectJs.setPropValueType;
                    action.animated = objectJs.setPropAnim;

                    objectJs.actions = [action];
                }

                delete objectJs.screen;
                delete objectJs.changeScreenTarget;
                delete objectJs.fadeMode;
                delete objectJs.changeScreenFadeMode;
                delete objectJs.speed;
                delete objectJs.changeScreenSpeed;
                delete objectJs.delay;
                delete objectJs.changeScreenDelay;

                delete objectJs.animTarget;
                delete objectJs.animDelay;
                delete objectJs.animItems;

                delete objectJs.setPropTargetType;
                delete objectJs.setPropTarget;
                delete objectJs.setPropProperty;
                delete objectJs.setPropAnim;
                delete objectJs.setPropValue;
                delete objectJs.setPropValueType;
            }
        },
        icon: (
            <img src="data:image/png;base64,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" />
        ),
        componentHeaderColor: "#FBDEDE",
        defaultValue: {
            actions: []
        }
    });

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            actions: observable
        });
    }

    getInputs() {
        return [
            {
                name: "@seqin",
                type: "any" as ValueType,
                isSequenceInput: true,
                isOptionalInput: true
            },
            ...super.getInputs()
        ];
    }

    getOutputs() {
        return [
            {
                name: "@seqout",
                type: "null" as ValueType,
                isSequenceOutput: true,
                isOptionalOutput: true
            },
            ...super.getOutputs()
        ];
    }

    getBody(flowContext: IFlowContext): React.ReactNode {
        return (
            <div className="body">
                {this.actions.map((action, i) => (
                    <pre key={getId(action)}>
                        {this.actions.length > 1 ? `#${i + 1} ` : ""}
                        {getListLabel(action, true)}
                    </pre>
                ))}
            </div>
        );
    }

    buildFlowComponentSpecific(assets: Assets, dataBuffer: DataBuffer) {
        dataBuffer.writeArray(this.actions, action => {
            // action
            dataBuffer.writeUint32(LVGL_ACTIONS[action.action]);

            // ...specific
            action.build(assets, dataBuffer);
        });
    }
}

registerClass("LVGLActionComponent", LVGLActionComponent);
*/
