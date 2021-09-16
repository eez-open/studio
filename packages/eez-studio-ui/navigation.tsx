import React from "react";
import { observer } from "mobx-react";
import classNames from "classnames";

import { Icon } from "eez-studio-ui/icon";

export interface INavigationItem {
    id: string;
    icon: string;
    title: string;
    position?: string;
    attention?: boolean;
}

@observer
export class NavigationItem extends React.Component<
    {
        item: INavigationItem;
        selected: boolean;
        selectItem: (item: INavigationItem) => void;
    },
    {}
> {
    constructor(props: any) {
        super(props);

        this.handleClick = this.handleClick.bind(this);
    }

    handleClick(event: React.MouseEvent<HTMLAnchorElement>) {
        event.preventDefault();
        this.props.selectItem(this.props.item);
    }

    render() {
        let className = classNames("NavigationItem", {
            selected: this.props.selected
        });

        return (
            <div
                className={classNames("EezStudio_NavigationItemLi", className)}
            >
                <a
                    href="#"
                    title={this.props.item.title}
                    onClick={this.handleClick}
                >
                    <Icon
                        icon={this.props.item.icon!}
                        attention={this.props.item.attention}
                    />
                    <span>{this.props.item.title}</span>
                </a>
            </div>
        );
    }
}

@observer
export class Navigation extends React.Component<
    {
        items: INavigationItem[];
        selectedItem: INavigationItem;
        selectItem: (item: INavigationItem) => void;
    },
    {}
> {
    render() {
        return (
            <div className="EezStudio_NavigationDiv">
                <ul className="list-unstyled">
                    {this.props.items
                        .filter(
                            item => !item.position || item.position === "top"
                        )
                        .map(item => (
                            <NavigationItem
                                key={item.id}
                                item={item}
                                selected={item === this.props.selectedItem}
                                selectItem={this.props.selectItem}
                            />
                        ))}
                </ul>
                <ul className="list-unstyled">
                    {this.props.items
                        .filter(item => item.position === "bottom")
                        .map(item => (
                            <NavigationItem
                                key={item.id}
                                item={item}
                                selected={item === this.props.selectedItem}
                                selectItem={this.props.selectItem}
                            />
                        ))}
                </ul>
            </div>
        );
    }
}
