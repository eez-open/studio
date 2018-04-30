import * as React from "react";
import { observer } from "mobx-react";

import { EezObject } from "project-editor/core/metaData";
import { NavigationStore, getChildren, objectToString } from "project-editor/core/store";

////////////////////////////////////////////////////////////////////////////////

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
        let classes = ["EezStudio_ProjectEditor_navigation-menu__item"];

        if (
            NavigationStore.getNavigationSelectedItem(this.props.navigationObject) ===
            this.props.item
        ) {
            classes.push("EezStudio_ProjectEditor_navigation-menu__item--selected");
        }

        let icon = this.props.item.$eez.metaData.icon || "extension";

        return (
            <div
                className={classes.join(" ")}
                title={objectToString(this.props.item)}
                onClick={this.onClick}
            >
                <i className="material-icons md-24">{icon}</i>
            </div>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

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
                key={item.$eez.id}
                navigationObject={this.props.navigationObject}
                item={item}
            />
        ));
        return (
            <div
                className="EezStudio_ProjectEditor_navigation-menu"
                tabIndex={0}
                onFocus={this.onFocus.bind(this)}
            >
                {items}
            </div>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

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
            let NavigationComponent = selectedItem.$eez.metaData.navigationComponent;
            if (NavigationComponent) {
                subNavigation = (
                    <NavigationComponent
                        id={selectedItem.$eez.metaData.navigationComponentId || this.props.id}
                        navigationObject={selectedItem}
                        content={this.props.content}
                    />
                );
            }
        }

        return (
            <div className="layoutCenter">
                <div className="layoutLeft">
                    <Menu navigationObject={this.props.navigationObject} />
                </div>
                <div className="layoutCenter">{subNavigation || this.props.content}</div>
            </div>
        );
    }
}
