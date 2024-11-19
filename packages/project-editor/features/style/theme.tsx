import { MenuItem } from "@electron/remote";
import React from "react";
import { observable, computed, action, makeObservable } from "mobx";
import { observer } from "mobx-react";
import * as FlexLayout from "flexlayout-react";

import { validators } from "eez-studio-shared/validation";

import { FlexLayoutContainer } from "eez-studio-ui/FlexLayout";

import {
    ClassInfo,
    IEezObject,
    EezObject,
    registerClass,
    PropertyType,
    getParent,
    IMessage
} from "project-editor/core/object";
import {
    ProjectStore,
    IContextMenuContext,
    getProjectStore,
    createObject
} from "project-editor/store";
import { replaceObjectReference } from "project-editor/core/search";

import {
    IFieldProperties,
    showGenericDialog
} from "eez-studio-ui/generic-dialog";

import { ListNavigation } from "project-editor/ui-components/ListNavigation";

import { ProjectContext } from "project-editor/project/context";
import { ProjectEditor } from "project-editor/project-editor-interface";

import type { Project } from "project-editor/project/project";
import { getName, NamingConvention } from "project-editor/build/helper";
import { generalGroup } from "project-editor/ui-components/PropertyGrid/groups";
import { isFirmwareProject } from "project-editor/project/project-type-traits";

////////////////////////////////////////////////////////////////////////////////

const ColorItem = observer(
    class ColorItem extends React.Component<{
        itemId: string;
        readOnly: boolean;
    }> {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        constructor(props: any) {
            super(props);

            makeObservable(this, {
                colorObject: computed,
                colorIndex: computed,
                selectedTheme: computed,
                themeColor: computed,
                changedThemeColor: observable
            });
        }

        get colorObject() {
            return this.context.getObjectFromObjectId(
                this.props.itemId
            ) as Color;
        }

        get colorIndex() {
            return (getParent(this.colorObject) as Color[]).indexOf(
                this.colorObject
            );
        }

        get selectedTheme() {
            const project = getProjectWithThemes(this.context);

            let selectedTheme =
                this.context.navigationStore?.selectedThemeObject.get() as Theme;

            if (!selectedTheme) {
                selectedTheme = project.themes[0];
            }

            return selectedTheme!;
        }

        get themeColor() {
            return this.selectedTheme.colors[this.colorIndex];
        }

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
                    this.context.updateObject(this.selectedTheme, {
                        colors
                    });
                }),
                100
            );
        });

        render() {
            return (
                <div className="EezStudio_ColorItem">
                    <input
                        type="color"
                        value={
                            this.changedThemeColor !== undefined
                                ? this.changedThemeColor
                                : this.themeColor
                        }
                        onChange={this.onChange}
                        tabIndex={0}
                        disabled={this.props.readOnly}
                    />
                    <span title={this.colorObject.name}>
                        {this.colorObject.name}
                    </span>
                </div>
            );
        }
    }
);

