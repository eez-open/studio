import { computed } from "mobx";
import { observer } from "mobx-react";
import React from "react";

import { NavigationStore, UIStateStore } from "project-editor/core/store";
import { NavigationComponent } from "project-editor/core/object";

import { Splitter } from "eez-studio-ui/splitter";

import { ListNavigation } from "project-editor/components/ListNavigation";
import { PropertyGrid } from "project-editor/components/PropertyGrid";

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
