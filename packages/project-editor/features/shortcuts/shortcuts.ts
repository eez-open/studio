import { observable } from "mobx";

import {
    ClassInfo,
    registerClass,
    EezObject,
    PropertyType
} from "project-editor/core/object";
import { objectToJS } from "project-editor/core/serialization";

import { ExtensionDefinition } from "project-editor/features/extension-definitions/extension-definitions";

import { IActionType } from "shortcuts/interfaces";
import { metrics } from "project-editor/features/shortcuts/metrics";
import { ShortcutsNavigation } from "project-editor/features/shortcuts/navigation";
import { Project } from "project-editor/project/project";

////////////////////////////////////////////////////////////////////////////////

export class ShortcutAction extends EezObject {
    @observable type: IActionType;
    @observable data: string;

    static classInfo: ClassInfo = {
        label: (shortcutAction: ShortcutAction) => {
            return shortcutAction.data;
        },

        properties: [
            {
                name: "type",
                type: PropertyType.String
            },
            {
                name: "data",
                type: PropertyType.String
            }
        ]
    };
}

registerClass(ShortcutAction);

////////////////////////////////////////////////////////////////////////////////

export class Shortcut extends EezObject {
    id: string;
    @observable name: string;
    @observable usedIn?: string[];
    @observable action: ShortcutAction;
    @observable keybinding: string;
    groupName: string;
    @observable showInToolbar: boolean;
    @observable toolbarButtonPosition: number;
    @observable toolbarButtonColor: string;
    @observable requiresConfirmation: boolean;
    @observable selected: boolean;

    static classInfo: ClassInfo = {
        properties: [
            {
                name: "id",
                type: PropertyType.String,
                unique: true
            },
            {
                name: "name",
                type: PropertyType.String,
                unique: true
            },
            {
                name: "usedIn",
                type: PropertyType.ConfigurationReference,
                referencedObjectCollectionPath: "settings/build/configurations"
            },
            {
                name: "action",
                type: PropertyType.Object,
                typeClass: ShortcutAction,
                readOnlyInPropertyGrid: true
            },
            {
                name: "keybinding",
                type: PropertyType.String
            },
            {
                name: "showInToolbar",
                type: PropertyType.Boolean
            },
            {
                name: "toolbarButtonPosition",
                type: PropertyType.Number
            },
            {
                name: "toolbarButtonColor",
                type: PropertyType.String
            },
            {
                name: "requiresConfirmation",
                type: PropertyType.Boolean
            }
        ]
    };
}

registerClass(Shortcut);

////////////////////////////////////////////////////////////////////////////////

export class Shortcuts extends EezObject {
    @observable shortcuts: Shortcut[];

    static classInfo: ClassInfo = {
        label: () => "Shortcuts",
        properties: [
            {
                name: "shortcuts",
                type: PropertyType.Array,
                typeClass: Shortcut,
                hideInPropertyGrid: true
            }
        ],
        navigationComponent: ShortcutsNavigation,
        hideInProperties: true,
        navigationComponentId: "shortcuts",
        icon: "playlist_play"
    };
}

registerClass(Shortcuts);

////////////////////////////////////////////////////////////////////////////////

export default {
    name: "eezstudio-project-feature-shortcuts",
    version: "0.1.0",
    description:
        "This feature adds support for shortcut definitions into your project",
    author: "EEZ",
    authorLogo: "../eez-studio-ui/_images/eez_logo.png",
    eezStudioExtension: {
        displayName: "Shortcuts",
        category: "project-feature",
        implementation: {
            projectFeature: {
                mandatory: false,
                key: "shortcuts",
                type: PropertyType.Object,
                typeClass: Shortcuts,
                icon: "playlist_play",
                create: () => {
                    return {
                        shortcuts: []
                    };
                },
                metrics: metrics,
                collectExtensionDefinitions: (
                    project: Project,
                    extensionDefinition: ExtensionDefinition,
                    properties: any
                ) => {
                    let shortcuts = project.shortcuts;
                    properties.shortcuts = objectToJS(
                        shortcuts.shortcuts.filter(
                            shortcut =>
                                !shortcut.usedIn ||
                                shortcut.usedIn.indexOf(
                                    extensionDefinition.buildConfiguration
                                ) != -1
                        )
                    ).map((shortcut: any) =>
                        Object.assign(shortcut, {
                            selected: undefined
                        })
                    );

                    // we don't need usedIn property in package.json
                    properties.shortcuts.forEach(
                        (shortcut: any) => delete shortcut.usedIn
                    );
                }
            }
        }
    }
};
