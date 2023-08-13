import React from "react";
import { observer } from "mobx-react";
import {
    IPropertyGridGroupDefinition,
    TYPE_NAMES
} from "project-editor/core/object";
import { ComponentInfo, IComponentInfoProperty } from "../component-info";
import { BodySection } from "./BodySection";
import classNames from "classnames";

export const ComponentProperties = observer(
    class ComponentProperties extends React.Component<{
        componentInfo: ComponentInfo;
        generateHTML: boolean;
    }> {
        render() {
            const { componentInfo } = this.props;

            const groupPropertiesArray = getPropertyGroups(
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

            const propertyName = property.name;

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

function getPropertyGroups(properties: IComponentInfoProperty[]) {
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

    let maxPosition = 0;

    groupPropertiesArray.forEach(groupProperties => {
        if (groupProperties.group.position != undefined) {
            let position;
            if (typeof groupProperties.group.position == "number") {
                position = groupProperties.group.position;
            }
            if (position != undefined && position > maxPosition) {
                maxPosition = position;
            }
        }
    });

    groupPropertiesArray.sort((a: IGroupProperties, b: IGroupProperties) => {
        const aPosition =
            a.group.title == "Specific"
                ? -1
                : a.group.position !== undefined &&
                  typeof a.group.position == "number"
                ? a.group.position
                : maxPosition + 1;

        const bPosition =
            b.group.title == "Specific"
                ? -1
                : b.group.position !== undefined &&
                  typeof b.group.position == "number"
                ? b.group.position
                : maxPosition + 1;

        return aPosition - bPosition;
    });

    return groupPropertiesArray;
}
