import React from "react";
import { observer } from "mobx-react";
import { getId } from "project-editor/core/object";
import type { IFlowContext } from "project-editor/flow/flow-interfaces";
import type { ComponentGroup } from "project-editor/flow/component-group";
import { settingsController } from "home/settings";
import { BoundingRectBuilder } from "eez-studio-shared/geometry";
import type { ActionComponent } from "project-editor/flow/component";
import { getProjectStore } from "project-editor/store";

////////////////////////////////////////////////////////////////////////////////

export const ComponentGroupRenderer = observer(
    ({
        group,
        flowContext
    }: {
        group: ComponentGroup;
        flowContext: IFlowContext;
    }) => {
        const isDark = settingsController.isDarkTheme;
        const viewState = flowContext.viewState;

        // Get drag offsets
        const dx = viewState.dxMouseDrag ?? 0;
        const dy = viewState.dyMouseDrag ?? 0;

        // Compute dynamic bounding rect that accounts for dragged components
        const builder = new BoundingRectBuilder();
        const projectStore = getProjectStore(group);
        const showDescriptions =
            projectStore?.uiStateStore?.showComponentDescriptions ?? false;

        for (const component of group.componentObjects) {
            // Check if this component is being dragged (directly selected)
            const isComponentDragged = viewState.isObjectIdSelected(
                getId(component)
            );

            // Calculate extra height for component description
            let descriptionHeight = 0;
            if (
                showDescriptions &&
                "description" in component &&
                (component as ActionComponent).description
            ) {
                const descriptionText = (component as ActionComponent)
                    .description;
                const estimatedLines = Math.ceil(
                    descriptionText.length / (component.width / 7)
                );
                descriptionHeight = 4 + 10 + Math.max(1, estimatedLines) * 14;
            }

            // Apply drag offset if component is being dragged
            const offsetX = isComponentDragged ? dx : 0;
            const offsetY = isComponentDragged ? dy : 0;

            builder.addRect({
                left: component.left + offsetX,
                top: component.top + offsetY,
                width: component.width,
                height: component.height + descriptionHeight
            });
        }

        const computedRect = builder.getRect();
        const rect = computedRect
            ? {
                  left: computedRect.left - 20,
                  top: computedRect.top - 20,
                  width: computedRect.width + 40,
                  height: computedRect.height + 40
              }
            : { left: 0, top: 0, width: 100, height: 100 };

        // Main container - covers the entire group area and is clickable
        const containerStyle: React.CSSProperties = {
            position: "absolute",
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height,
            border: isDark ? "1px solid #555" : "1px solid #ccc",
            borderRadius: "8px",
            backgroundColor: isDark
                ? "rgba(80, 80, 120, 0.15)"
                : "rgba(200, 200, 255, 0.1)",
            boxShadow: isDark
                ? "0 2px 8px rgba(0, 0, 0, 0.4)"
                : "0 2px 8px rgba(0, 0, 0, 0.15)",
            pointerEvents: "auto",
            cursor: "move",
            boxSizing: "border-box"
        };

        const labelTextStyle: React.CSSProperties = {
            position: "absolute",
            left: "8px",
            top: "-23px",
            padding: "4px 8px",
            backgroundColor: isDark
                ? "rgba(60, 60, 90, 0.95)"
                : "rgba(200, 200, 255, 0.9)",
            borderRadius: "0px",
            fontSize: "12px",
            fontWeight: "500",
            color: isDark ? "#ddd" : "#333",
            whiteSpace: "nowrap",
            maxWidth: rect.width - 20,
            overflow: "hidden",
            textOverflow: "ellipsis"
        };

        return (
            <div
                data-eez-flow-object-id={getId(group)}
                className="EezStudio_ComponentEnclosure eez-component-group"
                style={containerStyle}
            >
                <div
                    style={labelTextStyle}
                    title={group.description || "Group"}
                >
                    {group.description || "Group"}
                </div>
            </div>
        );
    }
);
