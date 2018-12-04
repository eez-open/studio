import React from "react";
import { observable, action } from "mobx";
import { observer } from "mobx-react";
import classNames from "classnames";

import { humanize } from "eez-studio-shared/string";

import { EezClass, getClassesDerivedFrom } from "eez-studio-shared/model/object";
import { objectToClipboardData, setClipboardData } from "eez-studio-shared/model/clipboard";
import { DragAndDropManager } from "eez-studio-shared/model/dd";

import { Widget, getWidgetType } from "eez-studio-page-editor/widget";

import styled from "eez-studio-ui/styled-components";

////////////////////////////////////////////////////////////////////////////////

const WidgetDiv = styled.div`
    margin: 5px;
    padding: 5px;
    cursor: -webkit-grab;
    display: flex;
    flex-direction: column;
    align-items: center;
    & > img {
        width: 100px;
        height: 100px;
        object-fit: contain;
    }
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
export class WidgetPalette extends React.Component<{
    baseWidgetClass?: EezClass;
}> {
    @observable
    selectedWidgetClass: EezClass | undefined;

    @action.bound
    onSelect(widgetClass: EezClass | undefined) {
        this.selectedWidgetClass = widgetClass;
    }

    render() {
        let widgets = getClassesDerivedFrom(this.props.baseWidgetClass || Widget).map(
            widgetClass => {
                return (
                    <PaletteItem
                        key={widgetClass.name}
                        widgetClass={widgetClass}
                        onSelect={this.onSelect}
                        selected={widgetClass === this.selectedWidgetClass}
                    />
                );
            }
        );

        return <WidgetPaletteDiv tabIndex={0}>{widgets}</WidgetPaletteDiv>;
    }
}
