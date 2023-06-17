import React from "react";
import { computed, makeObservable } from "mobx";
import { observer } from "mobx-react";

import { ProjectContext } from "project-editor/project/context";
import { getParent } from "project-editor/core/object";
import { EezValueObject, getLabel, isObjectExists } from "project-editor/store";
import { PropertyGrid } from "project-editor/ui-components/PropertyGrid";

export const PropertiesPanel = observer(
    class PropertiesPanel extends React.Component {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        constructor(props: { readOnly?: boolean }) {
            super(props);

            makeObservable(this, {
                objects: computed
            });
        }

        get objects() {
            return this.context.navigationStore.propertyGridObjects;
        }

        render() {
            this.context.lastRevision;

            let title;

            const objects = this.objects
                .filter(object => object != undefined)
                .filter(object => isObjectExists(object));

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
                        readOnly={!!this.context.runtime}
                    />
                </div>
            );
        }
    }
);
