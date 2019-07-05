import { observer } from "mobx-react";
import React from "react";

import { Splitter } from "eez-studio-ui/splitter";

import { ProjectStore } from "project-editor/core/store";
import { PropertyGrid } from "project-editor/components/PropertyGrid";
import { ScpiSubsystem, ScpiCommand } from "project-editor/features/scpi/scpi";

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

            let src;
            if (
                this.props.object.helpLink.trim().startsWith("http://") ||
                this.props.object.helpLink.trim().startsWith("https://") ||
                this.props.object.helpLink.trim().startsWith("//")
            ) {
                src = this.props.object.helpLink;
            } else {
                src = scpiHelpFolderPath + "/" + this.props.object.helpLink;
            }

            return (
                <Splitter
                    type="vertical"
                    persistId="project-editor/ScpiSubsystemOrCommandEditor"
                    sizes={`240px|100%`}
                >
                    <PropertyGrid objects={[this.props.object]} />
                    <iframe
                        src={src}
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
            return <PropertyGrid objects={[this.props.object]} />;
        }
    }
}
