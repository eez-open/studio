import React from "react";
import { action } from "mobx";
import { observer } from "mobx-react";
import { Section } from "project-editor/core/output";
import { ProjectContext } from "project-editor/project/context";

////////////////////////////////////////////////////////////////////////////////

@observer
class StatusBarItem extends React.Component<
    {
        body: React.ReactNode;
        onClick: () => void;
    },
    {}
> {
    render() {
        return (
            <span
                className="EezStudio_StatusBarItem"
                onClick={this.props.onClick}
            >
                {this.props.body}
            </span>
        );
    }
}
////////////////////////////////////////////////////////////////////////////////

@observer
export class StatusBar extends React.Component<{}, {}> {
    static contextType = ProjectContext;
    declare context: React.ContextType<typeof ProjectContext>;

    @action.bound
    onChecksClicked() {
        this.context.uiStateStore.viewOptions.outputVisible =
            !this.context.uiStateStore.viewOptions.outputVisible;
        this.context.outputSectionsStore.setActiveSection(Section.CHECKS);
    }

    render() {
        return (
            <div className="EezStudio_StatusBar">
                <StatusBarItem
                    key="checks"
                    body={
                        this.context.outputSectionsStore.getSection(
                            Section.CHECKS
                        ).title
                    }
                    onClick={this.onChecksClicked}
                />
            </div>
        );
    }
}
