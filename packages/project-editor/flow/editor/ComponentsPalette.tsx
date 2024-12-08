import React from "react";
import {
    observable,
    action,
    computed,
    makeObservable,
    IReactionDisposer,
    reaction,
    runInAction
} from "mobx";
import { observer } from "mobx-react";
import classNames from "classnames";
import { MenuItem } from "@electron/remote";

import { isArray, objectClone } from "eez-studio-shared/util";
import { SearchInput } from "eez-studio-ui/search-input";
import { Dialog, showDialog } from "eez-studio-ui/dialog";

import {
    getDefaultValue,
    IEezObject,
    IObjectClassInfo
} from "project-editor/core/object";
import { DragAndDropManager } from "project-editor/core/dd";
import {
    createObject,
    findPastePlaceInside,
    getAncestorOfType,
    getClass,
    getClassInfo,
    NavigationStore,
    objectToClipboardData,
    ProjectStore,
    setClipboardData
} from "project-editor/store";
import type { Component } from "project-editor/flow/component";
import { ProjectContext } from "project-editor/project/context";
import { ProjectEditor } from "project-editor/project-editor-interface";
import {
    SubNavigation,
    SubNavigationItem
} from "project-editor/ui-components/SubNavigation";
import {
    getAllComponentClasses,
    getGroups,
    getComponentVisualData,
    getComponentGroupDisplayName
} from "project-editor/flow/components/components-registry";
import { Point } from "eez-studio-shared/geometry";

////////////////////////////////////////////////////////////////////////////////

export async function selectComponentDialog(
    projectStore: ProjectStore,
    type: "actions" | "widgets"
) {
    return new Promise<Component | null>(resolve => {
        const onOk = (value: Component) => {
            resolve(value);
        };

        const onCancel = () => {
            resolve(null);
        };

        showDialog(
            <SelectComponentDialog
                projectStore={projectStore}
                type={type}
                onOk={onOk}
                onCancel={onCancel}
            />
        );
    });
}

////////////////////////////////////////////////////////////////////////////////

