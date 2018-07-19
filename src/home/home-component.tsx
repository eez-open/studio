import * as React from "react";
import { observer } from "mobx-react";

import { AppRootComponent } from "shared/ui/app";

import { navigationStore } from "home/navigation-store";

////////////////////////////////////////////////////////////////////////////////

@observer
export class HomeComponent extends React.Component<{}, {}> {
    onSelectionChange(item: any) {
        navigationStore.mainNavigationSelectedItem = item;
    }

    render() {
        return (
            <AppRootComponent
                navigationItems={navigationStore.navigationItems}
                selectedItem={navigationStore.mainNavigationSelectedItem}
                onSelectionChange={this.onSelectionChange}
            />
        );
    }
}
