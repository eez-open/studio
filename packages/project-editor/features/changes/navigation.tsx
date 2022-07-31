import moment from "moment";

import React from "react";
import {
    makeObservable,
    runInAction,
    action,
    computed,
    observable,
    autorun,
    IReactionDisposer
} from "mobx";
import { observer } from "mobx-react";
import * as FlexLayout from "flexlayout-react";

import { Loader } from "eez-studio-ui/loader";
import { List, IListNode } from "eez-studio-ui/list";

import { ProjectContext } from "project-editor/project/context";
import { NavigationComponent } from "project-editor/project/NavigationComponent";
import { EditorComponent } from "project-editor/project/EditorComponent";
import {
    getClassInfo,
    getLabel,
    IPanel,
    LayoutModels
} from "project-editor/store";
import {
    MEMORY_HASH,
    UNSTAGED_HASH,
    Revision,
    STAGED_HASH
} from "project-editor/store/ui-state";
import {
    diff,
    DiffResult,
    getRevisions
} from "project-editor/features/changes/diff";
import { Delta } from "jsondiffpatch";
import {
    Body,
    ToolbarHeader,
    VerticalHeaderWithBody
} from "eez-studio-ui/header-with-body";
import { Toolbar } from "eez-studio-ui/toolbar";
import { IconAction } from "eez-studio-ui/action";
import { ITreeNode, Tree } from "eez-studio-ui/tree";
import { Icon } from "eez-studio-ui/icon";
import {
    findPropertyByNameInClassInfo,
    getObjectPropertyDisplayName
} from "project-editor/core/object";

