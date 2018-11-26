import React from "react";
import styled from "eez-studio-ui/styled-components";

import { ProjectStore } from "project-editor/core/store";

////////////////////////////////////////////////////////////////////////////////

const ConfigurationReferencesPropertyValueDiv = styled.div`
    border: 1px solid #ced4da;
    border-radius: 0.25rem;
    padding: 0.375rem 0.75rem;
`;

const ConfigurationReferencesPropertyValueConfigurationsDiv = styled.div`
    padding-left: 1.25rem;
`;

export class ConfigurationReferencesPropertyValue extends React.Component<
    {
        value: string[] | undefined;
        onChange: (value: string[] | undefined) => void;
    },
    {}
> {
    render() {
        return (
            <ConfigurationReferencesPropertyValueDiv className="EezStudio_ProjectEditor_PropertyGrid">
                <div className="form-check">
                    <label>
                        <input
                            className="form-check-input"
                            type="radio"
                            value="all"
                            checked={!this.props.value}
                            onChange={() => this.props.onChange(undefined)}
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
                        />
                        Selected build configurations
                    </label>
                </div>
                {this.props.value && (
                    <ConfigurationReferencesPropertyValueConfigurationsDiv>
                        {ProjectStore.project.settings.build.configurations._array.map(
                            configuration => {
                                return (
                                    <div key={configuration.name} className="checkbox">
                                        <label>
                                            <input
                                                ref="input"
                                                type="checkbox"
                                                checked={
                                                    this.props.value!.indexOf(
                                                        configuration.name
                                                    ) !== -1
                                                }
                                                onChange={event => {
                                                    let value = this.props.value!.slice();
                                                    if (event.target.checked) {
                                                        value.push(configuration.name);
                                                    } else {
                                                        value.splice(
                                                            value.indexOf(configuration.name),
                                                            1
                                                        );
                                                    }
                                                    this.props.onChange(value);
                                                }}
                                            />
                                            {" " + configuration.name}
                                        </label>
                                    </div>
                                );
                            }
                        )}
                    </ConfigurationReferencesPropertyValueConfigurationsDiv>
                )}
            </ConfigurationReferencesPropertyValueDiv>
        );
    }
}
