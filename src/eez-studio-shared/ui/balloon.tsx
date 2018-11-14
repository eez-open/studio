import * as React from "react";
import { observer } from "mobx-react";

@observer
export class Balloon extends React.Component<{}, {}> {
    render() {
        return (
            <div>
                <div className="EezStudio_Ballon">{this.props.children}</div>
                <div className="EezStudio_BallonDecoration" />
            </div>
        );
    }
}
