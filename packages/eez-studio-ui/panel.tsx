import React from "react";

import styled from "eez-studio-ui/styled-components";

const PanelTitleDiv = styled.div`
    display: flex;
    flex-direction: row;
    padding: 5px 10px;
    border-bottom: 1px solid ${props => props.theme.borderColor};
    font-weight: bold;
`;

export class PanelTitle extends React.Component<{ title?: string }, {}> {
    render() {
        return <PanelTitleDiv>{this.props.title}</PanelTitleDiv>;
    }
}

const PanelContainerDiv = styled.div`
    display: flex;
    flex-direction: column;
    margin: 5px;
    background-color: white;
    border: 1px solid ${props => props.theme.borderColor};
`;

const PanelContentDiv = styled.div`
    display: flex;
    flex-direction: row;
    padding: 10px;
`;

export class Panel extends React.Component<
    {
        title?: string;
        justify?: "flex-start" | "flex-end" | "center" | "space-between" | "space-around";
        scrollable?: boolean;
        grow?: number;
    },
    {}
> {
    render() {
        return (
            <PanelContainerDiv>
                {this.props.title && <PanelTitle title={this.props.title} />}
                <PanelContentDiv
                    style={{
                        flexGrow: this.props.grow,
                        overflow: this.props.scrollable ? "auto" : "hidden",
                        justifyContent: this.props.justify
                    }}
                >
                    {this.props.children}
                </PanelContentDiv>
            </PanelContainerDiv>
        );
    }
}

const PanelsDiv = styled.div`
    display: flex;
    flex-direction: column;
    padding: 5px;
    background-color: ${props => props.theme.panelHeaderColor};
`;

export class Panels extends React.Component<{}, {}> {
    render() {
        return <PanelsDiv>{this.props.children}</PanelsDiv>;
    }
}
