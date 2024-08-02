import React from "react";
import { observer } from "mobx-react";
import classnames from "classnames";

import {
    LANGUAGE_ICON,
    CHANGES_ICON,
    VARIABLE_ICON,
    HIERARCHY_ICON,
    PROPERTIES_ICON,
    COMPONENTS_ICON,
    PALETTE_ICON,
    PAGES_ICON,
    PAGE_ICON,
    USER_WIDGETS_ICON,
    USER_WIDGET_ICON,
    LOG_ICON,
    WATCH_PANEL_ICON,
    QUEUE_PANEL_ICON,
    ACTIVE_FLOWS_PANEL_ICON,
    BREAKPOINTS_PANEL_ICON,
    PROJECT_EDITOR_SCRAPBOOK
} from "project-editor/ui-components/icons";

const MATERIAL_PREFIX = "material:";
const SVG_PREFIX = "svg:";

const SVG_ICONS: { [icon: string]: JSX.Element } = {
    language: LANGUAGE_ICON,
    changes: CHANGES_ICON,
    variable: VARIABLE_ICON,
    hierarchy: HIERARCHY_ICON,
    properties: PROPERTIES_ICON,
    components: COMPONENTS_ICON,
    palette: PALETTE_ICON,
    pages: PAGES_ICON,
    page: PAGE_ICON,
    user_widgets: USER_WIDGETS_ICON,
    user_widget: USER_WIDGET_ICON,
    log: LOG_ICON,
    watch_panel: WATCH_PANEL_ICON,
    queue_panel: QUEUE_PANEL_ICON,
    active_flows_panel: ACTIVE_FLOWS_PANEL_ICON,
    breakpoints_panel: BREAKPOINTS_PANEL_ICON,
    "project-editor-scrapbook": PROJECT_EDITOR_SCRAPBOOK
};

export const Icon = observer(
    class Icon extends React.Component<
        {
            icon: string | JSX.Element | React.ReactNode;
            size?: number;
            className?: string;
            style?: React.CSSProperties;
            onClick?: (event: React.MouseEvent) => void;
            overlayText?: string;
            attention?: boolean;
            title?: string;
        },
        {}
    > {
        render() {
            const { size, style, className, onClick } = this.props;

            let icon = this.props.icon;

            let iconSize = size || 24;

            let result;

            if (typeof icon === "string" && icon.startsWith(SVG_PREFIX)) {
                icon = SVG_ICONS[icon.substring(4)];
            }

            if (typeof icon === "string") {
                if (icon.startsWith(MATERIAL_PREFIX)) {
                    let iconClassName = classnames(
                        "EezStudio_Icon",
                        "material-icons",
                        className
                    );

                    let iconStyle = {
                        fontSize: iconSize + "px"
                    };
                    if (style) {
                        iconStyle = Object.assign(iconStyle, style);
                    }

                    const iconEl = (
                        <i
                            className={iconClassName}
                            style={iconStyle}
                            onClick={onClick}
                            title={this.props.title}
                        >
                            {icon.slice(MATERIAL_PREFIX.length)}
                        </i>
                    );

                    if (this.props.overlayText) {
                        result = (
                            <div className="EezStudio_IconWithOverlayContainer">
                                {iconEl}
                                <span className="EezStudio_IconOverlay">
                                    {this.props.overlayText}
                                </span>
                            </div>
                        );
                    } else {
                        result = iconEl;
                    }
                } else {
                    let iconStyle: React.CSSProperties = {
                        objectFit: "contain"
                    };
                    if (style) {
                        iconStyle = Object.assign(iconStyle, style);
                    }

                    result = (
                        <img
                            src={icon}
                            width={iconSize}
                            height={iconSize}
                            className={className}
                            style={iconStyle}
                            onClick={onClick}
                            title={this.props.title}
                        />
                    );
                }
            } else {
                result = React.cloneElement(icon as React.ReactElement<any>, {
                    className: classnames("EezStudio_Icon", className),
                    style,
                    width: iconSize,
                    height: iconSize,
                    onClick: onClick,
                    title: this.props.title
                });
            }

            if (this.props.attention) {
                return (
                    <div className="EezStudio_AttentionContainer">
                        {result}
                        <div className="EezStudio_AttentionDiv" />
                    </div>
                );
            }

            return result;
        }
    }
);
