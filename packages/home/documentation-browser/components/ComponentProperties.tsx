import React from "react";
import { observer } from "mobx-react";
import {
    ProjectType,
    PropertyInfo,
    TYPE_NAMES,
    getObjectPropertyDisplayName
} from "project-editor/core/object";
import { getCommonProperties } from "project-editor/store";
import type { Component } from "project-editor/flow/component";
import { getPropertyGroups } from "project-editor/ui-components/PropertyGrid/groups";
import { ComponentInfo } from "../component-info";
import { BodySection } from "./BodySection";
import { projectTypeToString } from "../helper";

export const ComponentProperties = observer(
    class ComponentProperties extends React.Component<{
        componentInfo: ComponentInfo;
        projectType: ProjectType;
        componentObject: Component;
        generateHTML: boolean;
    }> {
        render() {
            const { componentObject } = this.props;

            const properties = getCommonProperties([componentObject]);

            const groupPropertiesArray = getPropertyGroups(
                componentObject,
                properties
            );

            const id = `${projectTypeToString(
                this.props.projectType
            )}-component-properties-`;

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
                                                                this.props
                                                                    .componentInfo
                                                            }
                                                            projectType={
                                                                this.props
                                                                    .projectType
                                                            }
                                                            componentObject={
                                                                componentObject
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
        projectType: ProjectType;
        componentObject: Component;
        property: PropertyInfo;
        generateHTML: boolean;
    }> {
        render() {
            const { componentObject, property } = this.props;

            const propertyName = getObjectPropertyDisplayName(
                componentObject,
                property
            );

            let propertyDescription;
            if (property.expressionType) {
                propertyDescription = `EXPRESSSION(${property.expressionType})`;
            } else {
                propertyDescription = TYPE_NAMES[property.type];
            }

            return (
                <>
                    <dt>
                        {propertyName}{" "}
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
                            this.props.projectType,
                            propertyName,
                            this.props.generateHTML
                        )}
                    </dd>
                </>
            );
        }
    }
);
