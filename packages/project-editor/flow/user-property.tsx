import React from "react";
import { makeObservable, observable } from "mobx";
import { observer } from "mobx-react";

import { showGenericDialog } from "eez-studio-ui/generic-dialog";
import { validators } from "eez-studio-shared/validation";
import { validators as validatorsRenderer } from "eez-studio-shared/validation-renderer";
import classNames from "classnames";

import {
    ClassInfo,
    EezObject,
    getKey,
    getParent,
    IEezObject,
    IMessage,
    IOnSelectParams,
    MessageType,
    PropertyInfo,
    PropertyProps,
    PropertyType,
    setKey
} from "project-editor/core/object";
import {
    createObject,
    EezValueObject,
    getAncestorOfType,
    Message,
    propertyNotSetMessage,
    Section
} from "project-editor/store";

import { ProjectContext } from "project-editor/project/context";

import { ProjectEditor } from "project-editor/project-editor-interface";

import { specificGroup } from "project-editor/ui-components/PropertyGrid/groups";

import {
    getDefaultValueForType,
    isValidType,
    migrateType,
    ValueType,
    VariableTypeFieldComponent,
    variableTypeProperty
} from "project-editor/features/variable/value-type";
import { findAction, findPage } from "project-editor/project/assets";
import {
    Component,
    makeAssignableExpressionProperty,
    makeExpressionProperty
} from "project-editor/flow/component";
import type { Flow } from "project-editor/flow/flow";
import {
    checkAssignableExpression,
    checkExpression
} from "project-editor/flow/expression";
import { uniqueForVariableAndUserProperty } from "project-editor/features/variable/variable";
import { guid } from "eez-studio-shared/guid";

////////////////////////////////////////////////////////////////////////////////

export class UserProperty extends EezObject {
    id: string;
    name: string;
    type: ValueType;
    assignable: boolean;
    displayName?: string;
    description?: string;

    // IVariable compatibility
    get defaultValue() {
        return getDefaultValueForType(
            ProjectEditor.getProject(this),
            this.type
        );
    }
    get fullName() {
        return this.name;
    }
    get defaultValueList() {
        return undefined;
    }
    get persistent() {
        return false;
    }

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            name: observable,
            type: observable,
            assignable: observable,
            displayName: observable,
            description: observable
        });
    }

    static classInfo: ClassInfo = {
        properties: [
            {
                name: "id",
                type: PropertyType.String,
                hideInPropertyGrid: true,
                hideInDocumentation: "all"
            },
            {
                name: "name",
                type: PropertyType.String,
                uniqueIdentifier: uniqueForVariableAndUserProperty
            },
            variableTypeProperty,
            {
                name: "assignable",
                type: PropertyType.Boolean,
                checkboxStyleSwitch: true
            },
            {
                name: "displayName",
                type: PropertyType.String
            },
            {
                name: "description",
                type: PropertyType.MultilineText
            }
        ],

        listLabel: (userProperty: UserProperty, collapsed) =>
            !collapsed ? (
                ""
            ) : (
                <>
                    <span>{userProperty.name} </span>
                    <em
                        className="font-monospace"
                        style={{ marginLeft: 5, opacity: 0.5 }}
                    >
                        {userProperty.type}
                    </em>
                </>
            ),

        defaultValue: {},

        beforeLoadHook(object, jsObject) {
            migrateType(jsObject);

            if (jsObject.id == undefined) {
                jsObject.id = jsObject.objID;
            }
        },

        newItem: async (userProperties: UserProperty[]) => {
            const project = ProjectEditor.getProject(userProperties);

            const result = await showGenericDialog({
                dialogDefinition: {
                    title: "New User Property",
                    fields: [
                        {
                            name: "name",
                            type: "string",
                            validators: [
                                validators.required,
                                validatorsRenderer.identifierValidator,
                                uniqueForVariableAndUserProperty(
                                    {} as any,
                                    userProperties
                                )
                            ]
                        },
                        {
                            name: "type",
                            type: VariableTypeFieldComponent,
                            validators: [validators.required]
                        },
                        {
                            name: "assignable",
                            type: "boolean",
                            checkboxStyleSwitch: true
                        }
                    ]
                },
                values: {
                    assignable: false
                },
                dialogContext: project
            });

            const properties: Partial<UserProperty> = {
                id: guid(),
                name: result.values.name,
                type: result.values.type,
                assignable: result.values.assignable
            };

            const userProperty = createObject<UserProperty>(
                project._store,
                properties,
                UserProperty
            );

            return userProperty;
        },

        check: (userProperty: UserProperty, messages: IMessage[]) => {
            const projectStore = ProjectEditor.getProjectStore(userProperty);
            if (userProperty.type) {
                if (!isValidType(projectStore.project, userProperty.type)) {
                    messages.push(
                        new Message(
                            MessageType.ERROR,
                            `Invalid type`,
                            userProperty
                        )
                    );
                }
            } else {
                messages.push(propertyNotSetMessage(userProperty, "type"));
            }
        }
    };
}

