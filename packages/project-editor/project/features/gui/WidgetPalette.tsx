import React from "react";
import classNames from "classnames";

import styled from "eez-studio-ui/styled-components";

import { EezClass } from "project-editor/core/object";
import { objectToClipboardData, setClipboardData } from "project-editor/core/clipboard";
import { DragAndDropManager } from "project-editor/core/dd";

import { getWidgetType, widgetClasses } from "project-editor/project/features/gui/widget";

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

interface WidgetState {
    dragging: boolean;
}

class Widget extends React.Component<WidgetProps, WidgetState> {
    constructor(props: WidgetProps) {
        super(props);
        this.state = {
            dragging: false
        };
    }

    onDragStart(event: any) {
        this.props.onSelect(undefined);

        this.setState({
            dragging: true
        });

        let object = new this.props.widgetClass();
        Object.assign(object, object._classInfo.defaultValue!);

        if (!(object as any).style) {
            (object as any).style = "default";
        }

        object._id = "undefined";

        setClipboardData(event, objectToClipboardData(object));

        event.dataTransfer.effectAllowed = "copy";

        event.dataTransfer.setDragImage(DragAndDropManager.blankDragImage, 0, 0);
    }

    onDragEnd() {
        this.setState({
            dragging: false
        });
    }

    onSelect() {
        this.props.onSelect(undefined);
    }

    render() {
        let className = classNames({
            selected: this.props.selected,
            dragging: this.state.dragging
        });

        let label = getWidgetType(this.props.widgetClass);

        return (
            <WidgetDiv
                className={className}
                onClick={this.onSelect.bind(this)}
                draggable={true}
                onDragStart={this.onDragStart.bind(this)}
                onDragEnd={this.onDragEnd.bind(this)}
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

export class WidgetPalette extends React.Component<
    {},
    {
        selectedWidgetClass: EezClass | undefined;
    }
> {
    constructor(props: {}) {
        super(props);
        this.state = {
            selectedWidgetClass: undefined
        };
    }

    onSelect(widgetClass: EezClass | undefined) {
        this.setState({
            selectedWidgetClass: widgetClass
        });
    }

    render() {
        let widgets = widgetClasses.map(widgetClass => {
            return (
                <Widget
                    key={widgetClass.name}
                    widgetClass={widgetClass}
                    onSelect={this.onSelect.bind(this, widgetClass)}
                    selected={widgetClass == this.state.selectedWidgetClass}
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
