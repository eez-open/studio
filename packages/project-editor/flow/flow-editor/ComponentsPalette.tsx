import React from "react";
import { observable, action, computed } from "mobx";
import { observer } from "mobx-react";
import classNames from "classnames";

import { objectClone } from "eez-studio-shared/util";

import {
    setId,
    getClass,
    getClassesDerivedFrom,
    IObjectClassInfo
} from "project-editor/core/object";
import { loadObject } from "project-editor/core/serialization";
import {
    objectToClipboardData,
    setClipboardData
} from "project-editor/core/clipboard";
import { DragAndDropManager } from "project-editor/core/dd";

import { ActionComponent, Component } from "project-editor/flow/component";

import styled from "eez-studio-ui/styled-components";
import { ProjectContext } from "project-editor/project/context";
import { SearchInput } from "eez-studio-ui/search-input";
import { Panel } from "project-editor/components/Panel";
import { guid } from "eez-studio-shared/guid";

////////////////////////////////////////////////////////////////////////////////

function getLabel(componentClass: IObjectClassInfo) {
    const parts = componentClass.name.split("/");
    let name;
    if (parts.length == 2) {
        name = parts[1];
    } else {
        name = componentClass.name;
    }

    if (name.endsWith("Widget")) {
        return name.substring(0, name.length - "Widget".length);
    }

    if (name.endsWith("ActionComponent")) {
        return name.substring(0, name.length - "ActionComponent".length);
    }

    return componentClass.name;
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

        let icon = this.props.componentClass.objectClass.classInfo.icon;
        let label = getLabel(this.props.componentClass);

        let titleStyle: React.CSSProperties | undefined;
        if (
            this.props.componentClass.objectClass.classInfo.componentHeaderColor
        ) {
            titleStyle = {
                backgroundColor:
                    this.props.componentClass.objectClass.classInfo
                        .componentHeaderColor
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
                <div className="card-header">
                    <h4 className="mb-0">
                        <button
                            className="btn btn-link"
                            data-bs-toggle="collapse"
                            data-target={`#${target}`}
                        >
                            {name}
                        </button>
                    </h4>
                </div>
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

const ComponentsPaletteDiv = styled.div`
    flex-grow: 1;
    overflow: auto;

    .card {
        border-left: none;
        border-right: none;
        border-top: none;
        border-bottom: 1px solid ${props => props.theme.borderColor};
        border-radius: 0;
    }

    .card:last-child {
        border-bottom: none;
    }

    .card-header {
        padding: 5px;
        button {
            text-decoration: none;
            color: inherit;
        }
    }

    .card-body {
        display: flex;
        flex-wrap: wrap;
        align-content: flex-start;
        align-items: flex-start;
        padding: 5px;
    }

    .eez-component-palette-item {
        margin: 4px;
        padding: 4px;
        cursor: grab;
        display: flex;
        flex-direction: row;
        align-items: center;
        & > img,
        & > svg {
            width: 20px;
            height: 20px;
            object-fit: contain;
            margin-right: 4px;
        }
        white-space: nowrap;
        min-width: 120px;
        background-color: #3fadb5;
        color: #333;
        border-radius: 5px;

        &.selected {
            background-color: ${props =>
                props.theme.nonFocusedSelectionBackgroundColor};
            color: ${props => props.theme.nonFocusedSelectionColor};
        }
    }

    &:focus {
        .eez-component-palette-item {
            &:hover {
                background-color: ${props => props.theme.hoverBackgroundColor};
                color: ${props => props.theme.hoverColor};
            }

            &.selected {
                background-color: ${props =>
                    props.theme.selectionBackgroundColor};
                color: ${props => props.theme.selectionColor};
            }

            &.dragging {
                background-color: ${props =>
                    props.theme.dragSourceBackgroundColor};
                color: ${props => props.theme.dragSourceColor};
            }
        }
    }
`;

@observer
export class ComponentsPalette extends React.Component<{
    showOnlyActions?: boolean;
}> {
    static contextType = ProjectContext;
    declare context: React.ContextType<typeof ProjectContext>;

    @observable selectedComponentClass: IObjectClassInfo | undefined;

    @action.bound
    onSelect(widgetClass: IObjectClassInfo | undefined) {
        this.selectedComponentClass = widgetClass;
    }

    @computed get allComponentClasses() {
        return getClassesDerivedFrom(
            this.props.showOnlyActions ? ActionComponent : Component
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
            <Panel
                id="widgets"
                title="Components Palette"
                buttons={[
                    <SearchInput
                        key="search-input"
                        searchText={this.searchText}
                        onChange={this.onSearchChange}
                        onKeyDown={this.onSearchChange}
                    />
                ]}
                body={
                    <ComponentsPaletteDiv tabIndex={0}>
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
                    </ComponentsPaletteDiv>
                }
            />
        );
    }
}
