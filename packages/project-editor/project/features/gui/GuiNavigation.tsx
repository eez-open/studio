import React from "react";
import { observer } from "mobx-react";

import { MenuNavigation } from "project-editor/project/MenuNavigation";
import { NavigationComponent } from "project-editor/core/object";
import { ProjectStore, getProperty } from "project-editor/core/store";

////////////////////////////////////////////////////////////////////////////////

@observer
export class GuiNavigation extends NavigationComponent {
    render() {
        return (
            <MenuNavigation
                id={this.props.id}
                navigationObject={getProperty(ProjectStore.project, "gui")}
                content={this.props.content}
            />
        );
    }
}
