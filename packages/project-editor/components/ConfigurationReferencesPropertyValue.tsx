import React from "react";

import { ProjectContext } from "project-editor/project/context";

////////////////////////////////////////////////////////////////////////////////

export class ConfigurationReferencesPropertyValue extends React.Component<{
    value: string[] | undefined;
    onChange: (value: string[] | undefined) => void;
    readOnly: boolean;
}> {
    static contextType = ProjectContext;
    declare context: React.ContextType<typeof ProjectContext>;

    render() {
        const { readOnly } = this.props;

        return (
            <div className="EezStudio_ConfigurationReferencesPropertyValue EezStudio_ProjectEditor_PropertyGrid">
                <div className="form-check">
                    <label>
                        <input
                            className="form-check-input"
                            type="radio"
                            value="all"
                            checked={!this.props.value}
                            onChange={() => this.props.onChange(undefined)}
                            readOnly={readOnly}
                        />
                        All build configurations
                    </label>
                </div>
                <div className="form-check">
                    <label>
                        <input
                            className="form-check-input"
                            type="radio"
                            value="selected"
                            checked={!!this.props.value}
                            onChange={() => this.props.onChange([])}
                            readOnly={readOnly}
                        />
                        Selected build configurations
                    </label>
                </div>
                {this.props.value && (
                    <div className="EezStudio_ConfigurationReferencesPropertyValueConfigurations">
                        {this.context.project.settings.build.configurations.map(
                            configuration => {
                                return (
                                    <div
                                        key={configuration.name}
                                        className="checkbox"
                                    >
                                        <label>
                                            <input
                                                type="checkbox"
                                                checked={
                                                    this.props.value!.indexOf(
                                                        configuration.name
                                                    ) !== -1
                                                }
                                                onChange={event => {
                                                    let value =
                                                        this.props.value!.slice();
                                                    if (event.target.checked) {
                                                        value.push(
                                                            configuration.name
                                                        );
                                                    } else {
                                                        value.splice(
                                                            value.indexOf(
                                                                configuration.name
                                                            ),
                                                            1
                                                        );
                                                    }
                                                    this.props.onChange(value);
                                                }}
                                                readOnly={readOnly}
                                            />
                                            {" " + configuration.name}
                                        </label>
                                    </div>
                                );
                            }
                        )}
                    </div>
                )}
            </div>
        );
    }
}
