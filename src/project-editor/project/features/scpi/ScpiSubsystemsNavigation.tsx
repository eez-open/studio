import * as React from "react";
import { computed } from "mobx";
import { observer } from "mobx-react";

import { IconAction } from "shared/ui/action";

import { EezObject, NavigationComponent } from "project-editor/core/metaData";
import { ProjectStore, NavigationStore, getProperty } from "project-editor/core/store";

import { ListNavigation, ListNavigationWithContent } from "project-editor/project/ListNavigation";

import * as Layout from "project-editor/components/Layout";

import { showImportScpiDocDialog } from "project-editor/project/features/scpi/importScpiDoc";
import {
    ScpiCommandProperties,
    ScpiSubsystemProperties,
    ScpiProperties
} from "project-editor/project/features/scpi/scpi";
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
        let subsystems = ((getProperty(ProjectStore.projectProperties, "scpi") as ScpiProperties)
            .subsystems as any) as EezObject;

        let selectedScpiSubsystem = NavigationStore.getNavigationSelectedItem(
            subsystems
        ) as ScpiSubsystemProperties;

        let additionalButtons;
        if (ProjectStore.projectProperties.settings.general.scpiDocFolder) {
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
            <ScpiSubsystemOrCommandEditor
                object={this.object as ScpiSubsystemProperties | ScpiCommandProperties}
            />
        );

        if (selectedScpiSubsystem) {
            return (
                <Layout.Split orientation="horizontal" splitId={this.props.id} splitPosition="0.25">
                    <ListNavigation
                        navigationObject={subsystems}
                        additionalButtons={additionalButtons}
                    />
                    <ListNavigationWithContent
                        id="scpi-subsystem-commands"
                        title="Commands"
                        navigationObject={(selectedScpiSubsystem.commands as any) as EezObject}
                        content={content}
                    />
                </Layout.Split>
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
