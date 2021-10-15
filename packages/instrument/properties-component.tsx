import React from "react";
import { observable, action, toJS } from "mobx";
import { observer } from "mobx-react";
import { bind } from "bind-decorator";

import { changeExtensionProperties } from "eez-studio-shared/extensions/extensions";
import { PropertyList } from "eez-studio-ui/properties";
import { CodeEditorProperty } from "eez-studio-ui/code-editor";

import type { IExtension } from "eez-studio-shared/extensions/extension";
import type { IInstrumentExtensionProperties } from "instrument/instrument-extension";

interface PropertiesComponentProps {
    extension: IExtension;
}

@observer
export class PropertiesComponent extends React.Component<
    PropertiesComponentProps,
    {}
> {
    @observable value: string = this.getValue();
    @observable errors: string[] | undefined;

    getValue(props?: PropertiesComponentProps) {
        props = props || this.props;
        return JSON.stringify(
            (props.extension.properties as IInstrumentExtensionProperties)
                .properties,
            undefined,
            2
        );
    }

    @action.bound
    onChange(value: string) {
        this.value = value;

        try {
            JSON.parse(value);
        } catch (error) {
            this.errors = [error.toString()];
            return;
        }

        this.errors = undefined;
    }

    @action
    UNSAFE_componentWillReceiveProps(props: PropertiesComponentProps) {
        this.value = this.getValue(props);
    }

    @bind
    onBlur() {
        if (
            this.props.extension.isEditable &&
            !this.errors &&
            this.value !== this.getValue()
        ) {
            const properties = Object.assign(
                {},
                toJS(this.props.extension.properties)
            );
            properties.properties = JSON.parse(this.value);
            changeExtensionProperties(
                this.props.extension,
                Object.assign(
                    {},
                    toJS(this.props.extension.properties),
                    properties
                )
            );
        }
    }

    render() {
        return (
            <PropertyList>
                <CodeEditorProperty
                    mode="json"
                    value={this.value}
                    onChange={this.onChange}
                    onBlur={this.onBlur}
                    readOnly={!this.props.extension.isEditable}
                    errors={this.errors}
                    height={480}
                />
            </PropertyList>
        );
    }
}

export function renderPropertiesComponent(extension: IExtension) {
    return <PropertiesComponent extension={extension} />;
}
