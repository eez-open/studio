import { observable } from "mobx";

import { registerMetaData, EezObject, EezArrayObject } from "project-editor/core/metaData";
import { registerFeatureImplementation } from "project-editor/core/extensions";
import { objectToJS, getProperty } from "project-editor/core/store";

import { ExtensionDefinitionProperties } from "project-editor/project/features/extension-definitions/extension-definitions";

import { IActionType } from "shortcuts/interfaces";
import { metrics } from "project-editor/project/features/shortcuts/metrics";
import { ShortcutsNavigation } from "project-editor/project/features/shortcuts/navigation";

////////////////////////////////////////////////////////////////////////////////

export class ShortcutActionProperties extends EezObject {
    @observable type: IActionType;
    @observable data: string;
}

export const shortcutActionMetaData = registerMetaData({
    getClass: function(jsObject: any) {
        return ShortcutActionProperties;
    },
    className: "ShortcutAction",

    label: (shortcutAction: ShortcutActionProperties) => {
        return shortcutAction.data;
    },

    properties: () => [
        {
            name: "type",
            type: "string"
        },
        {
            name: "data",
            type: "string"
        }
    ]
});

////////////////////////////////////////////////////////////////////////////////

export class ShortcutProperties extends EezObject {
    id: string;
    @observable name: string;
    @observable usedIn: string[] | undefined;
    @observable action: ShortcutActionProperties;
    @observable keybinding: string;
    groupName: string;
    @observable showInToolbar: boolean;
    @observable toolbarButtonPosition: number;
    @observable toolbarButtonColor: string;
    @observable requiresConfirmation: boolean;
    @observable selected: boolean;
}

export const shortcutMetaData = registerMetaData({
    getClass: function(jsObject: any) {
        return ShortcutProperties;
    },
    className: "Shortcut",
    label: (object: EezObject) => (object as ShortcutProperties).name,
    properties: () => [
        {
            name: "id",
            type: "string",
            unique: true
        },
        {
            name: "name",
            type: "string",
            unique: true
        },
        {
            name: "usedIn",
            type: "configuration-references"
        },
        {
            name: "action",
            type: "object",
            typeMetaData: shortcutActionMetaData
        },
        {
            name: "keybinding",
            type: "string"
        },
        {
            name: "showInToolbar",
            type: "boolean"
        },
        {
            name: "toolbarButtonPosition",
            type: "number"
        },
        {
            name: "toolbarButtonColor",
            type: "string"
        },
        {
            name: "requiresConfirmation",
            type: "boolean"
        }
    ]
});

////////////////////////////////////////////////////////////////////////////////

export class ShortcutsProperties extends EezObject {
    @observable shortcuts: EezArrayObject<ShortcutProperties>;
}

export const shortcutsMetaData = registerMetaData({
    getClass: function(jsObject: any) {
        return ShortcutsProperties;
    },
    className: "Shortcuts",
    label: () => "Shortcuts",
    properties: () => [
        {
            name: "shortcuts",
            type: "array",
            typeMetaData: shortcutMetaData,
            hideInPropertyGrid: true
        }
    ],
    navigationComponent: ShortcutsNavigation,
    hideInProperties: true,
    navigationComponentId: "shortcuts",
    icon: "playlist_play"
});

////////////////////////////////////////////////////////////////////////////////

registerFeatureImplementation("shortcuts", {
    projectFeature: {
        mandatory: false,
        key: "shortcuts",
        type: "object",
        metaData: shortcutsMetaData,
        create: () => {
            return {
                shortcuts: []
            };
        },
        metrics: metrics,
        collectExtensionDefinitions: (
            project,
            extensionDefinition: ExtensionDefinitionProperties,
            properties
        ) => {
            let shortcuts = getProperty(project, "shortcuts") as ShortcutsProperties;
            properties.shortcuts = objectToJS(
                shortcuts.shortcuts._array.filter(
                    shortcut =>
                        !shortcut.usedIn ||
                        shortcut.usedIn.indexOf(extensionDefinition.buildConfiguration) != -1
                )
            ).map((shortcut: any) =>
                Object.assign(shortcut, {
                    selected: undefined
                })
            );

            // we don't need usedIn property in package.json
            properties.shortcuts.forEach((shortcut: any) => delete shortcut.usedIn);
        }
    }
});
