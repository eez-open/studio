import * as React from "react";
import { observer } from "mobx-react";
import * as classNames from "classnames";

import styled from "eez-studio-ui/styled-components";

import { EezObject } from "project-editor/core/metaData";
import {
    NavigationStore,
    getChildren,
    objectToString,
    getMetaData,
    getId
} from "project-editor/core/store";

////////////////////////////////////////////////////////////////////////////////

const NavigationMenuItemContainer = styled.div`
    display: block;
    cursor: pointer;
    padding: 4px;
    background-color: ${props => props.theme.panelHeaderColor};
    color: #999;
    border: 0;

    &:hover:not(.selected) {
        color: #333;
    }

    &.selected {
        color: ${props => props.theme.selectionBackgroundColor};
    }
`;

interface NavigationMenuItemProps {
    navigationObject: EezObject;
    item: EezObject;
}

@observer
class NavigationMenuItem extends React.Component<NavigationMenuItemProps, {}> {
    constructor(props: NavigationMenuItemProps) {
        super(props);

        this.onClick = this.onClick.bind(this);
    }

    onClick() {
        NavigationStore.setNavigationSelectedItem(this.props.navigationObject, this.props.item);
    }

    render() {
        let className = classNames({
            selected:
                NavigationStore.getNavigationSelectedItem(this.props.navigationObject) ===
                this.props.item
        });

        let icon = getMetaData(this.props.item).icon || "extension";

        return (
            <NavigationMenuItemContainer
                className={className}
                title={objectToString(this.props.item)}
                onClick={this.onClick}
            >
                <i className="material-icons md-24">{icon}</i>
            </NavigationMenuItemContainer>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

const MenuContainer = styled.div`
    background-color: ${props => props.theme.panelHeaderColor};
    border-right: 1px solid ${props => props.theme.borderColor};
`;

@observer
class Menu extends React.Component<
    {
        navigationObject: EezObject;
    },
    {}
> {
    onFocus() {
        NavigationStore.setSelectedPanel(undefined);
    }

    render() {
        let items = getChildren(this.props.navigationObject).map(item => (
            <NavigationMenuItem
                key={getId(item)}
                navigationObject={this.props.navigationObject}
                item={item}
            />
        ));
        return (
            <MenuContainer tabIndex={0} onFocus={this.onFocus.bind(this)}>
                {items}
            </MenuContainer>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

const MenuNavigationContainer = styled.div`
    flex-grow: 1;
    display: flex;
    flex-direction: row;
`;

@observer
export class MenuNavigation extends React.Component<
    {
        id: string;
        navigationObject: EezObject;
        content: JSX.Element;
    },
    {}
> {
    render() {
        let subNavigation: JSX.Element | undefined;
        let selectedItem = NavigationStore.getNavigationSelectedItemAsObject(
            this.props.navigationObject
        );
        if (selectedItem) {
            let NavigationComponent = getMetaData(selectedItem).navigationComponent;
            if (NavigationComponent) {
                subNavigation = (
                    <NavigationComponent
                        id={getMetaData(selectedItem).navigationComponentId || this.props.id}
                        navigationObject={selectedItem}
                        content={this.props.content}
                    />
                );
            }
        }

        return (
            <MenuNavigationContainer>
                <Menu navigationObject={this.props.navigationObject} />
                {subNavigation || this.props.content}
            </MenuNavigationContainer>
        );
    }
}
