import React from "react";
import { computed } from "mobx";
import { observer } from "mobx-react";

import { IconAction } from "eez-studio-ui/action";
import { Splitter } from "eez-studio-ui/splitter";

import { NavigationComponent, getProperty } from "eez-studio-shared/model/object";
import { NavigationStore } from "eez-studio-shared/model/store";

import { ProjectStore } from "project-editor/core/store";

import {
    ListNavigation,
    ListNavigationWithContent
} from "project-editor/project/ui/ListNavigation";

import { showImportScpiDocDialog } from "project-editor/project/features/scpi/importScpiDoc";
import { ScpiCommand, ScpiSubsystem, Scpi } from "project-editor/project/features/scpi/scpi";
import { ScpiSubsystemOrCommandEditor } from "project-editor/project/features/scpi/ScpiSubsystemOrCommandEditor";

@observer
export class ScpiSubsystemsNavigation extends NavigationComponent {
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
        let subsystems = (getProperty(ProjectStore.project, "scpi") as Scpi).subsystems;

        let selectedScpiSubsystem = NavigationStore.getNavigationSelectedItem(
            subsystems
        ) as ScpiSubsystem;

        let additionalButtons;
        if (ProjectStore.project.settings.general.scpiDocFolder) {
            additionalButtons = [
                <IconAction
                    key="refresh"
                    title="Refresh with content from SCPI help folder"
                    icon="material:refresh"
                    iconSize={16}
                    onClick={this.handleRefresh.bind(this)}
                />
            ];
        }

        let content = (
            <ScpiSubsystemOrCommandEditor object={this.object as ScpiSubsystem | ScpiCommand} />
        );

        if (selectedScpiSubsystem) {
            return (
                <Splitter
                    type="horizontal"
                    persistId={`project-editor/navigation-${this.props.id}`}
                    sizes={`240px|100%`}
                    childrenOverflow="hidden"
                >
                    <ListNavigation
                        navigationObject={subsystems}
                        additionalButtons={additionalButtons}
                    />
                    <ListNavigationWithContent
                        id="scpi-subsystem-commands"
                        title="Commands"
                        navigationObject={selectedScpiSubsystem.commands}
                        content={content}
                    />
                </Splitter>
            );
        } else {
            return (
                <ListNavigationWithContent
                    id={this.props.id}
                    navigationObject={subsystems}
                    content={content}
                    additionalButtons={additionalButtons}
                />
            );
        }
    }
}
