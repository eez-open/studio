import React from "react";
import {
    makeObservable,
    runInAction,
    action,
    observable,
    IReactionDisposer,
    autorun,
    computed
} from "mobx";
import { observer } from "mobx-react";

import { Loader } from "eez-studio-ui/loader";

import { ProjectContext } from "project-editor/project/context";
import { EditorComponent } from "project-editor/project/EditorComponent";
import {
    getAncestorOfType,
    getClassInfo,
    getLabel,
    IPanel,
    ProjectEditorStore
} from "project-editor/store";
import { ProjectEditor } from "project-editor/project-editor-interface";
import classNames from "classnames";
import { getProjectFeatures } from "project-editor/store/features";
import {
    EezObject,
    getObjectPropertyDisplayName,
    getParent,
    PropertyType
} from "project-editor/core/object";
import { Icon } from "eez-studio-ui/icon";
import {
    Body,
    ToolbarHeader,
    VerticalHeaderWithBody
} from "eez-studio-ui/header-with-body";
import { Toolbar } from "eez-studio-ui/toolbar";
import { TextAction } from "eez-studio-ui/action";
import { RightArrow } from "project-editor/flow/components/actions";
import { Splitter } from "eez-studio-ui/splitter";
import { FlowViewer } from "project-editor/features/changes/flow-viewer";
import { Transform } from "project-editor/flow/editor/transform";
import { Flow } from "project-editor/flow/flow";

import {
    MEMORY_HASH,
    STAGED_HASH,
    UNSTAGED_HASH,
    getBeforeAndAfterProject,
    BeforeAfterProject as ProjectBeforeAndAfter,
    diffObject,
    ObjectChanges,
    ArrayChanges,
    ProjectChange,
    ObjectPropertyValueChanged,
    PropertyValueRemoved,
    PropertyValueAdded,
    PropertyValueChanged,
    ArrayPropertyValueChanged,
    ArrayElementAdded,
    ArrayElementRemoved,
    ArrayElementChanged,
    ObjectPropertyChange,
    ArrayPropertyChange
} from "./state";

interface ChangesEditorParams {
    revisionAfterHash: string | undefined;
    revisionBeforeHash: string | undefined;
}

