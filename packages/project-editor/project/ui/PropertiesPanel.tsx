import React from "react";
import { computed, makeObservable } from "mobx";
import { observer } from "mobx-react";

import { ProjectContext } from "project-editor/project/context";
import { EezObject, getParent, IEezObject } from "project-editor/core/object";
import {
    EezValueObject,
    getAncestorOfType,
    getClassInfo,
    getLabel,
    getObjectIcon,
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

        bodyRef = React.createRef<HTMLDivElement>();
        lastObjectsKey: string | undefined;

        constructor(props: { readOnly?: boolean }) {
            super(props);

            makeObservable(this, {
                objects: computed
            });
        }

        get objects() {
            return this.context.navigationStore.propertyGridObjects
                .filter(
                    object =>
                        object != undefined &&
                        !getAncestorOfType(object, Settings.classInfo)
                )
                .filter(object => isObjectExists(object));
        }

        getObjectsKey(objects: IEezObject[]): string | undefined {
            if (objects.length === 0) {
                return undefined;
            }
            return objects
                .map(obj => {
                    let object = obj;
                    if (object instanceof EezValueObject) {
                        object = getParent(object);
                    }
                    return (object as EezObject).objID;
                })
                .join(",");
        }

        onScroll = () => {
            if (this.lastObjectsKey && this.bodyRef.current) {
                this.context.uiStateStore.setPropertiesPanelScrollPosition(
                    this.lastObjectsKey,
                    this.bodyRef.current.scrollTop
                );
            }
        };

        restoreScrollPosition() {
            const objects = this.objects;
            const currentObjID = this.getObjectsKey(objects);

            if (currentObjID !== this.lastObjectsKey) {
                this.lastObjectsKey = currentObjID;

                // Restore scroll position for the new object
                if (currentObjID && this.bodyRef.current) {
                    const savedScrollTop =
                        this.context.uiStateStore.getPropertiesPanelScrollPosition(
                            currentObjID
                        );
                    if (savedScrollTop !== undefined) {
                        this.bodyRef.current.scrollTop = savedScrollTop;
                    } else {
                        this.bodyRef.current.scrollTop = 0;
                    }
                }
            }
        }

        componentDidMount() {
            this.restoreScrollPosition();
        }

        componentDidUpdate() {
            this.restoreScrollPosition();
        }

        render() {
            this.context.lastRevision;

            let title;

            const objects = this.objects;

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
                    <div
                        className="EezStudio_PropertiesPanel_Body"
                        ref={this.bodyRef}
                        onScroll={this.onScroll}
                    >
                        <PropertyGrid
                            objects={objects}
                            readOnly={!!this.context.runtime}
                        />
                        {secondObject && (
                            <div style={{ marginTop: 10 }}>
                                <PropertyGrid
                                    objects={[secondObject]}
                                    readOnly={!!this.context.runtime}
                                />
                            </div>
                        )}
                    </div>
                </div>
            );
        }
    }
);

function getPropertiesPanelLabel(object: IEezObject) {
    const classInfo = getClassInfo(object);
    if (classInfo.propertiesPanelLabel) {
        return classInfo.propertiesPanelLabel(object);
    }
    return getLabel(object);
}
