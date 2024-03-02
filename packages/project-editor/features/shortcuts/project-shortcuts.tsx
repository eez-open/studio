import React from "react";
import { observable, computed, action, makeObservable } from "mobx";
import { observer } from "mobx-react";

import { guid } from "eez-studio-shared/guid";

import {
    VerticalHeaderWithBody,
    ToolbarHeader,
    Body
} from "eez-studio-ui/header-with-body";

import type {
    IShortcut,
    IActionType,
    IShortcutsStore,
    IGroupsStore
} from "shortcuts/interfaces";
import {
    Shortcuts as ShortcutsComponent,
    ShortcutsToolbarButtons
} from "shortcuts/shortcuts";
import { ShortcutDialog } from "shortcuts/shortcut-dialog";

import type { Project } from "project-editor/project/project";

import {
    ClassInfo,
    registerClass,
    EezObject,
    PropertyType
} from "project-editor/core/object";
import { createObject, objectToJS } from "project-editor/store";

import { ConfigurationReferencesPropertyValue } from "project-editor/ui-components/ConfigurationReferencesPropertyValue";

import type { ExtensionDefinition } from "project-editor/features/extension-definitions/extension-definitions";

import { ProjectContext } from "project-editor/project/context";

import { EditorComponent } from "project-editor/project/ui/EditorComponent";
import { showDialog } from "eez-studio-ui/dialog";
import type { ProjectEditorFeature } from "project-editor/store/features";

////////////////////////////////////////////////////////////////////////////////

export const ShortcutsEditor = observer(
    class ShortcutsEditor extends EditorComponent {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        constructor(props: any) {
            super(props);

            makeObservable(this, {
                shortcutsStore: computed
            });
        }

        get shortcutsStore() {
            const shortcuts = this.context.project.shortcuts.shortcuts;

            let shortcutsMap = new Map<string, Shortcut>();
            shortcuts.forEach(shortcut =>
                shortcutsMap.set(shortcut.id, shortcut)
            );

            const projectStore = this.context;

            return {
                shortcuts: observable.map(shortcutsMap),

                addShortcut(shortcut: Partial<IShortcut>) {
                    shortcut.id = guid();
                    projectStore.addObject(
                        shortcuts,
                        createObject<Shortcut>(
                            projectStore,
                            shortcut as any,
                            Shortcut
                        )
                    );
                    return shortcut.id;
                },

                updateShortcut(shortcut: Partial<IShortcut>): void {
                    let shortcutObject = shortcutsMap.get(shortcut.id!);
                    if (shortcutObject) {
                        projectStore.updateObject(shortcutObject, shortcut);
                    }
                },

                deleteShortcut(shortcut: Partial<IShortcut>): void {
                    console.log("deleteShortcut", shortcut);
                    let shortcutObject = shortcutsMap.get(shortcut.id!);
                    if (shortcutObject) {
                        projectStore.deleteObject(shortcutObject);
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
                                        action(
                                            () => (shortcut.usedIn = value)
                                        )();
                                    }}
                                    readOnly={false}
                                />
                            </td>
                        </tr>
                    );
                },

                showShortcutDialog: (
                    shortcutsStore: IShortcutsStore,
                    groupsStore: IGroupsStore | undefined,
                    shortcut: Partial<IShortcut>,
                    callback: (shortcut: Partial<IShortcut>) => void,
                    codeError?: string,
                    codeErrorLineNumber?: number,
                    codeErrorColumnNumber?: number,
                    hideCodeEditor?: boolean
                ) => {
                    showDialog(
                        <ProjectContext.Provider value={projectStore}>
                            <ShortcutDialog
                                shortcutsStore={shortcutsStore}
                                groupsStore={groupsStore}
                                shortcut={shortcut}
                                callback={callback}
                                codeError={codeError}
                                codeErrorLineNumber={codeErrorLineNumber}
                                codeErrorColumnNumber={codeErrorColumnNumber}
                                hideCodeEditor={hideCodeEditor}
                            />
                        </ProjectContext.Provider>
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
                        <ShortcutsComponent
                            shortcutsStore={this.shortcutsStore}
                        />
                    </Body>
                </VerticalHeaderWithBody>
            );
        }
    }
);
////////////////////////////////////////////////////////////////////////////////

export class ShortcutAction extends EezObject {
    type: IActionType;
    data: string;

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

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            type: observable,
            data: observable
        });
    }
}

registerClass("ShortcutAction", ShortcutAction);

////////////////////////////////////////////////////////////////////////////////

export class Shortcut extends EezObject {
    id: string;
    name: string;
    usedIn?: string[];
    action: ShortcutAction;
    keybinding: string;
    groupName: string;
    showInToolbar: boolean;
    toolbarButtonPosition: number;
    toolbarButtonColor: string;
    requiresConfirmation: boolean;
    selected: boolean;

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

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            name: observable,
            usedIn: observable,
            action: observable,
            keybinding: observable,
            showInToolbar: observable,
            toolbarButtonPosition: observable,
            toolbarButtonColor: observable,
            requiresConfirmation: observable,
            selected: observable
        });
    }
}

registerClass("Shortcut", Shortcut);

////////////////////////////////////////////////////////////////////////////////

export class Shortcuts extends EezObject {
    shortcuts: Shortcut[];

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
        icon: "material:playlist_play"
    };

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            shortcuts: observable
        });
    }
}

registerClass("Shortcuts", Shortcuts);

////////////////////////////////////////////////////////////////////////////////

const feature: ProjectEditorFeature = {
    name: "eezstudio-project-feature-shortcuts",
    version: "0.1.0",
    description:
        "This feature adds support for shortcut definitions into your project",
    author: "EEZ",
    authorLogo: "../eez-studio-ui/_images/eez_logo.png",
    displayName: "Shortcuts",
    mandatory: false,
    key: "shortcuts",
    type: PropertyType.Object,
    typeClass: Shortcuts,
    icon: "material:playlist_play",
    create: () => {
        return {
            shortcuts: []
        };
    },
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
        properties.shortcuts.forEach((shortcut: any) => delete shortcut.usedIn);
    }
};

export default feature;
