import React from "react";
import { action, IObservableValue, observable, makeObservable } from "mobx";
import { observer } from "mobx-react";
import classNames from "classnames";

import { Icon } from "eez-studio-ui/icon";

export interface ITreeNode<T = any> {
    id: string;
    label: React.ReactNode;
    children: ITreeNode[];
    selected: boolean;
    selectable?: boolean;
    expanded: boolean;
    data?: T;
    className?: string;
}

////////////////////////////////////////////////////////////////////////////////

export const TreeRow = observer(
    class TreeRow extends React.Component<{
        showOnlyChildren: boolean;
        node: ITreeNode;
        level: number;
        selectNode: (node: ITreeNode) => void;
        onDoubleClick?: () => void;
        getExpanded: (level: number, node: ITreeNode) => boolean;
        toggleExpanded: (level: number, node: ITreeNode) => void;
        collapsable: boolean;
        rowPadding?: number;
    }> {
        constructor(props: any) {
            super(props);

            makeObservable(this, {
                onTriangleClick: action
            });
        }

        onTriangleClick = (event: any) => {
            event.preventDefault();
            event.stopPropagation();

            this.props.selectNode(this.props.node);
            this.props.toggleExpanded(this.props.level, this.props.node);
        };

        onClick = (e: React.MouseEvent<HTMLDivElement>) => {
            e.preventDefault();
            e.stopPropagation();

            this.props.selectNode(this.props.node);
        };

        render() {
            let childrenRows: JSX.Element[] = [];

            if (
                this.props.showOnlyChildren ||
                this.props.getExpanded(this.props.level, this.props.node)
            ) {
                let childrenLevel = this.props.showOnlyChildren
                    ? this.props.level
                    : this.props.level + 1;

                this.props.node.children.forEach(child => {
                    childrenRows.push(
                        <TreeRow
                            key={child.id}
                            showOnlyChildren={false}
                            node={child}
                            level={childrenLevel}
                            selectNode={this.props.selectNode}
                            onDoubleClick={this.props.onDoubleClick}
                            getExpanded={this.props.getExpanded}
                            toggleExpanded={this.props.toggleExpanded}
                            collapsable={this.props.collapsable}
                            rowPadding={this.props.rowPadding}
                        />
                    );
                });
            }

            let rowEnclosureClassName = "EezStudio_TreeRowEnclosure";

            let row: JSX.Element | undefined;

            if (!this.props.showOnlyChildren) {
                let className = classNames(
                    "EezStudio_TreeRow",
                    this.props.node.className,
                    {
                        selectable:
                            this.props.node.selectable != undefined
                                ? this.props.node.selectable
                                : true,
                        EezStudio_Selected: this.props.node.selected
                    }
                );

                let labelText = this.props.node.label;

                let label: JSX.Element | undefined;
                let triangle: JSX.Element | undefined;

                if (
                    this.props.collapsable &&
                    this.props.node.children.length > 0
                ) {
                    let triangleClassName = classNames(
                        "EezStudio_TreeRowTriangle",
                        {
                            EezStudio_Expanded: this.props.getExpanded(
                                this.props.level,
                                this.props.node
                            )
                        }
                    );

                    triangle = (
                        <span
                            className={triangleClassName}
                            onClick={this.onTriangleClick}
                        >
                            <Icon
                                icon="material:keyboard_arrow_right"
                                size={18}
                            />
                        </span>
                    );
                    label = (
                        <span className="EezStudio_TreeRowLabel_Triangle">
                            {labelText}
                        </span>
                    );
                } else {
                    label = (
                        <span className="EezStudio_TreeRowLabel">
                            {labelText}
                        </span>
                    );
                }

                row = (
                    <div
                        data-object-id={this.props.node.id}
                        className={className}
                        style={{
                            paddingLeft:
                                this.props.level * (this.props.rowPadding ?? 20)
                        }}
                        onClick={this.onClick}
                    >
                        {triangle}
                        {label}
                    </div>
                );
            }

            return (
                <div
                    className={rowEnclosureClassName}
                    onDoubleClick={event => {
                        if (this.props.onDoubleClick) {
                            event.preventDefault();
                            event.stopPropagation();
                            this.props.onDoubleClick();
                        }
                    }}
                >
                    {row}
                    {childrenRows}
                </div>
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

export const Tree = observer(
    class Tree extends React.Component<
        {
            showOnlyChildren: boolean;
            rootNode: ITreeNode;
            selectNode: (node: ITreeNode) => void;
            onDoubleClick?: () => void;
            className?: string;
            style?: React.CSSProperties;
            collapsable?: boolean;
            rowPadding?: number;
        },
        {}
    > {
        expandedValues = new Map<string, IObservableValue<boolean>>();

        getExpanded = (level: number, node: ITreeNode) => {
            const key = `${level}:${node.id}`;
            let observableValue = this.expandedValues.get(key);
            if (observableValue == undefined) {
                observableValue = observable.box(node.expanded);
                this.expandedValues.set(key, observableValue);
            }
            return observableValue.get();
        };

        toggleExpanded = (level: number, node: ITreeNode) => {
            const key = `${level}:${node.id}`;
            let observableValue = this.expandedValues.get(key);
            if (observableValue) {
                observableValue.set(!observableValue.get());
            }
        };

        findNodeByID(node: ITreeNode, id: string): ITreeNode | undefined {
            if (node.id == id) {
                return node;
            }

            for (const child of node.children) {
                const found = this.findNodeByID(child, id);
                if (found) {
                    return found;
                }
            }

            return undefined;
        }

        onSelectByID(id: string) {
            const node = this.findNodeByID(this.props.rootNode, id);
            if (node) {
                this.props.selectNode(node);
            }
        }

        onKeyDown = (event: any) => {
            let focusedItemId = $(event.target)
                .find(".EezStudio_Selected")
                .attr("data-object-id");

            if (!focusedItemId) {
                return;
            }

            let $focusedItem = $(event.target).find(
                `.EezStudio_TreeRow[data-object-id="${focusedItemId}"]`
            );

            if (
                event.keyCode == 38 ||
                event.keyCode == 40 ||
                event.keyCode == 33 ||
                event.keyCode == 34 ||
                event.keyCode == 36 ||
                event.keyCode == 35
            ) {
                let $rows = $(event.target).find(".EezStudio_TreeRow");
                let index = $rows.index($focusedItem);

                let pageSize = Math.floor(
                    $(event.target).height()! / $rows.height()!
                );

                if (event.keyCode == 38) {
                    // up
                    index--;
                } else if (event.keyCode == 40) {
                    // down
                    index++;
                } else if (event.keyCode == 33) {
                    // page up
                    index -= pageSize;
                } else if (event.keyCode == 34) {
                    // page down
                    index += pageSize;
                } else if (event.keyCode == 36) {
                    // home
                    index = 0;
                } else if (event.keyCode == 35) {
                    // end
                    index = $rows.length - 1;
                }

                if (index < 0) {
                    index = 0;
                } else if (index >= $rows.length) {
                    index = $rows.length - 1;
                }

                let newFocusedItemId = $($rows[index]).attr("data-object-id");
                if (newFocusedItemId) {
                    this.onSelectByID(newFocusedItemId);
                    ($rows[index] as Element).scrollIntoView({
                        block: "nearest",
                        behavior: "auto"
                    });
                }

                event.preventDefault();
            } else if (event.keyCode == 37) {
                // left
                let $rows = $focusedItem.parent().find(".EezStudio_TreeRow");
                if ($rows.length == 1) {
                    let $row = $($rows[0]);
                    $rows = $row.parent().parent().find(".EezStudio_TreeRow");
                    let newFocusedItemId = $($rows[0]).attr("data-object-id");
                    if (newFocusedItemId) {
                        this.onSelectByID(newFocusedItemId);
                    }
                } else {
                    $focusedItem
                        .find(".EezStudio_TreeRowTriangle")
                        .trigger("click");
                }

                event.preventDefault();
            } else if (event.keyCode == 39) {
                // right
                $focusedItem
                    .find(".EezStudio_TreeRowTriangle:not(.EezStudio_Expanded)")
                    .trigger("click");
            }
        };

        render() {
            return (
                <div
                    className={classNames(
                        "EezStudio_SimpleTree",
                        this.props.className
                    )}
                    tabIndex={0}
                    style={this.props.style}
                    onKeyDown={this.onKeyDown}
                >
                    <TreeRow
                        showOnlyChildren={this.props.showOnlyChildren}
                        node={this.props.rootNode}
                        level={0}
                        selectNode={this.props.selectNode}
                        onDoubleClick={this.props.onDoubleClick}
                        getExpanded={this.getExpanded}
                        toggleExpanded={this.toggleExpanded}
                        collapsable={this.props.collapsable ?? true}
                        rowPadding={this.props.rowPadding}
                    />
                </div>
            );
        }
    }
);
