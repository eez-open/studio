import React from "react";
import classNames from "classnames";

import styled from "eez-studio-ui/styled-components";

import { objectToClipboardData, setClipboardData, setEez } from "project-editor/core/store";
import { DragAndDropManager } from "project-editor/core/dd";

import { widgetMetaData, WidgetType } from "project-editor/project/features/gui/widget";
import { getWidgetTypes } from "project-editor/project/features/gui/widget";

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
    widget: WidgetType;
    selected: boolean;
    onSelect: (widget: WidgetType | undefined) => void;
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

        let object = (this.props.widget as WidgetType)["create"]();

        if (!(object as any).style) {
            (object as any).style = "default";
        }

        setEez(object, {
            id: "undefined",
            metaData: widgetMetaData
        });

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

        let label = (this.props.widget as any)["id"] || (this.props.widget as any)["name"];

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
        selectedWidget: WidgetType | undefined;
    }
> {
    constructor(props: {}) {
        super(props);
        this.state = {
            selectedWidget: undefined
        };
    }

    onSelect(widget: WidgetType | undefined) {
        this.setState({
            selectedWidget: widget
        });
    }

    render() {
        let widgets = getWidgetTypes().map(widget => {
            return (
                <Widget
                    key={widget.id}
                    widget={widget}
                    onSelect={this.onSelect.bind(this, widget)}
                    selected={widget == this.state.selectedWidget}
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
