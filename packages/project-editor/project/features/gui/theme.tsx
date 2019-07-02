import React from "react";
import { observable, computed, action } from "mobx";
import { observer } from "mobx-react";

import { guid } from "eez-studio-shared/guid";
import {
    getProperty,
    ClassInfo,
    EezObject,
    EezArrayObject,
    registerClass,
    PropertyType,
    asArray,
    getObjectFromObjectId
} from "project-editor/model/object";
import { NavigationStore, DocumentStore, UndoManager } from "project-editor/model/store";
import { validators } from "eez-studio-shared/validation";
import { replaceObjectReference } from "project-editor/model/search";

import { showGenericDialog } from "eez-studio-ui/generic-dialog";
import styled from "eez-studio-ui/styled-components";
import { Splitter } from "eez-studio-ui/splitter";

import { ListNavigation } from "project-editor/project/ui/ListNavigation";

import { ProjectStore } from "project-editor/core/store";
import { Gui } from "project-editor/project/features/gui/gui";

////////////////////////////////////////////////////////////////////////////////

const ColorItemSpan = styled.span`
    width: calc(100% - 20px);

    & > span {
        display: flex;
        flex-direction: row;
        justify-content: space-between;

        & > label {
            cursor: pointer;
            width: 30px;
            height: 15px;
            margin: 3px 10px;
        }
    }
`;

@observer
class ColorItem extends React.Component<{
    itemId: string;
}> {
    @computed
    get colorObject() {
        return getObjectFromObjectId(ProjectStore.project, this.props.itemId) as Color;
    }

    @computed
    get colorIndex() {
        return (this.colorObject._parent! as EezArrayObject<Color>)._array.indexOf(
            this.colorObject
        );
    }

    @computed
    get selectedTheme() {
        const gui = getProperty(ProjectStore.project, "gui") as Gui;

        let selectedTheme = NavigationStore.getNavigationSelectedItem(gui.themes) as Theme;
        if (!selectedTheme) {
            selectedTheme = gui.themes._array[0];
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
        this.onChangeTimeout = setTimeout(action(() => {
            const colors = this.selectedTheme.colors.slice();
            colors[this.colorIndex] = this.changedThemeColor!;
            this.changedThemeColor = undefined;
            DocumentStore.updateObject(this.selectedTheme, {
                colors
            });
        }), 100)
    });

    render() {
        return (
            <ColorItemSpan className="tree-row-label">
                <span>
                    <span>{this.colorObject.name}</span>
                    <label
                        className="form-control"
                        style={{ backgroundColor: this.themeColor }}
                        tabIndex={0}
                    >
                        <input
                            type="color"
                            hidden
                            value={this.changedThemeColor !== undefined ? this.changedThemeColor : this.themeColor}
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
export class ThemesSideView extends React.Component {
    onEditThemeName = (itemId: string) => {
        const theme = getObjectFromObjectId(ProjectStore.project, itemId) as Theme;

        showGenericDialog({
            dialogDefinition: {
                fields: [
                    {
                        name: "name",
                        type: "string",
                        validators: [
                            validators.required,
                            validators.unique(theme, asArray(theme._parent!))
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
        const color = getObjectFromObjectId(ProjectStore.project, itemId) as Color;

        showGenericDialog({
            dialogDefinition: {
                fields: [
                    {
                        name: "name",
                        type: "string",
                        validators: [
                            validators.required,
                            validators.unique(color, asArray(color._parent!))
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
        const gui = getProperty(ProjectStore.project, "gui") as Gui;
        return (
            <Splitter
                type="vertical"
                persistId={`project-editor/themes`}
                sizes={`240px|100%`}
                childrenOverflow="hidden"
            >
                <ListNavigation
                    id="themes"
                    navigationObject={gui.themes}
                    onEditItem={this.onEditThemeName}
                />
                <ListNavigation
                    id="theme-colors"
                    navigationObject={gui.colors}
                    onEditItem={this.onEditColorName}
                    renderItem={renderColorItem}
                />
            </Splitter>
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
        const gui = this._parent!._parent as Gui;
        return gui.colors._array.map(color => gui.getThemeColor(this.id, color.id));
    }

    set colors(value: string[]) {
        const gui = this._parent!._parent as Gui;
        for (let i = 0; i < value.length; i++) {
            gui.setThemeColor(this.id, gui.colors._array[i].id, value[i]);
        }
    }
}

registerClass(Theme);

////////////////////////////////////////////////////////////////////////////////

export function getThemedColor(colorValue: string): string {
    if (colorValue.startsWith("#")) {
        return colorValue;
    }

    const gui = getProperty(ProjectStore.project, "gui") as Gui;

    let selectedTheme = NavigationStore.getNavigationSelectedItem(gui.themes) as Theme;
    if (!selectedTheme) {
        selectedTheme = gui.themes._array[0];
    }
    if (!selectedTheme) {
        return colorValue;
    }

    let index = gui.colors._array.findIndex(value => value.name === colorValue);
    if (index === -1) {
        return colorValue;
    }

    let color = selectedTheme.colors[index];
    if (color) {
        return color;
    }

    return colorValue;
}
