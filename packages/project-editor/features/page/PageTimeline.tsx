import React from "react";
import { action, makeObservable } from "mobx";
import { observer } from "mobx-react";

import { IEezObject } from "project-editor/core/object";
import { TreeAdapter } from "project-editor/core/objectAdapter";

import { ProjectContext } from "project-editor/project/context";
import { ProjectEditor } from "project-editor/project-editor-interface";

import { PageTabState } from "project-editor/features/page/PageEditor";
import { Page } from "project-editor/features/page/page";

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
