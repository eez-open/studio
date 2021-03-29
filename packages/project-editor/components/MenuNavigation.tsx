import React from "react";
import { observer } from "mobx-react";
import classNames from "classnames";

import styled from "eez-studio-ui/styled-components";

import {
    IEezObject,
    getChildren,
    objectToString,
    getId,
    getClassInfo
} from "project-editor/core/object";
import {
    createObjectNavigationItem,
    compareNavigationItem
} from "project-editor/core/store";
import { ProjectContext } from "project-editor/project/context";

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
    navigationObject: IEezObject;
    item: IEezObject;
}

@observer
class NavigationMenuItem extends React.Component<NavigationMenuItemProps, {}> {
    static contextType = ProjectContext;
    declare context: React.ContextType<typeof ProjectContext>;

    constructor(props: NavigationMenuItemProps) {
        super(props);

        this.onClick = this.onClick.bind(this);
    }

    onClick() {
        this.context.NavigationStore.setNavigationSelectedItem(
            this.props.navigationObject,
            createObjectNavigationItem(this.props.item)!
        );
    }

    render() {
        let className = classNames({
            selected: compareNavigationItem(
                this.context.NavigationStore.getNavigationSelectedItem(
                    this.props.navigationObject
                ),
                this.props.item
            )
        });

        let icon = getClassInfo(this.props.item).icon || "extension";

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
class Menu extends React.Component<{
    navigationObject: IEezObject;
}> {
    static contextType = ProjectContext;
    declare context: React.ContextType<typeof ProjectContext>;

    onFocus() {
        this.context.NavigationStore.setSelectedPanel(undefined);
    }

    render() {
        let items = getChildren(this.props.navigationObject);
        items = items.filter(item => getClassInfo(item).icon);
        const navigationItems = items.map(item => (
            <NavigationMenuItem
                key={getId(item)}
                navigationObject={this.props.navigationObject}
                item={item}
            />
        ));
        return (
            <MenuContainer tabIndex={0} onFocus={this.onFocus.bind(this)}>
                {navigationItems}
            </MenuContainer>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

const MenuNavigationContainer = styled.div`
    flex-grow: 1;
    display: flex;
    flex-direction: row;
    min-height: 0;
`;

@observer
export class MenuNavigation extends React.Component<
    {
        id: string;
        navigationObject: IEezObject;
    },
    {}
> {
    static contextType = ProjectContext;
    declare context: React.ContextType<typeof ProjectContext>;

    render() {
        let subNavigation: JSX.Element | undefined;
        let selectedItem = this.context.NavigationStore.getNavigationSelectedItemAsObject(
            this.props.navigationObject
        );
        if (selectedItem) {
            let NavigationComponent = getClassInfo(selectedItem)
                .navigationComponent;
            if (NavigationComponent) {
                subNavigation = (
                    <NavigationComponent
                        id={
                            getClassInfo(selectedItem).navigationComponentId ||
                            this.props.id
                        }
                        navigationObject={selectedItem}
                    />
                );
            }
        }

        return (
            <MenuNavigationContainer>
                <Menu navigationObject={this.props.navigationObject} />
                {subNavigation}
            </MenuNavigationContainer>
        );
    }
}
