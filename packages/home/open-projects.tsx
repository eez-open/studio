import path from "path";
import fs from "fs";
import { clipboard, ipcRenderer } from "electron";
import { Menu, MenuItem } from "@electron/remote";
import React from "react";
import {
    computed,
    action,
    observable,
    runInAction,
    makeObservable,
    autorun
} from "mobx";
import { observer } from "mobx-react";

import { ButtonAction, IconAction } from "eez-studio-ui/action";

import { stringCompare } from "eez-studio-shared/string";

import { IListNode, List, ListContainer, ListItem } from "eez-studio-ui/list";
import { settingsController } from "home/settings";
import type { IMruItem } from "main/settings";
import { SearchInput } from "eez-studio-ui/search-input";
import { getProjectIcon } from "home/helper";
import { ProjectStore, loadProject } from "project-editor/store";
import { ProjectEditorTab, tabs } from "home/tabs-store";
import { initProjectEditor } from "project-editor/project-editor-bootstrap";
import { HOME_TAB_OPEN_ICON } from "project-editor/ui-components/icons";

////////////////////////////////////////////////////////////////////////////////

const SORT_ALPHA_ICON = (
    <svg
        viewBox="0 0 24 24"
        strokeWidth="2"
        stroke="currentColor"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
    >
        <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
        <path d="M15 10v-5c0 -1.38 .62 -2 2 -2s2 .62 2 2v5m0 -3h-4"></path>
        <path d="M19 21h-4l4 -7h-4"></path>
        <path d="M4 15l3 3l3 -3"></path>
        <path d="M7 6v12"></path>
    </svg>
);

const SORT_RECENT_ICON = (
    <svg
        viewBox="0 0 24 24"
        strokeWidth="2"
        stroke="currentColor"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
    >
        <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
        <line x1="4" y1="6" x2="13" y2="6"></line>
        <line x1="4" y1="12" x2="11" y2="12"></line>
        <line x1="4" y1="18" x2="11" y2="18"></line>
        <polyline points="15 15 18 18 21 15"></polyline>
        <line x1="18" y1="6" x2="18" y2="18"></line>
    </svg>
);

////////////////////////////////////////////////////////////////////////////////

interface ProjectInfo {
    baseName: string;
    dirName: string;
    hasFlowSupport: boolean;
}

class OpenProjectsStore {
    selectedMruItem: IMruItem | undefined;
    selectedProjectInfo: ProjectInfo | undefined;
    searchText: string = "";
    sortAlphabetically: boolean = false;

    constructor() {
        this.sortAlphabetically =
            localStorage.getItem("homeTabProjectsSort") == "alphabetically"
                ? true
                : false;

        makeObservable(this, {
            selectedMruItem: observable,
            selectedProjectInfo: observable,
            searchText: observable,
            sortAlphabetically: observable,
            mru: computed,
            mruAlpha: computed,
            allMruItems: computed,
            toggleSort: action,
            onSearchChange: action,
            removeFromList: action
        });

        autorun(async () => {
            const mruItem = this.selectedMruItem;

            if (mruItem) {
                const isProject = mruItem.filePath.endsWith(".eez-project");

                let extension = isProject ? ".eez-project" : ".eez-dashboard";

                const baseName = path.basename(mruItem.filePath, extension);

                const dirName = path.dirname(mruItem.filePath);

                runInAction(() => {
                    this.selectedProjectInfo = {
                        baseName,
                        dirName,
                        hasFlowSupport: mruItem.hasFlowSupport
                    };
                });

                try {
                    const jsonStr = await fs.promises.readFile(
                        mruItem.filePath,
                        "utf8"
                    );

                    await initProjectEditor(tabs, ProjectEditorTab);
                    const projectStore = ProjectStore.create({
                        type: "read-only"
                    });
                    const project = loadProject(projectStore, jsonStr, false);
                    projectStore.setProject(project, "");

                    runInAction(() => {
                        if (this.selectedProjectInfo) {
                            this.selectedProjectInfo.hasFlowSupport =
                                projectStore.projectTypeTraits.hasFlowSupport;
                        }
                    });
                } catch (err) {
                    console.error(err);
                }
            } else {
                runInAction(() => {
                    this.selectedProjectInfo = undefined;
                });
            }
        });
    }

