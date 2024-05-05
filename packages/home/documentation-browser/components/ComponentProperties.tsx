import React from "react";
import { observer } from "mobx-react";
import {
    IPropertyGridGroupDefinition,
    TYPE_NAMES
} from "project-editor/core/object";
import { ComponentInfo, IComponentInfoProperty } from "../component-info";
import { BodySection } from "./BodySection";
import classNames from "classnames";
import { getModel } from "../model";

export const ComponentProperties = observer(
    class ComponentProperties extends React.Component<{
        componentInfo: ComponentInfo;
        generateHTML: boolean;
    }> {
        render() {
            const { componentInfo } = this.props;

            const groupPropertiesArray = getPropertyGroups(
                componentInfo,
                componentInfo.allProperties.filter(
                    property => !componentInfo.isEmptyProperty(property.name)
                )
            );

            return (
                <BodySection title="Properties">
                    <div className="EezStudio_Component_Documentation_Properties">
                        {groupPropertiesArray.map((groupProperties, i) => {
                            return (
                                <div
                                    className={classNames(
                                        "EezStudio_Component_Documentation_PropertiesGroup",
                                        {
                                            collapsed: i > 0
                                        }
                                    )}
                                    key={groupProperties.group.id}
                                >
                                    <h3>
                                        {groupProperties.group.title || "Other"}
                                    </h3>
                                    <dl>
                                        {groupProperties.properties.map(
                                            property => (
                                                <ComponentProperty
                                                    componentInfo={
                                                        componentInfo
                                                    }
                                                    property={property}
                                                    key={property.name}
                                                    generateHTML={
                                                        this.props.generateHTML
                                                    }
                                                />
                                            )
                                        )}
                                    </dl>
                                </div>
                            );
                        })}
                    </div>
                </BodySection>
            );
        }
    }
);

const ComponentProperty = observer(
    class ComponentProperty extends React.Component<{
        componentInfo: ComponentInfo;
        property: IComponentInfoProperty;
        generateHTML: boolean;
    }> {
        render() {
            const { property } = this.props;

            let propertyName = getPropertyName(property);
            let propertyDescription = getPropertyDescription(property);

            return (
                <>
                    <dt>
                        <h4>{propertyName}</h4>
                        <span
                            style={{
                                fontWeight: "normal",
                                fontStyle: "italic"
                            }}
                        >
                            {propertyDescription}
                        </span>
                    </dt>
                    <dd>
                        {this.props.componentInfo.renderPropertyDescription(
                            property.name,
                            this.props.generateHTML
                        )}
                    </dd>
                </>
            );
        }
    }
);

interface IGroupProperties {
    group: IPropertyGridGroupDefinition;
    properties: IComponentInfoProperty[];
}

export function getPropertyGroups(
    componentInfo: ComponentInfo,
    properties: IComponentInfoProperty[]
) {
    let groupPropertiesArray: IGroupProperties[] = [];

    let groupForPropertiesWithoutGroupSpecified: IGroupProperties | undefined;

    for (let property of properties) {
        const propertyInfo = property.metaInfo;
        const propertyGroup = propertyInfo.propertyGridGroup;

        let propertiesInGroup: IComponentInfoProperty[];

        if (propertyGroup) {
            let groupProperties = groupPropertiesArray.find(
                groupProperties => groupProperties.group.id === propertyGroup.id
            );

            if (!groupProperties) {
                groupProperties = {
                    group: propertyGroup,
                    properties: []
                };
                groupPropertiesArray.push(groupProperties);
            }

            propertiesInGroup = groupProperties.properties;
        } else {
            if (!groupForPropertiesWithoutGroupSpecified) {
                groupForPropertiesWithoutGroupSpecified = {
                    group: {
                        id: "",
                        title: ""
                    },
                    properties: []
                };

                groupPropertiesArray.push(
                    groupForPropertiesWithoutGroupSpecified
                );
            }
            propertiesInGroup =
                groupForPropertiesWithoutGroupSpecified.properties;
        }

        propertiesInGroup.push(property);
    }

    const componentObject = ComponentInfo.createComponentObject(
        getModel().dashboardProjectStore,
        componentInfo.componentClass
    );

    groupPropertiesArray.sort((a: IGroupProperties, b: IGroupProperties) => {
        function pos(groupProperties: IGroupProperties) {
            if (groupProperties.group.title == "Specific") return -1000;

            if (groupProperties.group.position !== undefined) {
                if (typeof groupProperties.group.position == "number")
                    return groupProperties.group.position;
                return groupProperties.group.position(componentObject);
            }

            return 1000;
        }

        return pos(a) - pos(b);
    });

    // move and remove some properties
    if (componentInfo.type == "widget") {
        groupPropertiesArray.forEach(groupProperties => {
            function move(name1: string, name2: string) {
                let i1 = groupProperties.properties.findIndex(
                    property => property.name == name1
                );
                const i2 = groupProperties.properties.findIndex(
                    property => property.name == name2
                );

                if (i1 != -1 && i2 != -1) {
                    groupProperties.properties.splice(
                        i2 + 1,
                        0,
                        groupProperties.properties[i1]
                    );
                    if (i2 < i1) i1++;
                    groupProperties.properties.splice(i1, 1);
                }
            }

            function remove(name: string) {
                const i = groupProperties.properties.findIndex(
                    property => property.name == name
                );
                if (i != -1) {
                    groupProperties.properties.splice(i, 1);
                }
            }

            if (componentInfo.isLVGLComponent) {
                move("Left unit", "Left");
                move("Top unit", "Top");
                move("Width unit", "Width");
                move("Height unit", "Height");

                remove("Absolute position");
                remove("Resizing");
                remove("Visible");
                remove("Output widget handle");
            }

            if (componentInfo.isEezGuiComponent) {
                remove("Output widget handle");
            }

            if (
                componentInfo.isLVGLComponent ||
                (componentInfo.isDashboardComponent &&
                    !componentInfo.isEezGuiComponent)
            ) {
                remove(`Hide "Widget is outside of its parent" warning`);
            }

            move("Center widget", "Align and distribute");
        });

        groupPropertiesArray = groupPropertiesArray.filter(
            groupProperties => groupProperties.properties.length > 0
        );
    }

    return groupPropertiesArray;
}

export function getPropertyName(property: IComponentInfoProperty) {
    let propertyName = property.name;
    if (propertyName.endsWith(" style") && propertyName != "Use style") {
        propertyName = propertyName.substr(
            0,
            propertyName.length - " style".length
        );
    }
    return propertyName;
}

export function getPropertyDescription(property: IComponentInfoProperty) {
    let propertyDescription;
    if (property.metaInfo.expressionType || property.metaInfo.flowProperty) {
        if (property.metaInfo.flowProperty == "assignable") {
            propertyDescription = `ASSIGNABLE EXPRESSION (${property.metaInfo.expressionType})`;
        } else if (
            property.metaInfo.flowProperty == "template-literal" ||
            property.metaInfo.flowProperty == "scpi-template-literal"
        ) {
            if (property.metaInfo.expressionType) {
                propertyDescription = `TEMPLATE LITERAL (${property.metaInfo.expressionType})`;
            } else {
                propertyDescription = `TEMPLATE LITERAL`;
            }
        } else {
            propertyDescription = `EXPRESSION (${property.metaInfo.expressionType})`;
        }
    } else {
        propertyDescription = TYPE_NAMES[property.metaInfo.type];
    }
    return propertyDescription;
}
