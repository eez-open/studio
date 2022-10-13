import React from "react";
import { observable, action, computed, makeObservable } from "mobx";
import { observer } from "mobx-react";
import classNames from "classnames";
import tinycolor from "tinycolor2";

import { objectClone } from "eez-studio-shared/util";

import {
    getClassesDerivedFrom,
    IObjectClassInfo,
    isProperSubclassOf
} from "project-editor/core/object";
import { createObject } from "project-editor/store";
import { DragAndDropManager } from "project-editor/core/dd";

import type { Component } from "project-editor/flow/component";

import { ProjectContext } from "project-editor/project/context";
import { SearchInput } from "eez-studio-ui/search-input";
import {
    getClass,
    objectToClipboardData,
    setClipboardData
} from "project-editor/store";
import { ProjectEditor } from "project-editor/project-editor-interface";

////////////////////////////////////////////////////////////////////////////////

// Groups sort order:
//  !1 -> "Common Widgets"
//  !2 -> "Common Actions"
//  !3 -> Built-in groups
//  !4 -> "Other components"
//  !5 -> Extensions
//  !6 -> "User Widgets"
//  !7 -> "User Actions"

export const ComponentsPalette = observer(
    class ComponentsPalette extends React.Component {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        selectedComponentClass: IObjectClassInfo | undefined;

        constructor(props: any) {
            super(props);

            makeObservable(this, {
                selectedComponentClass: observable,
                onSelect: action.bound,
                allComponentClasses: computed,
                groups: computed,
                searchText: observable,
                onSearchChange: action.bound
            });
        }

        onSelect(widgetClass: IObjectClassInfo | undefined) {
            this.selectedComponentClass = widgetClass;
        }

        get allComponentClasses() {
            const activeEditor = this.context.editorsStore.activeEditor;

            let baseClass;

            const showOnlyActions =
                activeEditor &&
                activeEditor.object instanceof ProjectEditor.ActionClass;

            if (this.context.projectTypeTraits.hasFlowSupport) {
                if (showOnlyActions) {
                    baseClass = ProjectEditor.ActionComponentClass;
                } else {
                    baseClass = ProjectEditor.ComponentClass;
                }
            } else {
                baseClass = ProjectEditor.WidgetClass;
            }

            const stockComponents = getClassesDerivedFrom(baseClass).filter(
                objectClassInfo =>
                    (this.context.projectTypeTraits.isFirmware ||
                        this.context.projectTypeTraits.isLVGL) &&
                    this.context.projectTypeTraits.hasFlowSupport
                        ? objectClassInfo.objectClass.classInfo
                              .flowComponentId != undefined ||
                          (this.context.projectTypeTraits.isLVGL &&
                              isProperSubclassOf(
                                  objectClassInfo.objectClass.classInfo,
                                  ProjectEditor.WidgetClass.classInfo
                              ))
                        : true
            );

            const userWidgets: IObjectClassInfo[] = [];
            if (!showOnlyActions) {
                for (const page of this.context.project.pages) {
                    if (page.isUsedAsCustomWidget) {
                        userWidgets.push({
                            id: `LayoutViewWidget<${page.name}>`,
                            name: "LayoutViewWidget",
                            objectClass: ProjectEditor.LayoutViewWidgetClass,
                            displayName: page.name,
                            componentPaletteGroupName: "!6User Widgets",
                            props: {
                                layout: page.name,
                                width: page.width,
                                height: page.height
                            }
                        });
                    }
                }
            }

            const userActions: IObjectClassInfo[] = [];
            if (this.context.projectTypeTraits.hasFlowSupport) {
                for (const action of this.context.project.actions) {
                    userActions.push({
                        id: `CallActionActionComponent<${action.name}>`,
                        name: "CallActionActionComponent",
                        objectClass:
                            ProjectEditor.CallActionActionComponentClass,
                        displayName: action.name,
                        componentPaletteGroupName: "!7User Actions",
                        props: {
                            action: action.name
                        }
                    });
                }
            }

            return [...stockComponents, ...userWidgets, ...userActions];
        }

        get groups() {
            const groups = new Map<string, IObjectClassInfo[]>();
            const searchText = this.searchText && this.searchText.toLowerCase();
            this.allComponentClasses.forEach(componentClass => {
                if (
                    searchText &&
                    componentClass.name.toLowerCase().indexOf(searchText) == -1
                ) {
                    return;
                }

                if (
                    componentClass.objectClass.classInfo
                        .enabledInComponentPalette
                ) {
                    if (
                        !componentClass.objectClass.classInfo.enabledInComponentPalette(
                            this.context.project.settings.general.projectType
                        )
                    ) {
                        return;
                    }
                }

                const parts = componentClass.name.split("/");
                let groupName;
                if (parts.length == 1) {
                    groupName =
                        componentClass.componentPaletteGroupName != undefined
                            ? componentClass.componentPaletteGroupName
                            : componentClass.objectClass.classInfo
                                  .componentPaletteGroupName;
                    if (groupName) {
                        if (!groupName.startsWith("!")) {
                            groupName = "!3" + groupName;
                        }
                    } else {
                        if (componentClass.name.endsWith("Widget")) {
                            groupName = "!1Common Widgets";
                        } else if (
                            componentClass.name.endsWith("ActionComponent")
                        ) {
                            groupName = "!2Common Actions";
                        } else {
                            groupName = "!4Other components";
                        }
                    }
                } else if (parts.length == 2) {
                    groupName = "!5" + parts[0];
                }

                if (groupName) {
                    let componentClasses = groups.get(groupName);
                    if (!componentClasses) {
                        componentClasses = [];
                        groups.set(groupName, componentClasses);
                    }
                    componentClasses.push(componentClass);
                }
            });
            return groups;
        }

        searchText = "";

        onSearchChange(event: any) {
            this.searchText = ($(event.target).val() as string).trim();
        }

        render() {
            return (
                <div className="EezStudio_ComponentsPalette_Enclosure">
                    <div className="EezStudio_Title">
                        <SearchInput
                            key="search-input"
                            searchText={this.searchText}
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
        let name = this.props.name;
        if (name.startsWith("!")) {
            name = name.substring(2);
        }
        const target = `eez-component-palette-group-${name
            .replace(/(^-\d-|^\d|^-\d|^--)/, "a$1")
            .replace(/[\W]/g, "-")}`;
        return (
            <div className="card">
                <div className="card-header">{name}</div>
                <div id={target} className="collapse show">
                    <div className="card-body">
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

export function getComponentName(componentClassName: string) {
    const parts = componentClassName.split("/");
    let name;
    if (parts.length == 2) {
        name = parts[1];
    } else {
        name = componentClassName;
    }

    if (name.startsWith("LVGL")) {
        name = name.substring("LVGL".length);
    }

    if (name.endsWith("EmbeddedWidget")) {
        name = name.substring(0, name.length - "EmbeddedWidget".length);
    } else if (name.endsWith("Widget")) {
        name = name.substring(0, name.length - "Widget".length);
    } else if (name.endsWith("ActionComponent")) {
        name = name.substring(0, name.length - "ActionComponent".length);
    }

    return name;
}

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

            if (componentClass.classInfo.defaultValue) {
                Object.assign(
                    defaultValue,
                    objectClone(componentClass.classInfo.defaultValue)
                );
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
            let className = classNames("eez-component-palette-item", {
                selected: this.props.selected,
                dragging:
                    DragAndDropManager.dragObject &&
                    getClass(DragAndDropManager.dragObject) ===
                        this.props.componentClass.objectClass
            });

            const classInfo = this.props.componentClass.objectClass.classInfo;
            let icon = classInfo.icon;
            let label = this.props.componentClass.displayName
                ? this.props.componentClass.displayName
                : classInfo.componentPaletteLabel ||
                  getComponentName(this.props.componentClass.name);

            let titleStyle: React.CSSProperties | undefined;
            if (classInfo.componentHeaderColor) {
                titleStyle = {
                    backgroundColor: classInfo.componentHeaderColor,
                    color: tinycolor
                        .mostReadable(classInfo.componentHeaderColor, [
                            "#fff",
                            "0x333"
                        ])
                        .toHexString()
                };
            }

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
                    {label}
                </div>
            );
        }
    }
);
