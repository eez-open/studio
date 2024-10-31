import React from "react";
import { observer } from "mobx-react";

import { TreeAdapter } from "project-editor/core/objectAdapter";
import { Tree } from "project-editor/ui-components/Tree";

////////////////////////////////////////////////////////////////////////////////

interface ListProps {
    listAdapter: TreeAdapter;
    tabIndex?: number;
    onFocus?: () => void;
    onEditItem?: (itemId: string) => void;
    renderItem?: (itemId: string) => React.ReactNode;
    onFilesDrop?: (files: File[]) => void;
}

export const List = observer(
    class List extends React.Component<ListProps, {}> {
        render() {
            const { tabIndex, onFocus, onEditItem, renderItem } = this.props;

            return (
                <Tree
                    treeAdapter={this.props.listAdapter}
                    tabIndex={tabIndex}
                    onFocus={onFocus}
                    onEditItem={onEditItem}
                    renderItem={renderItem}
                    onFilesDrop={this.props.onFilesDrop}
                />
            );
        }
    }
);
