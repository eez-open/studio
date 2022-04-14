import React from "react";
import { computed, makeObservable } from "mobx";
import { observer } from "mobx-react";

import { ProjectContext } from "project-editor/project/context";
import { getParent, IEezObject } from "project-editor/core/object";
import {
    findPropertyByChildObject,
    EezValueObject,
    isValue,
    getLabel
} from "project-editor/store";
import { PropertyGrid } from "project-editor/components/PropertyGrid";

export const PropertiesPanel = observer(
    class PropertiesPanel extends React.Component<{
        readOnly?: boolean;
    }> {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        constructor(props: { readOnly?: boolean }) {
            super(props);

            makeObservable(this, {
                objects: computed
            });
        }

        get objects() {
            let objects: IEezObject[];

            const navigationStore = this.context.navigationStore;

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

            const objects = this.objects.filter(object => object != undefined);

            if (objects.length == 0) {
                title = "Nothing selected";
            } else if (objects.length == 1) {
                let object = objects[0];
                if (object instanceof EezValueObject) {
                    object = getParent(object);
                }

                title = getLabel(object);
            } else {
                title = "Multiple objects selected";
            }

            return (
                <div className="EezStudio_PropertiesPanel">
                    <div className="header">{title}</div>
                    <PropertyGrid
                        objects={objects}
                        readOnly={this.props.readOnly}
                    />
                </div>
            );
        }
    }
);
