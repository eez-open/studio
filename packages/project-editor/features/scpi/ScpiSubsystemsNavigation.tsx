import React from "react";
import { computed } from "mobx";
import { observer } from "mobx-react";

import { IconAction } from "eez-studio-ui/action";
import { Splitter } from "eez-studio-ui/splitter";

import { NavigationComponent, getAncestorOfType } from "project-editor/core/object";
import { NavigationStore, getObjectFromNavigationItem } from "project-editor/core/store";

import { ProjectStore } from "project-editor/core/store";

import {
    ListNavigation,
    ListNavigationWithContent
} from "project-editor/components/ListNavigation";

import { showImportScpiDocDialog } from "project-editor/features/scpi/importScpiDoc";
import { ScpiCommand, ScpiSubsystem } from "project-editor/features/scpi/scpi";
import { ScpiSubsystemOrCommandEditor } from "project-editor/features/scpi/ScpiSubsystemOrCommandEditor";

@observer
export class ScpiSubsystemsNavigation extends NavigationComponent {
    handleRefresh() {
        showImportScpiDocDialog();
    }

    @computed
    get object(): ScpiSubsystem | ScpiCommand | undefined {
        // return selectedObject from selectedPanel if it is descendant of ScpiCommand or ScpiSubsystem
        let object = NavigationStore.selectedPanel
            ? NavigationStore.selectedPanel.selectedObject
            : NavigationStore.selectedObject;
        if (object) {
            const command = getAncestorOfType(object, ScpiCommand.classInfo);
            if (command) {
                return command as ScpiCommand;
            }

            const subsystem = getAncestorOfType(object, ScpiSubsystem.classInfo);
            if (subsystem) {
                return subsystem as ScpiSubsystem;
            }
        }

        // return lastly selected ScpiCommand or ScpiSubsystem
        let subsystems = ProjectStore.project.scpi.subsystems;

        let subsystem = getObjectFromNavigationItem(
            NavigationStore.getNavigationSelectedItem(subsystems)
        ) as ScpiSubsystem;

        let commands =
            subsystem &&
            (getObjectFromNavigationItem(
                NavigationStore.getNavigationSelectedItem(subsystem)
            ) as ScpiCommand[]);

        let command =
            commands &&
            (getObjectFromNavigationItem(
                NavigationStore.getNavigationSelectedItem(commands)
            ) as ScpiCommand);

        return command || commands || subsystem;
    }

    render() {
        let subsystems = ProjectStore.project.scpi.subsystems;

        let selectedScpiSubsystem = getObjectFromNavigationItem(
            NavigationStore.getNavigationSelectedItem(subsystems)
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

        let content = <ScpiSubsystemOrCommandEditor object={this.object!} />;

        if (selectedScpiSubsystem) {
            return (
                <Splitter
                    type="horizontal"
                    persistId={`project-editor/navigation-${this.props.id}`}
                    sizes={`240px|100%`}
                    childrenOverflow="hidden"
                >
                    <ListNavigation
                        id={this.props.id}
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
