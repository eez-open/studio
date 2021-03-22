import React from "react";
import { action } from "mobx";
import { observer } from "mobx-react";

import { DebugStoreClass } from "project-editor/core/store";

@observer
export class DebugPanel extends React.Component<{
    DebugStore: DebugStoreClass;
}> {
    render() {
        return (
            <div>
                <label>
                    <input
                        type="checkbox"
                        checked={this.props.DebugStore.isActive}
                        onChange={action(
                            e =>
                                (this.props.DebugStore.isActive =
                                    e.target.checked)
                        )}
                    ></input>
                    Debug active
                </label>
            </div>
        );
    }
}
