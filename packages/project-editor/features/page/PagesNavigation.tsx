import React from "react";
import { action, computed, makeObservable } from "mobx";
import { observer } from "mobx-react";
import * as FlexLayout from "flexlayout-react";

import { _find } from "eez-studio-shared/algorithm";

import { IEezObject } from "project-editor/core/object";
import {
    TreeAdapter,
    TreeObjectAdapter
} from "project-editor/core/objectAdapter";
import { IPanel, LayoutModels } from "project-editor/store";

import { ListNavigation } from "project-editor/components/ListNavigation";
import { Tree } from "project-editor/components/Tree";

import { ProjectContext } from "project-editor/project/context";

import { ProjectEditor } from "project-editor/project-editor-interface";
import { NavigationComponent } from "project-editor/project/NavigationComponent";
import { PageTabState } from "project-editor/features/page/PageEditor";
import { Page } from "project-editor/features/page/page";
import { LocalVariables } from "../variable/VariablesNavigation";
import type { Widget } from "project-editor/flow/component";
import classNames from "classnames";
import { IconAction } from "eez-studio-ui/action";
import {
    Body,
    ToolbarHeader,
    VerticalHeaderWithBody
} from "eez-studio-ui/header-with-body";
import { Toolbar } from "eez-studio-ui/toolbar";

////////////////////////////////////////////////////////////////////////////////

const LOCK_ICON = (
    <svg viewBox="0 0 320 420">
        <path d="M280 140h-20v-40C260 45 215 0 160 0S60 45 60 100v40H40c-22.002 0-40 17.998-40 40v200c0 22.002 17.998 40 40 40h240c22.002 0 40-17.998 40-40V180c0-22.002-17.998-40-40-40zM160 322c-22.002 0-40-17.998-40-40s17.998-40 40-40 40 17.998 40 40-17.998 40-40 40zm62.002-182H97.998v-40c0-34.004 28.003-62.002 62.002-62.002 34.004 0 62.002 27.998 62.002 62.002v40z" />
    </svg>
);

const UNLOCK_ICON = (
    <svg viewBox="0 0 320 420">
        <path d="M280 140h-20v-40C260 45 215 0 160 0S60 45 60 100h37.998c0-34.004 28.003-62.002 62.002-62.002 34.004 0 62.002 27.998 62.002 62.002H222v40H40c-22.002 0-40 17.998-40 40v200c0 22.002 17.998 40 40 40h240c22.002 0 40-17.998 40-40V180c0-22.002-17.998-40-40-40zM160 322c-22.002 0-40-17.998-40-40s17.998-40 40-40 40 17.998 40 40-17.998 40-40 40z" />
    </svg>
);

export const PagesNavigation = observer(
    class PagesNavigation extends NavigationComponent {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        factory = (node: FlexLayout.TabNode) => {
            var component = node.getComponent();

            if (component === "pages") {
                return (
                    <ListNavigation
                        id={this.props.id}
                        navigationObject={this.props.navigationObject}
                        selectedObject={
                            this.context.navigationStore.selectedPageObject
                        }
                        editable={!this.context.runtime}
                    />
                );
            }

            if (component === "page-structure") {
                return <PageStructure />;
            }

            if (component === "local-vars") {
                return <LocalVariables />;
            }

            return null;
        };

        render() {
            return (
                <FlexLayout.Layout
                    model={this.context.layoutModels.pages}
                    factory={this.factory}
                    realtimeResize={true}
                    font={LayoutModels.FONT_SUB}
                />
            );
        }
    }
);

