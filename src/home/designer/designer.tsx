import * as React from "react";
import { observer } from "mobx-react";

import { VerticalHeaderWithBody, Header, Body } from "shared/ui/header-with-body";
import { Splitter } from "shared/ui/splitter";

import { page } from "home/designer/designer-store";
import { Page } from "home/designer/canvas";
import { DesignerToolbar } from "home/designer/toolbar";
//import { Toolbox } from "home/designer/toolbox";
import { Properties } from "home/designer/properties";

@observer
export class Designer extends React.Component<{}, {}> {
    constructor(props: any) {
        super(props);

        page.selectDefaultTool();
    }

    render() {
        return (
            <VerticalHeaderWithBody>
                <Header>
                    <DesignerToolbar buttons={page.toolbarButtons} canvas={page} />
                </Header>
                <Body>
                    <Splitter
                        type="horizontal"
                        sizes={/*"240px|100%|240px"*/ "100%|240px"}
                        persistId="home/designer/splitter"
                    >
                        {/*<Toolbox
                            toolboxGroups={page.toolboxGroups}
                            selectTool={tool => page.selectTool(tool)}
                        />*/}

                        <Page
                            page={page}
                            tool={page.selectedTool}
                            selectDefaultTool={page.selectDefaultTool}
                        />

                        <Properties
                            selectedObjects={page.selectedObjects}
                            className="EezStudio_DesignerProperties"
                        />
                    </Splitter>
                </Body>
            </VerticalHeaderWithBody>
        );
    }
}
