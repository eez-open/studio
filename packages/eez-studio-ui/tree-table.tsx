import React from "react";
import { action } from "mobx";
import { observer } from "mobx-react";
import classNames from "classnames";

import { capitalize } from "eez-studio-shared/string";
import { Icon } from "eez-studio-ui/icon";

////////////////////////////////////////////////////////////////////////////////

interface ITableProps {
    className?: string;
    columns: IColumn[];

    showOnlyChildren: boolean;
    rootNode: ITreeNode;
    selectNode: (node: ITreeNode) => void;
}

export interface IColumn {
    name: string;
    title: string;
}

export interface ITreeNode<T = any> {
    id: string;

    // labels
    [column: string]: any;

    children: (() => ITreeNode[]) | undefined;
    selected: boolean;
    expanded: {
        get(): boolean;
        set(value: boolean): void;
    };
    data?: T;

    className?: string;
}

////////////////////////////////////////////////////////////////////////////////

const TreeTableRow = observer(
    class TreeTableRow extends React.Component<{
        columns: IColumn[];
        showOnlyChildren: boolean;
        node: ITreeNode;
        level: number;
        selectNode: (node: ITreeNode) => void;
    }> {
        onTriangleClick = action((event: any) => {
            event.preventDefault();
            event.stopPropagation();

            this.props.selectNode(this.props.node);
            this.props.node.expanded.set(!this.props.node.expanded.get());
        });

        onClick = (e: React.MouseEvent<HTMLDivElement>) => {
            e.preventDefault();
            e.stopPropagation();

            this.props.selectNode(this.props.node);
        };

        render() {
            let childrenRows: JSX.Element[] = [];

            if (this.props.showOnlyChildren || this.props.node.expanded.get()) {
                let childrenLevel = this.props.showOnlyChildren
                    ? this.props.level
                    : this.props.level + 1;

                if (this.props.node.children) {
                    this.props.node.children().forEach(child => {
                        childrenRows.push(
                            <TreeTableRow
                                key={child.id}
                                columns={this.props.columns}
                                showOnlyChildren={false}
                                node={child}
                                level={childrenLevel}
                                selectNode={this.props.selectNode}
                            />
                        );
                    });
                }
            }

            let row: JSX.Element | undefined;

            if (!this.props.showOnlyChildren) {
                let className = classNames("EezStudio_TreeRow", {
                    EezStudio_Selected: this.props.node.selected
                });

                const firstColumn = this.props.columns[0];

                let labelText = this.props.node[firstColumn.name];
                let labelTitle = this.props.node[firstColumn.name + "Title"];

                let label: JSX.Element | undefined;
                let triangle: JSX.Element | undefined;

                if (this.props.node.children) {
                    let triangleClassName = classNames(
                        "EezStudio_TreeRowTriangle",
                        {
                            EezStudio_Expanded: this.props.node.expanded.get()
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
                        <span
                            className="EezStudio_TreeRowLabel_Triangle"
                            title={labelTitle}
                        >
                            {labelText}
                        </span>
                    );
                } else {
                    label = (
                        <span
                            className="EezStudio_TreeRowLabel"
                            title={labelTitle}
                        >
                            {labelText}
                        </span>
                    );
                }

                row = (
                    <tr
                        data-object-id={this.props.node.id}
                        className={className}
                        onClick={this.onClick}
                    >
                        <td
                            className={classNames(
                                this.props.node.className,
                                "col" + capitalize(firstColumn.name)
                            )}
                            style={{ paddingLeft: this.props.level * 20 }}
                        >
                            {triangle}
                            {label}
                        </td>
                        {this.props.columns.slice(1).map(column => (
                            <td
                                key={column.name}
                                className={classNames(
                                    this.props.node.className,
                                    "col" + capitalize(column.name)
                                )}
                                title={this.props.node[column.name + "Title"]}
                            >
                                {column.name + "Component" in this.props.node
                                    ? this.props.node[column.name + "Component"]
                                    : this.props.node[column.name]}
                            </td>
                        ))}
                    </tr>
                );
            }

            return (
                <>
                    {row}
                    {childrenRows}
                </>
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

export const TreeTable = observer(
    class TreeTable extends React.Component<ITableProps> {
        columnClassName(column: IColumn) {
            let className = "col" + capitalize(column.name);

            return className;
        }

        render() {
            let className = classNames(
                "table EezStudio_TreeTable",
                this.props.className
            );

            return (
                <table className={className} tabIndex={-1}>
                    <thead>
                        <tr>
                            {this.props.columns.map(column => (
                                <th
                                    key={column.name}
                                    className={this.columnClassName(column)}
                                >
                                    {column.title}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        <TreeTableRow
                            columns={this.props.columns}
                            showOnlyChildren={this.props.showOnlyChildren}
                            node={this.props.rootNode}
                            level={0}
                            selectNode={this.props.selectNode}
                        />
                    </tbody>
                </table>
            );
        }
    }
);
