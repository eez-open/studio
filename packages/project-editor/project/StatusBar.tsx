import React from "react";
import { action } from "mobx";
import { observer } from "mobx-react";
import styled from "eez-studio-ui/styled-components";
import { Section } from "project-editor/core/output";
import { ProjectContext } from "project-editor/project/context";

////////////////////////////////////////////////////////////////////////////////
const StatusBarItemSpan = styled.span`
    display: inline-block;
    padding: 4px 8px;
    cursor: pointer;
`;

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
            <StatusBarItemSpan onClick={this.props.onClick}>
                {this.props.body}
            </StatusBarItemSpan>
        );
    }
}
////////////////////////////////////////////////////////////////////////////////
const StatusBarDiv = styled.div`
    background-color: ${props => props.theme.panelHeaderColor};
    border-top: 1px solid ${props => props.theme.borderColor};
`;

@observer
export class StatusBar extends React.Component<{}, {}> {
    static contextType = ProjectContext;
    declare context: React.ContextType<typeof ProjectContext>;

    @action.bound
    onChecksClicked() {
        this.context.UIStateStore.viewOptions.outputVisible = !this.context
            .UIStateStore.viewOptions.outputVisible;
        this.context.OutputSectionsStore.setActiveSection(Section.CHECKS);
    }

    render() {
        return (
            <StatusBarDiv>
                <StatusBarItem
                    key="checks"
                    body={
                        this.context.OutputSectionsStore.getSection(
                            Section.CHECKS
                        ).title
                    }
                    onClick={this.onChecksClicked}
                />
            </StatusBarDiv>
        );
    }
}
