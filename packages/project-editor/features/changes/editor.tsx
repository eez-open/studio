import React from "react";
import {
    makeObservable,
    runInAction,
    action,
    observable,
    autorun,
    IReactionDisposer,
    toJS
} from "mobx";
import { observer } from "mobx-react";

import { Loader } from "eez-studio-ui/loader";

import { ProjectContext } from "project-editor/project/context";
import {
    EditorComponent,
    IEditor,
    IEditorState
} from "project-editor/project/EditorComponent";
import { getClassInfo, IPanel } from "project-editor/store";
import {
    getBeforeAfterProject,
    BeforeAfterProject as ProjectBeforeAndAfter
} from "project-editor/features/changes/diff";
import { EezObject, PropertyType } from "project-editor/core/object";

interface ChangesEditorParams {
    revisionAfterHash: string;
    revisionBeforeHash: string | undefined;
}

export class ChangesEditorState implements IEditorState {
    getTitle(editor: IEditor) {
        const { revisionAfterHash, revisionBeforeHash }: ChangesEditorParams =
            editor.params;

        return `Changes: ${
            revisionBeforeHash ? revisionBeforeHash.slice(0, 8) : "none"
        } -> ${revisionAfterHash.slice(0, 8)}`;
    }
}

export const ChangesEditor = observer(
    class ChangesEditor extends EditorComponent implements IPanel {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        projectBeforeAndAfter: ProjectBeforeAndAfter | undefined;
        progressPercent: number | undefined;

        activeTask: () => void | undefined;
        dispose: IReactionDisposer | undefined;

        constructor(props: any) {
            super(props);

            makeObservable(this, {
                projectBeforeAndAfter: observable.shallow,
                progressPercent: observable
            });
        }

        componentDidMount() {
            this.dispose = autorun(async () => {
                if (this.activeTask) {
                    this.activeTask();
                }

                let canceled = false;

                this.activeTask = () => {
                    canceled = true;
                };

                runInAction(() => {
                    this.progressPercent = 0;
                });

                let revisionContent: ProjectBeforeAndAfter | undefined =
                    undefined;

                const params: ChangesEditorParams = this.props.editor.params;

                const revisionAfterIndex =
                    this.context.uiStateStore.revisions.findIndex(
                        revision => revision.hash == params.revisionAfterHash
                    );

                if (revisionAfterIndex != -1) {
                    const revisionAfter =
                        this.context.uiStateStore.revisions[revisionAfterIndex];

                    const revisionBeforeIndex = params.revisionBeforeHash
                        ? this.context.uiStateStore.revisions.findIndex(
                              revision =>
                                  revision.hash == params.revisionBeforeHash
                          )
                        : -1;

                    const revisionBefore =
                        revisionBeforeIndex != -1
                            ? this.context.uiStateStore.revisions[
                                  revisionBeforeIndex
                              ]
                            : undefined;

                    revisionContent = await getBeforeAfterProject(
                        this.context,
                        revisionBefore,
                        revisionAfter,
                        action(percent => {
                            if (canceled) {
                                throw "canceled";
                            }
                            this.progressPercent = Math.round(percent);
                        })
                    );
                }

                setTimeout(() => {
                    if (!canceled) {
                        runInAction(() => {
                            this.projectBeforeAndAfter = revisionContent;
                            this.progressPercent = undefined;
                        });
                    }
                }, 0);
            });
        }

        componentWillUnmount() {
            if (this.activeTask) {
                this.activeTask();
            }

            if (this.dispose) {
                this.dispose();
            }
        }

        // interface IPanel implementation
        get selectedObject() {
            return this.context.project.changes;
        }
        cutSelection() {}
        copySelection() {}
        pasteSelection() {}
        deleteSelection() {}
        onFocus = () => {
            this.context.navigationStore.setSelectedPanel(this);
        };

        render() {
            if (this.progressPercent != undefined) {
                return (
                    <Loader
                        className=""
                        centered={true}
                        progressPercent={this.progressPercent}
                    />
                );
            }

            if (!this.projectBeforeAndAfter) {
                return null;
            }

            return (
                <ChangesTree
                    projectBeforeAndAfter={this.projectBeforeAndAfter}
                />
            );
        }
    }
);

export const ChangesTree = observer(
    class ChangesTree extends React.Component<{
        projectBeforeAndAfter: ProjectBeforeAndAfter;
    }> {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        renderObjectChanges(objectBefore: EezObject, objectAfter: EezObject) {
            const classInfo = getClassInfo(objectAfter);
            return classInfo.properties
                .filter(propertyInfo => true)
                .map(propertyInfo => {
                    const valueBefore = (objectBefore as any)[
                        propertyInfo.name
                    ];
                    const valueAfter = (objectAfter as any)[propertyInfo.name];

                    if (!valueBefore && valueAfter) {
                        return (
                            <div key={propertyInfo.name}>
                                {propertyInfo.name} ADDED
                            </div>
                        );
                    }

                    if (valueBefore && !valueAfter) {
                        return (
                            <div key={propertyInfo.name}>
                                {propertyInfo.name} REMOVED
                            </div>
                        );
                    }

                    if (propertyInfo.type === PropertyType.Object) {
                        return null;
                    } else if (propertyInfo.type === PropertyType.Array) {
                        return null;
                    } else {
                        return null;
                    }
                });
        }

        render() {
            return (
                <div className="EezStudio_ChangesEditor">
                    {this.renderObjectChanges(
                        this.props.projectBeforeAndAfter.projectBefore,
                        this.props.projectBeforeAndAfter.projectAfter
                    )}
                </div>
            );
        }
    }
);
