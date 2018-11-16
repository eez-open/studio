import React from "react";
import { observer } from "mobx-react";

import { VerticalHeaderWithBody, Header, Body } from "eez-studio-ui/header-with-body";
import { Splitter } from "eez-studio-ui/splitter";

import { selectToolHandler } from "eez-studio-designer/select-tool";

import { workbenchDocument } from "home/designer/designer-store";
import { WorkbenchDocument } from "home/designer/canvas";
import { DesignerToolbar } from "home/designer/toolbar";
import { Properties } from "home/designer/properties";

@observer
export class Designer extends React.Component<{}, {}> {
    render() {
        return (
            <VerticalHeaderWithBody>
                <Header>
                    <DesignerToolbar
                        buttons={workbenchDocument.toolbarButtons}
                        document={workbenchDocument}
                    />
                </Header>
                <Body>
                    <Splitter
                        type="horizontal"
                        sizes={/*"240px|100%|240px"*/ "100%|240px"}
                        persistId="home/designer/splitter"
                    >
                        <WorkbenchDocument
                            document={workbenchDocument}
                            toolHandler={selectToolHandler}
                        />

                        <Properties selectedObjects={workbenchDocument.selectedObjects} />
                    </Splitter>
                </Body>
            </VerticalHeaderWithBody>
        );
    }
}
