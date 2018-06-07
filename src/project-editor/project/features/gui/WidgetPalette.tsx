import * as React from "react";

import { ProjectStore, objectToClipboardData, setClipboardData } from "project-editor/core/store";
import { EezObject } from "project-editor/core/metaData";
import { DragAndDropManager } from "project-editor/core/dd";

import { GuiProperties } from "project-editor/project/features/gui/gui";
import { widgetMetaData, WidgetType } from "project-editor/project/features/gui/widget";
import { getWidgetTypes } from "project-editor/project/features/gui/widget";
import { WidgetTypeProperties } from "project-editor/project/features/gui/widgetType";

////////////////////////////////////////////////////////////////////////////////

interface WidgetProps {
    widget: WidgetType | WidgetTypeProperties;
    selected: boolean;
    onSelect: (widget: WidgetType | WidgetTypeProperties | undefined) => void;
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

        let object: EezObject;
        if ((this.props.widget as WidgetType)["create"]) {
            object = (this.props.widget as WidgetType)["create"]();
        } else {
            let widgetTypeProperties = this.props.widget as WidgetTypeProperties;
            object = {
                type: "Local." + widgetTypeProperties.name,
                x: 0,
                y: 0,
                width: widgetTypeProperties.width,
                height: widgetTypeProperties.height
            } as any;
        }
        if (!object["style"]) {
            object["style"] = "default";
        }
        object.$eez = {
            id: "undefined",
            metaData: widgetMetaData
        };

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
        let className = "EezStudio_ProjectEditor_widget-palette-widget";
        if (this.props.selected) {
            className += " selected";
        }
        if (this.state.dragging) {
            className += " dragging";
        }

        let label = (this.props.widget as any)["id"] || (this.props.widget as any)["name"];

        return (
            <div
                className={className}
                onClick={this.onSelect.bind(this)}
                draggable={true}
                onDragStart={this.onDragStart.bind(this)}
                onDragEnd={this.onDragEnd.bind(this)}
            >
                {label}
            </div>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

export class WidgetPalette extends React.Component<
    {},
    {
        selectedWidget: WidgetType | WidgetTypeProperties | undefined;
    }
> {
    constructor(props: {}) {
        super(props);
        this.state = {
            selectedWidget: undefined
        };
    }

    onSelect(widget: WidgetType | WidgetTypeProperties | undefined) {
        this.setState({
            selectedWidget: widget
        });
    }

    render() {
        let generalWidgets = getWidgetTypes().map(widget => {
            return (
                <Widget
                    key={widget.id}
                    widget={widget}
                    onSelect={this.onSelect.bind(this, widget)}
                    selected={widget == this.state.selectedWidget}
                />
            );
        });

        let localWidgets = (ProjectStore.projectProperties["gui"] as GuiProperties).widgets.map(
            widgetType => {
                return (
                    <Widget
                        key={"Local." + widgetType.name}
                        widget={widgetType}
                        onSelect={this.onSelect.bind(this, widgetType)}
                        selected={widgetType == this.state.selectedWidget}
                    />
                );
            }
        );

        return (
            <div tabIndex={0} className="EezStudio_ProjectEditor_widget-palette layoutCenter">
                <h4>General</h4>
                <div>{generalWidgets}</div>
                <h4>Local</h4>
                <div>{localWidgets}</div>
            </div>
        );
    }
}
