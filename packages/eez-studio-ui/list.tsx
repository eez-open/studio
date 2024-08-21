import React from "react";
import { observer } from "mobx-react";
import classNames from "classnames";

import { Icon } from "eez-studio-ui/icon";

export interface IListNode<T = any> {
    id: string;
    label?: React.ReactNode;
    data: T;
    selected: boolean;
}

export const ListItem = observer(
    class ListItem extends React.Component<
        {
            leftIcon?: React.ReactNode;
            leftIconSize?: number;
            leftIconClassName?: string;
            label: React.ReactNode;
            rightIcon?: React.ReactNode;
            rightIconSize?: number;
            rightIconClassName?: string;
        },
        {}
    > {
        render() {
            let leftIcon;
            if (this.props.leftIcon) {
                if (typeof this.props.leftIcon == "string") {
                    leftIcon = (
                        <Icon
                            icon={this.props.leftIcon}
                            size={this.props.leftIconSize}
                            className={this.props.leftIconClassName}
                        />
                    );
                } else {
                    leftIcon = this.props.leftIcon;
                }
            }

            let rightIcon;
            if (this.props.rightIcon) {
                if (typeof this.props.rightIcon == "string") {
                    rightIcon = (
                        <Icon
                            icon={this.props.rightIcon}
                            size={this.props.rightIconSize}
                            className={this.props.rightIconClassName}
                        />
                    );
                } else {
                    rightIcon = this.props.rightIcon;
                }
            }

            return (
                <>
                    <div>{leftIcon}</div>
                    <div>{this.props.label}</div>
                    {rightIcon && <div>{rightIcon}</div>}
                </>
            );
        }
    }
);

export const List = observer(
    class List extends React.Component<
        {
            nodes: IListNode[];
            selectNode?: (node: IListNode) => void;
            renderNode?: (node: IListNode) => React.ReactNode;
            onContextMenu?: (node: IListNode) => void;
            onDoubleClick?: (node: IListNode) => void;
            tabIndex?: any;
            className?: string;
            style?: React.CSSProperties;
        },
        {}
    > {
        render() {
            const { renderNode, tabIndex } = this.props;

            let nodes = this.props.nodes.map(node => {
                let className = classNames("EezStudio_ListItem", {
                    EezStudio_Selected: node.selected
                });

                return (
                    <div
                        key={node.id}
                        className={className}
                        onClick={
                            this.props.selectNode
                                ? (e: any) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      if (this.props.selectNode) {
                                          this.props.selectNode(node);
                                      }
                                  }
                                : undefined
                        }
                        onDoubleClick={
                            this.props.onDoubleClick
                                ? (e: any) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      if (this.props.onDoubleClick) {
                                          this.props.onDoubleClick(node);
                                      }
                                  }
                                : undefined
                        }
                        onContextMenu={
                            this.props.onContextMenu
                                ? (event: React.MouseEvent<HTMLDivElement>) => {
                                      event.preventDefault();
                                      event.stopPropagation();
                                      this.props.onContextMenu!(node);
                                  }
                                : undefined
                        }
                    >
                        {renderNode ? renderNode(node) : node.label}
                    </div>
                );
            });

            let className = classNames(
                "EezStudio_List",
                {
                    EezStudio_List_Selectable: !!this.props.selectNode
                },
                this.props.className
            );

            return (
                <div
                    className={className}
                    style={this.props.style}
                    tabIndex={tabIndex}
                >
                    {nodes}
                </div>
            );
        }
    }
);

export const ListContainer = observer(
    class ListContainer extends React.Component<{
        children?: React.ReactNode;
        tabIndex: any;
        minHeight?: number;
        maxHeight?: number;
        maxWidth?: number;
        className?: string;
    }> {
        render() {
            const { minHeight, maxHeight, maxWidth } = this.props;
            return (
                <div
                    className={classNames(
                        "EezStudio_ListContainer",
                        this.props.className
                    )}
                    tabIndex={this.props.tabIndex}
                    style={{ minHeight, maxHeight, maxWidth }}
                >
                    {this.props.children}
                </div>
            );
        }
    }
);
