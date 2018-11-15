import React from "react";
import { observable, computed, action } from "mobx";
import { observer } from "mobx-react";

import { VerticalHeaderWithBody, ToolbarHeader, Body } from "eez-studio-ui/header-with-body";

import { IShortcut } from "shortcuts/interfaces";
import { Shortcuts, ShortcutsToolbarButtons } from "shortcuts/shortcuts";

import { generateGuid } from "project-editor/core/util";
import { NavigationComponent } from "project-editor/core/metaData";
import {
    addObject,
    updateObject,
    deleteObject,
    NavigationStore,
    ProjectStore,
    getProperty
} from "project-editor/core/store";
import { ConfigurationReferencesPropertyValue } from "project-editor/components/PropertyGrid";

import {
    ShortcutsProperties,
    ShortcutProperties
} from "project-editor/project/features/shortcuts/shortcuts";

////////////////////////////////////////////////////////////////////////////////

@observer
export class ShortcutsNavigation extends NavigationComponent {
    @computed
    get object() {
        if (NavigationStore.selectedPanel) {
            return NavigationStore.selectedPanel.selectedObject;
        }
        return NavigationStore.selectedObject;
    }

    @computed
    get shortcutsStore() {
        const shortcuts = (getProperty(
            ProjectStore.projectProperties,
            "shortcuts"
        ) as ShortcutsProperties).shortcuts;

        let shortcutsMap = new Map<string, ShortcutProperties>();
        shortcuts.forEach(shortcut => shortcutsMap.set(shortcut.id, shortcut));

        return {
            shortcuts: observable.map(shortcutsMap),

            addShortcut(shortcut: Partial<IShortcut>) {
                shortcut.id = generateGuid();
                addObject(shortcuts, shortcut as any);
                return shortcut.id;
            },

            updateShortcut(shortcut: Partial<IShortcut>): void {
                let shortcutObject = shortcutsMap.get(shortcut.id!);
                if (shortcutObject) {
                    updateObject(shortcutObject, shortcut);
                }
            },

            deleteShortcut(shortcut: Partial<IShortcut>): void {
                let shortcutObject = shortcutsMap.get(shortcut.id!);
                if (shortcutObject) {
                    deleteObject(shortcutObject);
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
                    <Shortcuts shortcutsStore={this.shortcutsStore} />
                </Body>
            </VerticalHeaderWithBody>
        );
    }
}
