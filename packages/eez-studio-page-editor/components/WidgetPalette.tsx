import React from "react";
import { observable, action } from "mobx";
import { observer } from "mobx-react";
import classNames from "classnames";

import styled from "eez-studio-ui/styled-components";

import { EezClass } from "eez-studio-shared/model/object";
import { objectToClipboardData, setClipboardData } from "eez-studio-shared/model/clipboard";
import { DragAndDropManager } from "eez-studio-shared/model/dd";

import { getWidgetType, getWidgetClasses } from "eez-studio-page-editor/widget";

////////////////////////////////////////////////////////////////////////////////

const WidgetDiv = styled.div`
    cursor: -webkit-grab;
    border: 2px solid transparent;

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
`;

interface WidgetProps {
    widgetClass: EezClass;
    selected: boolean;
    onSelect: (widget: EezClass | undefined) => void;
}

@observer
class Widget extends React.Component<WidgetProps> {
    @action.bound
    onDragStart(event: any) {
        this.props.onSelect(undefined);

        let object = new this.props.widgetClass();
        Object.assign(object, object._classInfo.defaultValue!);

        if (!(object as any).style) {
            (object as any).style = "default";
        }

        object._id = "undefined";

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
                DragAndDropManager.dragObject._class === this.props.widgetClass
        });

        let label = getWidgetType(this.props.widgetClass);

        return (
            <WidgetDiv
                className={className}
                onClick={() => this.props.onSelect(this.props.widgetClass)}
                draggable={true}
                onDragStart={this.onDragStart}
                onDragEnd={this.onDragEnd}
            >
                {label}
            </WidgetDiv>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

const WidgetPaletteDiv = styled.div`
    overflow: auto;
    padding: 10px;
`;

@observer
export class WidgetPalette extends React.Component {
    @observable
    selectedWidgetClass: EezClass | undefined;

    @action.bound
    onSelect(widgetClass: EezClass | undefined) {
        this.selectedWidgetClass = widgetClass;
    }

    render() {
        let widgets = getWidgetClasses().map(widgetClass => {
            return (
                <Widget
                    key={widgetClass.name}
                    widgetClass={widgetClass}
                    onSelect={this.onSelect}
                    selected={widgetClass === this.selectedWidgetClass}
                />
            );
        });

        return (
            <WidgetPaletteDiv tabIndex={0}>
                <div>{widgets}</div>
            </WidgetPaletteDiv>
        );
    }
}
