import React from "react";
import { computed } from "mobx";
import { observer } from "mobx-react";

import { ProjectContext } from "project-editor/project/context";
import {
    EezValueObject,
    findPropertyByChildObject,
    getClass,
    getParent,
    IEezObject,
    isValue
} from "project-editor/core/object";
import { INavigationStore } from "project-editor/core/store";
import { PropertyGrid } from "project-editor/components/PropertyGrid";
import { Panel } from "project-editor/components/Panel";

@observer
export class PropertiesPanel extends React.Component<{
    object: IEezObject | undefined;
    navigationStore?: INavigationStore;
    buttons?: JSX.Element[];
    readOnly?: boolean;
}> {
    static contextType = ProjectContext;
    declare context: React.ContextType<typeof ProjectContext>;

    @computed get objects() {
        let objects: IEezObject[];

        const navigationStore =
            this.props.navigationStore || this.context.navigationStore;

        if (
            navigationStore.selectedPanel &&
            navigationStore.selectedPanel.selectedObjects !== undefined &&
            navigationStore.selectedPanel.selectedObjects.length > 0
        ) {
            objects = navigationStore.selectedPanel.selectedObjects;
        } else if (
            navigationStore.selectedPanel &&
            navigationStore.selectedPanel.selectedObject !== undefined
        ) {
            objects = [navigationStore.selectedPanel.selectedObject];
        } else if (this.props.object) {
            objects = [this.props.object];
        } else {
            objects = [];
        }

        if (objects.length === 1) {
            if (isValue(objects[0])) {
                const object = objects[0];
                const childObject = getParent(object);
                const parent = getParent(childObject);
                if (parent) {
                    const propertyInfo = findPropertyByChildObject(
                        parent,
                        childObject
                    );
                    if (propertyInfo && !propertyInfo.hideInPropertyGrid) {
                        objects = [parent];
                    }
                }
            }
        }
        return objects;
    }

    render() {
        let title;
        if (this.objects.length == 0) {
            title = "Properties";
        } else if (this.objects.length == 1) {
            let object = this.objects[0];
            if (object instanceof EezValueObject) {
                object = getParent(object);
            }
            title = `Properties (${getClass(object).name})`;
        } else {
            title = `Properties (multiple objects)`;
        }

        return (
            <Panel
                id="properties"
                title={title}
                body={
                    <PropertyGrid
                        objects={this.objects}
                        readOnly={this.props.readOnly}
                    />
                }
                buttons={this.props.buttons}
            />
        );
    }
}