    get mruAlpha() {
        const mru = [...settingsController.mru];
        mru.sort((mruItem1, mruItem2) => {
            const baseName1 = path.basename(mruItem1.filePath);
            const baseName2 = path.basename(mruItem2.filePath);
            return stringCompare(baseName1, baseName2);
        });
        return mru;
    }

    get mru() {
        return this.sortAlphabetically ? this.mruAlpha : settingsController.mru;
    }

    get allMruItems() {
        return openProjectsStore.mru
            .filter(
                mruItem =>
                    mruItem.filePath
                        .toLowerCase()
                        .indexOf(
                            openProjectsStore.searchText.trim().toLowerCase()
                        ) != -1
            )
            .map(mruItem => ({
                id: mruItem.filePath,
                data: mruItem,
                selected: mruItem == openProjectsStore.selectedMruItem
            }));
    }

    toggleSort = () => {
        this.sortAlphabetically = !this.sortAlphabetically;

        localStorage.setItem(
            "homeTabProjectsSort",
            this.sortAlphabetically ? "alphabetically" : "most-recent"
        );
    };

    onSearchChange = (event: any) => {
        this.searchText = $(event.target).val() as string;
        if (this.allMruItems.length > 0) {
            this.selectedMruItem = this.allMruItems[0].data;
        }
    };

    editProject = () => {
        if (this.selectedMruItem) {
            ipcRenderer.send("open-file", this.selectedMruItem!.filePath);
        }
    };

    runProject = () => {
        if (this.selectedMruItem && this.selectedMruItem.hasFlowSupport) {
            ipcRenderer.send("open-file", this.selectedMruItem!.filePath, true);
        }
    };

    copyProjectPath = () => {
        if (this.selectedMruItem) {
            clipboard.writeText(this.selectedMruItem.filePath);
        }
    };

    removeFromList = () => {
        if (openProjectsStore.selectedMruItem) {
            settingsController.removeItemFromMRU(
                openProjectsStore.selectedMruItem
            );

            openProjectsStore.selectedMruItem = undefined;
        }
    };
}

const openProjectsStore = new OpenProjectsStore();

////////////////////////////////////////////////////////////////////////////////

