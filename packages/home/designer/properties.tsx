import React from "react";
import { observer } from "mobx-react";

import { Box } from "eez-studio-ui/box";
import { PanelTitle } from "eez-studio-ui/panel";
import { Splitter } from "eez-studio-ui/splitter";

import { IWorkbenchObject } from "home/designer/designer-store";
import { HistorySection } from "home/history";

@observer
export class Properties extends React.Component<
    {
        selectedObjects: IWorkbenchObject[];
        className?: string;
    },
    {}
> {
    render() {
        let className = this.props.className;

        if (this.props.selectedObjects.length === 0) {
            return <div className={className} />;
        }

        let history = (
            <Box direction="column" background="panel-header" style={{ height: "100%" }}>
                <PanelTitle title="History" />
                <Box scrollable={true} background="white">
                    <div>
                        <HistorySection
                            oids={this.props.selectedObjects.map(
                                selectedObject => selectedObject.oid
                            )}
                            simple={true}
                        />
                    </div>
                </Box>
            </Box>
        );

        if (this.props.selectedObjects.length === 1) {
            return (
                <Splitter
                    type="vertical"
                    sizes="100%|240px"
                    className={className}
                    persistId="home/designer/properties/splitter"
                >
                    {this.props.selectedObjects[0].details}
                    {history}
                </Splitter>
            );
        }

        return <div className={className}>{history}</div>;
    }
}
