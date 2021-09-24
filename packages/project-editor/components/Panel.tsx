import React from "react";
import { observer } from "mobx-react";
import classNames from "classnames";
import { observable, action } from "mobx";
import { Icon } from "eez-studio-ui/icon";

////////////////////////////////////////////////////////////////////////////////

@observer
export class Panel extends React.Component<{
    id: string;
    title: JSX.Element | string;
    collapsable?: boolean;
    buttons?: JSX.Element[];
    body: JSX.Element | undefined;
}> {
    @observable collapsed: boolean = false;

    toggleCollapsed = action(() => {
        this.collapsed = !this.collapsed;
    });

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
            <div
                className={classNames("EezStudio_PanelContainer", {
                    collapsable: this.props.collapsable
                })}
            >
                <div
                    className="EezStudio_PanelHeader"
                    onClick={this.toggleCollapsed}
                >
                    {this.props.collapsable && (
                        <Icon
                            icon={
                                this.collapsed
                                    ? "material:keyboard_arrow_right"
                                    : "material:keyboard_arrow_down"
                            }
                            size={18}
                            className="triangle"
                        />
                    )}
                    {title}
                    {(!this.props.collapsable || !this.collapsed) && (
                        <div
                            className="btn-toolbar EezStudio_Toolbar"
                            role="toolbar"
                        >
                            {this.props.buttons}
                        </div>
                    )}
                </div>
                {(!this.props.collapsable || !this.collapsed) &&
                    this.props.body}
            </div>
        );
    }
}
