import React from "react";
import { observable, computed, action } from "mobx";
import { observer } from "mobx-react";

import { guid } from "eez-studio-shared/guid";

import {
    VerticalHeaderWithBody,
    ToolbarHeader,
    Body
} from "eez-studio-ui/header-with-body";

import type { IShortcut, IActionType } from "shortcuts/interfaces";
import {
    Shortcuts as ShortcutsComponent,
    ShortcutsToolbarButtons
} from "shortcuts/shortcuts";

import type { Project } from "project-editor/project/project";

import {
    ClassInfo,
    registerClass,
    EezObject,
    PropertyType
} from "project-editor/core/object";
import { objectToJS } from "project-editor/core/store";

import { ConfigurationReferencesPropertyValue } from "project-editor/components/ConfigurationReferencesPropertyValue";

import type { ExtensionDefinition } from "project-editor/features/extension-definitions/extension-definitions";

import { ProjectContext } from "project-editor/project/context";

import { metrics } from "project-editor/features/shortcuts/metrics";
import { EditorComponent } from "project-editor/project/EditorComponent";

////////////////////////////////////////////////////////////////////////////////

@observer
export class ShortcutsEditor extends EditorComponent {
    static contextType = ProjectContext;
    declare context: React.ContextType<typeof ProjectContext>;

    @computed
    get shortcutsStore() {
        const shortcuts = this.context.project.shortcuts.shortcuts;

        let shortcutsMap = new Map<string, Shortcut>();
        shortcuts.forEach(shortcut => shortcutsMap.set(shortcut.id, shortcut));

        const DocumentStore = this.context;

        return {
            shortcuts: observable.map(shortcutsMap),

            addShortcut(shortcut: Partial<IShortcut>) {
                shortcut.id = guid();
                DocumentStore.addObject(shortcuts, shortcut as any);
                return shortcut.id;
            },

            updateShortcut(shortcut: Partial<IShortcut>): void {
                let shortcutObject = shortcutsMap.get(shortcut.id!);
                if (shortcutObject) {
                    DocumentStore.updateObject(shortcutObject, shortcut);
                }
            },

            deleteShortcut(shortcut: Partial<IShortcut>): void {
                let shortcutObject = shortcutsMap.get(shortcut.id!);
                if (shortcutObject) {
                    DocumentStore.deleteObject(shortcutObject);
                }
            },

            renderUsedInProperty(shortcut: Partial<IShortcut>) {
                return (
                    <tr>
                        <td>Used in</td>
                        <td>
                            <ConfigurationReferencesPropertyValue
                                value={shortcut.usedIn}
                                onChange={value => {
                                    action(() => (shortcut.usedIn = value))();
                                }}
                                readOnly={false}
                            />
                        </td>
                    </tr>
                );
            }
        };
    }

    render() {
        return (
            <VerticalHeaderWithBody className="EezStudio_ProjectEditor_Shortcuts">
                <ToolbarHeader>
                    <ShortcutsToolbarButtons
                        shortcutsStore={this.shortcutsStore}
                    />
                </ToolbarHeader>
                <Body tabIndex={0}>
                    <ShortcutsComponent shortcutsStore={this.shortcutsStore} />
                </Body>
            </VerticalHeaderWithBody>
        );
    }
}

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

registerClass("ShortcutAction", ShortcutAction);

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

registerClass("Shortcut", Shortcut);

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
        hideInProperties: true,
        icon: "playlist_play"
    };
}

registerClass("Shortcuts", Shortcuts);

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
