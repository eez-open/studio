import { IToolbarButton, IToolboxGroup } from "shared/ui/designer/designer-interfaces";
import { IActivityLogEntry } from "shared/activity-log";

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

export interface IExtension {
    id: string;
    preInstalled: boolean;
    type?: string;
    name: string;
    description?: string;
    version: string;
    author: string;
    image: string;
    init?: () => void;
    destroy?: () => void;
    toolbarButtons?: IToolbarButton[];
    toolboxGroups?: IToolboxGroup[];
    objectTypes?: {
        [type: string]: (oid: string) => IObject | undefined;
    };
    loadExtension?: (extensionFolderPath: string) => Promise<IExtension>;
    renderPropertiesComponent?: () => Promise<JSX.Element>;
    properties: IExtensionProperties;
    isEditable?: boolean;
    isDirty?: boolean;
}
