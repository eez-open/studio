import React from "react";
import { observer } from "mobx-react";

import { MenuNavigation } from "project-editor/components/MenuNavigation";
import { NavigationComponent } from "project-editor/core/object";
import { ProjectContext } from "project-editor/project/context";

////////////////////////////////////////////////////////////////////////////////

@observer
export class ScpiNavigation extends NavigationComponent {
    static contextType = ProjectContext;
    declare context: React.ContextType<typeof ProjectContext>

    render() {
        return <MenuNavigation id={this.props.id} navigationObject={this.context.project.scpi} />;
    }
}
