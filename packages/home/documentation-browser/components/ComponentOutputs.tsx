import React, { Fragment } from "react";
import { observer } from "mobx-react";
import { ComponentInfo } from "../component-info";
import { BodySection } from "./BodySection";

export const ComponentOutputs = observer(
    class ComponentOutputs extends React.Component<{
        componentInfo: ComponentInfo;
        generateHTML: boolean;
    }> {
        render() {
            const { componentInfo } = this.props;

            return (
                <BodySection title="Outputs">
                    <dl>
                        {componentInfo.outputs.map(output => {
                            const outputName = output.name;

                            let outputDescription;
                            if (output.metaInfo.isSequenceOutput) {
                                outputDescription = "SEQ";
                            } else {
                                outputDescription = `DATA(${output.metaInfo.type})`;
                            }
                            if (output.metaInfo.isOptionalOutput) {
                                outputDescription += ` | OPTIONAL`;
                            } else {
                                outputDescription += ` | MANDATORY`;
                            }

                            return (
                                <Fragment key={output.name}>
                                    <dt>
                                        <h2>{outputName}</h2>
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
