import React from "react";
import { observer } from "mobx-react";

import { MenuNavigation } from "project-editor/project/ui/MenuNavigation";
import { NavigationComponent, getProperty } from "project-editor/model/object";
import { ProjectStore } from "project-editor/core/store";

////////////////////////////////////////////////////////////////////////////////

@observer
export class ScpiNavigation extends NavigationComponent {
    render() {
        return (
            <MenuNavigation
                id={this.props.id}
                navigationObject={getProperty(ProjectStore.project, "scpi")}
                content={this.props.content}
            />
        );
    }
}
