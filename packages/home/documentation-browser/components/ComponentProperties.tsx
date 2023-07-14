import React from "react";
import { observer } from "mobx-react";
import { PropertyInfo, TYPE_NAMES } from "project-editor/core/object";
import { getPropertyGroups } from "project-editor/ui-components/PropertyGrid/groups";
import { ComponentInfo } from "../component-info";
import { BodySection } from "./BodySection";

export const ComponentProperties = observer(
    class ComponentProperties extends React.Component<{
        componentInfo: ComponentInfo;
        generateHTML: boolean;
    }> {
        render() {
            const { componentInfo } = this.props;

            const properties = [
                ...componentInfo.properties,
                ...componentInfo.common.parent.properties
            ];

            const groupPropertiesArray = getPropertyGroups(
                componentInfo.componentObject,
                properties.map(property => property.metaInfo)
            );

            const id = `component-properties-`;

            function getProperty(propertyInfo: PropertyInfo) {
                return componentInfo.properties.find(
                    property => property.metaInfo == propertyInfo
                )!;
            }

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
                                                            property={getProperty(
                                                                property
                                                            )}
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
        property: {
            name: string;
            metaInfo: PropertyInfo;
        };
        generateHTML: boolean;
    }> {
        render() {
            const { property } = this.props;

            const propertyName = property.name;

            let propertyDescription;
            if (property.metaInfo.expressionType) {
                propertyDescription = `EXPRESSSION(${property.metaInfo.expressionType})`;
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
