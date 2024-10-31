import React from "react";
import { computed, makeObservable } from "mobx";
import { observer } from "mobx-react";

import { ProjectContext } from "project-editor/project/context";
import { getParent } from "project-editor/core/object";
import {
    EezValueObject,
    getAncestorOfType,
    getObjectIcon,
    getPropertiesPanelLabel,
    isObjectExists
} from "project-editor/store";
import { PropertyGrid } from "project-editor/ui-components/PropertyGrid";
import { ProjectEditor } from "project-editor/project-editor-interface";
import { Settings } from "../project";
import { Icon } from "eez-studio-ui/icon";

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
                .filter(
                    object =>
                        object != undefined &&
                        !getAncestorOfType(object, Settings.classInfo)
                )
                .filter(object => isObjectExists(object));

            let icon = null;

            if (objects.length == 0) {
                title = "Nothing selected";
            } else if (objects.length == 1) {
                let object = objects[0];
                if (object instanceof EezValueObject) {
                    object = getParent(object);
                }

                icon = getObjectIcon(object);
                title = getPropertiesPanelLabel(object);
            } else {
                title = "Multiple objects selected";
            }

            // if LVGL project show properties for both Page object and Screen widget object
            let secondObject;
            if (
                objects.length == 1 &&
                objects[0] instanceof ProjectEditor.PageClass &&
                this.context.projectTypeTraits.isLVGL
            ) {
                secondObject = objects[0].lvglScreenWidget;
            }

            return (
                <div className="EezStudio_PropertiesPanel">
                    <div className="EezStudio_PropertiesPanel_Header">
                        {typeof icon === "string" ? <Icon icon={icon} /> : icon}
                        {title}
                    </div>
                    <div className="EezStudio_PropertiesPanel_Body">
                        <PropertyGrid
                            objects={objects}
                            readOnly={!!this.context.runtime}
                        />
                        {secondObject && (
                            <PropertyGrid
                                objects={[secondObject]}
                                readOnly={!!this.context.runtime}
                            />
                        )}
                    </div>
                </div>
            );
        }
    }
);
