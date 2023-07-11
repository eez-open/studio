import React, { Fragment } from "react";
import { observer } from "mobx-react";
import { ProjectType } from "project-editor/core/object";
import type { Component } from "project-editor/flow/component";
import { getInputDisplayName } from "project-editor/flow/helper";
import { ComponentInfo } from "../component-info";
import { BodySection } from "./BodySection";

export const ComponentInputs = observer(
    class ComponentInputs extends React.Component<{
        componentInfo: ComponentInfo;
        projectType: ProjectType;
        componentObject: Component;
        generateHTML: boolean;
    }> {
        render() {
            const { componentObject } = this.props;

            return (
                <BodySection title="Inputs">
                    <dl>
                        {componentObject.getInputs().map(input => {
                            const inputName = getInputDisplayName(
                                componentObject,
                                input.name
                            );

                            let inputDescription;
                            if (input.isSequenceInput) {
                                inputDescription = "SEQ";
                            } else {
                                inputDescription = `DATA(${input.type})`;
                            }
                            if (input.isOptionalInput) {
                                inputDescription += ` | OPTIONAL`;
                            } else {
                                inputDescription += ` | MANDATORY`;
                            }

                            return (
                                <Fragment key={input.name}>
                                    <dt>
                                        {inputName}{" "}
                                        <span
                                            style={{
                                                fontWeight: "normal",
                                                fontStyle: "italic"
                                            }}
                                        >
                                            {inputDescription}
                                        </span>
                                    </dt>
                                    <dd>
                                        {this.props.componentInfo.renderInputDescription(
                                            this.props.projectType,
                                            inputName,
                                            this.props.generateHTML
                                        )}
                                    </dd>
                                </Fragment>
                            );
                        })}
                    </dl>
                </BodySection>
            );
        }
    }
);
