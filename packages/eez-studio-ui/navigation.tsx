import React from "react";
import { observer } from "mobx-react";
import classNames from "classnames";

import { Icon } from "eez-studio-ui/icon";
import { styled } from "eez-studio-ui/styled-components";

export interface INavigationItem {
    id: string;
    icon: string;
    title: string;
    position?: string;
    attention?: boolean;
}

const NavigationItemLi = styled.li`
    &.selected {
        a {
            color: ${props => props.theme.selectionBackgroundColor};
        }
    }

    &:not(.selected) {
        a {
            color: #999;
        }

        a:hover {
            color: #333;
        }
    }
`;

const NavigationItemNeedsAttentionDiv = styled.div`
    position: absolute;
    width: 6px;
    height: 6px;
    bottom: -3px;
    right: -3px;
    background-color: red;
    border-radius: 3px;
    box-shadow: 0px 0px 6px 2px rgba(255, 0, 0, 0.3);
`;

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
            <NavigationItemLi className={className}>
                <a href="#" title={this.props.item.title} onClick={this.handleClick}>
                    <Icon icon={this.props.item.icon!} />
                    {this.props.item.attention && <NavigationItemNeedsAttentionDiv />}
                </a>
            </NavigationItemLi>
        );
    }
}

const NavigationDiv = styled.div`
    height: 100%;
    margin: 0;
    background-color: ${props => props.theme.panelHeaderColor};
    border-right: 1px solid ${props => props.theme.borderColor};
    display: flex;
    flex-direction: column;
    justify-content: space-between;

    & > ul {
        padding: 7px;
        margin-bottom: 0;
    }

    & > ul:nth-child(1) {
        .NavigationItem {
            width: 24px;
            margin-bottom: 7px;
            position: relative;
        }
    }

    & > ul:nth-child(2) {
        .NavigationItem {
            margin-top: 7px;
            position: relative;
        }
    }
`;

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
            <NavigationDiv>
                <ul className="list-unstyled">
                    {this.props.items
                        .filter(item => !item.position || item.position === "top")
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
            </NavigationDiv>
        );
    }
}
