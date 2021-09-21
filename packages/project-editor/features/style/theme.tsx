import React from "react";
import { observable, computed, action } from "mobx";
import { observer } from "mobx-react";

import { guid } from "eez-studio-shared/guid";
import {
    ClassInfo,
    IEezObject,
    EezObject,
    registerClass,
    PropertyType,
    getParent
} from "project-editor/core/object";
import {
    DocumentStoreClass,
    INavigationStore,
    SimpleNavigationStoreClass,
    IContextMenuContext,
    getObjectFromNavigationItem,
    getDocumentStore
} from "project-editor/core/store";
import { validators } from "eez-studio-shared/validation";
import { replaceObjectReference } from "project-editor/core/search";

import { showGenericDialog } from "eez-studio-ui/generic-dialog";
import { Splitter } from "eez-studio-ui/splitter";

import { ListNavigation } from "project-editor/components/ListNavigation";

import { DragAndDropManagerClass } from "project-editor/core/dd";
import { ProjectContext } from "project-editor/project/context";
import { getProject, Project } from "project-editor/project/project";

const { MenuItem } = EEZStudio.remote || {};

////////////////////////////////////////////////////////////////////////////////

function getProjectWithThemes(DocumentStore: DocumentStoreClass) {
    if (DocumentStore.masterProject) {
        return DocumentStore.masterProject;
    }

    if (DocumentStore.project.themes.length > 0) {
        return DocumentStore.project;
    }

    for (const importDirective of DocumentStore.project.settings.general
        .imports) {
        if (importDirective.project) {
            if (importDirective.project.themes.length > 0) {
                return importDirective.project;
            }
        }
    }

    return DocumentStore.project;
}

let simpleNavigationStore: SimpleNavigationStoreClass;

function getNavigationStore(DocumentStore: DocumentStoreClass) {
    if (!simpleNavigationStore) {
        simpleNavigationStore = new SimpleNavigationStoreClass(undefined);
    }
    return getProjectWithThemes(DocumentStore) != DocumentStore.project
        ? simpleNavigationStore
        : DocumentStore.navigationStore;
}

////////////////////////////////////////////////////////////////////////////////

