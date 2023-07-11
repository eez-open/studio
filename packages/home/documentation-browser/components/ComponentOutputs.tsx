import React, { Fragment } from "react";
import { observer } from "mobx-react";
import { ProjectType } from "project-editor/core/object";
import type { Component } from "project-editor/flow/component";
import { getOutputDisplayName } from "project-editor/flow/helper";
import { ComponentInfo } from "../component-info";
import { BodySection } from "./BodySection";

export const ComponentOutputs = observer(
    class ComponentOutputs extends React.Component<{
        componentInfo: ComponentInfo;
        projectType: ProjectType;
        componentObject: Component;
        generateHTML: boolean;
    }> {
        render() {
            const { componentObject } = this.props;

            return (
                <BodySection title="outputs">
                    <dl>
                        {componentObject.getOutputs().map(output => {
                            const outputName = getOutputDisplayName(
                                componentObject,
                                output.name
                            );

                            let outputDescription;
                            if (output.isSequenceOutput) {
                                outputDescription = "SEQ";
                            } else {
                                outputDescription = `DATA(${output.type})`;
                            }
                            if (output.isOptionalOutput) {
                                outputDescription += ` | OPTIONAL`;
                            } else {
                                outputDescription += ` | MANDATORY`;
                            }

                            return (
                                <Fragment key={output.name}>
                                    <dt>
                                        {outputName}{" "}
                                        <span
                                            style={{
                                                fontWeight: "normal",
                                                fontStyle: "italic"
                                            }}
                                        >
                                            {outputDescription}
                                        </span>
                                    </dt>
                                    <dd>
                                        {this.props.componentInfo.renderOutputDescription(
                                            this.props.projectType,
                                            outputName,
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
