import * as React from "react";
import { observable, action } from "mobx";
import { observer } from "mobx-react";

import { AppRootComponent } from "eez-studio-ui/app";

import { Test1 } from "test/test1";

////////////////////////////////////////////////////////////////////////////////

const navigationItems = [
    {
        id: "test1",
        icon: "material:create",
        title: "Test 1",
        renderContent: () => {
            return <Test1 />;
        }
    }
];

@observer
export class App extends React.Component {
    @observable.ref
    selectedItem = navigationItems[0];

    @action.bound
    selectItem(item: any) {
        this.selectedItem = item;

        if (item) {
            document.title = `${item.title} - Test - EEZ Studio`;
        } else {
            document.title = `Test - EEZ Studio`;
        }
    }

    render() {
        return (
            <AppRootComponent
                navigationItems={navigationItems}
                selectedItem={this.selectedItem}
                onSelectionChange={this.selectItem}
            />
        );
    }
}
