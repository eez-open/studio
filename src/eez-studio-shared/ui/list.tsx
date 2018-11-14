import * as React from "react";
import { observer } from "mobx-react";
import * as classNames from "classnames";

import { Icon } from "eez-studio-shared/ui/icon";

export interface IListNode<T = any> {
    id: string;
    label?: string;
    data?: T;
    selected: boolean;
}

@observer
export class ListItem extends React.Component<
    {
        leftIcon?: string;
        leftIconSize?: number;
        leftIconClassName?: string;
        label: JSX.Element | string;
        rightIcon?: string;
        rightIconSize?: number;
        rightIconClassName?: string;
    },
    {}
> {
    render() {
        return (
            <div className="EezStudio_ListItem">
                <div>
                    {this.props.leftIcon && (
                        <Icon
                            icon={this.props.leftIcon}
                            size={this.props.leftIconSize}
                            className={this.props.leftIconClassName}
                        />
                    )}
                </div>
                <div>{this.props.label}</div>
                <div>
                    {this.props.rightIcon && (
                        <Icon
                            icon={this.props.rightIcon}
                            size={this.props.rightIconSize}
                            className={this.props.rightIconClassName}
                        />
                    )}
                </div>
            </div>
        );
    }
}

@observer
export class List extends React.Component<
    {
        nodes: IListNode[];
        selectNode?: (node: IListNode) => void;
        renderNode?: (node: IListNode) => JSX.Element;
        tabIndex?: any;
    },
    {}
> {
    render() {
        const { renderNode, tabIndex } = this.props;

        let nodes = this.props.nodes.map(node => {
            let className = classNames({
                EezStudio_Selected: node.selected
            });

            return (
                <div
                    key={node.id}
                    className={className}
                    onClick={(e: any) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (this.props.selectNode) {
                            this.props.selectNode(node);
                        }
                    }}
                >
                    {renderNode ? renderNode(node) : node.label}
                </div>
            );
        });

        let className = classNames("EezStudio_List", {
            EezStudio_List_Selectable: !!this.props.selectNode
        });

        return (
            <div className={className} tabIndex={tabIndex}>
                {nodes}
            </div>
        );
    }
}

@observer
export class ListContainer extends React.Component<
    {
        tabIndex: any;
        minHeight?: number;
        maxHeight?: number;
    },
    {}
> {
    render() {
        const { minHeight, maxHeight } = this.props;
        return (
            <div
                className="EezStudio_ListContainer"
                tabIndex={this.props.tabIndex}
                style={{ minHeight, maxHeight }}
            >
                {this.props.children}
            </div>
        );
    }
}
