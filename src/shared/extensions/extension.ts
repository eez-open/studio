import { UNITS } from "shared/units";
import { IStore } from "shared/store";
import { IActivityLogEntry } from "shared/activity-log-interfaces";
import { IToolbarButton, IToolboxGroup } from "shared/ui/designer/designer-interfaces";

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

export interface IHomeSection {
    id: string;
    name?: string;
    title: string;
    icon: string;
    renderContent: () => JSX.Element;
    selectItem?: (itemId: string) => void;
}

export interface IActivityLogController {
    store: IStore;
    selection: IActivityLogEntry[];
}

interface IActivityLogTool1 {
    id: string;
    name?: string;
    title: string;
    icon: string;
    isEnabled: (controller: IActivityLogController) => boolean;
    handler: (controller: IActivityLogController) => void;
}

type IActivityLogTool2 = (controller: IActivityLogController) => JSX.Element | null;

type IActivityLogTool = IActivityLogTool1 | IActivityLogTool2;

export interface IMeasurementFunction {
    id: string;
    name: string;
    script: string;
}

export interface IChart {
    data: number[];
    samplingRate: number;
    xAxes: {
        unit: keyof typeof UNITS;
    };
    yAxes: {
        minValue?: number;
        maxValue?: number;
        unit: keyof typeof UNITS;
    };
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
    result: number | IChart | null;
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

    homeSections?: IHomeSection[];

    activityLogTools?: IActivityLogTool[];

    measurementFunctions?: IMeasurementFunction[];

    handleDragAndDropFile?(filePath: string): Promise<boolean>;
}

export type IExtension = IExtensionDescription & IExtensionDefinition;
