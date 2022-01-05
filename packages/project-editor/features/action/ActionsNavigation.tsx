import React from "react";
import { observer } from "mobx-react";

import { ProjectContext } from "project-editor/project/context";
import { ListNavigation } from "project-editor/components/ListNavigation";
import { NavigationComponent } from "project-editor/project/NavigationComponent";

@observer
export class ActionsNavigation extends NavigationComponent {
    static contextType = ProjectContext;
    declare context: React.ContextType<typeof ProjectContext>;

    render() {
        return (
            <ListNavigation
                id={this.props.id}
                navigationObject={this.props.navigationObject}
                selectedObject={
                    this.context.navigationStore.selectedActionObject
                }
                editable={!this.context.runtime}
                onDoubleClickItem={this.props.onDoubleClickItem}
            />
        );
    }
}
