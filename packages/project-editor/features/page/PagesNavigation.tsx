import React from "react";
import { action, computed, makeObservable } from "mobx";
import { observer } from "mobx-react";

import { IEezObject } from "project-editor/core/object";
import {
    TreeAdapter,
    TreeObjectAdapter
} from "project-editor/core/objectAdapter";
import { IPanel } from "project-editor/store";

import { Tree } from "project-editor/ui-components/Tree";

import { ProjectContext } from "project-editor/project/context";

import { ProjectEditor } from "project-editor/project-editor-interface";
import type { PageTabState } from "project-editor/features/page/PageEditor";
import type { Widget } from "project-editor/flow/component";
import classNames from "classnames";
import { IconAction } from "eez-studio-ui/action";
import {
    Body,
    ToolbarHeader,
    VerticalHeaderWithBody
} from "eez-studio-ui/header-with-body";
import { Toolbar } from "eez-studio-ui/toolbar";
import { visitObjects } from "project-editor/core/search";
import { CommentActionComponent } from "project-editor/flow/components/actions";

////////////////////////////////////////////////////////////////////////////////

const LOCK_ICON = (
    <svg viewBox="0 0 1664 1408">
        <path d="M320 640h512V448q0-106-75-181t-181-75-181 75-75 181v192zm832 96v576q0 40-28 68t-68 28H96q-40 0-68-28t-28-68V736q0-40 28-68t68-28h32V448q0-184 132-316T576 0t316 132 132 316v192h32q40 0 68 28t28 68z" />
    </svg>
);

const UNLOCK_ICON = (
    <svg viewBox="0 0 1664 1408">
        <path d="M1664 448v256q0 26-19 45t-45 19h-64q-26 0-45-19t-19-45V448q0-106-75-181t-181-75-181 75-75 181v192h96q40 0 68 28t28 68v576q0 40-28 68t-68 28H96q-40 0-68-28t-28-68V736q0-40 28-68t68-28h672V448q0-185 131.5-316.5T1216 0t316.5 131.5T1664 448z" />
    </svg>
);

const EYE_OPEN_ICON = (
    <svg viewBox="0 0 256 256">
        <path d="M245.4834 125.5631c-.3457-.7764-8.666-19.2334-27.2402-37.8096C201.0186 70.527 171.3799 49.9918 128 49.9918S54.9814 70.527 37.7568 87.7535c-18.5742 18.5762-26.8945 37.0332-27.2402 37.8096a6.0013 6.0013 0 0 0 .001 4.874c.3447.7764 8.666 19.2295 27.2402 37.8018 17.2246 17.2226 46.8623 37.753 90.2422 37.753s73.0176-20.5303 90.2422-37.753c18.5742-18.5723 26.8955-37.0254 27.2402-37.8018a6.0013 6.0013 0 0 0 .001-4.874ZM128 193.9918c-31.378 0-58.7803-11.416-81.4482-33.9306a134.6598 134.6598 0 0 1-23.8614-32.0616 134.689 134.689 0 0 1 23.8623-32.0703C69.2197 73.4098 96.6231 61.9918 128 61.9918s58.7803 11.418 81.4473 33.9375a134.6646 134.6646 0 0 1 23.8613 32.0684C226.9414 140.1979 195.039 193.9918 128 193.9918Zm0-111.9912a46 46 0 1 0 46 46 46.0524 46.0524 0 0 0-46-46Zm0 80a34 34 0 1 1 34-34 34.038 34.038 0 0 1-34 34Z" />
    </svg>
);

