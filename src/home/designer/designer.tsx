import * as React from "react";
import { observer } from "mobx-react";

import { VerticalHeaderWithBody, Header, Body } from "shared/ui/header-with-body";
import { Splitter } from "shared/ui/splitter";

import { workbenchDocument } from "home/designer/designer-store";
import { WorkbenchDocument } from "home/designer/canvas";
import { DesignerToolbar } from "home/designer/toolbar";
//import { Toolbox } from "home/designer/toolbox";
import { Properties } from "home/designer/properties";

@observer
export class Designer extends React.Component<{}, {}> {
    constructor(props: any) {
        super(props);

        workbenchDocument.selectDefaultTool();
    }

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
                        {/*<Toolbox
                            toolboxGroups={workbenchDocument.toolboxGroups}
                            selectTool={tool => workbenchDocument.selectTool(tool)}
                        />*/}

                        <WorkbenchDocument
                            document={workbenchDocument}
                            tool={workbenchDocument.selectedTool}
                            selectDefaultTool={workbenchDocument.selectDefaultTool}
                        />

                        <Properties
                            selectedObjects={workbenchDocument.selectedObjects}
                            className="EezStudio_DesignerProperties"
                        />
                    </Splitter>
                </Body>
            </VerticalHeaderWithBody>
        );
    }
}
