import React from "react";
import { observer } from "mobx-react";

import { ListAdapter } from "eez-studio-shared/model/objectAdapter";
import { Tree } from "eez-studio-shared/model/components/Tree";

////////////////////////////////////////////////////////////////////////////////

interface ListProps {
    listAdapter: ListAdapter;
    tabIndex?: number;
    onFocus?: () => void;
}

@observer
export class List extends React.Component<ListProps, {}> {
    render() {
        const { tabIndex, onFocus } = this.props;

        return <Tree treeAdapter={this.props.listAdapter} tabIndex={tabIndex} onFocus={onFocus} />;
    }
}