export const PageStructure = observer(
    class PageStructure extends React.Component implements IPanel {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        constructor(props: any) {
            super(props);

            makeObservable(this, {
                pageTabState: computed,
                componentContainerDisplayItem: computed,
                treeAdapter: computed,
                isLockAllEnabled: computed,
                isUnlockAllEnabled: computed
            });
        }

        get pageTabState() {
            const editor = this.context.editorsStore.activeEditor;
            if (!editor) {
                return undefined;
            }

            const object = editor.object;
            if (!(object instanceof Page)) {
                return undefined;
            }

            return editor.state as PageTabState;
        }

        get componentContainerDisplayItem() {
            if (!this.pageTabState) {
                return undefined;
            }

            return this.pageTabState.widgetContainer;
        }

        get treeAdapter() {
            if (!this.componentContainerDisplayItem) {
                return null;
            }
            return new TreeAdapter(
                this.componentContainerDisplayItem,
                undefined,
                (object: IEezObject) => {
                    return object instanceof ProjectEditor.WidgetClass;
                },
                true
            );
        }

        // interface IPanel implementation
        get selectedObject() {
            return this.selectedObjects[0];
        }

        get selectedObjects() {
            const selectedObjects =
                this.componentContainerDisplayItem &&
                this.componentContainerDisplayItem.selectedObjects;
            if (selectedObjects && selectedObjects.length > 0) {
                return selectedObjects;
            }

            if (this.pageTabState) {
                return [this.pageTabState.page];
            }

            return [];
        }
        cutSelection() {
            this.treeAdapter!.cutSelection();
        }
        copySelection() {
            this.treeAdapter!.copySelection();
        }
        pasteSelection() {
            this.treeAdapter!.pasteSelection();
        }
        deleteSelection() {
            this.treeAdapter!.deleteSelection();
        }
        onFocus = () => {
            this.context.navigationStore.setSelectedPanel(this);
        };

        get isLockAllEnabled() {
            if (!this.treeAdapter) {
                return false;
            }
            return (
                this.treeAdapter.allRows.find(
                    row =>
                        !((row.item as TreeObjectAdapter).object as Widget)
                            .locked
                ) != undefined
            );
        }

        onLockAll = () => {
            if (!this.treeAdapter) {
                return;
            }

            this.context.undoManager.setCombineCommands(true);

            this.treeAdapter.allRows.forEach(row => {
                const widget = (row.item as TreeObjectAdapter).object as Widget;
                if (!widget.locked) {
                    this.context.updateObject(widget, {
                        locked: true
                    });
                }
            });

            this.context.undoManager.setCombineCommands(false);
        };

        get isUnlockAllEnabled() {
            if (!this.treeAdapter) {
                return false;
            }

            return (
                this.treeAdapter.allRows.find(
                    row =>
                        ((row.item as TreeObjectAdapter).object as Widget)
                            .locked
                ) != undefined
            );
        }

        onUnlockAll = () => {
            if (!this.treeAdapter) {
                return;
            }

            this.context.undoManager.setCombineCommands(true);

            this.treeAdapter.allRows.forEach(row => {
                const widget = (row.item as TreeObjectAdapter).object as Widget;
                if (widget.locked) {
                    this.context.updateObject(widget, {
                        locked: false
                    });
                }
            });

            this.context.undoManager.setCombineCommands(false);
        };

        renderItem = (itemId: string) => {
            if (!this.treeAdapter) {
                return null;
            }
            const item = this.treeAdapter.getItemFromId(itemId);
            if (!item) {
                return null;
            }

            const widget = item.object as Widget;

            return (
                <span
                    className={classNames("EezStudio_WidgetTreeTrow", {
                        locked: widget.locked
                    })}
                >
                    <span>{this.treeAdapter.itemToString(item)}</span>
                    <IconAction
                        icon={widget.locked ? LOCK_ICON : UNLOCK_ICON}
                        title={
                            widget.locked
                                ? "Unlock this widget"
                                : "Lock this widget"
                        }
                        iconSize={14}
                        onClick={() =>
                            this.context.updateObject(widget, {
                                locked: !widget.locked
                            })
                        }
                    />
                </span>
            );
        };

        render() {
            return this.treeAdapter ? (
                <VerticalHeaderWithBody className="EezStudio_PageStructure">
                    <ToolbarHeader>
                        <Toolbar>
                            <IconAction
                                title="Lock All"
                                icon={LOCK_ICON}
                                iconSize={16}
                                onClick={this.onLockAll}
                                enabled={this.isLockAllEnabled}
                            />
                            <IconAction
                                title="Unlock All"
                                icon={UNLOCK_ICON}
                                iconSize={16}
                                onClick={this.onUnlockAll}
                                enabled={this.isUnlockAllEnabled}
                            />
                        </Toolbar>
                    </ToolbarHeader>
                    <Body>
                        <Tree
                            treeAdapter={this.treeAdapter}
                            onFocus={this.onFocus}
                            tabIndex={0}
                            renderItem={this.renderItem}
                        />
                    </Body>
                </VerticalHeaderWithBody>
            ) : null;
        }
    }
);

export const PageTimeline = observer(
    class PageTimeline extends React.Component {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        constructor(props: any) {
            super(props);

            makeObservable(this, {});
        }

        get pageTabState() {
            const editor = this.context.editorsStore.activeEditor;
            if (!editor) {
                return undefined;
            }

            const object = editor.object;
            if (!(object instanceof Page)) {
                return undefined;
            }

            return editor.state as PageTabState;
        }

        get componentContainerDisplayItem() {
            if (!this.pageTabState) {
                return undefined;
            }

            return this.pageTabState.widgetContainer;
        }

        get treeAdapter() {
            if (!this.componentContainerDisplayItem) {
                return null;
            }
            return new TreeAdapter(
                this.componentContainerDisplayItem,
                undefined,
                (object: IEezObject) => {
                    return object instanceof ProjectEditor.WidgetClass;
                },
                true
            );
        }

        render() {
            return this.pageTabState ? (
                <div>
                    <div style={{ display: "flex" }}>
                        <input
                            type="range"
                            min="0"
                            max="10.0"
                            step="0.1"
                            value={this.pageTabState.timelinePosition}
                            onChange={action(event => {
                                this.pageTabState!.timelinePosition =
                                    parseFloat(event.target.value);
                            })}
                            style={{ flex: 1 }}
                        />
                        <input
                            type="number"
                            min="0"
                            max="10.0"
                            step="0.1"
                            value={this.pageTabState.timelinePosition}
                            onChange={action(event => {
                                this.pageTabState!.timelinePosition =
                                    parseFloat(event.target.value);
                            })}
                        />
                    </div>
                </div>
            ) : null;
        }
    }
);
