import React from "react";
import { observable, action } from "mobx";
import { observer } from "mobx-react";
import classNames from "classnames";

import { humanize } from "eez-studio-shared/string";
import { objectClone } from "eez-studio-shared/util";

import {
    EezClass,
    getClassesDerivedFrom,
    setId,
    getClass
} from "project-editor/core/object";
import { loadObject } from "project-editor/core/serialization";
import {
    objectToClipboardData,
    setClipboardData
} from "project-editor/core/clipboard";
import { DragAndDropManager } from "project-editor/core/dd";

import { getTypeFromClass, Widget } from "project-editor/features/gui/widget";

import styled from "eez-studio-ui/styled-components";
import { ProjectContext } from "project-editor/project/context";

////////////////////////////////////////////////////////////////////////////////

function getWidgetType(widgetClass: EezClass) {
    if (widgetClass.name.endsWith("Widget")) {
        return widgetClass.name.substring(
            0,
            widgetClass.name.length - "Widget".length
        );
    }

    if (widgetClass.name.endsWith("ActionNode")) {
        return widgetClass.name.substring(
            0,
            widgetClass.name.length - "ActionNode".length
        );
    }

    return widgetClass.name;
}

////////////////////////////////////////////////////////////////////////////////

const WidgetDiv = styled.div`
    margin: 2px;
    padding: 2px;
    width: 85px;
    height: 75px;
    cursor: -webkit-grab;
    display: flex;
    flex-direction: column;
    align-items: center;
    & > img {
        width: 32px;
        height: 32px;
        object-fit: contain;
    }
    & > svg {
        width: 32px;
        height: 32px;
    }
    white-space: nowrap;
`;

interface PaletteItemProps {
    widgetClass: EezClass;
    selected: boolean;
    onSelect: (widget: EezClass | undefined) => void;
}

@observer
class PaletteItem extends React.Component<PaletteItemProps> {
    static contextType = ProjectContext;
    declare context: React.ContextType<typeof ProjectContext>;

    @action.bound
    onDragStart(event: any) {
        let protoObject = new this.props.widgetClass();

        const widgetClass = getClass(protoObject);
        const defaultValue = objectClone(widgetClass.classInfo.defaultValue!);

        if (!defaultValue.type) {
            defaultValue.type = getTypeFromClass(widgetClass);
        }

        let object = loadObject(
            this.context,
            undefined,
            defaultValue,
            this.props.widgetClass
        ) as Widget;

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

        setId(this.context.objects, object, "WidgetPaletteItem");

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
        let className = classNames({
            selected: this.props.selected,
            dragging:
                DragAndDropManager.dragObject &&
                getClass(DragAndDropManager.dragObject) ===
                    this.props.widgetClass
        });

        let icon = this.props.widgetClass.classInfo.icon;
        let label = humanize(getWidgetType(this.props.widgetClass));

        return (
            <WidgetDiv
                className={className}
                onClick={() => this.props.onSelect(this.props.widgetClass)}
                draggable={true}
                onDragStart={this.onDragStart}
                onDragEnd={this.onDragEnd}
            >
                {typeof icon === "string" ? <img src={icon} /> : icon}
                {label}
            </WidgetDiv>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

const WidgetPaletteDiv = styled.div`
    overflow: auto;
    padding: 5px;
    padding-right: 0;
    flex-grow: 1;

    display: flex;
    flex-wrap: wrap;
    align-content: flex-start;
    align-items: flex-start;

    & > div {
        &.selected {
            background-color: ${props =>
                props.theme.nonFocusedSelectionBackgroundColor};
            color: ${props => props.theme.nonFocusedSelectionColor};
        }
    }

    &:focus {
        & > div {
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
export class WidgetPalette extends React.Component<{
    widgetClass?: EezClass;
}> {
    @observable selectedWidgetClass: EezClass | undefined;

    @action.bound
    onSelect(widgetClass: EezClass | undefined) {
        this.selectedWidgetClass = widgetClass;
    }

    render() {
        let widgets = getClassesDerivedFrom(this.props.widgetClass || Widget)
            .filter(
                widgetClass =>
                    widgetClass.classInfo.creatableFromPalette !== false
            )
            .map(widgetClass => {
                return (
                    <PaletteItem
                        key={widgetClass.name}
                        widgetClass={widgetClass}
                        onSelect={this.onSelect}
                        selected={widgetClass === this.selectedWidgetClass}
                    />
                );
            });

        return <WidgetPaletteDiv tabIndex={0}>{widgets}</WidgetPaletteDiv>;
    }
}
