import React, { Fragment } from "react";
import { observer } from "mobx-react";
import { ComponentInfo } from "../component-info";
import { BodySection } from "./BodySection";
import { ComponentInput } from "project-editor/flow/component";

export const ComponentInputs = observer(
    class ComponentInputs extends React.Component<{
        componentInfo: ComponentInfo;
        generateHTML: boolean;
    }> {
        render() {
            const { componentInfo } = this.props;

            return (
                <BodySection title="Inputs">
                    <dl>
                        {componentInfo.inputs
                            .filter(
                                input => !componentInfo.isEmptyInput(input.name)
                            )
                            .map(input => {
                                const inputName = input.name;

                                let inputDescription =
                                    getInputDescription(input);

                                return (
                                    <Fragment key={input.name}>
                                        <dt>
                                            <h3>{inputName}</h3>
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

export function getInputDescription(input: {
    name: string;
    metaInfo: ComponentInput;
}) {
    let inputDescription;

    if (input.metaInfo.isSequenceInput) {
        inputDescription = "SEQ";
    } else {
        inputDescription = `DATA(${input.metaInfo.type})`;
    }

    if (input.metaInfo.isOptionalInput) {
        inputDescription += ` | OPTIONAL`;
    } else {
        inputDescription += ` | MANDATORY`;
    }

    return inputDescription;
}
