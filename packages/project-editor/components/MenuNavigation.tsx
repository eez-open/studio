import React from "react";
import { observer } from "mobx-react";
import classNames from "classnames";

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
        let className = classNames("EezStudio_NavigationMenuItemContainer", {
            selected: compareNavigationItem(
                this.context.NavigationStore.getNavigationSelectedItem(
                    this.props.navigationObject
                ),
                this.props.item
            )
        });

        let icon = getClassInfo(this.props.item).icon || "extension";

        return (
            <div
                className={className}
                title={objectToString(this.props.item)}
                onClick={this.onClick}
            >
                <i className="material-icons md-24">{icon}</i>
                <span>{objectToString(this.props.item)}</span>
            </div>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

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
            <div
                className="EezStudio_MenuContainer"
                tabIndex={0}
                onFocus={this.onFocus.bind(this)}
            >
                {navigationItems}
            </div>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

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
        let selectedItem =
            this.context.NavigationStore.getNavigationSelectedItemAsObject(
                this.props.navigationObject
            );
        if (selectedItem) {
            let NavigationComponent =
                getClassInfo(selectedItem).navigationComponent;
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
            <div className="EezStudio_MenuNavigationContainer">
                <Menu navigationObject={this.props.navigationObject} />
                {subNavigation}
            </div>
        );
    }
}
