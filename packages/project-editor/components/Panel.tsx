import React from "react";
import { observer } from "mobx-react";

////////////////////////////////////////////////////////////////////////////////

interface PanelProps {
    id: string;
    title: JSX.Element | string;
    buttons?: JSX.Element[];
    body: JSX.Element | undefined;
}

@observer
export class Panel extends React.Component<PanelProps> {
    render() {
        let title: JSX.Element;
        if (typeof this.props.title == "string") {
            title = (
                <div className="EezStudio_ProjectEditorPanelTitle">
                    {this.props.title}
                </div>
            );
        } else {
            title = this.props.title;
        }

        return (
            <div className="EezStudio_PanelContainer">
                <div className="EezStudio_PanelHeader">
                    {title}
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
