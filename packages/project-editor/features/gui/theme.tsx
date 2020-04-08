import React from "react";
import { observable, computed, action } from "mobx";
import { observer } from "mobx-react";

import { guid } from "eez-studio-shared/guid";
import {
    getProperty,
    ClassInfo,
    EezObject,
    registerClass,
    PropertyType,
    asArray,
    getObjectFromObjectId,
    getParent
} from "project-editor/core/object";
import {
    NavigationStore,
    INavigationStore,
    SimpleNavigationStoreClass,
    DocumentStore,
    UndoManager,
    IContextMenuContext
} from "project-editor/core/store";
import { validators } from "eez-studio-shared/validation";
import { replaceObjectReference } from "project-editor/core/search";

import { showGenericDialog } from "eez-studio-ui/generic-dialog";
import styled from "eez-studio-ui/styled-components";
import { Splitter } from "eez-studio-ui/splitter";

import { ListNavigation } from "project-editor/components/ListNavigation";

import { ProjectStore } from "project-editor/core/store";
import { DragAndDropManagerClass } from "project-editor/core/dd";
import { Gui } from "project-editor/features/gui/gui";

const { MenuItem } = EEZStudio.electron.remote;

////////////////////////////////////////////////////////////////////////////////

const navigationStore = computed(() => {
    return ProjectStore.masterProject ? new SimpleNavigationStoreClass(undefined) : NavigationStore;
});

////////////////////////////////////////////////////////////////////////////////

const ColorItemSpan = styled.span`
    width: calc(100% - 20px);

    & > span {
        display: flex;
        flex-direction: row;
        justify-content: space-between;

        & > span {
            flex-grow: 1;
            flex-shrink: 1;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        & > label {
            cursor: pointer;
            flex-grow: 0;
            flex-shrink: 0;
            width: 30px;
            height: 15px;
            margin: 3px 0 3px 5px;
        }
    }
`;

@observer
class ColorItem extends React.Component<{
    itemId: string;
}> {
    @computed
    get colorObject() {
        return getObjectFromObjectId(
            ProjectStore.masterProject || ProjectStore.project,
            this.props.itemId
        ) as Color;
    }

    @computed
    get colorIndex() {
        return asArray(getParent(this.colorObject)).indexOf(this.colorObject);
    }

    @computed
    get selectedTheme() {
        const gui = getProperty(ProjectStore.masterProject || ProjectStore.project, "gui") as Gui;

        let selectedTheme = navigationStore.get().getNavigationSelectedItem(gui.themes) as Theme;
        if (!selectedTheme) {
            selectedTheme = asArray(gui.themes)[0];
        }

        return selectedTheme!;
    }

    @computed
    get themeColor() {
        return this.selectedTheme.colors[this.colorIndex];
    }

    @observable
    changedThemeColor: string | undefined;

    onChangeTimeout: any;

    onChange = action((event: React.ChangeEvent<HTMLInputElement>) => {
        this.changedThemeColor = event.target.value;
        if (this.onChangeTimeout) {
            clearTimeout(this.onChangeTimeout);
        }
        this.onChangeTimeout = setTimeout(
            action(() => {
                const colors = this.selectedTheme.colors.slice();
                colors[this.colorIndex] = this.changedThemeColor!;
                this.changedThemeColor = undefined;
                DocumentStore.updateObject(this.selectedTheme, {
                    colors
                });
            }),
            100
        );
    });

    render() {
        return (
            <ColorItemSpan className="tree-row-label">
                <span>
                    <span title={this.colorObject.name}>{this.colorObject.name}</span>
                    <label
                        className="form-control"
                        style={{ backgroundColor: this.themeColor }}
                        tabIndex={0}
                    >
                        <input
                            type="color"
                            hidden
                            value={
                                this.changedThemeColor !== undefined
                                    ? this.changedThemeColor
                                    : this.themeColor
                            }
                            onChange={this.onChange}
                            tabIndex={0}
                        />
                    </label>
                </span>
            </ColorItemSpan>
        );
    }
}

