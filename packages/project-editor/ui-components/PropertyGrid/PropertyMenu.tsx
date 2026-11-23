import React from "react";
import { observer } from "mobx-react";
import classNames from "classnames";

import { humanize } from "eez-studio-shared/string";

import { PropertyProps } from "project-editor/core/object";
import { getPropertySourceInfo, objectToString } from "project-editor/store";
import { popupMenu, type IMenuItem } from "project-editor/core/menu";

export const PropertyMenu = observer(
    class PropertyMenu extends React.Component<PropertyProps> {
        get sourceInfo() {
            return getPropertySourceInfo(this.props);
        }

        onClicked = (event: React.MouseEvent) => {
            let menuItems: IMenuItem[] = [];

            if (this.props.propertyInfo.propertyMenu) {
                menuItems = this.props.propertyInfo.propertyMenu(this.props);
            }

            if (this.sourceInfo.source === "modified") {
                if (menuItems.length > 0) {
                    menuItems.unshift({
                        type: "separator"
                    });
                }

                menuItems.unshift({
                    label: "Reset",
                    click: () => {
                        this.props.updateObject({
                            [this.props.propertyInfo.name]: undefined
                        });
                    }
                });
            }

            popupMenu(menuItems);
        };

        render() {
            let title = humanize(this.sourceInfo.source);
            if (this.sourceInfo.inheritedFrom) {
                title +=
                    " from " + objectToString(this.sourceInfo.inheritedFrom);
            }

            return (
                <div
                    className={classNames(
                        "EezStudio_PropertyMenu",
                        this.sourceInfo.source
                    )}
                    title={title}
                    onClick={this.onClicked}
                >
                    <div />
                </div>
            );
        }
    }
);
