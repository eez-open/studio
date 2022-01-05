import React from "react";
import { observable, action, computed } from "mobx";
import { observer } from "mobx-react";
import classNames from "classnames";

import { objectClone } from "eez-studio-shared/util";

import {
    setId,
    getClassesDerivedFrom,
    IObjectClassInfo
} from "project-editor/core/object";
import { loadObject } from "project-editor/core/store";
import { DragAndDropManager } from "project-editor/core/dd";

import type { Component } from "project-editor/flow/component";

import { ProjectContext } from "project-editor/project/context";
import { SearchInput } from "eez-studio-ui/search-input";
import { guid } from "eez-studio-shared/guid";
import { humanize } from "eez-studio-shared/string";
import {
    getClass,
    objectToClipboardData,
    setClipboardData
} from "project-editor/core/store";
import { ProjectEditor } from "project-editor/project-editor-interface";

////////////////////////////////////////////////////////////////////////////////

export function getComponentName(componentClassName: string) {
    const parts = componentClassName.split("/");
    let name;
    if (parts.length == 2) {
        name = parts[1];
    } else {
        name = componentClassName;
    }

    if (name.endsWith("EmbeddedWidget")) {
        name = name.substring(0, name.length - "EmbeddedWidget".length);
    } else if (name.endsWith("Widget")) {
        name = name.substring(0, name.length - "Widget".length);
    } else if (name.endsWith("ActionComponent")) {
        name = name.substring(0, name.length - "ActionComponent".length);
    }

    return humanize(name);
}

////////////////////////////////////////////////////////////////////////////////

@observer
class PaletteItem extends React.Component<{
    componentClass: IObjectClassInfo;
    selected: boolean;
    onSelect: (componentClass: IObjectClassInfo | undefined) => void;
}> {
    static contextType = ProjectContext;
    declare context: React.ContextType<typeof ProjectContext>;

    @action.bound
    onDragStart(event: React.DragEvent<HTMLDivElement>) {
        event.stopPropagation();

        let protoObject = new this.props.componentClass.objectClass();

        const componentClass = getClass(protoObject);
        const defaultValue = objectClone(
            componentClass.classInfo.defaultValue!
        );

        defaultValue.type = this.props.componentClass.name;

        let object = loadObject(
            this.context,
            undefined,
            defaultValue,
            this.props.componentClass.objectClass
        ) as Component;

        object.wireID = guid();

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

        setId(this.context.objects, object, "ComponentPaletteItem");

        setClipboardData(event, objectToClipboardData(object));

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

    @action.bound
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
        let label =
            classInfo.componentPaletteLabel ||
            getComponentName(this.props.componentClass.name);

        let titleStyle: React.CSSProperties | undefined;
        if (classInfo.componentHeaderColor) {
            titleStyle = {
                backgroundColor: classInfo.componentHeaderColor
            };
        }

        return (
            <div
                className={className}
                onClick={() => this.props.onSelect(this.props.componentClass)}
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
            name = name.substr(2);
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
                                    key={componentClass.name}
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

@observer
export class ComponentsPalette extends React.Component {
    static contextType = ProjectContext;
    declare context: React.ContextType<typeof ProjectContext>;

    @observable selectedComponentClass: IObjectClassInfo | undefined;

    @action.bound
    onSelect(widgetClass: IObjectClassInfo | undefined) {
        this.selectedComponentClass = widgetClass;
    }

    @computed get allComponentClasses() {
        const activeEditor = this.context.editorsStore.activeEditor;
        if (!activeEditor) {
            return [];
        }

        let showOnlyActions;

        if (activeEditor.object instanceof ProjectEditor.PageClass) {
            showOnlyActions = false;
        } else if (activeEditor.object instanceof ProjectEditor.ActionClass) {
            showOnlyActions = true;
        } else {
            return [];
        }

        return getClassesDerivedFrom(
            showOnlyActions
                ? ProjectEditor.ActionComponentClass
                : ProjectEditor.ComponentClass
        ).filter(objectClassInfo =>
            this.context.project.isAppletProject ||
            this.context.project.isFirmwareWithFlowSupportProject
                ? objectClassInfo.objectClass.classInfo.flowComponentId !=
                  undefined
                : true
        );
    }

    @computed get groups() {
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
                componentClass.objectClass.classInfo.enabledInComponentPalette
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
                    componentClass.objectClass.classInfo
                        .componentPaletteGroupName;
                if (!groupName) {
                    if (componentClass.name.endsWith("Widget")) {
                        groupName = "!1Common Widgets";
                    } else if (
                        componentClass.name.endsWith("ActionComponent")
                    ) {
                        groupName = "!2Common Actions";
                    } else {
                        groupName = "Other components";
                    }
                }
            } else if (parts.length == 2) {
                groupName = parts[0];
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

    @observable searchText = "";

    @action.bound
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
                            selectedComponentClass={this.selectedComponentClass}
                            onSelect={this.onSelect}
                        ></PaletteGroup>
                    ))}
                </div>
            </div>
        );
    }
}