export const ChangesNavigation = observer(
    class ChangesNavigation extends NavigationComponent {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        loading: boolean = true;

        constructor(props: any) {
            super(props);

            makeObservable(this, {
                nodes: computed,
                loading: observable
            });
        }

        async componentDidMount() {
            this.refresh(false);
        }

        refresh = async (forceGitRefresh: boolean = true) => {
            runInAction(() => {
                this.loading = true;
            });

            let revisions: Revision[] = await getRevisions(
                this.context,
                forceGitRefresh
            );

            runInAction(() => {
                this.context.uiStateStore.revisions = revisions;
                this.loading = false;
            });
        };

        get nodes(): IListNode<Revision>[] {
            return this.context.uiStateStore.revisions.map(revision => ({
                id: revision.hash,
                label: revision.message,
                data: revision,
                selected:
                    revision.hash ==
                    this.context.uiStateStore.selectedRevisionHash
            }));
        }

        render() {
            return (
                <VerticalHeaderWithBody style={{ height: "100%" }}>
                    <ToolbarHeader>
                        <Toolbar>
                            <IconAction
                                icon="material:refresh"
                                title="Refresh"
                                onClick={this.refresh}
                            />
                        </Toolbar>
                    </ToolbarHeader>
                    <Body tabIndex={0}>
                        {this.loading ? (
                            <Loader className="" centered={true} />
                        ) : (
                            <List
                                tabIndex={0}
                                nodes={this.nodes}
                                selectNode={action(
                                    (node: IListNode<Revision>) => {
                                        this.context.uiStateStore.selectedRevisionHash =
                                            node.data.hash;
                                    }
                                )}
                                renderNode={(node: IListNode<Revision>) => (
                                    <div className="pb-2">
                                        <div>{node.data.message}</div>
                                        <div className="fw-light">
                                            {node.data.hash != MEMORY_HASH &&
                                            node.data.hash != UNSTAGED_HASH &&
                                            node.data.hash != STAGED_HASH
                                                ? `${node.data.hash.slice(
                                                      0,
                                                      8
                                                  )} • ${
                                                      node.data.author_name
                                                  } • ${moment(
                                                      node.data.date
                                                  ).calendar()}`
                                                : ""}
                                        </div>
                                    </div>
                                )}
                            ></List>
                        )}
                    </Body>
                </VerticalHeaderWithBody>
            );
        }
    }
);

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
                diffResult: observable,
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

                if (this.context.uiStateStore.selectedRevisionHash) {
                    const index = this.context.uiStateStore.revisions.findIndex(
                        revision =>
                            revision.hash ==
                            this.context.uiStateStore.selectedRevisionHash
                    );

                    if (index != -1) {
                        const revisionBefore =
                            index + 1 <
                            this.context.uiStateStore.revisions.length
                                ? this.context.uiStateStore.revisions[index + 1]
                                : undefined;
                        const revisionAfter =
                            this.context.uiStateStore.revisions[index];

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
                } else {
                    await new Promise(resolve => setTimeout(resolve, 100));
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

        factory = (node: FlexLayout.TabNode) => {
            var component = node.getComponent();

            if (component === "tree") {
                if (!this.diffResult) {
                    return null;
                }
                return <ChangesTree diffResult={this.diffResult} />;
            }

            if (component === "html") {
                return (
                    <div
                        dangerouslySetInnerHTML={{
                            __html: this.diffResult?.html || ""
                        }}
                    ></div>
                );
            }

            if (component === "json") {
                return (
                    <pre>
                        {JSON.stringify(this.diffResult?.delta, undefined, 2)}
                    </pre>
                );
            }

            if (component === "annotated") {
                return (
                    <div
                        dangerouslySetInnerHTML={{
                            __html: this.diffResult?.annotated || ""
                        }}
                    ></div>
                );
            }

            return null;
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

            return (
                <FlexLayout.Layout
                    model={this.context.layoutModels.changes}
                    factory={this.factory}
                    realtimeResize={true}
                    font={LayoutModels.FONT_SUB}
                />
            );
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
                                const destinationIndex = value[1];

                                const label = this.getValueLabel(
                                    eezObjectAfter,
                                    index,
                                    index
                                );

                                return {
                                    id,
                                    label: `${label}: moved from position ${index} to position ${destinationIndex}`,
                                    children: [],
                                    selected: false,
                                    expanded: true,
                                    data: undefined
                                };
                            }

                            const label = this.getValueLabel(
                                eezObjectBefore,
                                index,
                                index
                            );

                            return {
                                id,
                                label: (
                                    <>
                                        <Icon
                                            className="pe-1 text-danger"
                                            icon="material:delete"
                                            size={16}
                                            style={{
                                                transform: "translateY(-1px)"
                                            }}
                                        />
                                        <span className="pe-1">{label}</span>
                                    </>
                                ),
                                children: [],
                                selected: false,
                                expanded: true,
                                data: undefined
                            };
                        }

                        const index = parseInt(arrayIndex);

                        const label = this.getValueLabel(
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

            return Object.keys(delta).map(key =>
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

        getValueLabel(obj: any, key: any, defaultLabel: any) {
            if (!obj) {
                return defaultLabel;
            }
            if (!obj[key]) {
                return defaultLabel;
            }

            try {
                return getLabel(obj[key]);
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

            if (Array.isArray(value)) {
                if (value.length == 1) {
                    return {
                        id,
                        label: (
                            <>
                                <Icon
                                    icon="material:add"
                                    size={16}
                                    style={{ transform: "translateY(-2px)" }}
                                />
                                <span className="pe-1">{label}</span>
                                <span className="text-success">
                                    {JSON.stringify(value[0])}
                                </span>
                            </>
                        ),
                        children: [],
                        selected: false,
                        expanded: true,
                        data: undefined
                    };
                } else if (value.length == 2) {
                    return {
                        id,
                        label: (
                            <>
                                <Icon
                                    className="pe-1"
                                    icon="material:edit"
                                    size={16}
                                />
                                <span className="pe-1">{label}</span>
                                <span className="pe-1 text-decoration-line-through text-danger">
                                    {JSON.stringify(value[0])}
                                </span>
                                <span className="text-success">
                                    {JSON.stringify(value[1])}
                                </span>
                            </>
                        ),
                        children: [],
                        selected: false,
                        expanded: true,
                        data: undefined
                    };
                } else {
                    return {
                        id,
                        label: (
                            <>
                                <Icon
                                    className="pe-1"
                                    icon="material:delete"
                                    size={16}
                                    style={{ transform: "translateY(-1px)" }}
                                />
                                <span className="pe-1">{label}</span>
                                <span className="pe-1 text-decoration-line-through text-danger">
                                    {JSON.stringify(value[0])}
                                </span>
                            </>
                        ),
                        children: [],
                        selected: false,
                        expanded: true,
                        data: undefined
                    };
                }
            } else {
                return {
                    id,
                    label,
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
            return (
                <Tree
                    showOnlyChildren={true}
                    rootNode={this.rootNode}
                    selectNode={this.selectNode}
                />
            );
        }
    }
);
