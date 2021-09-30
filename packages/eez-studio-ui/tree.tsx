import React from "react";
import { action } from "mobx";
import { observer } from "mobx-react";
import classNames from "classnames";

import { Icon } from "eez-studio-ui/icon";

export interface ITreeNode<T = any> {
    id: string;
    label: React.ReactNode;
    children: ITreeNode[];
    selected: boolean;
    expanded: boolean;
    data?: T;
}

////////////////////////////////////////////////////////////////////////////////

@observer
export class TreeRow extends React.Component<{
    showOnlyChildren: boolean;
    node: ITreeNode;
    level: number;
    selectNode: (node: ITreeNode) => void;
}> {
    index: number;

    @action
    onTriangleClick(event: any) {
        event.preventDefault();
        event.stopPropagation();

        this.props.selectNode(this.props.node);
        this.props.node.expanded = !this.props.node.expanded;
    }

    onClick(e: React.MouseEvent<HTMLDivElement>) {
        e.preventDefault();
        e.stopPropagation();

        this.props.selectNode(this.props.node);
    }

    render() {
        let childrenRows: JSX.Element[] = [];

        if (this.props.showOnlyChildren || this.props.node.expanded) {
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
                    />
                );
            });
        }

        let rowEnclosureClassName = "EezStudio_TreeRowEnclosure";

        let row: JSX.Element | undefined;

        if (!this.props.showOnlyChildren) {
            let className = classNames("EezStudio_TreeRow", {
                EezStudio_Selected: this.props.node.selected
            });

            let labelText = this.props.node.label;

            let label: JSX.Element | undefined;
            let triangle: JSX.Element | undefined;

            if (this.props.node.children.length > 0) {
                let triangleClassName = classNames(
                    "EezStudio_TreeRowTriangle",
                    {
                        EezStudio_Expanded: this.props.node.expanded
                    }
                );

                triangle = (
                    <span
                        className={triangleClassName}
                        onClick={this.onTriangleClick.bind(this)}
                    >
                        <Icon icon="material:keyboard_arrow_right" size={18} />
                    </span>
                );
                label = <span>{labelText}</span>;
            } else {
                label = (
                    <span className="EezStudio_TreeRowLabel">{labelText}</span>
                );
            }

            row = (
                <div
                    data-object-id={this.props.node.id}
                    className={className}
                    style={{ paddingLeft: this.props.level * 20 }}
                    onClick={this.onClick.bind(this)}
                >
                    {triangle}
                    {label}
                </div>
            );
        }

        return (
            <div className={rowEnclosureClassName}>
                {row}
                {childrenRows}
            </div>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

@observer
export class Tree extends React.Component<
    {
        showOnlyChildren: boolean;
        rootNode: ITreeNode;
        selectNode: (node: ITreeNode) => void;
    },
    {}
> {
    render() {
        return (
            <div className="EezStudio_SimpleTree" tabIndex={0}>
                <TreeRow
                    showOnlyChildren={this.props.showOnlyChildren}
                    node={this.props.rootNode}
                    level={0}
                    selectNode={this.props.selectNode}
                />
            </div>
        );
    }
}
