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
import { EditorComponent } from "project-editor/project/ui/EditorComponent";
import {
    getAncestorOfType,
    getLabel,
    getObjectIcon,
    IPanel
} from "project-editor/store";
import { ProjectEditor } from "project-editor/project-editor-interface";
import classNames from "classnames";
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
//import { TextAction } from "eez-studio-ui/action";
import { RightArrow } from "project-editor/ui-components/icons";
import { Splitter } from "eez-studio-ui/splitter";
import {
    DEFAULT_SCALE,
    FlowViewer
} from "project-editor/features/changes/flow-viewer";
import { Transform } from "project-editor/flow/editor/transform";
import { Flow } from "project-editor/flow/flow";
import { ConnectionLine } from "project-editor/flow/connection-line";

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
    ObjectPropertyValueUpdated,
    PropertyValueRemoved,
    PropertyValueAdded,
    PropertyValueUpdated,
    ArrayPropertyValueUpdated,
    ArrayElementAdded,
    ArrayElementRemoved,
    ArrayElementUpdated,
    ObjectPropertyChange,
    ArrayPropertyChange,
    ChangedFlowObjects,
    getHashLabel
} from "./state";
import { Component } from "project-editor/flow/component";

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
            scale: DEFAULT_SCALE
        });
        transformAfter = new Transform({
            translate: { x: 0, y: 0 },
            scale: DEFAULT_SCALE
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
                flowChange: computed,
                changedFlowObjects: computed,
                comparePair: computed
            });
        }

        get comparePair() {
            const changesState = this.context.project.changes._state;

            if (this.props.editor.params) {
                const { hashBefore, hashAfter } = this.props.editor.params;

                return {
                    revisionAfter: changesState.getRevisionFromHash(hashAfter),
                    revisionBefore: changesState.getRevisionFromHash(hashBefore)
                };
            }

            return changesState.comparePair;
        }

        get flowChange() {
            function getFlowObject(object: EezObject | EezObject[]) {
                const component = getAncestorOfType(
                    object,
                    Component.classInfo
                );
                if (component) {
                    return component as Component;
                }

                const connectionLine = getAncestorOfType(
                    object,
                    ConnectionLine.classInfo
                );
                if (connectionLine) {
                    return connectionLine as ConnectionLine;
                }
                return undefined;
            }

            if (this.selectedProjectChange) {
                if (
                    this.selectedProjectChange instanceof ObjectPropertyChange
                ) {
                    if (
                        ProjectEditor.getProject(
                            this.selectedProjectChange.objectAfter
                        ) != this.projectChanges?.objectAfter
                    ) {
                        return undefined;
                    }

                    if (
                        this.selectedProjectChange.objectAfter instanceof Flow
                    ) {
                        return {
                            flowBefore: this.selectedProjectChange
                                .objectBefore as Flow,
                            flowAfter: this.selectedProjectChange.objectAfter,
                            selectedFlowObjectBefore: undefined,
                            selectedFlowObjectAfter: undefined
                        };
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
                                flowAfter: flow as Flow,
                                selectedFlowObjectBefore: getFlowObject(
                                    this.selectedProjectChange.objectBefore
                                ),
                                selectedFlowObjectAfter: getFlowObject(
                                    this.selectedProjectChange.objectAfter
                                )
                            };
                        }
                    }
                } else if (
                    this.selectedProjectChange instanceof ArrayPropertyChange
                ) {
                    if (
                        ProjectEditor.getProject(
                            this.selectedProjectChange.arrayAfter
                        ) != this.projectChanges?.objectAfter
                    ) {
                        return undefined;
                    }

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
                            flowAfter: flow as Flow,
                            selectedFlowObjectBefore: getFlowObject(
                                this.selectedProjectChange.arrayBefore[
                                    this.selectedProjectChange
                                        .elementIndexBefore
                                ]
                            ),
                            selectedFlowObjectAfter: getFlowObject(
                                this.selectedProjectChange.arrayAfter[
                                    this.selectedProjectChange.elementIndexAfter
                                ]
                            )
                        };
                    }
                }
            }

            return undefined;
        }

        get changedFlowObjects() {
            const flowChange = this.flowChange;

            if (!this.projectChanges || !flowChange) {
                return undefined;
            }

            const changedBeforeObjects: ChangedFlowObjects = [];
            const changedAfterObjects: ChangedFlowObjects = [];

            let insideFlow = false;

            function traverseObjectChanges(objectChanges: ObjectChanges) {
                if (objectChanges.objectAfter == flowChange!.flowAfter) {
                    insideFlow = true;
                }

                for (let i = 0; i < objectChanges.changes.length; i++) {
                    const propertyChange = objectChanges.changes[i];

                    if (propertyChange instanceof PropertyValueAdded) {
                        if (insideFlow) {
                            const value = (objectChanges.objectAfter as any)[
                                propertyChange.propertyInfo.name
                            ];
                            if (
                                value instanceof Component ||
                                value instanceof ConnectionLine
                            ) {
                                changedAfterObjects.push({
                                    object: value,
                                    operation: "added"
                                });
                            }
                        }
                    } else if (propertyChange instanceof PropertyValueRemoved) {
                        if (insideFlow) {
                            const value = (objectChanges.objectBefore as any)[
                                propertyChange.propertyInfo.name
                            ];
                            if (
                                value instanceof Component ||
                                value instanceof ConnectionLine
                            ) {
                                changedBeforeObjects.push({
                                    object: value,
                                    operation: "removed"
                                });
                            }
                        }
                    } else if (
                        propertyChange instanceof ObjectPropertyValueUpdated
                    ) {
                        if (insideFlow) {
                            const value = (objectChanges.objectAfter as any)[
                                propertyChange.propertyInfo.name
                            ];
                            if (
                                value instanceof Component ||
                                value instanceof ConnectionLine
                            ) {
                                changedBeforeObjects.push({
                                    object: (objectChanges.objectBefore as any)[
                                        propertyChange.propertyInfo.name
                                    ],
                                    operation: "updated"
                                });

                                changedAfterObjects.push({
                                    object: value,
                                    operation: "updated"
                                });
                            }
                        }

                        traverseObjectChanges(propertyChange.objectChanges);
                    } else if (
                        propertyChange instanceof ArrayPropertyValueUpdated
                    ) {
                        traverseArrayChanges(propertyChange.arrayChanges);
                    }
                }

                if (objectChanges.objectAfter == flowChange!.flowAfter) {
                    insideFlow = false;
                }
            }

            function traverseArrayChanges(arrayChanges: ArrayChanges) {
                for (let i = 0; i < arrayChanges.changes.length; i++) {
                    const arrayChange = arrayChanges.changes[i];

                    if (arrayChange instanceof ArrayElementAdded) {
                        if (insideFlow) {
                            const element =
                                arrayChanges.arrayAfter[
                                    arrayChange.elementIndexAfter
                                ];
                            if (
                                element instanceof Component ||
                                element instanceof ConnectionLine
                            ) {
                                changedAfterObjects.push({
                                    object: element,
                                    operation: "added"
                                });
                            }
                        }
                    } else if (arrayChange instanceof ArrayElementRemoved) {
                        if (insideFlow) {
                            const element =
                                arrayChanges.arrayBefore[
                                    arrayChange.elementIndexBefore
                                ];
                            if (
                                element instanceof Component ||
                                element instanceof ConnectionLine
                            ) {
                                changedBeforeObjects.push({
                                    object: element,
                                    operation: "removed"
                                });
                            }
                        }
                    } else if (arrayChange instanceof ArrayElementUpdated) {
                        if (insideFlow) {
                            const element =
                                arrayChanges.arrayAfter[
                                    arrayChange.elementIndexAfter
                                ];

                            if (
                                element instanceof Component ||
                                element instanceof ConnectionLine
                            ) {
                                changedBeforeObjects.push({
                                    object: arrayChanges.arrayBefore[
                                        arrayChange.elementIndexBefore
                                    ] as any,
                                    operation: "updated"
                                });

                                changedAfterObjects.push({
                                    object: element,
                                    operation: "updated"
                                });
                            }
                        }

                        traverseObjectChanges(arrayChange.objectChanges);
                    }
                }
            }

            traverseObjectChanges(this.projectChanges);

            return {
                changedBeforeObjects,
                changedAfterObjects
            };
        }

        componentDidMount() {
            this.refresh();

            this.context.navigationStore.mountPanel(this);
        }

        componentWillUnmount() {
            if (this.activeTask) {
                this.activeTask();
            }

            if (this.dispose) {
                this.dispose();
            }

            this.context.navigationStore.unmountPanel(this);
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

                const params = this.comparePair;

                if (params.revisionAfter) {
                    projectBeforeAndAfter = await getBeforeAndAfterProject(
                        this.context,
                        params.revisionBefore,
                        params.revisionAfter,
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
                    this.transformBefore.scale = DEFAULT_SCALE;
                });
            }

            if (this.flowChange) {
                const selectedObject =
                    this.flowChange.selectedFlowObjectAfter ||
                    this.flowChange.selectedFlowObjectBefore;

                if (selectedObject) {
                    const selectedObjectRect =
                        selectedObject instanceof ConnectionLine
                            ? {
                                  left: selectedObject.sourcePosition.x,
                                  top: selectedObject.sourcePosition.y,
                                  width:
                                      selectedObject.targetPosition.x -
                                      selectedObject.sourcePosition.x,
                                  height:
                                      selectedObject.targetPosition.y -
                                      selectedObject.sourcePosition.y
                              }
                            : {
                                  left: selectedObject.absolutePositionPoint.x,
                                  top: selectedObject.absolutePositionPoint.y,
                                  width: selectedObject.rect.width,
                                  height: selectedObject.rect.height
                              };

                    const transform =
                        selectedObject ==
                        this.flowChange.selectedFlowObjectAfter
                            ? this.transformAfter
                            : this.transformBefore;

                    runInAction(() => {
                        transform.translate = {
                            x:
                                transform.scale *
                                -(
                                    selectedObjectRect.left +
                                    selectedObjectRect.width / 2
                                ),
                            y:
                                transform.scale *
                                -(
                                    selectedObjectRect.top +
                                    selectedObjectRect.height / 2
                                )
                        };
                    });
                }
            }
        };

        revertChanges = async () => {
            if (
                this.selectedProjectChange &&
                this.selectedProjectChange.revertable
            ) {
                this.selectedProjectChange.revert(this.context.project);
            }

            const params = this.comparePair;

            if (params.revisionAfter?.hash != MEMORY_HASH) {
                runInAction(() => {
                    this.context.project.changes._state.selectedRevisionHash =
                        MEMORY_HASH;
                    this.context.project.changes._state.revisionForCompareHash =
                        params.revisionBefore?.hash;
                });
            } else {
                this.refresh();
            }
        };

        get title() {
            const { revisionAfter, revisionBefore } = this.comparePair;

            if (!revisionAfter) {
                return null;
            }

            return (
                <div>
                    <span>{getHashLabel(revisionBefore?.hash)}</span>
                    <RightArrow />
                    <span>{getHashLabel(revisionAfter.hash)}</span>
                </div>
            );
        }

        // interface IPanel implementation
        get selectedObject() {
            return this.context.project.changes;
        }

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

            const params = this.comparePair;

            const hasRevertChanges =
                params.revisionAfter?.hash == MEMORY_HASH ||
                (params.revisionAfter?.hash == UNSTAGED_HASH &&
                    this.context.project.changes._state.revisions[0].hash ==
                        UNSTAGED_HASH) ||
                (params.revisionAfter?.hash == STAGED_HASH &&
                    this.context.project.changes._state.revisions[0].hash ==
                        STAGED_HASH);
            hasRevertChanges;

            const changesEditor =
                this.projectChanges?.changes.length == 0 ? (
                    <div>No changes</div>
                ) : (
                    <div className="EezStudio_ChangesEditor">
                        <ObjectChangesComponent
                            objectChanges={this.projectChanges!}
                            selectedProjectChange={this.selectedProjectChange}
                            onSelectProjectChange={this.onSelectProjectChange}
                        />
                    </div>
                );

            const { revisionAfter, revisionBefore } = this.comparePair;

            return (
                <VerticalHeaderWithBody style={{ height: "100%" }}>
                    <ToolbarHeader style={{ justifyContent: "space-between" }}>
                        <div>{this.title}</div>
                        <Toolbar>
                            {/*hasRevertChanges && (
                                <TextAction
                                    text="Revert Changes"
                                    icon="material:undo"
                                    title="Revert Changes"
                                    onClick={this.revertChanges}
                                    enabled={this.isRevertChangesEnabled}
                                />
                            )*/}
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
                                            )._store
                                        }
                                    >
                                        <FlowViewer
                                            legend={true}
                                            title={`BEFORE / ${getHashLabel(
                                                revisionBefore?.hash
                                            )}`}
                                            flow={this.flowChange.flowBefore}
                                            transform={this.transformBefore}
                                            changedObjects={
                                                this.changedFlowObjects!
                                                    .changedBeforeObjects
                                            }
                                            selectedObject={
                                                this.flowChange
                                                    .selectedFlowObjectBefore
                                            }
                                        ></FlowViewer>
                                    </ProjectContext.Provider>
                                    <ProjectContext.Provider
                                        value={
                                            ProjectEditor.getProject(
                                                this.flowChange.flowAfter
                                            )._store
                                        }
                                    >
                                        <FlowViewer
                                            title={`AFTER / ${getHashLabel(
                                                revisionAfter?.hash
                                            )}`}
                                            flow={this.flowChange.flowAfter}
                                            transform={this.transformAfter}
                                            changedObjects={
                                                this.changedFlowObjects!
                                                    .changedAfterObjects
                                            }
                                            selectedObject={
                                                this.flowChange
                                                    .selectedFlowObjectAfter
                                            }
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
                    const features = ProjectEditor.extensions;
                    const feature = features.find(
                        feature =>
                            feature.key == propertyChange.propertyInfo.name
                    );

                    if (feature) {
                        icon = feature.icon;
                    } else {
                        if (
                            propertyChange instanceof ObjectPropertyValueUpdated
                        ) {
                            icon =
                                getObjectIcon(
                                    propertyChange.objectChanges.objectAfter
                                ) || "extension";
                        } else if (
                            propertyChange instanceof PropertyValueAdded
                        ) {
                            const value = (propertyChange.objectAfter as any)[
                                propertyChange.propertyInfo.name
                            ];
                            if (value instanceof EezObject) {
                                icon = getObjectIcon(value) || "extension";
                            }
                        } else if (
                            propertyChange instanceof PropertyValueRemoved
                        ) {
                            const value = (propertyChange.objectBefore as any)[
                                propertyChange.propertyInfo.name
                            ];
                            if (value instanceof EezObject) {
                                icon = getObjectIcon(value) || "extension";
                            }
                        }
                    }
                }

                if (icon && typeof icon == "string") {
                    icon = <Icon icon={`material:${icon}`} size={18} />;
                }

                const valueBefore = (propertyChange.objectBefore as any)[
                    propertyChange.propertyInfo.name
                ];
                const valueBeforeJSON = toJSON(valueBefore);

                const valueAfter = (propertyChange.objectAfter as any)[
                    propertyChange.propertyInfo.name
                ];
                const valueAfterJSON = toJSON(valueAfter);

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
                                    "feature-row": isProject
                                })}
                            >
                                <span className="change-label">
                                    {label}
                                    {(propertyChange instanceof
                                        PropertyValueAdded &&
                                        valueAfterJSON) ||
                                    (propertyChange instanceof
                                        PropertyValueRemoved &&
                                        valueBeforeJSON) ||
                                    propertyChange instanceof
                                        PropertyValueUpdated
                                        ? ": "
                                        : ""}
                                </span>

                                {propertyChange instanceof PropertyValueAdded &&
                                    valueAfterJSON && (
                                        <span className="value-added">
                                            {valueAfterJSON}
                                        </span>
                                    )}

                                {propertyChange instanceof
                                    PropertyValueRemoved &&
                                    valueBeforeJSON && (
                                        <span className="value-removed">
                                            {valueBeforeJSON}
                                        </span>
                                    )}

                                {propertyChange instanceof
                                    PropertyValueUpdated && (
                                    <>
                                        <span className="value-removed">
                                            {valueBeforeJSON}
                                        </span>
                                        <span className="value-added">
                                            {valueAfterJSON}
                                        </span>
                                    </>
                                )}
                            </div>
                        </div>

                        {propertyChange instanceof
                            ObjectPropertyValueUpdated && (
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
                            ArrayPropertyValueUpdated && (
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
                                    change.arrayAfter[change.elementIndexAfter]
                                        .objID
                                }`}
                                className={classNames("array-element-added", {
                                    selected: selectedProjectChange == change
                                })}
                                onClick={() => onSelectProjectChange(change)}
                            >
                                <span className="element-added">
                                    {getLabel(
                                        change.arrayAfter[
                                            change.elementIndexAfter
                                        ]
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
                                    change.arrayBefore[
                                        change.elementIndexBefore
                                    ].objID
                                }`}
                                className={classNames("array-element-removed", {
                                    selected: selectedProjectChange == change
                                })}
                                onClick={() => onSelectProjectChange(change)}
                            >
                                <span className="element-removed">
                                    {getLabel(
                                        change.arrayBefore[
                                            change.elementIndexBefore
                                        ]
                                    )}
                                </span>
                            </div>
                        );
                    }),
                ...arrayChanges.changes
                    .filter(change => change instanceof ArrayElementUpdated)
                    .map((change: ArrayElementUpdated) => {
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
                    })
                /*,...(arrayChanges.shuffled
                    ? [
                          <div
                              key="moved"
                              className={classNames("array-element-shuffled", {
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
                              <span className="array-shuffled">MOVED</span>
                          </div>
                      ]
                    : [])*/
            ];
        }
    }
);

function toJSON(value: any) {
    try {
        return JSON.stringify(value);
    } catch (err) {
        return undefined;
    }
}
