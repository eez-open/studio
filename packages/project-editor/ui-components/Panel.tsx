import React from "react";
import { observer } from "mobx-react";

////////////////////////////////////////////////////////////////////////////////

export const Panel = observer(
    class Panel extends React.Component<{
        id: string;
        title: JSX.Element | string;
        buttons?: JSX.Element[];
        body: JSX.Element | undefined;
        style?: React.CSSProperties;
    }> {
        render() {
            let title: JSX.Element;
            if (typeof this.props.title == "string") {
                title = (
                    <span className="EezStudio_ProjectEditorPanelTitleText">
                        {this.props.title}
                    </span>
                );
            } else {
                title = this.props.title;
            }

            return (
                <div
                    className="EezStudio_PanelContainer"
                    style={this.props.style}
                >
                    <div className="EezStudio_PanelHeader">
                        <span className="EezStudio_ProjectEditorPanelTitle">
                            {title}
                        </span>
                        <div
                            className="btn-toolbar EezStudio_Toolbar"
                            role="toolbar"
                        >
                            {this.props.buttons}
                        </div>
                    </div>

                    {this.props.body}
                </div>
            );
        }
    }
);
