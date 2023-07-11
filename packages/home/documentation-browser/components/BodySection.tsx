import React from "react";
import { observer } from "mobx-react";

export const BodySection = observer(
    class BodySection extends React.Component<
        React.PropsWithChildren<{
            title: string;
        }>
    > {
        render() {
            return (
                <div className="EezStudio_Component_Documentation_BodySection">
                    <div>{this.props.title}</div>
                    <div>{this.props.children}</div>
                </div>
            );
        }
    }
);
