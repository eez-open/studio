import React from "react";
import {
    makeObservable,
    runInAction,
    action,
    observable,
    IReactionDisposer,
    autorun
} from "mobx";
import { observer } from "mobx-react";

import { Loader } from "eez-studio-ui/loader";

import { ProjectContext } from "project-editor/project/context";
import { EditorComponent } from "project-editor/project/EditorComponent";
import {
    getClassInfo,
    getLabel,
    IPanel,
    ProjectEditorStore
} from "project-editor/store";
import {
    getBeforeAndAfterProject,
    BeforeAfterProject as ProjectBeforeAndAfter,
    diffObject,
    ObjectChanges,
    ArrayChanges,
    RevertChange,
    refreshRevisions
} from "project-editor/features/changes/diff";
import { ProjectEditor } from "project-editor/project-editor-interface";
import classNames from "classnames";
import { getProjectFeatures } from "project-editor/store/features";
import {
    getObjectPropertyDisplayName,
    PropertyType
} from "project-editor/core/object";
import { Icon } from "eez-studio-ui/icon";
import {
    MEMORY_HASH,
    STAGED_HASH,
    UNSTAGED_HASH
} from "project-editor/store/ui-state";
import {
    Body,
    ToolbarHeader,
    VerticalHeaderWithBody
} from "eez-studio-ui/header-with-body";
import { Toolbar } from "eez-studio-ui/toolbar";
import { TextAction } from "eez-studio-ui/action";
import { RightArrow } from "project-editor/flow/components/actions";

interface ChangesEditorParams {
    revisionAfterHash: string | undefined;
    revisionBeforeHash: string | undefined;
}

function getChangesEditorParams(projectEditorStore: ProjectEditorStore) {
    let revisionAfterHash = undefined;
    let revisionBeforeHash = undefined;

    if (projectEditorStore.uiStateStore.selectedRevisionHash) {
        if (projectEditorStore.uiStateStore.revisionForCompareHash) {
            revisionAfterHash =
                projectEditorStore.uiStateStore.selectedRevisionHash;
            revisionBeforeHash =
                projectEditorStore.uiStateStore.revisionForCompareHash;
        } else {
            const index = projectEditorStore.uiStateStore.revisions.findIndex(
                revision =>
                    revision.hash ==
                    projectEditorStore.uiStateStore.selectedRevisionHash
            );

            if (index != -1) {
                revisionAfterHash =
                    projectEditorStore.uiStateStore.revisions[index].hash;

                if (
                    index != -1 &&
                    index + 1 < projectEditorStore.uiStateStore.revisions.length
                ) {
                    revisionBeforeHash =
                        projectEditorStore.uiStateStore.revisions[index + 1]
                            .hash;
                }
            }
        }
    }

    return {
        revisionAfterHash,
        revisionBeforeHash
    };
}

