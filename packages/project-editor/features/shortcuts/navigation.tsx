import React from "react";
import { observable, computed, action } from "mobx";
import { observer } from "mobx-react";

import { guid } from "eez-studio-shared/guid";

import { VerticalHeaderWithBody, ToolbarHeader, Body } from "eez-studio-ui/header-with-body";

import { IShortcut } from "shortcuts/interfaces";
import { Shortcuts as ShortcutsComponent, ShortcutsToolbarButtons } from "shortcuts/shortcuts";

import { NavigationComponent } from "project-editor/core/object";
import { DocumentStore } from "project-editor/core/store";

import { ConfigurationReferencesPropertyValue } from "project-editor/components/ConfigurationReferencesPropertyValue";

import { ProjectStore } from "project-editor/project/project";

import { Shortcut } from "project-editor/features/shortcuts/shortcuts";

////////////////////////////////////////////////////////////////////////////////

@observer
export class ShortcutsNavigation extends NavigationComponent {
    @computed
    get object() {
        if (DocumentStore.Navigation.selectedPanel) {
            return DocumentStore.Navigation.selectedPanel.selectedObject;
        }
        return DocumentStore.Navigation.selectedObject;
    }

    @computed
    get shortcutsStore() {
        const shortcuts = ProjectStore.project.shortcuts.shortcuts;

        let shortcutsMap = new Map<string, Shortcut>();
        shortcuts.forEach(shortcut => shortcutsMap.set(shortcut.id, shortcut));

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
            <VerticalHeaderWithBody>
                <ToolbarHeader>
                    <ShortcutsToolbarButtons shortcutsStore={this.shortcutsStore} />
                </ToolbarHeader>
                <Body tabIndex={0}>
                    <ShortcutsComponent shortcutsStore={this.shortcutsStore} />
                </Body>
            </VerticalHeaderWithBody>
        );
    }
}