const EYE_CLOSE_ICON = (
    <svg viewBox="0 0 256 256">
        <path d="M229.1563 163.8125a6.0001 6.0001 0 1 1-10.3926 6l-19.4546-33.6953a121.9088 121.9088 0 0 1-38.2362 17.6728l6.1322 34.7744a6.0008 6.0008 0 0 1-4.8672 6.9512 6.098 6.098 0 0 1-1.0488.0918 6.002 6.002 0 0 1-5.9024-4.959l-6.058-34.3544a134.2055 134.2055 0 0 1-42.747-.0137l-6.0573 34.3555a6.002 6.002 0 0 1-5.9023 4.959 6.0991 6.0991 0 0 1-1.0489-.0918 6.0008 6.0008 0 0 1-4.8671-6.9512l6.133-34.7846a121.903 121.903 0 0 1-38.1914-17.6802L37.085 169.9707a6.0001 6.0001 0 0 1-10.3926-6l20.3362-35.2231a145.1916 145.1916 0 0 1-19.6965-20.102 5.9998 5.9998 0 0 1 9.334-7.541 130.8535 130.8535 0 0 0 21.582 21.2558c.1215.085.2364.1758.3498.2686A111.5045 111.5045 0 0 0 128 146a111.5016 111.5016 0 0 0 69.3887-23.3618c.1052-.0845.211-.1685.3228-.2466a130.8324 130.8324 0 0 0 21.6215-21.2871 5.9998 5.9998 0 1 1 9.334 7.541 145.1519 145.1519 0 0 1-19.7368 20.1352Z" />
    </svg>
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
                isAnyLocked: computed,
                isAnyHidden: computed
            });
        }

        componentDidMount() {
            this.context.navigationStore.mountPanel(this);
        }

        componentWillUnmount() {
            this.context.navigationStore.unmountPanel(this);
        }

        get pageTabState() {
            const editor = this.context.editorsStore.activeEditor;
            if (!editor) {
                return undefined;
            }

            const object = editor.object;
            if (!(object instanceof ProjectEditor.PageClass)) {
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
                true,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                // Argument hideRootItem is true in case of LVGL page, ie root LVGLScreenWidget is hidden for the users.
                this.context.projectTypeTraits.isLVGL &&
                this.pageTabState?.page.lvglScreenWidget
                    ? true
                    : false
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
        canCut() {
            return this.treeAdapter ? this.treeAdapter.canCut() : false;
        }
        cutSelection() {
            this.treeAdapter!.cutSelection();
        }
        canCopy() {
            return this.treeAdapter ? this.treeAdapter.canCopy() : false;
        }
        copySelection() {
            this.treeAdapter!.copySelection();
        }
        canPaste() {
            return this.treeAdapter ? this.treeAdapter.canPaste() : false;
        }
        pasteSelection() {
            this.treeAdapter!.pasteSelection();
        }
        canDelete() {
            return this.treeAdapter ? this.treeAdapter.canDelete() : false;
        }
        deleteSelection() {
            this.treeAdapter!.deleteSelection();
        }
        selectAll() {
            this.treeAdapter!.selectItems(
                this.treeAdapter!.allRows.map(row => row.item)
            );
        }
        onFocus = () => {
            this.context.navigationStore.setSelectedPanel(this);
        };

        get isAnyLocked() {
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

        onLockAll = action(() => {
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
        });

        onUnlockAll = action(() => {
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
        });

        get isAnyHidden() {
            if (!this.treeAdapter) {
                return false;
            }
            return (
                this.treeAdapter.allRows.find(
                    row =>
                        ((row.item as TreeObjectAdapter).object as Widget)
                            .hiddenInEditor
                ) != undefined
            );
        }

        onHideAll = action(() => {
            if (!this.treeAdapter) {
                return;
            }

            this.context.undoManager.setCombineCommands(true);

            this.treeAdapter.allRows.forEach(row => {
                const widget = (row.item as TreeObjectAdapter).object as Widget;
                if (!widget.hiddenInEditor) {
                    this.context.updateObject(widget, {
                        hiddenInEditor: true
                    });
                }
            });

            this.context.undoManager.setCombineCommands(false);
        });

        onShowAll = action(() => {
            if (!this.treeAdapter) {
                return;
            }

            this.context.undoManager.setCombineCommands(true);

            this.treeAdapter.allRows.forEach(row => {
                const widget = (row.item as TreeObjectAdapter).object as Widget;
                if (widget.hiddenInEditor) {
                    this.context.updateObject(widget, {
                        hiddenInEditor: false
                    });
                }
            });

            this.context.undoManager.setCombineCommands(false);
        });

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
                        withIcon: widget.locked || widget.hiddenInEditor,
                        dimmed: widget.hiddenInEditor
                    })}
                >
                    <span>{this.treeAdapter.itemToString(item)}</span>
                    <Toolbar>
                        <IconAction
                            icon={widget.locked ? LOCK_ICON : UNLOCK_ICON}
                            title={
                                widget.locked
                                    ? "Unlock this widget"
                                    : "Lock this widget"
                            }
                            iconSize={14}
                            onClick={action(() =>
                                this.context.updateObject(widget, {
                                    locked: !widget.locked
                                })
                            )}
                            style={{
                                visibility: widget.locked ? "visible" : "hidden"
                            }}
                        />
                        <IconAction
                            icon={
                                widget.hiddenInEditor
                                    ? EYE_CLOSE_ICON
                                    : EYE_OPEN_ICON
                            }
                            title={widget.hiddenInEditor ? "Show" : "Hide"}
                            iconSize={14}
                            onClick={action(() => {
                                const hiddenInEditor = !widget.hiddenInEditor;

                                this.context.undoManager.setCombineCommands(
                                    true
                                );
                                this.context.updateObject(widget, {
                                    hiddenInEditor
                                });

                                const childWidgets: Widget[] = [];

                                for (const object of visitObjects(widget)) {
                                    if (
                                        object instanceof
                                        ProjectEditor.WidgetClass
                                    ) {
                                        childWidgets.push(object);
                                    }
                                }

                                childWidgets.forEach(childWidget =>
                                    this.context.updateObject(childWidget, {
                                        hiddenInEditor
                                    })
                                );

                                this.context.undoManager.setCombineCommands(
                                    false
                                );
                            })}
                            style={{
                                visibility: widget.hiddenInEditor
                                    ? "visible"
                                    : "hidden"
                            }}
                        />
                    </Toolbar>
                </span>
            );
        };

        render() {
            return this.treeAdapter ? (
                <VerticalHeaderWithBody className="EezStudio_PageStructure">
                    <ToolbarHeader>
                        <Toolbar style={{ minHeight: 38 }}>
                            {this.isAnyHidden ? (
                                <label className="EezStudio_PageStructure_HiddenWidgetLines">
                                    <span>Hidden widget lines</span>
                                    <select
                                        className="form-select"
                                        value={
                                            this.context.project.settings
                                                .general.hiddenWidgetLines
                                        }
                                        onChange={action(event => {
                                            this.context.project.settings.general.hiddenWidgetLines =
                                                event.target.value as any;
                                        })}
                                        style={{ margin: "2px 10px 2px 5px" }}
                                    >
                                        <option value="visible">Visible</option>
                                        <option value="dimmed">Dimmed</option>
                                        <option value="hidden">Hidden</option>
                                    </select>
                                </label>
                            ) : null}
                            <IconAction
                                title={
                                    this.isAnyLocked ? "Unlock All" : "Lock All"
                                }
                                icon={
                                    this.isAnyLocked ? UNLOCK_ICON : LOCK_ICON
                                }
                                iconSize={16}
                                onClick={
                                    this.isAnyLocked
                                        ? this.onUnlockAll
                                        : this.onLockAll
                                }
                            />
                            <IconAction
                                title={
                                    this.isAnyHidden ? "Show All" : "Hide all"
                                }
                                icon={
                                    this.isAnyHidden
                                        ? EYE_OPEN_ICON
                                        : EYE_CLOSE_ICON
                                }
                                iconSize={16}
                                onClick={
                                    this.isAnyHidden
                                        ? this.onShowAll
                                        : this.onHideAll
                                }
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
            ) : (
                <div
                    className="EezStudio_PageStructure_NoPageSelected"
                    onContextMenu={e => e.preventDefault()}
                ></div>
            );
        }
    }
);

