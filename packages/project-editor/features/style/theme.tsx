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
    IMessage,
    MessageType,
    setParent,
    SerializedData
} from "project-editor/core/object";
import { makeTagsProperty } from "project-editor/core/tags";
import {
    ProjectStore,
    IContextMenuContext,
    getProjectStore,
    createObject,
    objectToClipboardData,
    Message
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
import {
    isEezGuiProject,
    isFirmwareProject
} from "project-editor/project/project-type-traits";
import { getColorRGB, rgbToHexString } from "eez-studio-shared/color";

////////////////////////////////////////////////////////////////////////////////

// A theme color with alpha (EEZ-GUI projects with 32-bit colors) is stored as
// "#rrggbbaa", without alpha as "#rrggbb".

function getColorRGBPart(color: string) {
    const rgb = getColorRGB(color);
    return rgbToHexString(rgb.r, rgb.g, rgb.b);
}

// 0 .. 255
function getColorAlpha(color: string) {
    return Math.round(getColorRGB(color).a * 255);
}

function withAlpha(rgbColor: string, alpha: number) {
    if (alpha >= 255) {
        return rgbColor;
    }
    return rgbColor + alpha.toString(16).padStart(2, "0");
}

////////////////////////////////////////////////////////////////////////////////

const ColorItem = observer(
    class ColorItem extends React.Component<{
        itemId: string;
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
                readOnly: computed,
                hasAlpha: computed,
                color: computed,
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
            if (isModuleColor(this.colorObject)) {
                return getModuleColorValue(
                    this.colorObject,
                    this.selectedTheme?.name
                );
            }
            return this.selectedTheme?.colors[this.colorIndex]??"#000000";
        }

        // the colors of the master project (in a module project) and of an
        // imported project are read-only
        get readOnly() {
            return ProjectEditor.getProject(this.colorObject)._isReadOnly;
        }

        // EEZ-GUI projects with 32-bit colors: the colors have alpha
        get hasAlpha() {
            return (
                isEezGuiProject(this.context.project) &&
                this.context.project.settings.general.colorBpp == "32"
            );
        }

        get color() {
            return this.changedThemeColor !== undefined
                ? this.changedThemeColor
                : this.themeColor;
        }

        changedThemeColor: string | undefined;

        onChangeTimeout: any;

        // the color input has no alpha, the alpha of the color stays
        onChange = (event: React.ChangeEvent<HTMLInputElement>) => {
            this.setColor(
                withAlpha(event.target.value, getColorAlpha(this.color))
            );
        };

        onChangeAlpha = (event: React.ChangeEvent<HTMLInputElement>) => {
            const percent = parseFloat(event.target.value);
            if (isNaN(percent)) {
                return;
            }
            const alpha = Math.round(
                (Math.min(Math.max(percent, 0), 100) * 255) / 100
            );
            this.setColor(withAlpha(getColorRGBPart(this.color), alpha));
        };

        setColor = action((color: string) => {
            this.changedThemeColor = color;
            if (this.onChangeTimeout) {
                clearTimeout(this.onChangeTimeout);
            }
            this.onChangeTimeout = setTimeout(
                action(() => {
                    if (isModuleColor(this.colorObject)) {
                        this.context.updateObject(this.colorObject, {
                            themeValues: {
                                ...this.colorObject.themeValues,
                                [this.selectedTheme.name]:
                                    this.changedThemeColor!
                            }
                        });
                    } else {
                        const colors = this.selectedTheme.colors.slice();
                        colors[this.colorIndex] = this.changedThemeColor!;
                        this.context.updateObject(this.selectedTheme, {
                            colors
                        });
                    }
                    this.changedThemeColor = undefined;
                }),
                100
            );
        });

        render() {
            const color = this.color;
            return (
                <div className="EezStudio_ColorItem">
                    <input
                        type="color"
                        value={getColorRGBPart(color)}
                        onChange={this.onChange}
                        tabIndex={0}
                        disabled={this.readOnly}
                    />
                    <span title={this.colorObject.name}>
                        {this.colorObject.name}
                    </span>
                    {this.hasAlpha && (
                        <input
                            className="EezStudio_ColorItem_Alpha"
                            type="number"
                            min={0}
                            max={100}
                            step={1}
                            value={Math.round(
                                (getColorAlpha(color) * 100) / 255
                            )}
                            onChange={this.onChangeAlpha}
                            title="Alpha (%)"
                            disabled={this.readOnly}
                        />
                    )}
                </div>
            );
        }
    }
);

