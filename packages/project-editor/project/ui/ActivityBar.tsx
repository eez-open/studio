import React from "react";
import { runInAction } from "mobx";
import { observer } from "mobx-react";
import classNames from "classnames";

import { t } from "eez-studio-shared/i18n";

import { Icon } from "eez-studio-ui/icon";
import { openCommandPalette } from "eez-studio-ui/command-palette";

import { ProjectContext } from "project-editor/project/context";
import { LayoutModels } from "project-editor/store";
import { settingsController } from "home/settings";
import { resourcesState } from "project-editor/project/ui/LeftPanelTabs";

// Figma-style activity bar: a narrow vertical rail on the far left with one
// icon per dock tab. Clicking an icon activates that tab in the FlexLayout
// model; the active tab gets a blue indicator. Only tabs that actually
// exist in the current layout are shown. When the Resources entry is the
// active tab, a group of sub-items appears below the divider — one per
// resource kind (styles, fonts, bitmaps, themes, LVGL groups).

interface IRailItem {
    tabId?: string;
    component?: string;
    icon: string;
    titleKey: string;
}

const RAIL_ITEMS: (IRailItem | "divider")[] = [
    {
        tabId: LayoutModels.PAGES_TAB_ID,
        icon: "svg:pages",
        titleKey: "Pages"
    },
    {
        tabId: LayoutModels.USER_WIDGETS_TAB_ID,
        icon: "svg:user_widgets",
        titleKey: "User Widgets"
    },
    {
        tabId: LayoutModels.ACTIONS_TAB_ID,
        icon: "material:code",
        titleKey: "User Actions"
    },
    {
        component: "flow-structure",
        icon: "svg:hierarchy",
        titleKey: "Widgets Structure"
    },
    {
        tabId: LayoutModels.VARIABLES_TAB_ID,
        icon: "svg:variable",
        titleKey: "Variables"
    },
    "divider",
    {
        tabId: LayoutModels.RESOURCES_TAB_ID,
        icon: "material:folder_open",
        titleKey: "Resources"
    },
    "divider",
    {
        tabId: LayoutModels.PROPERTIES_TAB_ID,
        icon: "svg:properties",
        titleKey: "Properties"
    },
    {
        tabId: LayoutModels.COMPONENTS_PALETTE_TAB_ID,
        icon: "svg:components",
        titleKey: "Components Palette"
    }
];

const RESOURCE_SUB_ITEMS = [
    {
        id: "styles",
        icon: "material:format_color_fill",
        titleKey: "Styles"
    },
    {
        id: "fonts",
        icon: "material:font_download",
        titleKey: "Fonts"
    },
    {
        id: "bitmaps",
        icon: "material:image",
        titleKey: "Bitmaps"
    },
    {
        id: "themes",
        icon: "svg:palette",
        titleKey: "Themes"
    },
    {
        id: "lvgl-groups",
        icon: "material:view_compact",
        titleKey: "LVGL Groups"
    }
];

function visitTabNodes(node: any, visit: (tabNode: any) => void) {
    if (!node) {
        return;
    }
    if (node.getType() === "tab") {
        visit(node);
        return;
    }
    const children = node.getChildren();
    if (children) {
        for (const child of children) {
            visitTabNodes(child, visit);
        }
    }
}

