import * as React from "react";
import { observer } from "mobx-react";
//import { DragSource, DragSourceConnector, DragSourceMonitor } from "react-dnd";
import * as classNames from "classnames";

import { Icon } from "shared/ui/icon";
import { IToolboxGroup, ITool } from "shared/ui/designer";

@observer
export class DndTool extends React.Component<
    {
        tool: ITool;
        selectTool: (tool: ITool | undefined) => void;
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
        let aClassName = classNames("list-group-item-action", {
            EezStudio_Selected: this.props.tool.selected
        });

        return (
            /*this.props.connectDragSource*/ <li className="EezStudio_Tool d-flex flex-row align-items-center">
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
const Tool = DndTool;

@observer
export class ToolboxGroup extends React.Component<
    {
        toolboxGroup: IToolboxGroup;
        selectTool: (tool: ITool | undefined) => void;
    },
    {}
> {
    render() {
        let className = classNames("EezStudio_ToolboxGroup", "p-2");

        return (
            <div className={className}>
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

@observer
export class Toolbox extends React.Component<
    {
        toolboxGroups: IToolboxGroup[];
        selectTool: (tool: ITool | undefined) => void;
        className: string;
    },
    {}
> {
    render() {
        let className = classNames("EezStudio_Toolbox", this.props.className);

        return (
            <div className={className}>
                {this.props.toolboxGroups.map(toolboxGroup => (
                    <ToolboxGroup
                        key={toolboxGroup.id}
                        toolboxGroup={toolboxGroup}
                        selectTool={this.props.selectTool}
                    />
                ))}
            </div>
        );
    }
}
