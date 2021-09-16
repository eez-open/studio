import React from "react";
import { observer } from "mobx-react";
import { bind } from "bind-decorator";

import {
    HorizontalHeaderWithBody,
    VerticalHeaderWithBody,
    Header,
    Body
} from "eez-studio-ui/header-with-body";
import { Navigation, INavigationItem } from "eez-studio-ui/navigation";
import classNames from "classnames";

////////////////////////////////////////////////////////////////////////////////

export interface IRootNavigationItem extends INavigationItem {
    renderContent: () => JSX.Element;
    selectItem?: (itemId: string) => void;
}

@observer
export class AppRootComponent extends React.Component<
    {
        appBar?: JSX.Element;
        selectedItem: IRootNavigationItem;
        navigationItems: IRootNavigationItem[];
        onSelectionChange?: (selectedItem: IRootNavigationItem) => void;
        className?: string;
    },
    {}
> {
    renderedItems = new Set<string>();

    renderContent(item: IRootNavigationItem) {
        this.renderedItems.add(item.id);
        return item.renderContent();
    }

    renderContentIfRenderedBefore(item: IRootNavigationItem) {
        if (!this.renderedItems.has(item.id)) {
            return null;
        }
        return item.renderContent();
    }

    @bind
    selectNavigationItem(item: IRootNavigationItem) {
        if (this.props.onSelectionChange) {
            this.props.onSelectionChange(item);
        }
    }

    render() {
        let devTools;
        // if (isDev) {
        //     const DevTools = require("mobx-react-devtools").default;
        //     devTools = <DevTools />;
        // }

        return (
            <div className={classNames("EezStudio_App", this.props.className)}>
                <VerticalHeaderWithBody>
                    <Header>{this.props.appBar}</Header>
                    <Body>
                        <HorizontalHeaderWithBody>
                            <Header>
                                <Navigation
                                    items={this.props.navigationItems}
                                    selectedItem={this.props.selectedItem}
                                    selectItem={this.selectNavigationItem}
                                />
                            </Header>
                            {this.props.navigationItems.map(item => (
                                <Body
                                    visible={item === this.props.selectedItem}
                                    key={item.id}
                                >
                                    {item === this.props.selectedItem
                                        ? this.renderContent(item)
                                        : this.renderContentIfRenderedBefore(
                                              item
                                          )}
                                </Body>
                            ))}
                        </HorizontalHeaderWithBody>
                    </Body>
                </VerticalHeaderWithBody>
                {devTools}
            </div>
        );
    }
}
