import * as React from "react";
import { observer } from "mobx-react";

import { MenuNavigation } from "project-editor/project/MenuNavigation";
import { NavigationComponent } from "project-editor/core/metaData";
import { ProjectStore } from "project-editor/core/store";

////////////////////////////////////////////////////////////////////////////////

@observer
export class GuiNavigation extends NavigationComponent {
    render() {
        return (
            <MenuNavigation
                id={this.props.id}
                navigationObject={ProjectStore.projectProperties["gui"]}
                content={this.props.content}
            />
        );
    }
}
