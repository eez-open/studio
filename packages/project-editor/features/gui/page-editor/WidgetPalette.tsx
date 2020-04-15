import React from "react";
import { observable, action } from "mobx";
import { observer } from "mobx-react";
import classNames from "classnames";

import { humanize } from "eez-studio-shared/string";

import {
    EezClass,
    getClassesDerivedFrom,
    setId,
    getClass,
    getClassInfo
} from "project-editor/core/object";
import { loadObject } from "project-editor/core/serialization";
import { objectToClipboardData, setClipboardData } from "project-editor/core/clipboard";
import { DragAndDropManager } from "project-editor/core/dd";

import { Widget } from "project-editor/features/gui/widget";

import styled from "eez-studio-ui/styled-components";

////////////////////////////////////////////////////////////////////////////////

function getWidgetType(widgetClass: EezClass) {
    if (widgetClass.name.endsWith("Widget")) {
        return widgetClass.name.substring(0, widgetClass.name.length - "Widget".length);
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
        width: 48px;
        height: 48px;
        object-fit: contain;
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
    @action.bound
    onDragStart(event: any) {
        let protoObject = new this.props.widgetClass();
        let object = loadObject(
            undefined,
            JSON.parse(JSON.stringify(getClassInfo(protoObject).defaultValue!)),
            this.props.widgetClass
        );

        if (!(object as any).style) {
            (object as any).style = "default";
        }

        setId(object, "WidgetPaletteItem");

        setClipboardData(event, objectToClipboardData(object));

        event.dataTransfer.effectAllowed = "copy";

        event.dataTransfer.setDragImage(DragAndDropManager.blankDragImage, 0, 0);

        // postpone render, otherwise we can receive onDragEnd immediatelly
        setTimeout(() => {
            DragAndDropManager.start(event, object);
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
                getClass(DragAndDropManager.dragObject) === this.props.widgetClass
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
                {icon && <img src={icon} />}
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
            background-color: ${props => props.theme.nonFocusedSelectionBackgroundColor};
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
                background-color: ${props => props.theme.selectionBackgroundColor};
                color: ${props => props.theme.selectionColor};
            }

            &.dragging {
                background-color: ${props => props.theme.dragSourceBackgroundColor};
                color: ${props => props.theme.dragSourceColor};
            }
        }
    }
`;

@observer
export class WidgetPalette extends React.Component {
    @observable selectedWidgetClass: EezClass | undefined;

    @action.bound
    onSelect(widgetClass: EezClass | undefined) {
        this.selectedWidgetClass = widgetClass;
    }

    render() {
        let widgets = getClassesDerivedFrom(Widget)
            .filter(widgetClass => widgetClass.classInfo.creatableFromPalette !== false)
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