export const ChangesEditor = observer(
    class ChangesEditor extends EditorComponent implements IPanel {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        projectBeforeAndAfter: ProjectBeforeAndAfter | undefined;
        projectChanges: ObjectChanges | undefined;
        progressPercent: number | undefined;

        selectedRevertChange: { revertChange: RevertChange | undefined } = {
            revertChange: undefined
        };

        activeTask: () => void | undefined;
        dispose: IReactionDisposer | undefined;

        constructor(props: any) {
            super(props);

            makeObservable(this, {
                projectBeforeAndAfter: observable.shallow,
                progressPercent: observable,
                selectedRevertChange: observable.shallow
            });
        }

        componentDidMount() {
            this.refresh();
        }

        async refresh() {
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

                const params = getChangesEditorParams(this.context);

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
                        if (projectBeforeAndAfter) {
                            this.projectChanges = diffObject(
                                projectBeforeAndAfter.projectBefore,
                                projectBeforeAndAfter.projectAfter
                            );
                        } else {
                            this.projectChanges = undefined;
                        }

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

        get isRevertChangesEnabled() {
            return this.selectedRevertChange.revertChange != undefined;
        }

        onSelectRevertChange = action((revertChange: RevertChange) => {
            this.selectedRevertChange = { revertChange };
        });

        revertChanges = async () => {
            if (this.selectedRevertChange.revertChange) {
                this.selectedRevertChange.revertChange(this.context.project);
            }

            const params = getChangesEditorParams(this.context);

            if (params.revisionAfterHash != MEMORY_HASH) {
                await refreshRevisions(this.context);

                runInAction(() => {
                    this.context.uiStateStore.selectedRevisionHash =
                        MEMORY_HASH;
                    this.context.uiStateStore.revisionForCompareHash =
                        params.revisionBeforeHash;
                });
            } else {
                this.refresh();
            }
        };

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
                            className={classNames("property-change", {
                                selected:
                                    this.selectedRevertChange.revertChange &&
                                    this.selectedRevertChange.revertChange ==
                                        propertyChange.revert
                            })}
                            onClick={() =>
                                this.onSelectRevertChange(propertyChange.revert)
                            }
                        >
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
                ...arrayChanges.added.map(added => {
                    return (
                        <div
                            key={`added-${added.object.objID}`}
                            className={classNames("array-element-added", {
                                selected:
                                    this.selectedRevertChange.revertChange &&
                                    this.selectedRevertChange.revertChange ==
                                        added.revert
                            })}
                            onClick={() =>
                                this.onSelectRevertChange(added.revert)
                            }
                        >
                            <span className="element-added">
                                {getLabel(added.object)}
                            </span>
                        </div>
                    );
                }),
                ...arrayChanges.removed.map(removed => {
                    return (
                        <div
                            key={`removed-${removed.object.objID}`}
                            className={classNames("array-element-removed", {
                                selected:
                                    this.selectedRevertChange.revertChange &&
                                    this.selectedRevertChange.revertChange ==
                                        removed.revert
                            })}
                            onClick={() =>
                                this.onSelectRevertChange(removed.revert)
                            }
                        >
                            <span className="element-removed">
                                {getLabel(removed.object)}
                            </span>
                        </div>
                    );
                }),
                ...arrayChanges.changed.map(change => {
                    return (
                        <div
                            key={`changed-${change.objectChanges.objectAfter.objID}`}
                        >
                            <div
                                className={classNames("array-element-changed", {
                                    selected:
                                        this.selectedRevertChange
                                            .revertChange == change.revert
                                })}
                                onClick={() =>
                                    this.onSelectRevertChange(change.revert)
                                }
                            >
                                {getLabel(change.objectChanges.objectAfter)}
                            </div>
                            <div style={{ marginLeft: 20 }}>
                                {this.renderObjectChanges(change.objectChanges)}
                            </div>
                        </div>
                    );
                }),
                ...(arrayChanges.moved
                    ? [
                          <div
                              key="moved"
                              className={classNames("array-element-moved", {
                                  selected:
                                      this.selectedRevertChange.revertChange &&
                                      this.selectedRevertChange.revertChange ==
                                          arrayChanges.moved
                              })}
                              onClick={() =>
                                  this.onSelectRevertChange(arrayChanges.moved)
                              }
                          >
                              <span className="array-moved">MOVED</span>
                          </div>
                      ]
                    : [])
            ];
        }

        get title() {
            const { revisionAfterHash, revisionBeforeHash } =
                getChangesEditorParams(this.context);

            if (!revisionAfterHash) {
                return null;
            }

            return (
                <div className="d-flex">
                    <span>
                        {revisionBeforeHash
                            ? revisionBeforeHash.slice(0, 8)
                            : "none"}
                    </span>
                    <RightArrow />
                    <span>
                        {revisionAfterHash
                            ? revisionAfterHash.slice(0, 8)
                            : "none"}
                    </span>
                </div>
            );
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

            const params: ChangesEditorParams = getChangesEditorParams(
                this.context
            );

            const hasRevertChanges =
                params.revisionAfterHash == MEMORY_HASH ||
                (params.revisionAfterHash == UNSTAGED_HASH &&
                    this.context.uiStateStore.revisions[0].hash ==
                        UNSTAGED_HASH) ||
                (params.revisionAfterHash == STAGED_HASH &&
                    this.context.uiStateStore.revisions[0].hash == STAGED_HASH);

            return (
                <VerticalHeaderWithBody style={{ height: "100%" }}>
                    <ToolbarHeader style={{ justifyContent: "space-between" }}>
                        <div>{this.title}</div>
                        <Toolbar>
                            {hasRevertChanges && (
                                <TextAction
                                    text="Revert Changes"
                                    icon="material:undo"
                                    title="Revert Changes"
                                    onClick={this.revertChanges}
                                    enabled={this.isRevertChangesEnabled}
                                />
                            )}
                        </Toolbar>
                    </ToolbarHeader>
                    <Body tabIndex={0}>
                        <div className="EezStudio_ChangesEditor">
                            {this.renderObjectChanges(this.projectChanges!)}
                        </div>
                    </Body>
                </VerticalHeaderWithBody>
            );
        }
    }
);
