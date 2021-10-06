import React from "react";
import { observer } from "mobx-react";
import classNames from "classnames";
import { action, IObservableValue } from "mobx";
import { Icon } from "eez-studio-ui/icon";

////////////////////////////////////////////////////////////////////////////////

@observer
export class Panel extends React.Component<{
    id: string;
    title: JSX.Element | string;
    collapsed?: IObservableValue<boolean>;
    buttons?: JSX.Element[];
    body: JSX.Element | undefined;
    onHeaderDoubleClick?: () => void;
}> {
    toggleCollapsed = action(() => {
        if (this.props.collapsed) {
            this.props.collapsed.set(!this.props.collapsed.get());
        }
    });

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
                className={classNames("EezStudio_PanelContainer", {
                    collapsable: !!this.props.collapsed
                })}
            >
                <div
                    className="EezStudio_PanelHeader"
                    onDoubleClick={this.props.onHeaderDoubleClick}
                >
                    <span
                        onClick={this.toggleCollapsed}
                        className="EezStudio_ProjectEditorPanelTitle"
                    >
                        {this.props.collapsed && (
                            <Icon
                                icon={
                                    this.props.collapsed.get()
                                        ? "material:keyboard_arrow_right"
                                        : "material:keyboard_arrow_down"
                                }
                                size={18}
                                className="triangle"
                            />
                        )}
                        {title}
                    </span>
                    {(!this.props.collapsed || !this.props.collapsed.get()) && (
                        <div
                            className="btn-toolbar EezStudio_Toolbar"
                            role="toolbar"
                        >
                            {this.props.buttons}
                        </div>
                    )}
                </div>
                {(!this.props.collapsed || !this.props.collapsed.get()) &&
                    this.props.body}
            </div>
        );
    }
}
