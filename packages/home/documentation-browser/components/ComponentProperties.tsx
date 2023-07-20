import React from "react";
import { observer } from "mobx-react";
import {
    IPropertyGridGroupDefinition,
    TYPE_NAMES
} from "project-editor/core/object";
import { ComponentInfo, IComponentInfoProperty } from "../component-info";
import { BodySection } from "./BodySection";

export const ComponentProperties = observer(
    class ComponentProperties extends React.Component<{
        componentInfo: ComponentInfo;
        generateHTML: boolean;
    }> {
        render() {
            const { componentInfo } = this.props;

            const groupPropertiesArray = getPropertyGroups(
                componentInfo.allProperties
            );

            const id = `component-properties-`;

            return (
                <BodySection title="Properties">
                    <div className="accordion" id={id}>
                        {groupPropertiesArray.map((groupProperties, i) => {
                            const headingId = `${id}_h_${groupProperties.group.id}`;
                            const collapseId = `${id}_c_${groupProperties.group.id}`;

                            return (
                                <div
                                    key={groupProperties.group.id}
                                    className="accordion-item"
                                >
                                    <h2
                                        className="accordion-header"
                                        id={headingId}
                                    >
                                        <button
                                            className={
                                                i == 0
                                                    ? "accordion-button"
                                                    : "accordion-button collapsed"
                                            }
                                            type="button"
                                            data-bs-toggle="collapse"
                                            data-bs-target={`#${collapseId}`}
                                            aria-expanded={
                                                i == 0 ? "true" : "false"
                                            }
                                            aria-controls={collapseId}
                                        >
                                            {groupProperties.group.title ||
                                                "Other"}
                                        </button>
                                    </h2>
                                    <div
                                        id={collapseId}
                                        className={
                                            i == 0
                                                ? "accordion-collapse collapse show"
                                                : "accordion-collapse collapse"
                                        }
                                        aria-labelledby={headingId}
                                        data-bs-parent={`#${id}`}
                                    >
                                        <div className="accordion-body">
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
                                                                this.props
                                                                    .generateHTML
                                                            }
                                                        />
                                                    )
                                                )}
                                            </dl>
                                        </div>
                                    </div>
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
                        <h3>{propertyName}</h3>
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
            a.group.position !== undefined &&
            typeof a.group.position == "number"
                ? a.group.position
                : maxPosition + 1;

        const bPosition =
            b.group.position !== undefined &&
            typeof b.group.position == "number"
                ? b.group.position
                : maxPosition + 1;

        return aPosition - bPosition;
    });

    return groupPropertiesArray;
}
