import { observer } from "mobx-react";
import React from "react";

import { Splitter } from "eez-studio-ui/splitter";

import { ProjectStore } from "project-editor/core/store";
import { PropertyGrid } from "eez-studio-shared/model/components/PropertyGrid";
import { ScpiSubsystem, ScpiCommand } from "project-editor/project/features/scpi/scpi";

@observer
export class ScpiSubsystemOrCommandEditor extends React.Component<
    { object: ScpiSubsystem | ScpiCommand },
    {}
> {
    render() {
        if (
            this.props.object &&
            this.props.object.helpLink &&
            ProjectStore.project.settings.general.scpiDocFolder
        ) {
            let scpiHelpFolderPath = ProjectStore.getAbsoluteFilePath(
                ProjectStore.project.settings.general.scpiDocFolder
            );

            return (
                <Splitter
                    type="vertical"
                    persistId="project-editor/ScpiSubsystemOrCommandEditor"
                    sizes={`240px|100%`}
                >
                    <PropertyGrid object={this.props.object} />
                    <iframe
                        src={scpiHelpFolderPath + "/" + this.props.object.helpLink}
                        style={{
                            position: "absolute",
                            width: "100%",
                            height: "100%",
                            border: "none"
                        }}
                    />
                </Splitter>
            );
        } else {
            return <PropertyGrid object={this.props.object} />;
        }
    }
}