function getChangesEditorParams(projectEditorStore: ProjectEditorStore) {
    let revisionAfterHash = undefined;
    let revisionBeforeHash = undefined;

    if (projectEditorStore.project.changes._state.selectedRevisionHash) {
        if (projectEditorStore.project.changes._state.revisionForCompareHash) {
            revisionAfterHash =
                projectEditorStore.project.changes._state.selectedRevisionHash;
            revisionBeforeHash =
                projectEditorStore.project.changes._state
                    .revisionForCompareHash;
        } else {
            const index =
                projectEditorStore.project.changes._state.revisions.findIndex(
                    revision =>
                        revision.hash ==
                        projectEditorStore.project.changes._state
                            .selectedRevisionHash
                );

            if (index != -1) {
                revisionAfterHash =
                    projectEditorStore.project.changes._state.revisions[index]
                        .hash;

                if (
                    index != -1 &&
                    index + 1 <
                        projectEditorStore.project.changes._state.revisions
                            .length
                ) {
                    revisionBeforeHash =
                        projectEditorStore.project.changes._state.revisions[
                            index + 1
                        ].hash;
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

        selectedProjectChange: ProjectChange | undefined;

        transformBefore = new Transform({
            translate: { x: 0, y: 0 },
            scale: 0.5
        });
        transformAfter = new Transform({
            translate: { x: 0, y: 0 },
            scale: 0.5
        });

        activeTask: () => void | undefined;
        dispose: IReactionDisposer | undefined;

        constructor(props: any) {
            super(props);

            this.transformBefore.boundedTransform = this.transformAfter;
            this.transformAfter.boundedTransform = this.transformBefore;

            makeObservable(this, {
                projectBeforeAndAfter: observable.shallow,
                progressPercent: observable,
                selectedProjectChange: observable,
                flowChange: computed
            });
        }

        get flowChange() {
            if (this.selectedProjectChange) {
                if (
                    this.selectedProjectChange instanceof ObjectPropertyChange
                ) {
                    if (
                        this.selectedProjectChange.objectAfter instanceof Flow
                    ) {
                        if (
                            this.selectedProjectChange.propertyInfo.name ==
                                "components" ||
                            this.selectedProjectChange.propertyInfo.name ==
                                "connectionLines"
                        ) {
                            return {
                                flowBefore: this.selectedProjectChange
                                    .objectBefore as Flow,
                                flowAfter:
                                    this.selectedProjectChange.objectAfter
                            };
                        }
                    } else {
                        const flow = getAncestorOfType(
                            this.selectedProjectChange.objectAfter,
                            Flow.classInfo
                        );

                        if (flow) {
                            return {
                                flowBefore: getAncestorOfType(
                                    this.selectedProjectChange.objectBefore,
                                    Flow.classInfo
                                ) as Flow,
                                flowAfter: flow as Flow
                            };
                        }
                    }
                } else if (
                    this.selectedProjectChange instanceof ArrayPropertyChange
                ) {
                    const flow = getAncestorOfType(
                        getParent(this.selectedProjectChange.arrayAfter),
                        Flow.classInfo
                    );

                    if (flow) {
                        return {
                            flowBefore: getAncestorOfType(
                                this.selectedProjectChange.arrayBefore,
                                Flow.classInfo
                            ) as Flow,
                            flowAfter: flow as Flow
                        };
                    }
                }
            }

            return undefined;
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
                    this.context.project.changes._state.revisions.findIndex(
                        revision => revision.hash == params.revisionAfterHash
                    );

                if (revisionAfterIndex != -1) {
                    const revisionAfter =
                        this.context.project.changes._state.revisions[
                            revisionAfterIndex
                        ];

                    const revisionBeforeIndex = params.revisionBeforeHash
                        ? this.context.project.changes._state.revisions.findIndex(
                              revision =>
                                  revision.hash == params.revisionBeforeHash
                          )
                        : -1;

                    const revisionBefore =
                        revisionBeforeIndex != -1
                            ? this.context.project.changes._state.revisions[
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
            return (
                this.selectedProjectChange != undefined &&
                this.selectedProjectChange.revertable
            );
        }

        onSelectProjectChange = (projectChange: ProjectChange) => {
            const flowChangeBefore = this.flowChange;

            runInAction(() => {
                this.selectedProjectChange = projectChange;
            });

            const flowChangeAfter = this.flowChange;

            if (flowChangeBefore?.flowAfter != flowChangeAfter?.flowAfter) {
                runInAction(() => {
                    this.transformBefore.translate = { x: 0, y: 0 };
                    this.transformBefore.scale = 0.5;
                });
            }
        };

        revertChanges = async () => {
            if (
                this.selectedProjectChange &&
                this.selectedProjectChange.revertable
            ) {
                this.selectedProjectChange.revert(this.context.project);
            }

            const params = getChangesEditorParams(this.context);

            if (params.revisionAfterHash != MEMORY_HASH) {
                this.context.project.changes._state.refreshRevisions(
                    this.context
                );

                runInAction(() => {
                    this.context.project.changes._state.selectedRevisionHash =
                        MEMORY_HASH;
                    this.context.project.changes._state.revisionForCompareHash =
                        params.revisionBeforeHash;
                });
            } else {
                this.refresh();
            }
        };

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
                    this.context.project.changes._state.revisions[0].hash ==
                        UNSTAGED_HASH) ||
                (params.revisionAfterHash == STAGED_HASH &&
                    this.context.project.changes._state.revisions[0].hash ==
                        STAGED_HASH);

            const changesEditor = (
                <div className="EezStudio_ChangesEditor">
                    <ObjectChangesComponent
                        objectChanges={this.projectChanges!}
                        selectedProjectChange={this.selectedProjectChange}
                        onSelectProjectChange={this.onSelectProjectChange}
                    />
                </div>
            );

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
                        {this.flowChange ? (
                            <Splitter
                                type="horizontal"
                                sizes="150px|100%"
                                persistId="project-editor/changes/splitter1"
                                splitterSize={5}
                            >
                                {changesEditor}
                                <Splitter
                                    type="vertical"
                                    sizes="50%|50%"
                                    persistId="project-editor/changes/splitter3"
                                    splitterSize={5}
                                    resizeable={false}
                                >
                                    <ProjectContext.Provider
                                        value={
                                            ProjectEditor.getProject(
                                                this.flowChange.flowBefore
                                            )._DocumentStore
                                        }
                                    >
                                        <FlowViewer
                                            flow={this.flowChange.flowBefore}
                                            transform={this.transformBefore}
                                        ></FlowViewer>
                                    </ProjectContext.Provider>
                                    <ProjectContext.Provider
                                        value={
                                            ProjectEditor.getProject(
                                                this.flowChange.flowAfter
                                            )._DocumentStore
                                        }
                                    >
                                        <FlowViewer
                                            flow={this.flowChange.flowAfter}
                                            transform={this.transformAfter}
                                        ></FlowViewer>
                                    </ProjectContext.Provider>
                                </Splitter>
                            </Splitter>
                        ) : (
                            changesEditor
                        )}
                    </Body>
                </VerticalHeaderWithBody>
            );
        }
    }
);

export const ObjectChangesComponent = observer(
    class ObjectChangesComponent extends React.Component<{
        objectChanges: ObjectChanges;
        selectedProjectChange: ProjectChange | undefined;
        onSelectProjectChange: (projectChange: ProjectChange) => void;
    }> {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        render() {
            const {
                objectChanges,
                selectedProjectChange,
                onSelectProjectChange
            } = this.props;

            const isProject =
                objectChanges.objectAfter instanceof ProjectEditor.ProjectClass;

            return objectChanges.changes.map(propertyChange => {
                let label = getObjectPropertyDisplayName(
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
                        if (
                            propertyChange instanceof ObjectPropertyValueChanged
                        ) {
                            icon =
                                getClassInfo(
                                    propertyChange.objectChanges.objectAfter
                                ).icon || "extension";
                        } else if (
                            propertyChange instanceof PropertyValueAdded
                        ) {
                            const value = (propertyChange.objectAfter as any)[
                                propertyChange.propertyInfo.name
                            ];
                            if (value instanceof EezObject) {
                                icon = getClassInfo(value).icon || "extension";
                            }
                        } else if (
                            propertyChange instanceof PropertyValueRemoved
                        ) {
                            const value = (propertyChange.objectBefore as any)[
                                propertyChange.propertyInfo.name
                            ];
                            if (value instanceof EezObject) {
                                icon = getClassInfo(value).icon || "extension";
                            }
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
                                    selectedProjectChange == propertyChange
                            })}
                            onClick={() =>
                                onSelectProjectChange(propertyChange)
                            }
                        >
                            <div
                                className={classNames({
                                    "feature-row": isProject,
                                    "value-added":
                                        propertyChange instanceof
                                        PropertyValueAdded,
                                    "value-removed":
                                        propertyChange instanceof
                                        PropertyValueRemoved
                                })}
                            >
                                {icon && (
                                    <span className="change-icon">{icon}</span>
                                )}
                                <span className="change-label">{label}</span>

                                {propertyChange instanceof
                                    PropertyValueChanged && (
                                    <>
                                        <span className="value-removed">
                                            {JSON.stringify(
                                                (
                                                    propertyChange.objectBefore as any
                                                )[
                                                    propertyChange.propertyInfo
                                                        .name
                                                ],
                                                undefined,
                                                2
                                            )}
                                        </span>
                                        <span className="value-added">
                                            {JSON.stringify(
                                                (
                                                    propertyChange.objectAfter as any
                                                )[
                                                    propertyChange.propertyInfo
                                                        .name
                                                ],
                                                undefined,
                                                2
                                            )}
                                        </span>
                                    </>
                                )}
                            </div>
                        </div>

                        {propertyChange instanceof
                            ObjectPropertyValueChanged && (
                            <div style={{ marginLeft: 20 }}>
                                <ObjectChangesComponent
                                    objectChanges={propertyChange.objectChanges}
                                    selectedProjectChange={
                                        selectedProjectChange
                                    }
                                    onSelectProjectChange={
                                        onSelectProjectChange
                                    }
                                />
                            </div>
                        )}

                        {propertyChange instanceof
                            ArrayPropertyValueChanged && (
                            <div style={{ marginLeft: 20 }}>
                                <ArrayChangesComponent
                                    arrayChanges={propertyChange.arrayChanges}
                                    selectedProjectChange={
                                        selectedProjectChange
                                    }
                                    onSelectProjectChange={
                                        onSelectProjectChange
                                    }
                                />
                            </div>
                        )}
                    </div>
                );
            });
        }
    }
);