@observer
class ColorItem extends React.Component<{
    itemId: string;
}> {
    static contextType = ProjectContext;
    declare context: React.ContextType<typeof ProjectContext>;

    @computed
    get colorObject() {
        return this.context.getObjectFromObjectId(this.props.itemId) as Color;
    }

    @computed
    get colorIndex() {
        return (getParent(this.colorObject) as Color[]).indexOf(
            this.colorObject
        );
    }

    @computed
    get selectedTheme() {
        const project = getProjectWithThemes(this.context);

        let selectedTheme = getObjectFromNavigationItem(
            getNavigationStore(this.context).getNavigationSelectedItem(
                project.themes
            )
        ) as Theme;
        if (!selectedTheme) {
            selectedTheme = project.themes[0];
        }

        return selectedTheme!;
    }

    @computed
    get themeColor() {
        return this.selectedTheme.colors[this.colorIndex];
    }

    @observable changedThemeColor: string | undefined;

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
            <div className="tree-row-label EezStudio_ColorItem">
                <input
                    type="color"
                    value={
                        this.changedThemeColor !== undefined
                            ? this.changedThemeColor
                            : this.themeColor
                    }
                    onChange={this.onChange}
                    tabIndex={0}
                />
                <span title={this.colorObject.name}>
                    {this.colorObject.name}
                </span>
            </div>
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
    hasCloseButton?: boolean;
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

        showGenericDialog({
            dialogDefinition: {
                fields: [
                    {
                        name: "name",
                        type: "string",
                        validators: [
                            validators.required,
                            validators.unique(color, getParent(color))
                        ]
                    }
                ]
            },
            values: color
        })
            .then(result => {
                let newValue = result.values.name.trim();
                if (newValue != color.name) {
                    this.context.undoManager.setCombineCommands(true);
                    replaceObjectReference(color, newValue);
                    this.context.updateObject(color, {
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

    onClose = action(() => {
        this.context.uiStateStore.viewOptions.themesVisible = false;
    });

    render() {
        if (this.context.masterProjectEnabled && !this.context.masterProject) {
            return null;
        }

        const project = getProjectWithThemes(this.context);

        const themes = (
            <ListNavigation
                id="themes"
                navigationObject={project.themes}
                onEditItem={this.onEditThemeName}
                searchInput={false}
                editable={!this.context.masterProject}
                navigationStore={getNavigationStore(this.context)}
                onClose={this.props.hasCloseButton ? this.onClose : undefined}
            />
        );

        let colors;
        if (project.themes.length > 0) {
            colors = (
                <ListNavigation
                    id="theme-colors"
                    navigationObject={project.colors}
                    onEditItem={this.onEditColorName}
                    renderItem={renderColorItem}
                    editable={!this.context.masterProject}
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

export class IColor {
    id: string;
    name: string;
}

export class Color extends EezObject implements IColor {
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
        newItem: (parent: IEezObject) => {
            return showGenericDialog({
                dialogDefinition: {
                    title: "New Color",
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
            }).then(result => {
                return Promise.resolve({
                    id: guid(),
                    name: result.values.name
                });
            });
        },

        extendContextMenu: (
            thisObject: Color,
            context: IContextMenuContext,
            objects: IEezObject[],
            menuItems: Electron.MenuItem[]
        ) => {
            var additionalMenuItems: Electron.MenuItem[] = [];

            additionalMenuItems.push(
                new MenuItem({
                    label: "Copy to other themes",
                    click: () => {
                        const DocumentStore = getDocumentStore(thisObject);

                        DocumentStore.undoManager.setCombineCommands(true);

                        const project = getProjectWithThemes(
                            getDocumentStore(thisObject)
                        );

                        const selectedTheme = getObjectFromNavigationItem(
                            getNavigationStore(
                                DocumentStore
                            ).getNavigationSelectedItem(project.themes)
                        ) as Theme;

                        const colorIndex = project.colors.indexOf(thisObject);
                        const color = project.getThemeColor(
                            selectedTheme.id,
                            thisObject.id
                        );

                        project.themes.forEach((theme: any, i: number) => {
                            if (theme != selectedTheme) {
                                const colors = theme.colors.slice();
                                colors[colorIndex] = color;
                                DocumentStore.updateObject(theme, {
                                    colors
                                });
                            }
                        });

                        DocumentStore.undoManager.setCombineCommands(false);
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
        newItem: (parent: IEezObject) => {
            return showGenericDialog({
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
            }).then(result => {
                return Promise.resolve({
                    id: guid(),
                    name: result.values.name
                });
            });
        }
    };

    @computed get colors() {
        const project = getProject(this);
        return project.colors.map(color =>
            project.getThemeColor(this.id, color.id)
        );
    }

    set colors(value: string[]) {
        const project = getProject(this);
        for (let i = 0; i < value.length; i++) {
            project.setThemeColor(this.id, project.colors[i].id, value[i]);
        }
    }
}

registerClass(Theme);

////////////////////////////////////////////////////////////////////////////////

function getThemedColorInProject(
    project: Project,
    colorValue: string
): string | undefined {
    let selectedTheme = getObjectFromNavigationItem(
        getNavigationStore(project._DocumentStore).getNavigationSelectedItem(
            project.themes
        )
    ) as Theme;
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

export function getThemedColor(
    DocumentStore: DocumentStoreClass,
    colorValue: string
): string {
    if (colorValue.startsWith("#")) {
        return colorValue;
    }

    const project = getProjectWithThemes(DocumentStore);
    let color = getThemedColorInProject(project, colorValue);
    if (color) {
        return color;
    }

    return colorValue;
}
