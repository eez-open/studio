import React from "react";
import { observer } from "mobx-react";

export const Balloon = observer(
    class Balloon extends React.Component<{}, {}> {
        render() {
            return (
                <div>
                    <div className="EezStudio_Ballon">
                        {this.props.children}
                    </div>
                    <div className="EezStudio_BallonDecoration" />
                </div>
            );
        }
    }
);
