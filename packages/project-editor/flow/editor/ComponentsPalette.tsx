import React from "react";
import {
    observable,
    action,
    computed,
    makeObservable,
    IReactionDisposer,
    reaction
} from "mobx";
import { observer } from "mobx-react";
import classNames from "classnames";

import { objectClone } from "eez-studio-shared/util";
import { SearchInput } from "eez-studio-ui/search-input";

import { getDefaultValue, IObjectClassInfo } from "project-editor/core/object";
import { DragAndDropManager } from "project-editor/core/dd";
import {
    createObject,
    getClass,
    NavigationStore,
    objectToClipboardData,
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

        readFromLocalStorage() {
            this.searchText =
                localStorage.getItem(
                    "ComponentsPaletteSearchText_" + this.props.type
                ) || "";
        }

        componentDidUpdate() {
            this.readFromLocalStorage();
        }

        componentWillUnmount() {
            this.dispose();
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
    }> {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        constructor(props: {
            componentClass: IObjectClassInfo;
            selected: boolean;
            onSelect: (componentClass: IObjectClassInfo | undefined) => void;
        }) {
            super(props);

            makeObservable(this, {
                onDragStart: action.bound,
                onDragEnd: action.bound
            });
        }

        onDragStart(event: React.DragEvent<HTMLDivElement>) {
            event.stopPropagation();

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
                dragging
            });

            const { icon, label, titleStyle } = getComponentVisualData(
                this.props.componentClass,
                this.context
            );

            return (
                <div
                    className={className}
                    onClick={() =>
                        this.props.onSelect(this.props.componentClass)
                    }
                    draggable={true}
                    onDragStart={this.onDragStart}
                    onDragEnd={this.onDragEnd}
                    style={titleStyle}
                >
                    {typeof icon === "string" ? <img src={icon} /> : icon}
                    <span title={label}>{label}</span>
                </div>
            );
        }
    }
);
