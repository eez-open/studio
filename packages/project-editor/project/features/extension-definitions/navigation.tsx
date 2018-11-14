import { computed } from "mobx";
import { observer } from "mobx-react";
import * as React from "react";

import { NavigationStore, UIStateStore } from "project-editor/core/store";
import { NavigationComponent } from "project-editor/core/metaData";

import { Splitter } from "eez-studio-ui/splitter";

import { ListNavigation } from "project-editor/project/ListNavigation";
import { PropertyGrid } from "project-editor/components/PropertyGrid";

@observer
export class ExtensionDefinitionsNavigation extends NavigationComponent {
    @computed
    get object() {
        if (NavigationStore.selectedPanel) {
            return NavigationStore.selectedPanel.selectedObject;
        }
        return NavigationStore.selectedObject;
    }

    render() {
        let content;
        if (this.object) {
            content = <PropertyGrid object={this.object} />;
        }

        if (UIStateStore.viewOptions.navigationVisible) {
            return (
                <Splitter
                    type="horizontal"
                    persistId={`project-editor/navigation-${this.props.id}`}
                    sizes={`240px|100%`}
                    childrenOverflow="hidden"
                >
                    <ListNavigation navigationObject={this.props.navigationObject} />
                    {content}
                </Splitter>
            );
        } else {
            return content;
        }
    }
}