export const ArrayChangesComponent = observer(
    class ArrayChangesComponent extends React.Component<{
        arrayChanges: ArrayChanges;
        selectedProjectChange: ProjectChange | undefined;
        onSelectProjectChange: (projectChange: ProjectChange) => void;
    }> {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        render() {
            const {
                arrayChanges,
                selectedProjectChange,
                onSelectProjectChange
            } = this.props;

            return [
                ...arrayChanges.changes
                    .filter(change => change instanceof ArrayElementAdded)
                    .map(change => {
                        return (
                            <div
                                key={`added-${
                                    change.arrayAfter[change.elementIndex].objID
                                }`}
                                className={classNames("array-element-added", {
                                    selected: selectedProjectChange == change
                                })}
                                onClick={() => onSelectProjectChange(change)}
                            >
                                <span className="element-added">
                                    {getLabel(
                                        change.arrayAfter[change.elementIndex]
                                    )}
                                </span>
                            </div>
                        );
                    }),
                ...arrayChanges.changes
                    .filter(change => change instanceof ArrayElementRemoved)
                    .map(change => {
                        return (
                            <div
                                key={`removed-${
                                    change.arrayBefore[change.elementIndex]
                                        .objID
                                }`}
                                className={classNames("array-element-removed", {
                                    selected: selectedProjectChange == change
                                })}
                                onClick={() => onSelectProjectChange(change)}
                            >
                                <span className="element-removed">
                                    {getLabel(
                                        change.arrayBefore[change.elementIndex]
                                    )}
                                </span>
                            </div>
                        );
                    }),
                ...arrayChanges.changes
                    .filter(change => change instanceof ArrayElementChanged)
                    .map((change: ArrayElementChanged) => {
                        return (
                            <div
                                key={`changed-${change.objectChanges.objectAfter.objID}`}
                            >
                                <div
                                    className={classNames(
                                        "array-element-changed",
                                        {
                                            selected:
                                                selectedProjectChange == change
                                        }
                                    )}
                                    onClick={() =>
                                        onSelectProjectChange(change)
                                    }
                                >
                                    {getLabel(change.objectChanges.objectAfter)}
                                </div>
                                <div style={{ marginLeft: 20 }}>
                                    <ObjectChangesComponent
                                        objectChanges={change.objectChanges}
                                        selectedProjectChange={
                                            selectedProjectChange
                                        }
                                        onSelectProjectChange={
                                            onSelectProjectChange
                                        }
                                    />
                                </div>
                            </div>
                        );
                    }),
                ...(arrayChanges.shuffled
                    ? [
                          <div
                              key="moved"
                              className={classNames("array-element-moved", {
                                  selected:
                                      selectedProjectChange ==
                                      arrayChanges.shuffled
                              })}
                              onClick={() => {
                                  if (arrayChanges.shuffled) {
                                      onSelectProjectChange(
                                          arrayChanges.shuffled
                                      );
                                  }
                              }}
                          >
                              <span className="array-moved">MOVED</span>
                          </div>
                      ]
                    : [])
            ];
        }
    }
);