////////////////////////////////////////////////////////////////////////////////

function getReferencedFlow(object: IEezObject): Flow | undefined {
    let flow;

    if (object instanceof ProjectEditor.CallActionActionComponentClass) {
        flow = findAction(ProjectEditor.getProject(object), object.action);
    } else if (
        object instanceof ProjectEditor.UserWidgetWidgetClass ||
        object instanceof ProjectEditor.LVGLUserWidgetWidgetClass
    ) {
        flow = findPage(
            ProjectEditor.getProject(object),
            object.userWidgetPageName
        );
    }

    if (flow) {
        return flow;
    }

    const parent = getParent(object);
    if (parent) {
        return getReferencedFlow(parent);
    }

    return undefined;
}

function getPropertyInfoForUserProperty(
    userProperty: UserProperty,
    parent: IEezObject
) {
    const propertyInfo = userProperty.assignable
        ? makeAssignableExpressionProperty(
              {
                  name: userProperty.id,
                  displayName: userProperty.displayName || userProperty.name,
                  type: PropertyType.MultilineText,
                  propertyGridGroup: specificGroup,
                  formText: userProperty.description
              },
              userProperty.type
          )
        : makeExpressionProperty(
              {
                  name: userProperty.id,
                  displayName: userProperty.displayName || userProperty.name,
                  type: PropertyType.MultilineText,
                  propertyGridGroup: specificGroup,
                  formText: userProperty.description
              },
              userProperty.type
          );

    const onSelect = propertyInfo.onSelect!;

    propertyInfo.onSelect = async (
        object: IEezObject,
        propertyInfo: PropertyInfo,
        params?: IOnSelectParams
    ) => {
        (object as any)._eez_parent = parent;
        const result = await onSelect(object, propertyInfo, params);
        delete (object as any)._eez_parent;
        return result;
    };

    return propertyInfo;
}

function getUserPropertiesAsPropertyInfos(
    userProperties: UserProperty[],
    parent: IEezObject
): PropertyInfo[] {
    return userProperties.map(userProperty =>
        getPropertyInfoForUserProperty(userProperty, parent)
    );
}

function makeValueObjectForUserProperty(
    userPropertyValues: UserPropertyValues,
    userProperty: UserProperty
) {
    const valueObject = EezValueObject.create(
        userPropertyValues,
        getPropertyInfoForUserProperty(userProperty, userPropertyValues),
        userPropertyValues.values[userProperty.id]
    );

    setKey(valueObject, `values.${userProperty.id}`);

    return valueObject;
}

function isPropertyInError(
    userPropertyValues: UserPropertyValues,
    userPropertyId: string
) {
    const messages = ProjectEditor.getProjectStore(
        userPropertyValues
    ).outputSectionsStore.getSection(Section.CHECKS).messages.messages;

    function test(messages: Message[]) {
        for (const message of messages) {
            if (message.type == MessageType.GROUP) {
                if (test(message.messages!)) {
                    return true;
                }
            } else {
                if (
                    message.object &&
                    getParent(message.object) === userPropertyValues &&
                    getKey(message.object) === `values.${userPropertyId}`
                ) {
                    return true;
                }
            }
        }

        return false;
    }

    return test(messages);
}

