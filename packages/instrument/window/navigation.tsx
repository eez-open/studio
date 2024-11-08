import React from "react";
import { observer } from "mobx-react";
import classNames from "classnames";

import { Icon } from "eez-studio-ui/icon";

export interface INavigationItem {
    id: string;
    icon: string;
    title: string;
    position?: "hidden";
    attention?: boolean;
    renderContent: () => JSX.Element;
    selectItem?: (itemId: string) => void;
    renderToolbarButtons: () => JSX.Element;
}

export const NavigationItem = observer(
    class NavigationItem extends React.Component<
        {
            item: INavigationItem;
            selected: boolean;
            selectItem: (item: INavigationItem) => void;
        },
        {}
    > {
        handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
            event.preventDefault();
            this.props.selectItem(this.props.item);
        };

        render() {
            let className = classNames(
                "EezStudio_NavigationMenuItemContainer",
                {
                    selected: this.props.selected
                }
            );

            return (
                <div
                    className={className}
                    title={this.props.item.title}
                    onClick={this.handleClick}
                >
                    <Icon
                        icon={this.props.item.icon!}
                        attention={this.props.item.attention}
                    />
                    <span>{this.props.item.title}</span>
                </div>
            );
        }
    }
);

export const Navigation = observer(
    class Navigation extends React.Component<
        {
            items: INavigationItem[];
            selectedItem: INavigationItem;
            selectItem: (item: INavigationItem) => void;
        },
        {}
    > {
        render() {
            return (
                <div className="EezStudio_MenuNavigationContainer">
                    <div className="EezStudio_MenuContainer">
                        {this.props.items
                            .filter(item => item.position != "hidden")
                            .map(item => (
                                <NavigationItem
                                    key={item.id}
                                    item={item}
                                    selected={item === this.props.selectedItem}
                                    selectItem={this.props.selectItem}
                                />
                            ))}
                    </div>
                </div>
            );
        }
    }
);