export const ActionComponents = observer(
    class ActionComponents extends React.Component implements IPanel {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        constructor(props: any) {
            super(props);

            makeObservable(this, {
                pageTabState: computed,
                componentContainerDisplayItem: computed,
                treeAdapter: computed
            });
        }

        componentDidMount() {
            this.context.navigationStore.mountPanel(this);
        }

        componentWillUnmount() {
            this.context.navigationStore.unmountPanel(this);
        }

        get pageTabState() {
            const editor = this.context.editorsStore.activeEditor;
            if (!editor) {
                return undefined;
            }

            const object = editor.object;
            if (!(object instanceof ProjectEditor.PageClass)) {
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
                    return (
                        object instanceof ProjectEditor.ActionComponentClass &&
                        !(object instanceof CommentActionComponent)
                    );
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
        canCut() {
            return this.treeAdapter ? this.treeAdapter.canCut() : false;
        }
        cutSelection() {
            this.treeAdapter!.cutSelection();
        }
        canCopy() {
            return this.treeAdapter ? this.treeAdapter.canCopy() : false;
        }
        copySelection() {
            this.treeAdapter!.copySelection();
        }
        canPaste() {
            return this.treeAdapter ? this.treeAdapter.canPaste() : false;
        }
        pasteSelection() {
            this.treeAdapter!.pasteSelection();
        }
        canDelete() {
            return this.treeAdapter ? this.treeAdapter.canDelete() : false;
        }
        deleteSelection() {
            this.treeAdapter!.deleteSelection();
        }
        onFocus = () => {
            this.context.navigationStore.setSelectedPanel(this);
        };

        renderItem = (itemId: string) => {
            if (!this.treeAdapter) {
                return null;
            }
            const item = this.treeAdapter.getItemFromId(itemId);
            if (!item) {
                return null;
            }

            return (
                <span className="EezStudio_ActionComponentTreeTrow">
                    <span>{this.treeAdapter.itemToString(item)}</span>
                </span>
            );
        };

        render() {
            return this.treeAdapter ? (
                <Tree
                    treeAdapter={this.treeAdapter}
                    onFocus={this.onFocus}
                    tabIndex={0}
                    renderItem={this.renderItem}
                />
            ) : null;
        }
    }
);