const SelectComponentDialog = observer(
    class SelectComponentDialog extends React.Component<{
        projectStore: ProjectStore;
        type: "actions" | "widgets";
        onOk: (value: Component) => void;
        onCancel: () => void;
    }> {
        open: boolean = true;

        constructor(props: any) {
            super(props);

            makeObservable(this, {
                open: observable
            });
        }

        render() {
            return (
                <ProjectContext.Provider value={this.props.projectStore}>
                    <Dialog
                        className="EezStudio_ProjectEditor_SelectComponentDialog"
                        open={this.open}
                        modal={true}
                        title={`Add ${
                            this.props.type == "actions" ? "Action" : "Widget"
                        }`}
                        onCancel={this.props.onCancel}
                    >
                        <ComponentsPalette1
                            type={this.props.type}
                            onSelectComponent={component => {
                                runInAction(() => {
                                    this.open = false;
                                });
                                this.props.onOk(component);
                            }}
                        />
                    </Dialog>
                </ProjectContext.Provider>
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

export function newComponentMenuItem(
    object: IEezObject,
    menuItems: Electron.MenuItem[],
    atPoint?: Point
) {
    const flow = getAncestorOfType(object, ProjectEditor.FlowClass.classInfo);
    if (flow) {
        const isPage = flow instanceof ProjectEditor.PageClass;
        const isAction = flow instanceof ProjectEditor.ActionClass;

        if (isPage || isAction) {
            let type: "actions" | "widgets" = "actions";

            if (
                (isPage &&
                    (!atPoint ||
                        (atPoint.x >= 0 &&
                            atPoint.x < flow.width &&
                            atPoint.y >= 0 &&
                            atPoint.y < flow.height))) ||
                object instanceof ProjectEditor.WidgetClass
            ) {
                type = "widgets";
            }

            menuItems.unshift(new MenuItem({ type: "separator" }));

            menuItems.unshift(
                new MenuItem({
                    label: `Add ${type == "actions" ? "Action" : "Widget"}...`,
                    click: async () => {
                        const projectStore =
                            ProjectEditor.getProjectStore(object);

                        const component = await selectComponentDialog(
                            projectStore,
                            type
                        );

                        if (component) {
                            if (atPoint) {
                                component.left = Math.round(atPoint.x);
                                component.top = Math.round(atPoint.y);
                            }

                            let parent;

                            let selectedWidget = object;
                            if (
                                selectedWidget instanceof
                                ProjectEditor.WidgetClass
                            ) {
                                const pastePlace = findPastePlaceInside(
                                    selectedWidget,
                                    getClassInfo(component),
                                    true
                                );
                                if (isArray(pastePlace)) {
                                    parent = pastePlace;
                                    if (atPoint) {
                                        component.left -= selectedWidget.left;
                                        component.top -= selectedWidget.top;
                                    }
                                }
                            }

                            let newObject = projectStore.addObject(
                                parent || flow.components,
                                component
                            );

                            projectStore.navigationStore.showObjects(
                                [newObject],
                                true,
                                true,
                                true
                            );
                        }
                    }
                })
            );
        }
    }
}

////////////////////////////////////////////////////////////////////////////////

export const ComponentsPalette = observer(
    class ComponentsPalette extends React.Component {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        get items(): SubNavigationItem[] {
            return [
                {
                    name: NavigationStore.COMPONENTS_PALETTE_SUB_NAVIGATION_ITEM_WIDGETS,
                    component: <ComponentsPalette1 type="widgets" />,
                    numItems: 0
                },
                {
                    name: NavigationStore.COMPONENTS_PALETTE_SUB_NAVIGATION_ITEM_ACTIONS,
                    component: <ComponentsPalette1 type="actions" />,
                    numItems: 0
                }
            ];
        }

        render() {
            if (!this.context.projectTypeTraits.hasFlowSupport) {
                return <ComponentsPalette1 type="widgets" />;
            }

            const activeEditor = this.context.editorsStore.activeEditor;
            const showOnlyActions =
                activeEditor &&
                activeEditor.object instanceof ProjectEditor.ActionClass;

            if (showOnlyActions) {
                return <ComponentsPalette1 type="actions" />;
            }

            return (
                <SubNavigation
                    id={NavigationStore.COMPONENTS_PALETTE_SUB_NAVIGATION_ID}
                    items={this.items}
                />
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

export const ComponentsPalette1 = observer(
    class ComponentsPalette1 extends React.Component<{
        type: "widgets" | "actions";
        onSelectComponent?: (value: Component) => void;
    }> {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        selectedComponentClass: IObjectClassInfo | undefined;

        searchText = "";

        dispose: IReactionDisposer;

        constructor(props: any) {
            super(props);

            this.readFromLocalStorage();

            makeObservable(this, {
                selectedComponentClass: observable,
                onSelect: action.bound,
                allComponentClasses: computed,
                groups: computed,
                searchText: observable,
                onSearchChange: action.bound,
                readFromLocalStorage: action
            });

            if (!this.props.onSelectComponent) {
                this.dispose = reaction(
                    () => ({
                        searchText: this.searchText
                    }),
                    arg => {
                        localStorage.setItem(
                            "ComponentsPaletteSearchText_" + this.props.type,
                            arg.searchText
                        );
                    }
                );
            }
        }

        readFromLocalStorage() {
            if (!this.props.onSelectComponent) {
                this.searchText =
                    localStorage.getItem(
                        "ComponentsPaletteSearchText_" + this.props.type
                    ) || "";
            }
        }

        componentDidUpdate() {
            this.readFromLocalStorage();
        }

        componentWillUnmount() {
            if (this.dispose) {
                this.dispose();
            }
        }

        onSelect(widgetClass: IObjectClassInfo | undefined) {
            this.selectedComponentClass = widgetClass;
        }

        get allComponentClasses() {
            return getAllComponentClasses(
                this.context,
                this.props.type == "actions"
                    ? ProjectEditor.ActionComponentClass
                    : ProjectEditor.WidgetClass
            );
        }

        get groups() {
            return getGroups(
                this.allComponentClasses,
                this.context,
                this.searchText
            );
        }

        onSearchChange(event: any) {
            this.searchText = ($(event.target).val() as string).trim();
        }

        render() {
            return (
                <div
                    className="EezStudio_ComponentsPalette_Enclosure"
                    onContextMenu={e => e.preventDefault()}
                >
                    <div className="EezStudio_Title">
                        <SearchInput
                            key="search-input"
                            searchText={this.searchText}
                            onClear={action(() => {
                                this.searchText = "";
                            })}
                            onChange={this.onSearchChange}
                            onKeyDown={this.onSearchChange}
                        />
                    </div>

                    <div className="EezStudio_ComponentsPalette" tabIndex={0}>
                        {[...this.groups.entries()].sort().map(entry => (
                            <PaletteGroup
                                key={entry[0]}
                                name={entry[0]}
                                componentClasses={entry[1]}
                                selectedComponentClass={
                                    this.selectedComponentClass
                                }
                                onSelect={this.onSelect}
                                onSelectComponent={this.props.onSelectComponent}
                            ></PaletteGroup>
                        ))}
                    </div>
                </div>
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

class PaletteGroup extends React.Component<{
    name: string;
    componentClasses: IObjectClassInfo[];
    selectedComponentClass: IObjectClassInfo | undefined;
    onSelect: (componentClass: IObjectClassInfo | undefined) => void;
    onSelectComponent?: (value: Component) => void;
}> {
    render() {
        let name = getComponentGroupDisplayName(this.props.name);

        const target = `eez-component-palette-group-${name
            .replace(/(^-\d-|^\d|^-\d|^--)/, "a$1")
            .replace(/[\W]/g, "-")}`;

        return (
            <div className="eez-component-palette-group">
                <div className="eez-component-palette-header">{name}</div>
                <div id={target}>
                    <div className="eez-component-palette-body">
                        {this.props.componentClasses.map(componentClass => {
                            return (
                                <PaletteItem
                                    key={componentClass.id}
                                    componentClass={componentClass}
                                    onSelect={this.props.onSelect}
                                    selected={
                                        componentClass ===
                                        this.props.selectedComponentClass
                                    }
                                    onSelectComponent={
                                        this.props.onSelectComponent
                                    }
                                />
                            );
                        })}
                    </div>
                </div>
            </div>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

const PaletteItem = observer(
    class PaletteItem extends React.Component<{
        componentClass: IObjectClassInfo;
        selected: boolean;
        onSelect: (componentClass: IObjectClassInfo | undefined) => void;
        onSelectComponent?: (value: Component) => void;
    }> {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        constructor(props: any) {
            super(props);

            makeObservable(this, {
                onDragStart: action.bound,
                onDragEnd: action.bound
            });
        }

        get component() {
            let protoObject = new this.props.componentClass.objectClass();

            const componentClass = getClass(protoObject);

            let defaultValue: Partial<Component> = {};

            const classInfoDefaultValue = getDefaultValue(
                this.context,
                componentClass.classInfo
            );
            if (classInfoDefaultValue) {
                Object.assign(defaultValue, classInfoDefaultValue);
            }

            if (componentClass.classInfo.componentDefaultValue) {
                Object.assign(
                    defaultValue,
                    objectClone(
                        componentClass.classInfo.componentDefaultValue(
                            this.context
                        )
                    )
                );
            }

            defaultValue.type = this.props.componentClass.name;

            Object.assign(defaultValue, this.props.componentClass.props);

            let object = createObject<Component>(
                this.context,
                defaultValue,
                this.props.componentClass.objectClass
            );

            if (object.left == undefined) {
                object.left = 0;
            }
            if (object.top == undefined) {
                object.top = 0;
            }
            if (object.width == undefined) {
                object.width = 0;
            }
            if (object.height == undefined) {
                object.height = 0;
            }

            return object;
        }

        onDragStart(event: React.DragEvent<HTMLDivElement>) {
            event.stopPropagation();

            const object = this.component;

            setClipboardData(
                event,
                objectToClipboardData(this.context, object)
            );

            event.dataTransfer.effectAllowed = "copy";

            event.dataTransfer.setDragImage(
                DragAndDropManager.blankDragImage,
                0,
                0
            );

            // postpone render, otherwise we can receive onDragEnd immediatelly
            setTimeout(() => {
                DragAndDropManager.start(event, object, this.context);
            });
        }

        onDragEnd(event: any) {
            DragAndDropManager.end(event);
        }

        render() {
            const dragObject = DragAndDropManager.dragObject;
            const dragObjectClass = dragObject && getClass(dragObject);

            let dragging;

            if (dragObject) {
                if (
                    (dragObjectClass == ProjectEditor.UserWidgetWidgetClass ||
                        dragObjectClass ==
                            ProjectEditor.LVGLUserWidgetWidgetClass) &&
                    this.props.componentClass.objectClass == dragObjectClass
                ) {
                    dragging =
                        (dragObject as any).userWidgetPageName ==
                        this.props.componentClass.props?.userWidgetPageName;
                } else if (
                    dragObjectClass ==
                        ProjectEditor.CallActionActionComponentClass &&
                    this.props.componentClass.objectClass == dragObjectClass
                ) {
                    dragging =
                        (dragObject as any).action ==
                        this.props.componentClass.props?.action;
                } else {
                    dragging =
                        dragObjectClass ===
                        this.props.componentClass.objectClass;
                }
            } else {
                dragging = false;
            }

            let className = classNames("eez-component-palette-item", {
                selected: this.props.selected,
                "no-drag": this.props.onSelectComponent != undefined,
                dragging
            });

            const { icon, label, titleStyle } = getComponentVisualData(
                this.props.componentClass,
                this.context
            );

            return (
                <div
                    className={className}
                    onClick={() => {
                        if (this.props.onSelectComponent) {
                            this.props.onSelectComponent(this.component);
                        } else {
                            this.props.onSelect(this.props.componentClass);
                        }
                    }}
                    draggable={!this.props.onSelectComponent}
                    onDragStart={
                        this.props.onSelectComponent
                            ? undefined
                            : this.onDragStart
                    }
                    onDragEnd={
                        this.props.onSelectComponent
                            ? undefined
                            : this.onDragEnd
                    }
                    style={titleStyle}
                >
                    {typeof icon === "string" ? <img src={icon} /> : icon}
                    <span title={label}>{label}</span>
                </div>
            );
        }
    }
);