export const ActivityBar = observer(
    class ActivityBar extends React.Component {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        // The layout model is loaded asynchronously, so the bar renders
        // nothing until the FlexLayout model is ready.
        _modelChangeListener = () => this.forceUpdate();
        _modelChangeListenerAttached = false;

        componentDidMount() {
            this.attachModelChangeListener();
        }

        componentDidUpdate() {
            this.attachModelChangeListener();
        }

        componentWillUnmount() {
            this.detachModelChangeListener();
        }

        attachModelChangeListener() {
            if (this.model && !this._modelChangeListenerAttached) {
                this.model.addChangeListener(this._modelChangeListener);
                this._modelChangeListenerAttached = true;
            }
        }

        detachModelChangeListener() {
            if (this.model && this._modelChangeListenerAttached) {
                this.model.removeChangeListener(this._modelChangeListener);
                this._modelChangeListenerAttached = false;
            }
        }

        get model(): any {
            const model = this.context.layoutModels?.root;
            return model && typeof model.getRootRow === "function"
                ? model
                : undefined;
        }

        findTabNode(item: IRailItem) {
            if (!this.model) {
                return undefined;
            }
            let found: any = undefined;
            visitTabNodes(this.model.getRootRow(), tabNode => {
                if (item.tabId !== undefined) {
                    if (tabNode.getId() === item.tabId) {
                        found = tabNode;
                    }
                } else if (
                    item.component !== undefined &&
                    tabNode.getComponent() === item.component
                ) {
                    found = tabNode;
                }
            });
            return found;
        }

        renderRailButton(
            key: string,
            icon: string,
            title: string,
            active: boolean,
            onClick: () => void,
            sub?: boolean
        ) {
            return (
                <div
                    key={key}
                    className={classNames("EezStudio_ActivityBar_Button", {
                        active,
                        "EezStudio_ActivityBar_SubButton": sub
                    })}
                    data-tooltip={title}
                    onClick={onClick}
                >
                    <Icon icon={icon} size={sub ? 18 : 20} />
                </div>
            );
        }

        render() {
            if (!this.model) {
                return null;
            }

            const items: React.ReactNode[] = [];

            for (const item of RAIL_ITEMS) {
                if (item === "divider") {
                    items.push(
                        <div
                            key={"divider" + items.length}
                            className="EezStudio_ActivityBar_Divider"
                        />
                    );
                    continue;
                }

                const tabNode = this.findTabNode(item);
                if (!tabNode) {
                    continue;
                }

                const parent = tabNode.getParent();
                const selected =
                    parent &&
                    parent.getType() === "tabset" &&
                    parent.getSelectedNode() === tabNode;

                items.push(
                    this.renderRailButton(
                        item.tabId || item.component || item.titleKey,
                        item.icon,
                        t(item.titleKey),
                        !!selected,
                        () =>
                            this.context.layoutModels.selectTab(
                                this.model,
                                tabNode.getId()
                            )
                    )
                );

                // resource sub-items: shown while the Resources tab is the
                // active one; clicking selects the resource kind shown in
                // the panel
                if (
                    item.tabId === LayoutModels.RESOURCES_TAB_ID &&
                    selected
                ) {
                    items.push(
                        <div
                            key="resource-sub-divider"
                            className="EezStudio_ActivityBar_Divider"
                        />
                    );
                    for (const sub of RESOURCE_SUB_ITEMS) {
                        items.push(
                            this.renderRailButton(
                                "resource-" + sub.id,
                                sub.icon,
                                t(sub.titleKey),
                                resourcesState.selected === sub.id,
                                () =>
                                    runInAction(
                                        () =>
                                            (resourcesState.selected = sub.id)
                                    ),
                                true
                            )
                        );
                    }
                }
            }

            if (items.length === 0) {
                return null;
            }

            return <div className="EezStudio_ActivityBar">{items}</div>;
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

// Figma-style floating toolbar at the bottom center of the editor area:
// edit/run mode mirror, theme toggle and the command palette trigger.

export const FloatingToolbar = observer(
    class FloatingToolbar extends React.Component {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        get isFullSimulatorMode() {
            return this.context.layoutModels.isDockerSimulatorMode;
        }

        render() {
            const runtime = this.context.runtime;

            return (
                <div className="EezStudio_FloatingToolbar">
                    <div
                        className={classNames(
                            "EezStudio_FloatingToolbar_Button",
                            { active: !runtime && !this.isFullSimulatorMode }
                        )}
                        data-tooltip={t("Enter edit mode (Shift+F5)")}
                        onClick={this.context.onSetEditorMode}
                    >
                        <Icon icon="material:mode_edit" size={18} />
                    </div>

                    <div
                        className={classNames(
                            "EezStudio_FloatingToolbar_Button",
                            { active: !!runtime }
                        )}
                        data-tooltip={t("Enter run mode (F5)")}
                        onClick={this.context.onSetRuntimeMode}
                    >
                        <Icon icon="material:play_arrow" size={18} />
                    </div>

                    <div className="EezStudio_FloatingToolbar_Divider" />

                    <div
                        className="EezStudio_FloatingToolbar_Button"
                        data-tooltip={
                            settingsController.isDarkTheme
                                ? t("Switch to Light Theme")
                                : t("Switch to Dark Theme")
                        }
                        onClick={() =>
                            settingsController.switchTheme(
                                !settingsController.isDarkTheme
                            )
                        }
                    >
                        <Icon
                            icon={
                                settingsController.isDarkTheme
                                    ? "material:brightness_7"
                                    : "material:brightness_4"
                            }
                            size={18}
                        />
                    </div>

                    <div
                        className="EezStudio_FloatingToolbar_Button"
                        data-tooltip={t("Command Palette") + " (Ctrl+Shift+P)"}
                        onClick={openCommandPalette}
                    >
                        <Icon icon="material:search" size={18} />
                    </div>
                </div>
            );
        }
    }
);