function renderColorItem(itemId: string) {
    return <ColorItem itemId={itemId} />;
}

@observer
export class ThemesSideView extends React.Component<{
    navigationStore?: INavigationStore;
    dragAndDropManager?: DragAndDropManagerClass;
}> {
    onEditThemeName = (itemId: string) => {
        const theme = getObjectFromObjectId(
            ProjectStore.masterProject || ProjectStore.project,
            itemId
        ) as Theme;

        showGenericDialog({
            dialogDefinition: {
                fields: [
                    {
                        name: "name",
                        type: "string",
                        validators: [
                            validators.required,
                            validators.unique(theme, asArray(getParent(theme)))
                        ]
                    }
                ]
            },
            values: theme
        })
            .then(result => {
                let newValue = result.values.name.trim();
                if (newValue != theme.name) {
                    UndoManager.setCombineCommands(true);
                    replaceObjectReference(theme, newValue);
                    DocumentStore.updateObject(theme, {
                        name: newValue
                    });
                    UndoManager.setCombineCommands(false);
                }
            })
            .catch(error => {
                if (error !== undefined) {
                    console.error(error);
                }
            });
    };

    onEditColorName = (itemId: string) => {
        const color = getObjectFromObjectId(
            ProjectStore.masterProject || ProjectStore.project,
            itemId
        ) as Color;

        showGenericDialog({
            dialogDefinition: {
                fields: [
                    {
                        name: "name",
                        type: "string",
                        validators: [
                            validators.required,
                            validators.unique(color, asArray(getParent(color)))
                        ]
                    }
                ]
            },
            values: color
        })
            .then(result => {
                let newValue = result.values.name.trim();
                if (newValue != color.name) {
                    UndoManager.setCombineCommands(true);
                    replaceObjectReference(color, newValue);
                    DocumentStore.updateObject(color, {
                        name: newValue
                    });
                    UndoManager.setCombineCommands(false);
                }
            })
            .catch(error => {
                if (error !== undefined) {
                    console.error(error);
                }
            });
    };

    render() {
        if (ProjectStore.masterProjectEnabled && !ProjectStore.masterProject) {
            return null;
        }

        const gui = getProperty(ProjectStore.masterProject || ProjectStore.project, "gui") as Gui;

        const themes = (
            <ListNavigation
                id="themes"
                navigationObject={gui.themes}
                onEditItem={this.onEditThemeName}
                searchInput={false}
                editable={!ProjectStore.masterProject}
                navigationStore={navigationStore.get()}
            />
        );

        let colors;
        if (!ProjectStore.masterProject) {
            colors = (
                <ListNavigation
                    id="theme-colors"
                    navigationObject={gui.colors}
                    onEditItem={this.onEditColorName}
                    renderItem={renderColorItem}
                    navigationStore={this.props.navigationStore}
                    dragAndDropManager={this.props.dragAndDropManager}
                />
            );

            if (this.props.navigationStore) {
                return colors;
            }
        }

        return colors ? (
            <Splitter
                type="vertical"
                persistId={`project-editor/themes`}
                sizes={`240px|100%`}
                childrenOverflow="hidden"
            >
                {themes}
                {colors}
            </Splitter>
        ) : (
            themes
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

export class Color extends EezObject {
    @observable id: string;
    @observable name: string;

    static classInfo: ClassInfo = {
        properties: [
            {
                name: "id",
                type: PropertyType.String,
                unique: true,
                hideInPropertyGrid: true
            },
            {
                name: "name",
                displayName: "Color name",
                type: PropertyType.String,
                unique: true
            }
        ],
        newItem: (parent: EezObject) => {
            return showGenericDialog({
                dialogDefinition: {
                    title: "New Color",
                    fields: [
                        {
                            name: "name",
                            type: "string",
                            validators: [
                                validators.required,
                                validators.unique({}, asArray(parent))
                            ]
                        }
                    ]
                },
                values: {}
            }).then(result => {
                return Promise.resolve({
                    id: guid(),
                    name: result.values.name
                });
            });
        }
    };

    extendContextMenu(
        context: IContextMenuContext,
        objects: EezObject[],
        menuItems: Electron.MenuItem[]
    ) {
        var additionalMenuItems: Electron.MenuItem[] = [];

        additionalMenuItems.push(
            new MenuItem({
                label: "Copy to other themes",
                click: () => {
                    UndoManager.setCombineCommands(true);

                    const gui = getProperty(
                        ProjectStore.masterProject || ProjectStore.project,
                        "gui"
                    ) as Gui;

                    const selectedTheme = navigationStore
                        .get()
                        .getNavigationSelectedItem(gui.themes) as Theme;

                    const colorIndex = asArray(gui.colors).indexOf(this);
                    const color = gui.getThemeColor(selectedTheme.id, this.id);

                    asArray(gui.themes).forEach((theme: any, i: number) => {
                        if (theme != selectedTheme) {
                            const colors = theme.colors.slice();
                            colors[colorIndex] = color;
                            DocumentStore.updateObject(theme, {
                                colors
                            });
                        }
                    });

                    UndoManager.setCombineCommands(false);
                }
            })
        );

        additionalMenuItems.push(
            new MenuItem({
                type: "separator"
            })
        );

        menuItems.unshift(...additionalMenuItems);
    }
}

registerClass(Color);

////////////////////////////////////////////////////////////////////////////////

export class Theme extends EezObject {
    @observable id: string;
    @observable name: string;

    static classInfo: ClassInfo = {
        properties: [
            {
                name: "id",
                type: PropertyType.String,
                unique: true,
                hideInPropertyGrid: true
            },
            {
                name: "name",
                displayName: "Theme name",
                type: PropertyType.String,
                unique: true
            },
            {
                name: "colors",
                type: PropertyType.StringArray,
                hideInPropertyGrid: true
            }
        ],
        newItem: (parent: EezObject) => {
            return showGenericDialog({
                dialogDefinition: {
                    title: "New Theme",
                    fields: [
                        {
                            name: "name",
                            type: "string",
                            validators: [
                                validators.required,
                                validators.unique({}, asArray(parent))
                            ]
                        }
                    ]
                },
                values: {}
            }).then(result => {
                return Promise.resolve({
                    id: guid(),
                    name: result.values.name
                });
            });
        }
    };

    @computed get colors() {
        const gui = getParent(getParent(this)) as Gui;
        return gui.colors.map(color => gui.getThemeColor(this.id, color.id));
    }

    set colors(value: string[]) {
        const gui = getParent(getParent(this)) as Gui;
        for (let i = 0; i < value.length; i++) {
            gui.setThemeColor(this.id, asArray(gui.colors)[i].id, value[i]);
        }
    }
}

registerClass(Theme);

////////////////////////////////////////////////////////////////////////////////

function getThemedColorInGui(gui: Gui, colorValue: string): string | undefined {
    let selectedTheme = navigationStore.get().getNavigationSelectedItem(gui.themes) as Theme;
    if (!selectedTheme) {
        selectedTheme = asArray(gui.themes)[0];
    }
    if (!selectedTheme) {
        return colorValue;
    }

    let index = gui.colorsMap.get(colorValue);
    if (index === undefined) {
        return undefined;
    }

    let color = selectedTheme.colors[index];
    if (color) {
        return color;
    }

    return undefined;
}

export function getThemedColor(colorValue: string): string {
    if (colorValue.startsWith("#")) {
        return colorValue;
    }

    const gui = getProperty(ProjectStore.masterProject || ProjectStore.project, "gui") as Gui;
    let color = getThemedColorInGui(gui, colorValue);
    if (color) {
        return color;
    }

    return colorValue;
}
