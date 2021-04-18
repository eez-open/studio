import React from "react";
import { computed } from "mobx";
import { observer } from "mobx-react";

import { Splitter } from "eez-studio-ui/splitter";

import { NavigationComponent } from "project-editor/core/object";
import { getObjectFromNavigationItem } from "project-editor/core/store";

import { ListNavigation } from "project-editor/components/ListNavigation";

import { showImportScpiDocDialog } from "project-editor/features/scpi/importScpiDoc";
import { ScpiEnum } from "project-editor/features/scpi/enum";
import { PropertiesPanel } from "project-editor/project/PropertiesPanel";
import { ProjectContext } from "project-editor/project/context";

@observer
export class ScpiEnumsNavigation extends NavigationComponent {
    static contextType = ProjectContext;
    declare context: React.ContextType<typeof ProjectContext>;

    handleRefresh() {
        showImportScpiDocDialog(this.context);
    }

    @computed
    get object() {
        if (this.context.NavigationStore.selectedPanel) {
            return this.context.NavigationStore.selectedPanel.selectedObject;
        }
        return this.context.NavigationStore.selectedObject;
    }

    render() {
        let enums = this.context.project.scpi.enums;

        let selectedScpiEnum = getObjectFromNavigationItem(
            this.context.NavigationStore.getNavigationSelectedItem(enums)
        ) as ScpiEnum;

        return (
            <Splitter
                type="horizontal"
                persistId={`project-editor/navigation-${this.props.id}`}
                sizes={`240px|100%`}
                childrenOverflow="hidden"
            >
                <ListNavigation id={this.props.id} navigationObject={enums} />
                <PropertiesPanel object={selectedScpiEnum} />
            </Splitter>
        );
    }
}
