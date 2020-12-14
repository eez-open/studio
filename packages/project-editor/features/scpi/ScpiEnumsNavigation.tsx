import React from "react";
import { computed } from "mobx";
import { observer } from "mobx-react";

import { Splitter } from "eez-studio-ui/splitter";

import { NavigationComponent } from "project-editor/core/object";
import { DocumentStore, getObjectFromNavigationItem } from "project-editor/core/store";

import { ProjectStore } from "project-editor/project/project";

import { ListNavigation } from "project-editor/components/ListNavigation";

import { showImportScpiDocDialog } from "project-editor/features/scpi/importScpiDoc";
import { ScpiEnum } from "project-editor/features/scpi/enum";
import { PropertiesPanel } from "project-editor/project/ProjectEditor";

@observer
export class ScpiEnumsNavigation extends NavigationComponent {
    handleRefresh() {
        showImportScpiDocDialog();
    }

    @computed
    get object() {
        if (DocumentStore.Navigation.selectedPanel) {
            return DocumentStore.Navigation.selectedPanel.selectedObject;
        }
        return DocumentStore.Navigation.selectedObject;
    }

    render() {
        let enums = ProjectStore.project.scpi.enums;

        let selectedScpiEnum = getObjectFromNavigationItem(
            DocumentStore.Navigation.getNavigationSelectedItem(enums)
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
