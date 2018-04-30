import { computed } from "mobx";
import { observer } from "mobx-react";
import * as React from "react";

import { NavigationStore, UIStateStore } from "project-editor/core/store";
import { NavigationComponent } from "project-editor/core/metaData";

import * as Layout from "project-editor/components/Layout";
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
            content = <PropertyGrid object={this.object} className="layoutCenter" />;
        }

        if (UIStateStore.viewOptions.navigationVisible) {
            return (
                <Layout.Split
                    orientation="horizontal"
                    splitId={`navigation-${this.props.id}`}
                    splitPosition="0.25"
                >
                    <ListNavigation navigationObject={this.props.navigationObject} />
                    {content}
                </Layout.Split>
            );
        } else {
            return content;
        }
    }
}
