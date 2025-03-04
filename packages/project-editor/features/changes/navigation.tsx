import { getCurrentWindow, Menu, MenuItem } from "@electron/remote";
import React from "react";
import { makeObservable, action, computed } from "mobx";
import { observer } from "mobx-react";
import classNames from "classnames";
import { dialog } from "@electron/remote";

import { Loader } from "eez-studio-ui/loader";
import { List, IListNode } from "eez-studio-ui/list";

import { ProjectContext } from "project-editor/project/context";
import {
    Body,
    ToolbarHeader,
    VerticalHeaderWithBody
} from "eez-studio-ui/header-with-body";
import { Toolbar } from "eez-studio-ui/toolbar";
import { IconAction } from "eez-studio-ui/action";

import {
    MEMORY_HASH,
    UNSTAGED_HASH,
    Revision,
    STAGED_HASH,
    getHashFromFilePath,
    getFilePathFromHash
} from "./state";
import { getMoment } from "eez-studio-shared/util";

////////////////////////////////////////////////////////////////////////////////

export const ChangesTab = observer(
    class ChangesTab extends React.Component {
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
            this.context.project.changes._state.refreshRevisions(
                this.context,
                forceGitRefresh
            );
        };

        open = async () => {
            const result = await dialog.showOpenDialog(getCurrentWindow(), {
                properties: ["openFile"],
                filters: [
                    { name: "EEZ Project", extensions: ["eez-project"] },
                    { name: "All Files", extensions: ["*"] }
                ]
            });

            if (!result.canceled) {
                this.context.editorsStore.openEditor(
                    this.context.project.changes,
                    undefined,
                    {
                        hashBefore: getHashFromFilePath(result.filePaths[0]),
                        hashAfter:
                            this.context.project.changes._state.revisions[0]
                                .hash
                    }
                );
            }
        };

        get nodes(): IListNode<Revision>[] {
            return this.context.project.changes._state.revisions.map(
                revision => ({
                    id: revision.hash,
                    label: revision.message,
                    data: revision,
                    selected:
                        revision.hash ==
                        this.context.project.changes._state.selectedRevisionHash
                })
            );
        }

        selectNode = action((node: IListNode<Revision>) => {
            this.context.project.changes._state.selectedRevisionHash =
                node.data.hash;
            if (
                this.context.project.changes._state.revisionForCompareHash &&
                getFilePathFromHash(
                    this.context.project.changes._state.revisionForCompareHash
                )
            ) {
                this.context.project.changes._state.revisionForCompareHash =
                    undefined;
            }
            this.context.editorsStore.openEditor(this.context.project.changes);
        });

        renderNode = (node: IListNode<Revision>) => (
            <div
                className={classNames({
                    "revision-for-compare":
                        node.data.hash ==
                        this.context.project.changes._state
                            .revisionForCompareHash
                })}
            >
                <div className="revision-message">{node.data.message}</div>
                <div className="revision-details">
                    {node.data.hash != MEMORY_HASH &&
                    node.data.hash != UNSTAGED_HASH &&
                    node.data.hash != STAGED_HASH &&
                    !getFilePathFromHash(node.data.hash)
                        ? `${node.data.hash.slice(0, 8)} • ${
                              node.data.author_name
                          } • ${getMoment()(node.data.date).calendar()}`
                        : ""}
                </div>
            </div>
        );

        onContextMenu = (node: IListNode<Revision>) => {
            const menu = new Menu();

            if (
                node.data.hash ==
                this.context.project.changes._state.revisionForCompareHash
            ) {
                menu.append(
                    new MenuItem({
                        label: "Deselect",
                        click: action(() => {
                            this.context.project.changes._state.revisionForCompareHash =
                                undefined;
                        })
                    })
                );
            } else {
                menu.append(
                    new MenuItem({
                        label: "Select for Compare",
                        click: action(() => {
                            this.context.project.changes._state.revisionForCompareHash =
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
                            <IconAction
                                icon="material:compare"
                                title="Compare with other project"
                                onClick={this.open}
                            />
                        </Toolbar>
                    </ToolbarHeader>
                    <Body tabIndex={0}>
                        {this.context.project.changes._state
                            .revisionsRefreshing ? (
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