export const ThemesSideView = observer(
    class ThemesSideView extends React.Component<{
        // render only this part ("themes" or "colors")
        component?: string;
    }> {
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

            // the colors of a module project are not exported, no id
            const hasId = isFirmwareProject(color) && !isModuleColor(color);

            if (hasId) {
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
                    validators.unique(color, getParent(color)),
                    notMasterColorName(this.context)
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

                    if (hasId) {
                        this.context.updateObject(color, {
                            id: result.values.id
                        });
                    }

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
            return this.renderComponent(node.getComponent());
        };

        renderComponent(component: string | undefined) {
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
                        doNotUsePropertyGrid={true}
                    />
                ) : null;
            }

            if (component === "colors") {
                if (!this.project) {
                    return null;
                }

                // module project: its own colors (editable), then the colors
                // of the master project (read-only)
                const isModule = !!this.context.masterProject;

                return (
                    <ListNavigation
                        id="theme-colors"
                        navigationObject={
                            isModule
                                ? this.context.project.colors
                                : this.project.colors
                        }
                        masterObjects={
                            isModule ? this.project.colors : undefined
                        }
                        selectedObject={
                            this.context.navigationStore
                                .selectedThemeColorObject
                        }
                        onEditItem={this.onEditColorName}
                        renderItem={itemId => <ColorItem itemId={itemId} />}
                        editable={isModule || !readOnly}
                        doNotUsePropertyGrid={true}
                    />
                );
            }

            return null;
        }

        render() {
            if (this.props.component) {
                return this.renderComponent(this.props.component);
            }

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
    tags?: string;

    // Color defined in a module project: its value for each theme of the
    // master project, by theme name (the values of the master project colors
    // are in the themes).
    themeValues: { [themeName: string]: string } | undefined;

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
            name: observable,
            tags: observable,
            themeValues: observable.ref
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
                propertyGridGroup: generalGroup,
                hideInPropertyGrid: true
            },
            {
                name: "name",
                displayName: "Color name",
                type: PropertyType.String,
                unique: true
            },
            makeTagsProperty(),
            {
                name: "themeValues",
                type: PropertyType.Any,
                isOptional: true,
                hideInPropertyGrid: true,
                skipSearch: true
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

            if (isModuleColor(color)) {
                const masterProject = getProjectWithThemes(projectStore);

                if (
                    masterProject.colors.find(
                        masterColor => masterColor.name == color.name
                    )
                ) {
                    messages.push(
                        new Message(
                            MessageType.ERROR,
                            `Color "${color.name}" is also defined in the master project`,
                            color
                        )
                    );
                }

                for (const theme of masterProject.themes) {
                    if (!color.themeValues?.[theme.name]) {
                        messages.push(
                            new Message(
                                MessageType.WARNING,
                                `Color "${color.name}" has no value for the theme "${theme.name}"`,
                                color
                            )
                        );
                    }
                }

                return;
            }

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
            const projectStore = getProjectStore(parent);

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
                                notMasterColorName(projectStore),
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
                values: {},
                modal: true,
                backdrop: "static"
            });

            const colorProperties: Partial<Color> = {
                name: result.values.name
            };

            if (projectStore.masterProject) {
                // color of a module project: a value for each master theme
                const themeValues: { [themeName: string]: string } = {};
                for (const theme of getProjectWithThemes(projectStore)
                    .themes) {
                    themeValues[theme.name] = "#000000";
                }
                colorProperties.themeValues = themeValues;
            }

            const project = ProjectEditor.getProject(parent);

            const color = createObject<Color>(
                project._store,
                colorProperties,
                Color
            );

            return color;
        },

        objectsToClipboardData: (colors: Color[]) => {
            const projectStore = ProjectEditor.getProjectStore(colors[0]);
            const themeColorsClipboardData = new ThemeColorsClipboardData();
            themeColorsClipboardData.addColors(projectStore, colors);
            setParent(themeColorsClipboardData, projectStore.project);
            return objectToClipboardData(projectStore, themeColorsClipboardData);
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

                            const project = getProjectWithThemes(
                                getProjectStore(thisObject)
                            );

                            const selectedTheme = getSelectedTheme(project);
                            if (!selectedTheme) {
                                return;
                            }

                            if (isModuleColor(thisObject)) {
                                const value = getModuleColorValue(
                                    thisObject,
                                    selectedTheme.name
                                );
                                const themeValues: {
                                    [themeName: string]: string;
                                } = {};
                                for (const theme of project.themes) {
                                    themeValues[theme.name] = value;
                                }
                                projectStore.updateObject(thisObject, {
                                    themeValues
                                });
                                return;
                            }

                            projectStore.undoManager.setCombineCommands(true);

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
    tags?: string;

    static classInfo: ClassInfo = {
        properties: [
            {
                name: "name",
                displayName: "Theme name",
                type: PropertyType.String,
                unique: true
            },
            makeTagsProperty(),
            {
                name: "colors",
                type: PropertyType.StringArray,
                hideInPropertyGrid: true,
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
                values: {},
                modal: true,
                backdrop: "static"
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

        objectsToClipboardData: (themes: Theme[]) => {
            const projectStore = ProjectEditor.getProjectStore(themes[0]);
            const themeColorsClipboardData = new ThemeColorsClipboardData();
            themeColorsClipboardData.addThemes(projectStore, themes);
            setParent(themeColorsClipboardData, projectStore.project);
            return objectToClipboardData(projectStore, themeColorsClipboardData);
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
            name: observable,
            tags: observable
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

export class ThemeColorsClipboardData extends EezObject {
    data: {
        kind: "themes" | "colors";
        themes: {
            name: string;
            colors: string[];
        }[];
        colorNames: string[];
    };

    static classInfo: ClassInfo = {
        properties: [
            {
                name: "data",
                type: PropertyType.Any
            }
        ],

        pasteItemHook: (
            object: IEezObject,
            clipboardData: {
                serializedData: SerializedData;
                pastePlace: EezObject;
            }
        ) => {
            const projectStore = ProjectEditor.getProjectStore(
                clipboardData.pastePlace
            );
            const themeColorsClipboardData = clipboardData.serializedData
                .object as ThemeColorsClipboardData;

            let closeCombineCommands = false;
            if (!projectStore.undoManager.combineCommands) {
                projectStore.undoManager.setCombineCommands(true);
                closeCombineCommands = true;
            }

            const newObjects: EezObject[] = [];

            if (projectStore.masterProject) {
                // module project: no themes, the pasted colors get their
                // values for the master themes
                if (themeColorsClipboardData.data.kind == "colors") {
                    const colorNames = themeColorsClipboardData.data.colorNames;
                    for (
                        let colorIndex = 0;
                        colorIndex < colorNames.length;
                        colorIndex++
                    ) {
                        const themeValues: { [themeName: string]: string } =
                            {};
                        for (const theme of themeColorsClipboardData.data
                            .themes) {
                            themeValues[theme.name] = theme.colors[colorIndex];
                        }

                        newObjects.push(
                            projectStore.addObject(
                                projectStore.project.colors,
                                createObject<Color>(
                                    projectStore,
                                    {
                                        name: colorNames[colorIndex],
                                        themeValues
                                    },
                                    Color
                                )
                            )
                        );
                    }
                }
            } else if (themeColorsClipboardData.data.kind == "themes") {
                for (const colorName of themeColorsClipboardData.data.colorNames) {
                    const color = projectStore.project.colors.find(
                        color => color.name == colorName
                    );
                    if (!color) {
                        projectStore.addObject(
                            projectStore.project.colors,
                            createObject<Color>(
                                projectStore,
                                {
                                    name: colorName
                                },
                                Color
                            )
                        );
                    }
                }

                for (const theme of themeColorsClipboardData.data.themes) {
                    const newTheme = projectStore.addObject(
                        projectStore.project.themes,
                        createObject<Theme>(
                            projectStore,
                            {
                                name: theme.name
                            },
                            Theme
                        )
                    );

                    newObjects.push(newTheme);

                    for (const color of projectStore.project.colors) {
                        const index =
                            themeColorsClipboardData.data.colorNames.findIndex(
                                colorName => colorName == color.name
                            );
                        projectStore.project.setThemeColor(
                            newTheme.objID,
                            color.objID,
                            index != -1 ? theme.colors[index] : "#000000"
                        );
                    }
                }
            } else {
                for (const theme of themeColorsClipboardData.data.themes) {
                    const theme2 = projectStore.project.themes.find(
                        theme2 => theme2.name == theme.name
                    );
                    if (!theme2) {
                        projectStore.addObject(
                            projectStore.project.themes,
                            createObject<Theme>(
                                projectStore,
                                {
                                    name: theme.name
                                },
                                Theme
                            )
                        );
                    }
                }

                for (
                    let colorIndex = 0;
                    colorIndex < themeColorsClipboardData.data.colorNames.length;
                    colorIndex++
                ) {
                    const colorName =
                        themeColorsClipboardData.data.colorNames[colorIndex];

                    const newColor = projectStore.addObject(
                        projectStore.project.colors,
                        createObject<Color>(
                            projectStore,
                            {
                                name: colorName
                            },
                            Color
                        )
                    );

                    newObjects.push(newColor);

                    for (const theme of themeColorsClipboardData.data.themes) {
                        const theme2 = projectStore.project.themes.find(
                            theme2 => theme2.name == theme.name
                        )!;
                        projectStore.project.setThemeColor(
                            theme2.objID,
                            newColor.objID,
                            theme.colors[colorIndex]
                        );
                    }
                }
            }

            if (closeCombineCommands) {
                projectStore.undoManager.setCombineCommands(false);
            }

            return newObjects;
        }
    };

    addThemes(projectStore: ProjectStore, themes: Theme[]) {
        this.data = {
            kind: "themes",
            themes: themes.map(theme => ({
                name: theme.name,
                colors: theme.colors
            })),
            colorNames: projectStore.project.colors.map(color => color.name)
        };
    }

    addColors(projectStore: ProjectStore, colors: Color[]) {
        this.data = {
            kind: "colors",
            themes: getProjectWithThemes(projectStore).themes.map(theme => ({
                name: theme.name,
                colors: colors.map(color =>
                    isModuleColor(color)
                        ? getModuleColorValue(color, theme.name)
                        : ProjectEditor.getProject(color).getThemeColor(
                              theme.objID,
                              color.objID
                          )
                )
            })),
            colorNames: colors.map(color => color.name)
        };
    }
}

registerClass("ThemeColorsClipboardData", ThemeColorsClipboardData);

////////////////////////////////////////////////////////////////////////////////

// The theme selected in the editor (or in the runtime) of the project with
// themes.
function getSelectedTheme(project: Project): Theme | undefined {
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

    return selectedTheme ?? project.themes[0];
}

// True for a color defined in a module project (the opened project has a
// master project with the themes).
export function isModuleColor(color: Color) {
    const projectStore = getProjectStore(color);
    return (
        !!projectStore.masterProject &&
        ProjectEditor.getProject(color) === projectStore.project
    );
}

// The color with this name defined in the module project.
export function findModuleColor(projectStore: ProjectStore, name: string) {
    if (!projectStore.masterProject) {
        return undefined;
    }
    return projectStore.project.colors.find(color => color.name == name);
}

// The value of a module color for a master theme, the first value if the
// theme has none.
export function getModuleColorValue(
    color: Color,
    themeName: string | undefined
) {
    const themeValues = color.themeValues;
    if (themeValues) {
        if (themeName && themeValues[themeName]) {
            return themeValues[themeName];
        }
        for (const value of Object.values(themeValues)) {
            if (value) {
                return value;
            }
        }
    }
    return "#000000";
}

// In a module project a color name can't be a name of a master color.
function notMasterColorName(projectStore: ProjectStore) {
    return function (object: any, ruleName: string) {
        if (
            projectStore.masterProject &&
            getProjectWithThemes(projectStore).colors.find(
                color => color.name == object[ruleName]
            )
        ) {
            return "Color with this name is defined in the master project";
        }
        return null;
    };
}

function getThemedColorInProject(
    project: Project,
    colorValue: string
): string | undefined {
    const selectedTheme = getSelectedTheme(project);
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

    const moduleColor = findModuleColor(projectStore, colorValue);
    if (moduleColor) {
        return {
            colorValue: getModuleColorValue(
                moduleColor,
                getSelectedTheme(project)?.name
            ),
            isFromTheme: true
        };
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
