import React from "react";
import { observable, action, toJS, runInAction } from "mobx";
import { observer } from "mobx-react";

import {
    readJsObjectFromFile,
    writeJsObjectToFile
} from "eez-studio-shared/util-electron";
import { getExtensionFolderPath } from "eez-studio-shared/extensions/extension-folder";

import { PropertyList } from "eez-studio-ui/properties";
import { CodeEditorProperty } from "eez-studio-ui/code-editor";
import * as notification from "eez-studio-ui/notification";

import type {
    IExtension,
    IExtensionProperties
} from "eez-studio-shared/extensions/extension";
import type { IInstrumentExtensionProperties } from "instrument/instrument-extension";
import {
    ExtensionChangeEvent,
    notifySource
} from "eez-studio-shared/extensions/extensions";
import { sendMessage } from "eez-studio-shared/notify";

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
    componentDidUpdate(prevProps: any) {
        if (this.props != prevProps) {
            this.value = this.getValue(this.props);
        }
    }

    onBlur = () => {
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
    };

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

async function changeExtensionProperties(
    extension: IExtension,
    properties: IExtensionProperties
) {
    let extensionFolderPath = getExtensionFolderPath(extension.id);

    let packageJsonFilePath = extensionFolderPath + "/package.json";

    try {
        let packageJs = await readJsObjectFromFile(packageJsonFilePath);
        packageJs["eez-studio"] = properties;
        await writeJsObjectToFile(packageJsonFilePath, packageJs);
    } catch (err) {
        notification.error(err);
        return;
    }

    runInAction(() => {
        extension.properties = properties;
        extension.isDirty = true;
    });

    let extensionChange: ExtensionChangeEvent = {
        id: extension.id,
        properties: properties
    };
    sendMessage(notifySource, extensionChange);
}
