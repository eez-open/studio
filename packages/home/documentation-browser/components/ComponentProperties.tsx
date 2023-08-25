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

            let propertyName = property.name;
            if (propertyName.endsWith(" style")) {
                propertyName = propertyName.substr(0, " style".length);
            }

            let propertyDescription;
            if (
                property.metaInfo.expressionType ||
                property.metaInfo.flowProperty
            ) {
                if (property.metaInfo.flowProperty == "assignable") {
                    propertyDescription = `ASSIGNABLE EXPRESSSION (${property.metaInfo.expressionType})`;
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
                    propertyDescription = `EXPRESSSION (${property.metaInfo.expressionType})`;
                }
            } else {
                propertyDescription = TYPE_NAMES[property.metaInfo.type];
            }

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
                            propertyName,
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

function getPropertyGroups(
    componentInfo: ComponentInfo,
    properties: IComponentInfoProperty[]
) {
    const groupPropertiesArray: IGroupProperties[] = [];

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

    return groupPropertiesArray;
}
