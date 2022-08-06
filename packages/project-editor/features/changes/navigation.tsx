import moment from "moment";
import { Menu, MenuItem } from "@electron/remote";
import React from "react";
import { makeObservable, action, computed } from "mobx";
import { observer } from "mobx-react";
import classNames from "classnames";

import { Loader } from "eez-studio-ui/loader";
import { List, IListNode } from "eez-studio-ui/list";

import { ProjectContext } from "project-editor/project/context";
import { NavigationComponent } from "project-editor/project/NavigationComponent";
import {
    MEMORY_HASH,
    UNSTAGED_HASH,
    Revision,
    STAGED_HASH
} from "project-editor/store/ui-state";
import { refreshRevisions } from "project-editor/features/changes/diff";
import {
    Body,
    ToolbarHeader,
    VerticalHeaderWithBody
} from "eez-studio-ui/header-with-body";
import { Toolbar } from "eez-studio-ui/toolbar";
import { IconAction } from "eez-studio-ui/action";

export const ChangesNavigation = observer(
    class ChangesNavigation extends NavigationComponent {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        constructor(props: any) {
            super(props);

            makeObservable(this, {
                nodes: computed
            });
        }

        async componentDidMount() {
            this.refresh(false);
        }

        refresh = (forceGitRefresh: boolean = true) => {
            refreshRevisions(this.context, forceGitRefresh);
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

        selectNode = action((node: IListNode<Revision>) => {
            this.context.uiStateStore.selectedRevisionHash = node.data.hash;
            this.context.editorsStore.openEditor(this.context.project.changes);
        });

        renderNode = (node: IListNode<Revision>) => (
            <div
                className={classNames({
                    "revision-for-compare":
                        node.data.hash ==
                        this.context.uiStateStore.revisionForCompareHash
                })}
            >
                <div className="revision-message">{node.data.message}</div>
                <div className="revision-details">
                    {node.data.hash != MEMORY_HASH &&
                    node.data.hash != UNSTAGED_HASH &&
                    node.data.hash != STAGED_HASH
                        ? `${node.data.hash.slice(0, 8)} • ${
                              node.data.author_name
                          } • ${moment(node.data.date).calendar()}`
                        : ""}
                </div>
            </div>
        );

        onContextMenu = (node: IListNode<Revision>) => {
            const menu = new Menu();

            if (
                node.data.hash ==
                this.context.uiStateStore.revisionForCompareHash
            ) {
                menu.append(
                    new MenuItem({
                        label: "Deselect",
                        click: action(() => {
                            this.context.uiStateStore.revisionForCompareHash =
                                undefined;
                        })
                    })
                );
            } else {
                menu.append(
                    new MenuItem({
                        label: "Select for Compare",
                        click: action(() => {
                            this.context.uiStateStore.revisionForCompareHash =
                                node.data.hash;
                        })
                    })
                );
            }
            menu.popup();
        };

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
                        {this.context.uiStateStore.revisionsRefreshing ? (
                            <Loader className="" centered={true} />
                        ) : (
                            <List
                                className="EezStudio_ChangesNavigation"
                                tabIndex={0}
                                nodes={this.nodes}
                                selectNode={this.selectNode}
                                renderNode={this.renderNode}
                                onContextMenu={this.onContextMenu}
                            ></List>
                        )}
                    </Body>
                </VerticalHeaderWithBody>
            );
        }
    }
);
