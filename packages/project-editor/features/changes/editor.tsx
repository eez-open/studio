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
import { diff, DiffResult } from "project-editor/features/changes/diff";
import { Delta } from "jsondiffpatch";
import { ITreeNode, Tree } from "eez-studio-ui/tree";
import { Icon } from "eez-studio-ui/icon";
import {
    findPropertyByNameInClassInfo,
    getObjectPropertyDisplayName
} from "project-editor/core/object";
import { ProjectEditor } from "project-editor/project-editor-interface";
import { getProjectFeatures } from "project-editor/store/features";

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

        diffResult: DiffResult | undefined;
        progressPercent: number | undefined;

        activeTask: () => void | undefined;
        dispose: IReactionDisposer | undefined;

        constructor(props: any) {
            super(props);

            makeObservable(this, {
                diffResult: observable.shallow,
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

                let revisionContent: DiffResult | undefined = undefined;

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

                    revisionContent = await diff(
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
                            this.diffResult = revisionContent;
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

            if (!this.diffResult) {
                return null;
            }

            return <ChangesTree diffResult={this.diffResult} />;
        }
    }
);

export const ChangesTree = observer(
    class ChangesTree extends React.Component<{ diffResult: DiffResult }> {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        get rootNode(): ITreeNode {
            return {
                id: "",
                label: "",
                children: this.getChildren(
                    this.props.diffResult.delta,
                    this.props.diffResult.beforeContent.project,
                    this.props.diffResult.afterContent.project
                ),
                selected: false,
                expanded: true,
                data: undefined
            };
        }

        getChildren(
            delta: Delta,
            eezObjectBefore: any,
            eezObjectAfter: any
        ): ITreeNode[] {
            if (!eezObjectAfter) {
                return [];
            }

            if (delta._t == "a") {
                return Object.keys(delta)
                    .filter(key => key != "_t")
                    .map(arrayIndex => {
                        const value = delta[arrayIndex];
                        const id = arrayIndex.toString();

                        if (arrayIndex[0] == "_") {
                            const index = parseInt(arrayIndex.slice(1));

                            if (value[2] == 3) {
                                // element moved inside an array
                                const destinationIndex = value[1];

                                const label = this.getArrayElementLabel(
                                    eezObjectBefore,
                                    index,
                                    index
                                );

                                return {
                                    id,
                                    label: (
                                        <span className="item-moved">{`${label}: moved from position ${index} to position ${destinationIndex}`}</span>
                                    ),
                                    children: [],
                                    selected: false,
                                    expanded: true,
                                    data: undefined
                                };
                            }

                            // element removed from the array
                            const label = this.getArrayElementLabel(
                                eezObjectBefore,
                                index,
                                index
                            );

                            return {
                                id,
                                label: (
                                    <span className="item-removed">
                                        {label}
                                    </span>
                                ),
                                children: [],
                                selected: false,
                                expanded: true,
                                data: undefined
                            };
                        }

                        // element added to the array
                        const index = parseInt(arrayIndex);

                        const label = this.getArrayElementLabel(
                            eezObjectAfter,
                            index,
                            index
                        );

                        return this.getTreeNode(
                            value,
                            index,
                            id,
                            label,
                            eezObjectBefore,
                            eezObjectAfter
                        );
                    });
            }

            return Object.keys(delta)
                .filter(key => this.filterProperties(eezObjectAfter, key))
                .map(key =>
                    this.getTreeNode(
                        delta[key],
                        key,
                        key,
                        undefined,
                        eezObjectBefore,
                        eezObjectAfter
                    )
                );
        }

        filterProperties(object: any, key: any) {
            if (
                object instanceof ProjectEditor.ProjectClass &&
                key == "lastObjid"
            ) {
                return false;
            }
            return true;
        }

        getArrayElementLabel(obj: any, key: any, defaultLabel: any) {
            if (!obj) {
                return defaultLabel;
            }

            const subobject = obj[key];

            if (!subobject) {
                return defaultLabel;
            }

            try {
                return getLabel(subobject);
            } catch (err) {
                return defaultLabel;
            }
        }

        getTreeNode(
            value: any,
            key: any,
            id: string,
            label: string | undefined,
            eezObjectBefore: any,
            eezObjectAfter: any
        ) {
            let icon: string | React.ReactNode | undefined;
            let isProject: boolean = false;

            if (label == undefined) {
                if (eezObjectAfter instanceof ProjectEditor.ProjectClass) {
                    isProject = true;

                    const features = getProjectFeatures();
                    const feature = features.find(
                        feature => feature.key == key
                    );

                    if (feature) {
                        icon = feature.icon;
                    } else {
                        icon =
                            getClassInfo((eezObjectAfter as any)[key]).icon ||
                            "extension";
                    }
                }

                if (label == undefined) {
                    const propertyInfo = findPropertyByNameInClassInfo(
                        getClassInfo(eezObjectAfter),
                        key
                    );

                    if (propertyInfo) {
                        label = getObjectPropertyDisplayName(
                            eezObjectAfter,
                            propertyInfo
                        );
                    } else {
                        label = key;
                    }
                }
            }

            if (icon && typeof icon == "string") {
                icon = <Icon icon={`material:${icon}`} size={18} />;
            }

            if (Array.isArray(value)) {
                if (value.length == 1) {
                    // added
                    return {
                        id,
                        label: isProject ? (
                            <span className="feature-row feature-added">
                                <span className="feature-icon">{icon}</span>
                                <span className="feature-label">{label}</span>
                            </span>
                        ) : (
                            <span className="property-added">
                                {typeof value[0] == "object"
                                    ? label
                                    : `${label}: ${JSON.stringify(value[0])}`}
                            </span>
                        ),
                        children: [],
                        selected: false,
                        expanded: true,
                        data: undefined
                    };
                } else if (value.length == 2) {
                    // edited
                    return {
                        id,
                        label: (
                            <span className="property-changed">
                                <span className="property-label">
                                    {label}:{" "}
                                </span>
                                <span className="property-old-value">
                                    {JSON.stringify(value[0])}
                                </span>
                                <span> </span>
                                <span className="property-new-value">
                                    {JSON.stringify(value[1])}
                                </span>
                            </span>
                        ),
                        children: [],
                        selected: false,
                        expanded: true,
                        data: undefined
                    };
                } else {
                    // removed
                    return {
                        id,
                        label: isProject ? (
                            <span className="feature-row feature-removed">
                                <span className="feature-icon">{icon}</span>
                                <span className="feature-label">{label}</span>
                            </span>
                        ) : (
                            <span className="property-removed">
                                {`${label}: ${JSON.stringify(value[0])}`}
                            </span>
                        ),
                        children: [],
                        selected: false,
                        expanded: true,
                        data: undefined
                    };
                }
            } else {
                // changed
                return {
                    id,
                    label: isProject ? (
                        <span className="feature-row">
                            <span className="feature-icon">
                                {icon && typeof icon == "string" ? (
                                    <Icon icon={`material:${icon}`} size={20} />
                                ) : (
                                    icon
                                )}
                            </span>
                            <span className="feature-label">{label}</span>
                        </span>
                    ) : (
                        label
                    ),
                    children: this.getChildren(
                        value,
                        eezObjectBefore[key],
                        eezObjectAfter[key]
                    ),
                    selected: false,
                    expanded: true,
                    data: undefined
                };
            }
        }

        selectNode = (treeNode: ITreeNode) => {};

        render() {
            console.log(this.props.diffResult);
            return (
                <Tree
                    className="EezStudio_ChangesEditor"
                    showOnlyChildren={true}
                    rootNode={this.rootNode}
                    selectNode={this.selectNode}
                    collapsable={true}
                />
            );
        }
    }
);
