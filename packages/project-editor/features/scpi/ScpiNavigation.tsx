import React from "react";
import { observer } from "mobx-react";

import { MenuNavigation } from "project-editor/components/MenuNavigation";
import { NavigationComponent } from "project-editor/core/object";
import { ProjectStore } from "project-editor/project/project";

////////////////////////////////////////////////////////////////////////////////

@observer
export class ScpiNavigation extends NavigationComponent {
    render() {
        return <MenuNavigation id={this.props.id} navigationObject={ProjectStore.project.scpi} />;
    }
}
