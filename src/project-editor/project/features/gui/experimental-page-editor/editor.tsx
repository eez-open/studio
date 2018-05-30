import * as React from "react";
import { observer } from "mobx-react";

import { PageOrientationProperties } from "project-editor/project/features/gui/page";

////////////////////////////////////////////////////////////////////////////////

@observer
export class ExperimentalPageEditor extends React.Component<{
    pageOrientation: PageOrientationProperties;
}> {
    render() {
        return <div className="layoutCenter" style={{ overflow: "auto" }} />;
    }
}