export const ThemesSideView = observer(
    class ThemesSideView extends React.Component {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        onEditThemeName = (itemId: string) => {
            const theme = this.context.getObjectFromObjectId(itemId) as Theme;

            showGenericDialog({
                dialogDefinition: {
                    fields: [
                        {
                            name: "name",
                            type: "string",
                            validators: [
                                validators.required,
                                validators.unique(theme, getParent(theme))
                            ]
                        }
                    ]
                },
                values: theme
            })
                .then(result => {
                    let newValue = result.values.name.trim();
                    if (newValue != theme.name) {
                        this.context.undoManager.setCombineCommands(true);
                        replaceObjectReference(theme, newValue);
                        this.context.updateObject(theme, {
                            name: newValue
                        });
                        this.context.undoManager.setCombineCommands(false);
                    }
                })
                .catch(error => {
                    if (error !== undefined) {
                        console.error(error);
                    }
                });
        };

        onEditColorName = (itemId: string) => {
            const color = this.context.getObjectFromObjectId(itemId) as Color;

            const fields: IFieldProperties[] = [];

            if (isFirmwareProject(color)) {
                fields.push({
                    name: "id",
                    type: "optional-integer",
                    validators: [
                        validators.unique(color, getParent(color)),
                        validators.rangeInclusive(0, 1000)
                    ]
                });
            }

            fields.push({
                name: "name",
                type: "string",
                validators: [
                    validators.required,
                    validators.unique(color, getParent(color))
                ]
            });

            showGenericDialog({
                dialogDefinition: {
                    fields
                },
                values: color
            })
                .then(result => {
                    this.context.undoManager.setCombineCommands(true);

                    this.context.updateObject(color, {
                        id: result.values.id
                    });

                    let newName = result.values.name.trim();
                    if (newName != color.name) {
                        replaceObjectReference(color, newName);
                        this.context.updateObject(color, {
                            name: newName
                        });
                    }

                    this.context.undoManager.setCombineCommands(false);
                })
                .catch(error => {
                    if (error !== undefined) {
                        console.error(error);
                    }
                });
        };

        constructor(props: any) {
            super(props);

            makeObservable(this, {
                project: computed
            });
        }

        get project() {
            if (
                this.context.masterProjectEnabled &&
                !this.context.masterProject
            ) {
                return null;
            }

            return getProjectWithThemes(this.context);
        }

        factory = (node: FlexLayout.TabNode) => {
            var component = node.getComponent();

            const readOnly =
                getProjectWithThemes(this.context) != this.context.project;

            if (component === "themes") {
                return this.project ? (
                    <ListNavigation
                        id="themes"
                        navigationObject={this.project.themes}
                        selectedObject={
                            this.context.navigationStore.selectedThemeObject
                        }
                        onEditItem={this.onEditThemeName}
                        searchInput={false}
                        editable={!readOnly}
                    />
                ) : null;
            }

            if (component === "colors") {
                return this.project ? (
                    <ListNavigation
                        id="theme-colors"
                        navigationObject={this.project.colors}
                        selectedObject={
                            this.context.navigationStore
                                .selectedThemeColorObject
                        }
                        onEditItem={this.onEditColorName}
                        renderItem={itemId => (
                            <ColorItem itemId={itemId} readOnly={readOnly} />
                        )}
                        editable={!readOnly}
                    />
                ) : null;
            }

            return null;
        };

        render() {
            return (
                <FlexLayoutContainer
                    model={this.context.layoutModels.themes}
                    factory={this.factory}
                />
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

export class Color extends EezObject {
    id: number | undefined;
    name: string;

    constructor() {
        super();

        makeObservable(this, {
            toJSON: computed
        });
    }

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            id: observable,
            name: observable
        });
    }

    get toJSON() {
        return {
            id: this.id,
            name: this.name,
            colorValues: this.colorValues
        };
    }

    static classInfo: ClassInfo = {
        properties: [
            {
                name: "colorId",
                type: PropertyType.String,
                unique: true,
                hideInPropertyGrid: true
            },
            {
                name: "id",
                type: PropertyType.Number,
                isOptional: true,
                unique: true,
                propertyGridGroup: generalGroup
            },
            {
                name: "name",
                displayName: "Color name",
                type: PropertyType.String,
                unique: true
            }
        ],
        icon: (
            <svg width={20} height={20} viewBox="0 0 20 20">
                <circle
                    cx={10.859}
                    cy={5.521}
                    r={1.5}
                    fill="var(--iconPrimary, #222)"
                />
                <circle
                    cx={6.859}
                    cy={7.521}
                    r={1.5}
                    fill="var(--iconPrimary, #222)"
                />
                <circle
                    cx={6.859}
                    cy={12.521}
                    r={1.5}
                    fill="var(--iconPrimary, #222)"
                />
                <circle
                    cx={10.859}
                    cy={14.521}
                    r={1.5}
                    fill="var(--iconPrimary, #222)"
                />
                <path
                    d="M11.003 18.771c-2.595-.018-4.935-.91-6.662-2.507-1.762-1.631-2.732-3.814-2.732-6.145s.97-4.514 2.732-6.144C6.192 2.257 8.683 1.27 11.17 1.27c2.157 0 4.143.737 5.594 2.074 1.048.97 1.626 2.27 1.626 3.659s-.578 2.69-1.625 3.66l-1.204 1.12c-.086.078-.188.206-.188.362s.102.284.188.364c.146.136.18.169.516.226.414.073.95.166 1.373.576l.001.001c.396.386.626.979.618 1.586-.008.59-.234 1.119-.636 1.49-1.625 1.513-3.97 2.382-6.431 2.382m.168-16c-2.114 0-4.233.84-5.81 2.304C3.907 6.42 3.108 8.211 3.108 10.12s.8 3.7 2.251 5.043c1.431 1.325 3.465 2.094 5.581 2.11 2.147 0 4.12-.723 5.473-1.983.133-.123.154-.31.156-.41.003-.223-.083-.41-.164-.49-.092-.088-.352-.134-.562-.17-.61-.106-.923-.254-1.306-.614-.428-.397-.664-.916-.664-1.46 0-.542.236-1.061.666-1.46l1.205-1.122c.74-.683 1.146-1.592 1.146-2.56s-.407-1.873-1.144-2.556c-1.172-1.08-2.797-1.675-4.576-1.675"
                    fill="var(--iconPrimary, #222)"
                />
            </svg>
        ),
        check: (color: Color, messages: IMessage[]) => {
            const projectStore = getProjectStore(color);

            ProjectEditor.checkAssetId(
                projectStore,
                "colors",
                color,
                messages,
                0,
                1000
            );
        },
        newItem: async (parent: IEezObject) => {
            const result = await showGenericDialog({
                dialogDefinition: {
                    title: "New Color",
                    fields: [
                        {
                            name: "name",
                            type: "string",
                            validators: [
                                validators.required,
                                validators.invalidCharacters("."),
                                validators.unique({}, parent),
                                function (object: any, ruleName: string) {
                                    const name = getName(
                                        "COLOR_ID_",
                                        object[ruleName],
                                        NamingConvention.UnderscoreUpperCase
                                    );

                                    const KEYWORDS = ["transparent"];

                                    for (let i = 0; i < KEYWORDS.length; i++) {
                                        if (
                                            name ==
                                            getName(
                                                "COLOR_ID_",
                                                KEYWORDS[i],
                                                NamingConvention.UnderscoreUpperCase
                                            )
                                        ) {
                                            return `Name "${KEYWORDS[i]}" is reserved.`;
                                        }
                                    }
                                    return null;
                                }
                            ]
                        }
                    ]
                },
                values: {}
            });

            const colorProperties: Partial<Color> = {
                name: result.values.name
            };

            const project = ProjectEditor.getProject(parent);

            const color = createObject<Color>(
                project._store,
                colorProperties,
                Color
            );

            return color;
        },

        extendContextMenu: (
            thisObject: Color,
            context: IContextMenuContext,
            objects: IEezObject[],
            menuItems: Electron.MenuItem[],
            editable: boolean
        ) => {
            var additionalMenuItems: Electron.MenuItem[] = [];

            if (editable) {
                additionalMenuItems.push(
                    new MenuItem({
                        label: "Copy to other themes",
                        click: () => {
                            const projectStore = getProjectStore(thisObject);

                            projectStore.undoManager.setCombineCommands(true);

                            const project = getProjectWithThemes(
                                getProjectStore(thisObject)
                            );

                            const selectedTheme =
                                projectStore.navigationStore.selectedThemeObject.get() as Theme;

                            const colorIndex =
                                project.colors.indexOf(thisObject);
                            const color = project.getThemeColor(
                                selectedTheme.objID,
                                thisObject.objID
                            );

                            project.themes.forEach((theme: any, i: number) => {
                                if (theme != selectedTheme) {
                                    const colors = theme.colors.slice();
                                    colors[colorIndex] = color;
                                    projectStore.updateObject(theme, {
                                        colors
                                    });
                                }
                            });

                            projectStore.undoManager.setCombineCommands(false);
                        }
                    })
                );

                additionalMenuItems.push(
                    new MenuItem({
                        type: "separator"
                    })
                );
            }

            menuItems.unshift(...additionalMenuItems);
        }
    };

    get colorValues() {
        const colorValues: { [colorName: string]: string } = {};

        const project = ProjectEditor.getProject(this);
        for (const theme of project.themes) {
            colorValues[this.name] = project.getThemeColor(
                theme.name,
                this.name
            );
        }

        return colorValues;
    }
}

registerClass("Color", Color);

////////////////////////////////////////////////////////////////////////////////

export class ITheme {
    colors?: string[];
}

export class Theme extends EezObject implements ITheme {
    name: string;

    static classInfo: ClassInfo = {
        properties: [
            {
                name: "name",
                displayName: "Theme name",
                type: PropertyType.String,
                unique: true
            },
            {
                name: "colors",
                type: PropertyType.StringArray,
                hideInPropertyGrid: true,
                partOfNavigation: false,
                computedIfNotLoadProject: true
            }
        ],
        newItem: async (parent: IEezObject) => {
            const result = await showGenericDialog({
                dialogDefinition: {
                    title: "New Theme",
                    fields: [
                        {
                            name: "name",
                            type: "string",
                            validators: [
                                validators.required,
                                validators.unique({}, parent)
                            ]
                        }
                    ]
                },
                values: {}
            });

            const themeProperties: Partial<Theme> = {
                name: result.values.name
            };

            const project = ProjectEditor.getProject(parent);

            const theme = createObject<Theme>(
                project._store,
                themeProperties,
                Theme
            );

            return theme;
        },

        onAfterPaste: (newTheme: Theme, fromTheme: Theme) => {
            const project = ProjectEditor.getProject(newTheme);

            for (const color of project.colors) {
                project.setThemeColor(
                    newTheme.objID,
                    color.objID,
                    project.getThemeColor(fromTheme.objID, color.objID)
                );
            }
        }
    };

    constructor() {
        super();

        makeObservable(this, {
            colors: computed
        });
    }

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            name: observable
        });
    }

    get colors() {
        const project = ProjectEditor.getProject(this);
        return project.colors.map(color =>
            project.getThemeColor(this.objID, color.objID)
        );
    }

    set colors(value: string[]) {
        const project = ProjectEditor.getProject(this);
        for (let i = 0; i < value.length; i++) {
            if (i < project.colors.length) {
                project.setThemeColor(
                    this.objID,
                    project.colors[i].objID,
                    value[i]
                );
            }
        }
    }
}

