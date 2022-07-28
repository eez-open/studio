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

import { Loader } from "eez-studio-ui/loader";
import { List, IListNode } from "eez-studio-ui/list";

import { ProjectContext } from "project-editor/project/context";
import { NavigationComponent } from "project-editor/project/NavigationComponent";
import { EditorComponent } from "project-editor/project/EditorComponent";
import { IPanel } from "project-editor/store";
import {
    MEMORY_HASH,
    UNSTAGED_HASH,
    Revision,
    STAGED_HASH
} from "project-editor/store/ui-state";
import { diff, getRevisions } from "project-editor/features/changes/diff";

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
            runInAction(() => {
                this.loading = true;
            });

            let revisions: Revision[] | undefined;
            try {
                revisions = await getRevisions(this.context);
            } catch (err) {
                revisions = undefined;
            }

            runInAction(() => {
                this.context.uiStateStore.revisions = revisions;
                this.loading = false;
            });
        }

        get nodes(): IListNode<Revision>[] | undefined {
            return this.context.uiStateStore.revisions?.map(revision => ({
                id: revision.hash,
                label: revision.message,
                data: revision,
                selected:
                    revision.hash ==
                    this.context.uiStateStore.selectedRevisionHash
            }));
        }

        render() {
            if (this.loading) {
                return <Loader className="" centered={true} />;
            }

            return this.nodes ? (
                <List
                    tabIndex={0}
                    nodes={this.nodes}
                    selectNode={action((node: IListNode<Revision>) => {
                        this.context.uiStateStore.selectedRevisionHash =
                            node.data.hash;
                    })}
                    renderNode={(node: IListNode<Revision>) => (
                        <div className="pb-2">
                            <div>{node.data.message}</div>
                            <div className="fw-light">
                                {node.data.hash != MEMORY_HASH &&
                                node.data.hash != UNSTAGED_HASH &&
                                node.data.hash != STAGED_HASH
                                    ? `${node.data.hash.slice(0, 8)} • ${
                                          node.data.author_name
                                      } • ${moment(node.data.date).calendar()}`
                                    : ""}
                            </div>
                        </div>
                    )}
                ></List>
            ) : (
                "Not a git repository"
            );
        }
    }
);

export const ChangesEditor = observer(
    class ChangesEditor extends EditorComponent implements IPanel {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        delta: string | undefined;
        progressPercent: number | undefined;

        activeTask: () => void | undefined;
        dispose: IReactionDisposer | undefined;

        constructor(props: any) {
            super(props);

            makeObservable(this, {
                delta: observable,
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

                let revisionContent: string | undefined = undefined;

                if (
                    this.context.uiStateStore.selectedRevisionHash &&
                    this.context.uiStateStore.revisions
                ) {
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
                            this.delta = revisionContent;
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
            return (
                <div
                    dangerouslySetInnerHTML={{ __html: this.delta || "" }}
                ></div>
            );
        }
    }
);
