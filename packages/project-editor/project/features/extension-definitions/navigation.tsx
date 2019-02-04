import { computed } from "mobx";
import { observer } from "mobx-react";
import React from "react";

import { NavigationStore, UIStateStore } from "eez-studio-shared/model/store";
import { NavigationComponent } from "eez-studio-shared/model/object";

import { Splitter } from "eez-studio-ui/splitter";

import { ListNavigation } from "project-editor/project/ui/ListNavigation";
import { PropertyGrid } from "eez-studio-shared/model/components/PropertyGrid";

@observer
export class ExtensionDefinitionsNavigation extends NavigationComponent {
    @computed
    get object() {
        return (
            (NavigationStore.selectedPanel && NavigationStore.selectedPanel.selectedObject) ||
            NavigationStore.selectedObject
        );
    }

    render() {
        let content = <PropertyGrid object={this.object} />;

        if (UIStateStore.viewOptions.navigationVisible) {
            return (
                <Splitter
                    type="horizontal"
                    persistId={`project-editor/navigation-${this.props.id}`}
                    sizes={`240px|100%`}
                    childrenOverflow="hidden"
                >
                    <ListNavigation
                        id={this.props.id}
                        navigationObject={this.props.navigationObject}
                    />
                    {content}
                </Splitter>
            );
        } else {
            return content;
        }
    }
}
