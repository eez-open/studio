import React from "react";
import { observer } from "mobx-react";
import classNames from "classnames";

import { humanize } from "eez-studio-shared/string";

import { PropertyProps } from "project-editor/core/object";
import {
    getPropertySourceInfo,
    objectToString
} from "project-editor/core/store";

const { Menu, MenuItem } = EEZStudio.remote || {};

@observer
export class PropertyMenu extends React.Component<PropertyProps> {
    get sourceInfo() {
        return getPropertySourceInfo(this.props);
    }

    onClicked = (event: React.MouseEvent) => {
        let menuItems: Electron.MenuItem[] = [];

        if (this.props.propertyInfo.propertyMenu) {
            menuItems = this.props.propertyInfo.propertyMenu(this.props);
        }

        if (this.sourceInfo.source === "modified") {
            if (menuItems.length > 0) {
                menuItems.push(
                    new MenuItem({
                        type: "separator"
                    })
                );
            }

            menuItems.push(
                new MenuItem({
                    label: "Reset",
                    click: () => {
                        this.props.updateObject({
                            [this.props.propertyInfo.name]: undefined
                        });
                    }
                })
            );
        }

        if (menuItems.length > 0) {
            const menu = new Menu();
            menuItems.forEach(menuItem => menu.append(menuItem));
            menu.popup({});
        }
    };

    render() {
        let title = humanize(this.sourceInfo.source);
        if (this.sourceInfo.inheritedFrom) {
            title += " from " + objectToString(this.sourceInfo.inheritedFrom);
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
