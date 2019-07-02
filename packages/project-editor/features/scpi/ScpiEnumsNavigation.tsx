import React from "react";
import { computed } from "mobx";
import { observer } from "mobx-react";

import { Splitter } from "eez-studio-ui/splitter";

import { NavigationComponent, getProperty } from "project-editor/core/object";
import { NavigationStore } from "project-editor/core/store";
import { PropertyGrid } from "project-editor/components/PropertyGrid";

import { ProjectStore } from "project-editor/core/store";

import { ListNavigation } from "project-editor/components/ListNavigation";

import { showImportScpiDocDialog } from "project-editor/features/scpi/importScpiDoc";
import { Scpi } from "project-editor/features/scpi/scpi";
import { ScpiEnum } from "project-editor/features/scpi/enum";

@observer
export class ScpiEnumsNavigation extends NavigationComponent {
    handleRefresh() {
        showImportScpiDocDialog();
    }

    @computed
    get object() {
        if (NavigationStore.selectedPanel) {
            return NavigationStore.selectedPanel.selectedObject;
        }
        return NavigationStore.selectedObject;
    }

    render() {
        let enums = (getProperty(ProjectStore.project, "scpi") as Scpi).enums;

        let selectedScpiEnum = NavigationStore.getNavigationSelectedItem(enums) as ScpiEnum;

        return (
            <Splitter
                type="horizontal"
                persistId={`project-editor/navigation-${this.props.id}`}
                sizes={`240px|100%`}
                childrenOverflow="hidden"
            >
                <ListNavigation id={this.props.id} navigationObject={enums} />
                <PropertyGrid object={selectedScpiEnum} />
            </Splitter>
        );
    }
}
