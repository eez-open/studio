import * as React from "react";

import { Box } from "eez-studio-shared/ui/box";

export class PanelTitle extends React.Component<{ title?: string }, {}> {
    render() {
        return (
            <Box
                className="EezStudio_Panel_Title"
                padding={[0.5, 1]}
                border="bottom"
                borderColor="lighter"
            >
                {this.props.title}
            </Box>
        );
    }
}

export class Panel extends React.Component<{ title?: string }, {}> {
    render() {
        return (
            <Box
                direction="column"
                margin={0.5}
                background="white"
                border="all"
                borderColor="lighter"
            >
                {this.props.title && <PanelTitle title={this.props.title} />}
                <Box padding={1} justify="center">
                    {this.props.children}
                </Box>
            </Box>
        );
    }
}

export class Panels extends React.Component<{}, {}> {
    render() {
        return (
            <Box direction="column" padding={0.5} background="panel-header">
                {this.props.children}
            </Box>
        );
    }
}
