import * as React from "react";
import { observer } from "mobx-react";
//import { DragSource, DragSourceConnector, DragSourceMonitor } from "react-dnd";
import * as classNames from "classnames";

import { Icon } from "shared/ui/icon";
import { IToolboxGroup, ITool } from "shared/ui/designer/designer-interfaces";
import styled from "shared/ui/styled-components";

@observer
export class DndTool extends React.Component<
    {
        tool: ITool;
        selectTool: (tool: ITool | undefined) => void;
        className?: string;
        //connectDragSource: any;
        //isDragging: boolean;
    },
    {}
> {
    constructor(props: any) {
        super(props);

        this.handleClick = this.handleClick.bind(this);
        this.handleDoubleClick = this.handleDoubleClick.bind(this);
    }

    handleClick(event: React.MouseEvent<HTMLAnchorElement>) {
        event.preventDefault();
        this.props.selectTool(this.props.tool);
    }

    handleDoubleClick() {
        this.props.selectTool(undefined);
    }

    render() {
        let className = classNames(this.props.className, "d-flex flex-row align-items-center");

        let aClassName = classNames("list-group-item-action", {
            EezStudio_Selected: this.props.tool.selected
        });

        return (
            /*this.props.connectDragSource*/ <li className={className}>
                <a
                    href="#"
                    className={aClassName}
                    title={this.props.tool.title}
                    onClick={this.handleClick}
                    onDoubleClick={this.handleDoubleClick}
                >
                    <span className="pr-2">
                        <Icon icon={this.props.tool.icon} size={this.props.tool.iconSize} />
                    </span>
                    {this.props.tool.label && <span>{this.props.tool.label}</span>}
                </a>
            </li>
        );
    }
}

// const Tool = DragSource(
//     "ToolFromToolbox",
//     {
//         beginDrag(props: any) {
//             props.selectTool(props.tool);
//             return {};
//         },

//         canDrag(props: any) {
//             return (props.tool as ITool).toolHandler.canDrag;
//         }
//     },
//     (connect: DragSourceConnector, monitor: DragSourceMonitor) => {
//         return {
//             connectDragSource: connect.dragSource(),
//             isDragging: monitor.isDragging()
//         };
//     }
// )(DndTool);
const Tool = styled(DndTool)`
    white-space: nowrap;
    overflow: hidden;

    .EezStudio_Selected {
        background-color: ${props => props.theme.selectionBackgroundColor};
        color: @selection-color;
    }
`;

@observer
export class ToolboxGroup extends React.Component<
    {
        toolboxGroup: IToolboxGroup;
        selectTool: (tool: ITool | undefined) => void;
    },
    {}
> {
    render() {
        return (
            <div className="p-2">
                {this.props.toolboxGroup.label && <h5>{this.props.toolboxGroup.label}</h5>}
                <ul className="list-unstyled">
                    {this.props.toolboxGroup.tools.map(tool => (
                        <Tool key={tool.id} tool={tool} selectTool={this.props.selectTool} />
                    ))}
                </ul>
            </div>
        );
    }
}

const ToolboxContainer = styled.div`
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    background-color: ${props => props.theme.panelHeaderColor};
    pointer-events: all;
`;

@observer
export class Toolbox extends React.Component<
    {
        toolboxGroups: IToolboxGroup[];
        selectTool: (tool: ITool | undefined) => void;
    },
    {}
> {
    render() {
        return (
            <ToolboxContainer>
                {this.props.toolboxGroups.map(toolboxGroup => (
                    <ToolboxGroup
                        key={toolboxGroup.id}
                        toolboxGroup={toolboxGroup}
                        selectTool={this.props.selectTool}
                    />
                ))}
            </ToolboxContainer>
        );
    }
}