function isHighlightedProperty(
    userPropertyValues: UserPropertyValues,
    userPropertyId: string
) {
    const projectStore = ProjectEditor.getProjectStore(userPropertyValues);
    const selectedObject =
        projectStore.navigationStore.selectedPanel &&
        projectStore.navigationStore.selectedPanel.selectedObject;

    return !!(
        selectedObject &&
        getParent(selectedObject) === userPropertyValues &&
        getKey(selectedObject) === `values.${userPropertyId}`
    );
}

export function getAdditionalFlowPropertiesForUserProperties(
    component: Component
) {
    const flow = getReferencedFlow(component);

    if (!flow) {
        return [];
    }

    return flow.userProperties.map(userProperty =>
        userProperty.assignable
            ? makeAssignableExpressionProperty(
                  {
                      name: `userPropertyValues.values.${userProperty.id}`,
                      type: PropertyType.MultilineText
                  },
                  userProperty.type
              )
            : makeExpressionProperty(
                  {
                      name: `userPropertyValues.values.${userProperty.id}`,
                      type: PropertyType.MultilineText
                  },
                  userProperty.type
              )
    );
}

////////////////////////////////////////////////////////////////////////////////

export const UserPropertyValuesProperty = observer(
    class UserPropertyValuesProperty extends React.Component<PropertyProps> {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        constructor(props: any) {
            super(props);
        }

        get properties(): PropertyInfo[] {
            if (this.props.objects.length != 1) {
                return [];
            }

            const object = this.props.objects[0];

            const flow = getReferencedFlow(object);
            if (!flow) {
                return [];
            }

            return getUserPropertiesAsPropertyInfos(
                flow.userProperties,
                object
            );
        }

        render() {
            if (this.props.objects.length != 1) {
                return null;
            }

            const userPropertyValues = (this.props.objects[0] as any)
                .userPropertyValues;
            const values = (this.props.objects[0] as any).userPropertyValues
                .values;

            return this.properties.map(propertyInfo => (
                <div
                    key={propertyInfo.name}
                    className={classNames("EezStudio_PropertyGrid_Property", {
                        inError: isPropertyInError(
                            userPropertyValues,
                            propertyInfo.name
                        ),
                        highlighted: isHighlightedProperty(
                            userPropertyValues,
                            propertyInfo.name
                        )
                    })}
                >
                    <div
                        className="property-name"
                        title={propertyInfo.expressionType}
                    >
                        {propertyInfo.displayName as string}
                    </div>
                    <div style={{ width: "100%" }}>
                        <ProjectEditor.Property
                            key={propertyInfo.name}
                            propertyInfo={propertyInfo}
                            objects={[values]}
                            updateObject={(propertyValues: Object) => {
                                this.context.updateObject(userPropertyValues, {
                                    values: Object.assign(
                                        {},
                                        values,
                                        propertyValues
                                    )
                                });
                            }}
                            readOnly={false}
                        />
                    </div>
                </div>
            ));
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

export const userPropertiesProperty: PropertyInfo = {
    name: "userProperties",
    type: PropertyType.Array,
    typeClass: UserProperty,
    partOfNavigation: false,
    enumerable: false,
    defaultValue: [],
    propertyGridGroup: specificGroup,
    disabled: (object: EezObject) => {
        return (
            !ProjectEditor.getProject(object).projectTypeTraits
                .hasFlowSupport ||
            (object instanceof ProjectEditor.PageClass &&
                !object.isUsedAsUserWidget)
        );
    }
};

////////////////////////////////////////////////////////////////////////////////

export class UserPropertyValues extends EezObject {
    values: {
        [id: string]: string;
    };

    static classInfo: ClassInfo = {
        label: () => "User Properties",

        properties: [
            {
                name: "values",
                type: PropertyType.Any,
                visitProperty: (userPropertyValues: UserPropertyValues) => {
                    const valueObjects: EezValueObject[] = [];

                    let flow = getReferencedFlow(userPropertyValues);
                    if (!flow) {
                        return valueObjects;
                    }

                    flow.userProperties.forEach(userProperty => {
                        if (
                            userPropertyValues.values.hasOwnProperty(
                                userProperty.id
                            )
                        ) {
                            valueObjects.push(
                                makeValueObjectForUserProperty(
                                    userPropertyValues,
                                    userProperty
                                )
                            );
                        }
                    });

                    return valueObjects;
                }
            }
        ],
        defaultValue: {
            values: {}
        },
        beforeLoadHook: (object: IEezObject, jsObject: any) => {
            if (jsObject.values == undefined) {
                jsObject.values = {};
            }
        },
        check: (
            userPropertyValues: UserPropertyValues,
            messages: IMessage[]
        ) => {
            let flow = getReferencedFlow(userPropertyValues);
            if (!flow) {
                return;
            }

            const component = getAncestorOfType(
                userPropertyValues,
                ProjectEditor.ComponentClass.classInfo
            ) as Component;

            flow.userProperties.forEach(userProperty => {
                const value = userPropertyValues.values[userProperty.id];

                if (value) {
                    if (userProperty.assignable) {
                        try {
                            checkAssignableExpression(component, value);
                        } catch (err) {
                            messages.push(
                                new Message(
                                    MessageType.ERROR,
                                    `${
                                        userProperty.displayName ||
                                        userProperty.name
                                    }: invalid assignable expression (${err})`,
                                    makeValueObjectForUserProperty(
                                        userPropertyValues,
                                        userProperty
                                    )
                                )
                            );
                        }
                    } else {
                        try {
                            checkExpression(component, value);
                        } catch (err) {
                            messages.push(
                                new Message(
                                    MessageType.ERROR,
                                    `${
                                        userProperty.displayName ||
                                        userProperty.name
                                    }: invalid expression (${err})`,
                                    makeValueObjectForUserProperty(
                                        userPropertyValues,
                                        userProperty
                                    )
                                )
                            );
                        }
                    }
                } else {
                    messages.push(
                        new Message(
                            MessageType.ERROR,
                            `${
                                userProperty.displayName || userProperty.name
                            }: not set`,
                            makeValueObjectForUserProperty(
                                userPropertyValues,
                                userProperty
                            )
                        )
                    );
                }
            });
        },

        getPropertyDisplayName: (
            userPropertyValues: UserPropertyValues,
            propertyKey: string
        ) => {
            if (propertyKey.startsWith("values.")) {
                let flow = getReferencedFlow(userPropertyValues);
                if (flow) {
                    let userProperty = flow.userProperties.find(
                        userProperty =>
                            userProperty.id ==
                            propertyKey.slice("values.".length)
                    );
                    if (userProperty) {
                        return userProperty.displayName || userProperty.name;
                    }
                }
            }
            return undefined;
        }
    };

    override makeEditable() {
        super.makeEditable();

        // setTimeout(() => this.removeUnusedPropertyValues());

        makeObservable(this, {
            values: observable
        });
    }

    removeUnusedPropertyValues() {
        let flow = getReferencedFlow(this);
        if (flow) {
            let usedPropertyIds = flow.userProperties.map(
                userProperty => userProperty.id
            );

            for (let key of Object.keys(this.values)) {
                if (!usedPropertyIds.includes(key)) {
                    delete this.values[key];
                }
            }
        }
    }
}

export const userPropertyValuesProperty: PropertyInfo = {
    name: "userPropertyValues",
    type: PropertyType.Object,
    typeClass: UserPropertyValues,
    propertyGridGroup: specificGroup,
    propertyGridFullRowComponent: UserPropertyValuesProperty,
    enumerable: false,
    disabled: (object: EezObject) => {
        return !ProjectEditor.getProject(object).projectTypeTraits
            .hasFlowSupport;
    }
};