registerClass("Theme", Theme);

////////////////////////////////////////////////////////////////////////////////

function getThemedColorInProject(
    project: Project,
    colorValue: string
): string | undefined {
    let selectedTheme: Theme | undefined;

    const runtime = project._store.runtime;
    if (runtime) {
        if (runtime instanceof ProjectEditor.WasmRuntimeClass) {
            selectedTheme = project.themes.find(
                theme => theme.name == runtime.selectedDashboardTheme
            );
        }
    } else {
        selectedTheme =
            project._store.navigationStore?.selectedThemeObject.get() as Theme;
    }

    if (!selectedTheme) {
        selectedTheme = project.themes[0];
    }
    if (!selectedTheme) {
        return colorValue;
    }

    let index = project.colorToIndexMap.get(colorValue);
    if (index === undefined) {
        return undefined;
    }

    let color = selectedTheme.colors[index];
    if (color) {
        return color;
    }

    return undefined;
}

export function getThemedColor(projectStore: ProjectStore, colorValue: string) {
    if (typeof colorValue != "string" || colorValue.startsWith("#")) {
        return { colorValue, isFromTheme: false };
    }

    if (!projectStore.projectTypeTraits.isLVGL && colorValue == "transparent") {
        return { colorValue: `rgba(0, 0, 0, 0)`, isFromTheme: false };
    }

    const project = getProjectWithThemes(projectStore);
    let color = getThemedColorInProject(project, colorValue);
    if (color) {
        return { colorValue: color, isFromTheme: true };
    }

    return { colorValue, isFromTheme: false };
}

////////////////////////////////////////////////////////////////////////////////

export function getProjectWithThemes(projectStore: ProjectStore) {
    if (projectStore.masterProject) {
        return projectStore.masterProject;
    }

    if (projectStore.project.themes.length > 0) {
        return projectStore.project;
    }

    for (const importDirective of projectStore.project.settings.general
        .imports) {
        if (importDirective.project) {
            if (importDirective.project.themes.length > 0) {
                return importDirective.project;
            }
        }
    }

    return projectStore.project;
}

export function getAllProjectsWithThemes(projectStore: ProjectStore) {
    const projects = [];

    if (projectStore.masterProject) {
        projects.push(projectStore.masterProject);
    }

    if (projectStore.project.themes.length > 0) {
        projects.push(projectStore.project);
    }

    for (const importDirective of projectStore.project.settings.general
        .imports) {
        if (importDirective.project) {
            if (importDirective.project.themes.length > 0) {
                projects.push(importDirective.project);
            }
        }
    }

    return projects;
}
