import React from "react";
import {
    makeObservable,
    runInAction,
    action,
    observable,
    autorun,
    IReactionDisposer
} from "mobx";
import { observer } from "mobx-react";

import { Loader } from "eez-studio-ui/loader";

import { ProjectContext } from "project-editor/project/context";
import {
    EditorComponent,
    IEditor,
    IEditorState
} from "project-editor/project/EditorComponent";
import { getClassInfo, getLabel, IPanel } from "project-editor/store";
import {
    getBeforeAndAfterProject,
    BeforeAfterProject as ProjectBeforeAndAfter,
    diffObject,
    ObjectChanges,
    ArrayChanges
} from "project-editor/features/changes/diff";
import { ProjectEditor } from "project-editor/project-editor-interface";
import classNames from "classnames";
import { getProjectFeatures } from "project-editor/store/features";
import {
    getObjectPropertyDisplayName,
    PropertyType
} from "project-editor/core/object";
import { Icon } from "eez-studio-ui/icon";

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

                let projectBeforeAndAfter: ProjectBeforeAndAfter | undefined =
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

                    projectBeforeAndAfter = await getBeforeAndAfterProject(
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
                            this.projectBeforeAndAfter = projectBeforeAndAfter;
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

        renderObjectChanges(objectChanges: ObjectChanges) {
            const isProject =
                objectChanges.objectBefore instanceof
                ProjectEditor.ProjectClass;

            return objectChanges.changes.map(propertyChange => {
                const label = getObjectPropertyDisplayName(
                    objectChanges.objectAfter,
                    propertyChange.propertyInfo
                );

                let icon;

                if (
                    isProject &&
                    (propertyChange.propertyInfo.type == PropertyType.Object ||
                        propertyChange.propertyInfo.type == PropertyType.Array)
                ) {
                    const features = getProjectFeatures();
                    const feature = features.find(
                        feature =>
                            feature.key == propertyChange.propertyInfo.name
                    );

                    if (feature) {
                        icon = feature.icon;
                    } else {
                        if (propertyChange.type == "OBJECT_CHANGED") {
                            icon =
                                getClassInfo(
                                    propertyChange.objectChanges.objectAfter
                                ).icon || "extension";
                        } else if (
                            propertyChange.type == "VALUE_ADDED" ||
                            propertyChange.type == "VALUE_REMOVED"
                        ) {
                            icon =
                                getClassInfo(propertyChange.value).icon ||
                                "extension";
                        }
                    }
                }

                if (icon && typeof icon == "string") {
                    icon = <Icon icon={`material:${icon}`} size={18} />;
                }

                return (
                    <div key={propertyChange.propertyInfo.name}>
                        <div
                            className={classNames({
                                "feature-row": isProject,
                                "value-added":
                                    propertyChange.type == "VALUE_ADDED",
                                "value-removed":
                                    propertyChange.type == "VALUE_REMOVED"
                            })}
                        >
                            {icon && (
                                <span className="change-icon">{icon}</span>
                            )}
                            <span className="change-label">{label}</span>

                            {propertyChange.type == "VALUE_CHANGED" && (
                                <>
                                    <span className="value-removed">
                                        {JSON.stringify(
                                            propertyChange.valueBefore,
                                            undefined,
                                            2
                                        )}
                                    </span>
                                    <span className="value-added">
                                        {JSON.stringify(
                                            propertyChange.valueAfter,
                                            undefined,
                                            2
                                        )}
                                    </span>
                                </>
                            )}
                        </div>

                        {propertyChange.type == "OBJECT_CHANGED" && (
                            <div style={{ marginLeft: 20 }}>
                                {this.renderObjectChanges(
                                    propertyChange.objectChanges
                                )}
                            </div>
                        )}

                        {propertyChange.type == "ARRAY_CHANGED" && (
                            <div style={{ marginLeft: 20 }}>
                                {this.renderArrayChanges(
                                    propertyChange.arrayChanges
                                )}
                            </div>
                        )}
                    </div>
                );
            });
        }

        renderArrayChanges(arrayChanges: ArrayChanges) {
            return [
                ...arrayChanges.added.map(addedObject => {
                    return (
                        <div
                            key={`added-${addedObject.objID}`}
                            className="element-added"
                        >
                            getLabel(addedObject)
                        </div>
                    );
                }),
                ...arrayChanges.removed.map(removedObject => {
                    return (
                        <div
                            key={`removed-${removedObject.objID}`}
                            className="element-removed"
                        >
                            {getLabel(removedObject)}
                        </div>
                    );
                }),
                ...arrayChanges.changed.map(objectChanges => {
                    return (
                        <div key={`changed-${objectChanges.objectAfter.objID}`}>
                            <div>{getLabel(objectChanges.objectAfter)}</div>
                            <div style={{ marginLeft: 20 }}>
                                {this.renderObjectChanges(objectChanges)}
                            </div>
                        </div>
                    );
                }),
                ...(arrayChanges.moved
                    ? [
                          <div key="moved">
                              <span className="array-moved">MOVED</span>
                          </div>
                      ]
                    : [])
            ];
        }

        render() {
            const projectChanges = diffObject(
                this.props.projectBeforeAndAfter.projectBefore,
                this.props.projectBeforeAndAfter.projectAfter
            );

            return (
                <div className="EezStudio_ChangesEditor">
                    {this.renderObjectChanges(projectChanges)}
                </div>
            );
        }
    }
);
