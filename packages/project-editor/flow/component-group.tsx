import React from "react";
import { observable, makeObservable, computed } from "mobx";
import {
    ClassInfo,
    EezObject,
    PropertyType,
    registerClass,
    getParent
} from "project-editor/core/object";
import { generalGroup } from "project-editor/ui-components/PropertyGrid/groups";
import type { Flow } from "project-editor/flow/flow";
import type { Component, ActionComponent } from "project-editor/flow/component";
import { BoundingRectBuilder, Rect } from "eez-studio-shared/geometry";
import { getProjectStore } from "project-editor/store";

////////////////////////////////////////////////////////////////////////////////

export class ComponentGroup extends EezObject {
    description: string;
    components: string[]; // Array of component objIDs

    static classInfo: ClassInfo = {
        properties: [
            {
                name: "description",
                type: PropertyType.String,
                propertyGridGroup: generalGroup
            },
            {
                name: "components",
                type: PropertyType.JSON,
                hideInPropertyGrid: true
            }
        ],
        defaultValue: {
            description: "",
            components: []
        },
        label: (group: ComponentGroup) => {
            return group.description || "Group";
        },
        icon: (
            <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
            >
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M9 9h6M9 13h6M9 17h6" />
            </svg>
        ),
        isMoveable: () => true,
        getRect: (group: ComponentGroup): Rect => {
            return group.boundingRect;
        },
        setRect: (group: ComponentGroup, rect: Rect) => {
            const oldRect = group.boundingRect;
            const dx = rect.left - oldRect.left;
            const dy = rect.top - oldRect.top;

            if (dx === 0 && dy === 0) {
                return;
            }

            // Move all components in the group
            const projectStore = getProjectStore(group);
            projectStore.undoManager.setCombineCommands(true);

            group.componentObjects.forEach(component => {
                projectStore.updateObject(component, {
                    left: component.left + dx,
                    top: component.top + dy
                });
            });

            projectStore.undoManager.setCombineCommands(false);
        },
        isSelectable: () => true,
        deleteObjectFilterHook: (group: ComponentGroup) => {
            const flow = getParent(getParent(group)) as Flow;
            return flow.componentGroups.indexOf(group) != -1;
        }
    };

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            description: observable,
            components: observable,
            boundingRect: computed,
            componentObjects: computed
        });
    }

    get flow(): Flow {
        return getParent(getParent(this)) as Flow;
    }

    get componentObjects(): Component[] {
        const flow = this.flow;
        if (!flow) return [];

        return this.components
            .map(componentId => {
                return flow.components.find(
                    component => component.objID === componentId
                );
            })
            .filter(component => component != null) as Component[];
    }

    get boundingRect() {
        const builder = new BoundingRectBuilder();
        const projectStore = getProjectStore(this);
        const showDescriptions =
            projectStore?.uiStateStore?.showComponentDescriptions ?? false;

        for (const component of this.componentObjects) {
            // Calculate extra height for component description
            let descriptionHeight = 0;
            if (
                showDescriptions &&
                "description" in component &&
                (component as ActionComponent).description
            ) {
                // Estimate description height based on text length
                // Description has: 4px gap + 5px padding top + ~14px line height per line + 5px padding bottom
                const descriptionText = (component as ActionComponent)
                    .description;
                const estimatedLines = Math.ceil(
                    descriptionText.length / (component.width / 7)
                ); // ~7px per character
                descriptionHeight = 4 + 10 + Math.max(1, estimatedLines) * 14;
            }

            builder.addRect({
                left: component.left,
                top: component.top,
                width: component.width,
                height: component.height + descriptionHeight
            });
        }

        const rect = builder.getRect();
        if (!rect) {
            return { left: 0, top: 0, width: 100, height: 100 };
        }

        // Add padding around the components
        const padding = 20;
        return {
            left: rect.left - padding,
            top: rect.top - padding,
            width: rect.width + padding * 2,
            height: rect.height + padding * 2
        };
    }
}

registerClass("ComponentGroup", ComponentGroup);
