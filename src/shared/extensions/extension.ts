import { IToolbarButton, IToolboxGroup } from "shared/ui/designer/designer-interfaces";
import { IActivityLogEntry } from "shared/activity-log-interfaces";

import { IShortcut } from "shortcuts/interfaces";

export interface IActivityLogEntryInfo {
    name: string;
    content: JSX.Element | string;
}

export interface IEditor {
    onCreate(): void;
    onActivate(): void;
    onDeactivate(): void;
    onTerminate(): void;

    render(): JSX.Element;
}

export interface IObject {
    id: string;
    name: string;
    content: JSX.Element | null;
    activityLogEntryInfo(logEntry: IActivityLogEntry): IActivityLogEntryInfo | null;
    details: JSX.Element | null;
    isResizable: boolean;
    isEditable: boolean;
    getEditor?(): IEditor;
    getEditorWindowArgs?(): {
        url: string;
        args: any;
    };
    openEditor?(target: "tab" | "window" | "default"): void;
    afterDelete?(): void;
}

export interface IExtensionProperties {
    properties?: any;
    shortcuts?: IShortcut[];
}

export interface IMeasurementFunction {
    id: string;
    name: string;
    script: string;
}

export interface IMeasureTask {
    // x value of the first sample (at xStartIndex)
    xStartValue: number;

    // no. of samples per second
    xSamplingRate: number;

    // index of the first sample to use for measurement
    xStartIndex: number;
    // total number of samples to use for measurement
    xNumSamples: number;

    getSampleValueAtIndex(index: number): number;

    // store measurement result to this property
    result: number;
}

export interface IExtensionDescription {
    id: string;
    name: string;
    displayName?: string;
    version: string;
    author: string;
    description?: string;
    image?: string;
    download?: string;
    installationFolderPath?: string;
}

export interface IExtensionDefinition {
    preInstalled?: boolean;

    type?: string;

    init?: () => void;
    destroy?: () => void;

    toolbarButtons?: IToolbarButton[];
    toolboxGroups?: IToolboxGroup[];
    objectTypes?: {
        [type: string]: (oid: string) => IObject | undefined;
    };
    loadExtension?: (extensionFolderPath: string) => Promise<IExtension>;
    renderPropertiesComponent?: () => Promise<JSX.Element>;
    properties?: IExtensionProperties;
    isEditable?: boolean;
    isDirty?: boolean;

    measurementFunctions?: IMeasurementFunction[];
}

export type IExtension = IExtensionDescription & IExtensionDefinition;