export const Projects = observer(
    class Projects extends React.Component {
        onContextMenu = (node: IListNode<IMruItem>) => {
            runInAction(() => (openProjectsStore.selectedMruItem = node.data));

            const menu = new Menu();

            menu.append(
                new MenuItem({
                    label: "Edit Project",
                    click: openProjectsStore.editProject
                })
            );

            if (node.data.hasFlowSupport) {
                menu.append(
                    new MenuItem({
                        label: "Run Project",
                        click: openProjectsStore.runProject
                    })
                );
            }

            menu.append(
                new MenuItem({
                    label: "Copy Project Path",
                    click: openProjectsStore.copyProjectPath
                })
            );

            menu.append(
                new MenuItem({
                    label: "Remove From List",
                    click: openProjectsStore.removeFromList
                })
            );

            menu.popup();
        };

        render() {
            return (
                <div className="EezStudio_HomeTab_Projects">
                    <div className="EezStudio_HomeTab_Projects_Header">
                        <div style={{ width: 28, height: 28 }}></div>
                        <SearchInput
                            searchText={openProjectsStore.searchText}
                            onClear={action(() => {
                                openProjectsStore.searchText = "";
                            })}
                            onChange={openProjectsStore.onSearchChange}
                            onKeyDown={openProjectsStore.onSearchChange}
                        />
                        <IconAction
                            icon={
                                openProjectsStore.sortAlphabetically
                                    ? SORT_ALPHA_ICON
                                    : SORT_RECENT_ICON
                            }
                            title={
                                openProjectsStore.sortAlphabetically
                                    ? "Sort alphabetically"
                                    : "Show most recent first"
                            }
                            onClick={openProjectsStore.toggleSort}
                        />
                    </div>
                    <div className="EezStudio_HomeTab_Projects_Body">
                        <div className="EezStudio_HomeTab_Projects_Space"></div>
                        <div className="EezStudio_HomeTab_Projects_Actions">
                            <ButtonAction
                                className="btn-primary"
                                text={"Open Project"}
                                title="Open a local EEZ Studio Project"
                                icon={HOME_TAB_OPEN_ICON}
                                onClick={() => {
                                    ipcRenderer.send("open-project");
                                }}
                            />
                        </div>
                        <ListContainer tabIndex={0}>
                            <List
                                nodes={openProjectsStore.allMruItems}
                                renderNode={(node: IListNode<IMruItem>) => {
                                    let mruItem = node.data;

                                    const isProject =
                                        mruItem.filePath.endsWith(
                                            ".eez-project"
                                        );

                                    let extension = isProject
                                        ? ".eez-project"
                                        : ".eez-dashboard";

                                    const baseName = path.basename(
                                        mruItem.filePath,
                                        extension
                                    );

                                    return (
                                        <ListItem
                                            leftIcon={getProjectIcon(
                                                mruItem.filePath,
                                                mruItem.projectType,
                                                48,
                                                mruItem.hasFlowSupport
                                            )}
                                            leftIconSize={48}
                                            label={
                                                <div
                                                    className="EezStudio_HomeTab_ProjectItem"
                                                    title={mruItem.filePath}
                                                >
                                                    <div className="project-name">
                                                        <span className="fw-bolder">
                                                            {baseName}
                                                        </span>
                                                        <span>{extension}</span>
                                                    </div>
                                                    <div className="project-folder">
                                                        {path.dirname(
                                                            mruItem.filePath
                                                        )}
                                                    </div>
                                                </div>
                                            }
                                        />
                                    );
                                }}
                                selectNode={(node: IListNode<IMruItem>) => {
                                    runInAction(
                                        () =>
                                            (openProjectsStore.selectedMruItem =
                                                node.data)
                                    );
                                }}
                                onContextMenu={this.onContextMenu}
                                onDoubleClick={openProjectsStore.editProject}
                            ></List>
                        </ListContainer>
                        <ProjectInfo />
                    </div>
                </div>
            );
        }
    }
);

export const ProjectInfo = observer(
    class ProjectInfo extends React.Component {
        render() {
            return (
                <div className="EezStudio_HomeTab_Projects_ProjectInfo">
                    {openProjectsStore.selectedProjectInfo && (
                        <div className="EezStudio_HomeTab_Projects_ProjectInfo_Actions">
                            <ButtonAction
                                className="btn-primary"
                                text="Edit Project"
                                title="Edit Project"
                                icon="material:edit"
                                onClick={openProjectsStore.editProject}
                            />
                            {openProjectsStore.selectedProjectInfo
                                .hasFlowSupport && (
                                <ButtonAction
                                    className="btn-secondary"
                                    text="Run Project"
                                    title="Run Project"
                                    icon="material:play_arrow"
                                    onClick={openProjectsStore.runProject}
                                />
                            )}
                            <ButtonAction
                                className="btn-secondary"
                                text="Copy Project Path"
                                title="Copy Project Path"
                                icon="material:content_copy"
                                onClick={openProjectsStore.copyProjectPath}
                            />
                            <ButtonAction
                                className="btn-danger"
                                text="Remove From List"
                                title="Remove From List"
                                icon="material:close"
                                onClick={openProjectsStore.removeFromList}
                            />
                        </div>
                    )}
                </div>
            );
        }
    }
);
