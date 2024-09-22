import { ipcRenderer } from "electron";

import { dialog } from "@electron/remote";
import React from "react";
import { observable, action, keys, makeObservable } from "mobx";
import { observer } from "mobx-react";
import * as FlexLayout from "flexlayout-react";

import { readBinaryFile } from "eez-studio-shared/util-electron";

import { IconAction, ButtonAction } from "eez-studio-ui/action";
import { Toolbar } from "eez-studio-ui/toolbar";
import {
    SideDock2,
    SideDockComponent2,
    layoutModels,
    LayoutModels
} from "eez-studio-ui/side-dock";
import { SearchInput } from "eez-studio-ui/search-input";
import * as notification from "eez-studio-ui/notification";

import { extensions } from "eez-studio-shared/extensions/extensions";

import { log } from "instrument/window/history/activity-log";

import type {
    IAppStore,
    INavigationStore
} from "instrument/window/history/history";
import {
    HistoryListComponent,
    HistoryListComponentClass
} from "instrument/window/history/list-component";
import type { IHistoryItem } from "instrument/window/history/item";
import { SearchResults } from "instrument/window/history/search-results";
import { FiltersComponent } from "instrument/window/history/filters";
import { Calendar } from "instrument/window/history/calendar";
import { SessionList } from "instrument/window/history/session/list-view";
import { Scrapbook } from "instrument/window/history/scrapbook";

import { showAddNoteDialog } from "instrument/window/note-dialog";
import {
    showAddAudioDialog,
    showAddVideoDialog
} from "instrument/window/media-dialogs";

import {
    detectFileType,
    extractColumnFromCSVHeuristically
} from "instrument/connection/file-type";
import { Loader } from "eez-studio-ui/loader";
import { WaveformFormat } from "eez-studio-ui/chart/WaveformFormat";
import {
    CONVERT_TO_CHART,
    PLOTTER_ICON,
    RECORD_AUDIO_ICON,
    RECORD_VIDEO_ICON
} from "project-editor/ui-components/icons";

////////////////////////////////////////////////////////////////////////////////

export const HistoryTools = observer(
    class HistoryTools extends React.Component<{ appStore: IAppStore }, {}> {
        addNote = () => {
            showAddNoteDialog(note => {
                const selectedItems = this.props.appStore.history.items.filter(
                    item => item.selected
                );

                log(
                    this.props.appStore.history.options.store,
                    {
                        oid: this.props.appStore.history.oid,
                        type: "activity-log/note",
                        message: note,
                        date:
                            selectedItems.length == 1
                                ? selectedItems[0].date
                                : undefined
                    },
                    {
                        undoable: true,
                        transaction: "Add note"
                    }
                );
            });
        };

        logMedia = (
            media: { message: string; data: any },
            transaction: string
        ) => {
            log(
                this.props.appStore.history.options.store,
                {
                    oid: this.props.appStore.history.oid,
                    type: "activity-log/media",
                    message: media.message,
                    data: media.data
                },
                {
                    undoable: true,
                    transaction
                }
            );
        };

        addAudio = () => {
            showAddAudioDialog(media => {
                this.logMedia(media, "Add audio");
            });
        };

        addVideo = () => {
            showAddVideoDialog(media => {
                this.logMedia(media, "Add video");
            });
        };

        attachFile = async () => {
            const result = await dialog.showOpenDialog({
                properties: ["openFile", "multiSelections"],
                filters: [{ name: "All Files", extensions: ["*"] }]
            });

            const filePaths = result.filePaths;
            if (filePaths) {
                filePaths.forEach(async filePath => {
                    const progressToastId = notification.info(
                        "Loading file ...",
                        {
                            autoClose: false,
                            closeButton: false,
                            closeOnClick: false,
                            hideProgressBar: false,
                            progressStyle: {
                                transition: "none"
                            }
                        }
                    );

                    await new Promise(resolve => setTimeout(resolve, 600));

                    let data = await readBinaryFile(filePath);

                    let message;

                    if (filePath.toLowerCase().endsWith(".csv")) {
                        notification.update(progressToastId, {
                            render: "Importing CSV ..."
                        });

                        await new Promise(resolve => setTimeout(resolve, 300));

                        const result = await extractColumnFromCSVHeuristically(
                            data,
                            progressToastId
                        );

                        if (result) {
                            data = result.data;

                            message = {
                                sourceFilePath: filePath,
                                state: "success",
                                fileType: { mime: "application/eez-raw" },
                                waveformDefinition: {
                                    samplingRate: result.samplingRate,
                                    format: WaveformFormat.FLOATS_64BIT,
                                    unitName: result.unitName,
                                    color: result.color,
                                    colorInverse: result.colorInverse,
                                    label: result.label,
                                    offset: 0,
                                    scale: 1
                                },
                                viewOptions: {
                                    axesLines: {
                                        type: "dynamic",
                                        steps: {
                                            x: [],
                                            y: []
                                        },
                                        majorSubdivision: {
                                            horizontal: 24,
                                            vertical: 8
                                        },
                                        minorSubdivision: {
                                            horizontal: 5,
                                            vertical: 5
                                        },
                                        snapToGrid: true,
                                        defaultZoomMode: "all"
                                    }
                                },
                                dataLength: data.length
                            };
                        } else {
                            const fileType = detectFileType(data, filePath);
                            const note = fileType.comment;
                            delete fileType.comment;
                            message = {
                                sourceFilePath: filePath,
                                state: "success",
                                fileType,
                                waveformDefinition: {
                                    samplingRate: 1,
                                    format: WaveformFormat.CSV_STRING,
                                    unitName: "volt",
                                    color: "blue",
                                    colorInverse: "blue",
                                    label: "Voltage",
                                    offset: 0,
                                    scale: 1
                                },
                                viewOptions: {
                                    axesLines: {
                                        type: "dynamic",
                                        steps: {
                                            x: [],
                                            y: []
                                        },
                                        majorSubdivision: {
                                            horizontal: 24,
                                            vertical: 8
                                        },
                                        minorSubdivision: {
                                            horizontal: 5,
                                            vertical: 5
                                        },
                                        snapToGrid: true,
                                        defaultZoomMode: "all"
                                    }
                                },
                                note,
                                dataLength: data.length
                            };
                        }
                    } else {
                        const fileType = detectFileType(data, filePath);
                        const note = fileType.comment;
                        delete fileType.comment;
                        message = {
                            sourceFilePath: filePath,
                            state: "success",
                            fileType,
                            note,
                            dataLength: data.length
                        };
                    }

                    notification.update(progressToastId, {
                        render: "Importing to database ..."
                    });
                    await new Promise(resolve => setTimeout(resolve, 300));

                    log(
                        this.props.appStore.history.options.store,
                        {
                            oid: this.props.appStore.history.oid,
                            type: "instrument/file-attachment",
                            message: JSON.stringify(message),
                            data: data
                        },
                        {
                            undoable: true
                        }
                    );

                    notification.update(progressToastId, {
                        render: "Import done.",
                        type: notification.SUCCESS,
                        closeButton: true,
                        closeOnClick: true,
                        hideProgressBar: true,
                        autoClose: 3000
                    });
                });
            }
        };

        addChart = () => {
            if (this.props.appStore.instrument.commandsProtocol == "SCPI") {
                this.props.appStore.selectHistoryItems({
                    historyItemType: "chart",
                    message: "Select two or more waveform data items",
                    okButtonText: "Add Chart",
                    okButtonTitle: "Add chart",
                    loading: true,
                    onOk: () => {
                        const multiWaveformDefinition = {
                            waveformLinks: keys(
                                this.props.appStore.selectedHistoryItems
                            ).map(id => ({
                                id
                            }))
                        };

                        this.props.appStore.selectHistoryItems(undefined);

                        log(
                            this.props.appStore.history.options.store,
                            {
                                oid: this.props.appStore.history.oid,
                                type: "instrument/chart",
                                message: JSON.stringify(multiWaveformDefinition)
                            },
                            {
                                undoable: true,
                                transaction: "Add chart"
                            }
                        );
                    }
                });
            }
        };

        togglePlotter = () => {
            const connection = this.props.appStore.instrument.connection;
            if (connection.enablePlotter) {
                if (connection.isPlotterEnabled) {
                    connection.abortLongOperation();
                } else {
                    connection.enablePlotter();
                }
            }
        };

        generateChart = () => {
            const numSamples = 128;
            const data = Buffer.alloc(numSamples * 8);
            for (let i = 0; i < numSamples; ++i) {
                let value;
                if (i <= 10) {
                    value = 1;
                } else if (i >= 118) {
                    value = 1;
                } else {
                    value = 0;
                }
                data.writeDoubleLE(value, i * 8);
            }

            log(
                this.props.appStore.history.options.store,
                {
                    oid: this.props.appStore.history.oid,
                    type: "instrument/file-attachment",
                    message: JSON.stringify({
                        state: "success",
                        fileType: { mime: "application/eez-raw" },
                        waveformDefinition: {
                            samplingRate: 1,
                            format: WaveformFormat.FLOATS_64BIT,
                            unitName: "volt",
                            color: "blue",
                            colorInverse: "blue",
                            label: "Voltage",
                            offset: 0,
                            scale: 1
                        },
                        dataLength: data.length
                    }),
                    data
                },
                {
                    undoable: true,
                    transaction: "Generate chart"
                }
            );
        };

        render() {
            const { appStore } = this.props;

            const tools: JSX.Element[] = [];

            if (appStore.selectHistoryItemsSpecification === undefined) {
                tools.push(
                    <IconAction
                        key="addNote"
                        icon="material:comment"
                        title="Add Note"
                        onClick={this.addNote}
                    />,
                    <IconAction
                        key="addAudio"
                        icon={RECORD_AUDIO_ICON}
                        title="Record Audio"
                        onClick={this.addAudio}
                    />,
                    <IconAction
                        key="addVideo"
                        icon={RECORD_VIDEO_ICON}
                        title="Record Video from Camera"
                        onClick={this.addVideo}
                    />,
                    <IconAction
                        key="addFile"
                        icon="material:attach_file"
                        title="Attach File"
                        onClick={this.attachFile}
                    />
                );

                if (this.props.appStore.instrument.commandsProtocol == "SCPI") {
                    tools.push(
                        <IconAction
                            key="addChart"
                            icon="material:insert_chart"
                            title="Add Chart"
                            onClick={this.addChart}
                        />
                    );
                } else {
                    tools.push(
                        <IconAction
                            key="addChart"
                            icon={PLOTTER_ICON}
                            title="Show/Hide Plotter"
                            onClick={this.togglePlotter}
                            selected={
                                this.props.appStore.instrument.connection
                                    .isPlotterEnabled
                            }
                        />
                    );

                    if (appStore.history.selection.canConvertToChart) {
                        tools.push(
                            <IconAction
                                key="convertToChart"
                                icon={CONVERT_TO_CHART}
                                title="Create chart from selected items"
                                onClick={appStore.history.convertToChart}
                            />
                        );
                    }
                }

                // add tools from extensions
                extensions.forEach(extension => {
                    if (extension.activityLogTools) {
                        extension.activityLogTools.forEach(activityLogTool => {
                            const controller = {
                                store: appStore.history.options.store,
                                selection: appStore.history.selection.items
                            };

                            let tool;

                            if (typeof activityLogTool === "function") {
                                tool = activityLogTool(controller);
                            } else {
                                if (activityLogTool.isEnabled(controller)) {
                                    tool = (
                                        <IconAction
                                            key={activityLogTool.id}
                                            icon={activityLogTool.icon}
                                            title={activityLogTool.title}
                                            onClick={() =>
                                                activityLogTool.handler(
                                                    controller
                                                )
                                            }
                                        />
                                    );
                                }
                            }
                            if (tool) {
                                tools.push(tool);
                            }
                        });
                    }
                });

                if (appStore.history.selection.canStorePermanently) {
                    tools.push(
                        <IconAction
                            key="Save"
                            icon="material:save"
                            title="Store selected history items permanently"
                            onClick={
                                appStore.history
                                    .storeSelectedHistoryItemsPermanently
                            }
                        />
                    );
                }

                if (appStore.history.selection.canDelete) {
                    tools.push(
                        <IconAction
                            key="delete"
                            icon="material:delete"
                            title="Delete selected history items"
                            onClick={
                                appStore.history.deleteSelectedHistoryItems
                            }
                        />
                    );
                }

                if (appStore.deletedItemsHistory.deletedCount > 0) {
                    tools.push(
                        <ButtonAction
                            key="deletedItems"
                            text={`Deleted Items (${appStore.deletedItemsHistory.deletedCount})`}
                            icon="material:delete"
                            title="Show deleted items"
                            onClick={
                                appStore.navigationStore
                                    .navigateToDeletedHistoryItems
                            }
                            className="btn-secondary btn-sm"
                            style={{ marginLeft: 20 }}
                        />
                    );
                }
            }

            return tools;
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

export class HistoryViewComponent extends React.Component<{
    appStore: IAppStore;
    persistId: string;
    simple?: boolean;
    showSideBar: boolean;
}> {
    history: HistoryListComponentClass | null;
    sideDock: SideDockComponent2 | null;
    jumpToPresentCondition = observable.box<boolean>(false);

    searchText: string = "";

    constructor(props: any) {
        super(props);

        makeObservable(this, {
            searchText: observable,
            onSearchChange: action.bound
        });
    }

    componentDidMount() {
        if (!this.props.simple) {
            this.props.appStore.navigationStore.mainHistoryView = this;
        }
    }

    componentWillUnmount() {
        if (!this.props.simple) {
            this.props.appStore.navigationStore.mainHistoryView = undefined;
        }
    }

    onSelectHistoryItemsOk = () => {
        this.props.appStore.selectHistoryItemsSpecification!.onOk();
    };

    onSelectHistoryItemsCancel = () => {
        this.props.appStore.selectHistoryItems(undefined);
    };

    onSearchChange(event: any) {
        this.searchText = $(event.target).val() as string;
        this.props.appStore.history.search.search(this.searchText);
    }

    factory = (node: FlexLayout.TabNode) => {
        var component = node.getComponent();

        const appStore = this.props.appStore;

        if (component === "SearchResults") {
            return (
                <div
                    style={{
                        position: "absolute",
                        width: "100%",
                        height: "100%",
                        display: "flex"
                    }}
                >
                    <SearchResults history={appStore.history} />
                </div>
            );
        } else if (component === "Filters") {
            return <FiltersComponent appStore={appStore} />;
        } else if (component === "Calendar") {
            return (
                <div
                    style={{
                        height: "100%",
                        overflow: "auto"
                    }}
                >
                    <Calendar history={appStore.history} />
                </div>
            );
        } else if (component === "Sessions") {
            return (
                <div
                    style={{
                        position: "absolute",
                        width: "100%",
                        height: "100%",
                        display: "flex"
                    }}
                >
                    <SessionList appStore={appStore} />
                </div>
            );
        } else if (component === "Scrapbook") {
            return <Scrapbook appStore={appStore} history={appStore.history} />;
        }

        return null;
    };

    renderHistoryComponentWithTools(historyComponent: JSX.Element) {
        const appStore = this.props.appStore;

        return (
            <div className="EezStudio_HistoryContainer">
                {appStore.selectHistoryItemsSpecification && (
                    <div className="EezStudio_HistoryHeader EezStudio_SlideInDownTransition">
                        <div>
                            {appStore.selectedHistoryItems.size > 0 ? (
                                `${appStore.selectedHistoryItems.size} selected`
                            ) : (
                                <span style={{ display: "flex" }}>
                                    {appStore.selectHistoryItemsSpecification
                                        .loading && (
                                        <Loader
                                            size={24}
                                            style={{ marginRight: 20 }}
                                        />
                                    )}
                                    <span>
                                        {
                                            appStore
                                                .selectHistoryItemsSpecification
                                                .message
                                        }
                                    </span>
                                </span>
                            )}
                        </div>
                        <Toolbar>
                            {appStore.selectedHistoryItems.size > 1 && (
                                <ButtonAction
                                    text={
                                        appStore.selectHistoryItemsSpecification
                                            .okButtonText
                                    }
                                    title={
                                        appStore.selectHistoryItemsSpecification
                                            .okButtonTitle
                                    }
                                    className={
                                        appStore.selectHistoryItemsSpecification
                                            .alertDanger
                                            ? "btn-danger"
                                            : "btn-primary"
                                    }
                                    onClick={this.onSelectHistoryItemsOk}
                                />
                            )}
                            <ButtonAction
                                text="Cancel"
                                title="Cancel"
                                className="btn-secondary"
                                onClick={this.onSelectHistoryItemsCancel}
                            />
                        </Toolbar>
                    </div>
                )}
                <div
                    className="EezStudio_HistoryBody"
                    onClick={event => {
                        if (
                            $(event.target).closest(
                                ".EezStudio_HistoryItemEnclosure"
                            ).length === 0
                        ) {
                            // deselect all items
                            this.props.appStore.history.selection.selectItems(
                                []
                            );
                        }
                    }}
                    tabIndex={0}
                >
                    {historyComponent}
                    {this.props.appStore.history &&
                        (this.props.appStore.history.navigator.hasNewer ||
                            this.jumpToPresentCondition.get()) && (
                            <button
                                className="EezStudio_HistoryListComponent_JumpToPresent_Button btn btn-sm btn-secondary"
                                onClick={() => {
                                    this.props.appStore.history.calendar.update();
                                }}
                            >
                                Jump To Present
                            </button>
                        )}
                </div>
            </div>
        );
    }

    render() {
        const appStore = this.props.appStore;

        const historyComponent = (
            <HistoryListComponent
                ref={ref => (this.history = ref)}
                appStore={appStore}
                history={appStore.history}
                jumpToPresentCondition={this.jumpToPresentCondition}
            />
        );

        if (this.props.simple || !this.props.showSideBar) {
            return historyComponent;
        }

        let historyComponentWithTools =
            this.renderHistoryComponentWithTools(historyComponent);

        let input = (
            <SearchInput
                searchText={this.searchText}
                onClear={action(() => {
                    this.searchText = "";
                    this.props.appStore.history.search.search(this.searchText);
                })}
                onChange={this.onSearchChange}
            />
        );

        return (
            <SideDock2
                ref={ref => (this.sideDock = ref)}
                persistId={this.props.persistId + "/side-dock-1"}
                flexLayoutModel={layoutModels.getHistoryViewModel(
                    this.props.appStore.history.search.searchActive,
                    this.props.appStore.history.isSessionsSupported
                )}
                factory={this.factory}
                header={input}
                width={420}
            >
                {historyComponentWithTools}
            </SideDock2>
        );
    }
}

export const HistoryView = observer(HistoryViewComponent);

export function moveToTopOfHistory(
    historyView: HistoryViewComponent | undefined
) {
    if (historyView && historyView.history) {
        historyView.history.moveToTop();
    }
}

export function moveToBottomOfHistory(
    historyView: HistoryViewComponent | undefined
) {
    if (historyView && historyView.history) {
        historyView.history.moveToBottom();
    }
}

export function showHistoryItem(
    historyView: HistoryViewComponent | undefined,
    historyItem: IHistoryItem
) {
    if (historyView && historyView.history) {
        historyView.history.showHistoryItem(historyItem);
    }
}

export function showSessionsList(navigationStore: INavigationStore) {
    const sideDock =
        navigationStore.mainHistoryView &&
        navigationStore.mainHistoryView.sideDock;
    if (sideDock) {
        if (!sideDock.isOpen) {
            sideDock.toggleIsOpen();
        } else {
            if (sideDock.props.flexLayoutModel) {
                layoutModels.selectTab(
                    sideDock.props.flexLayoutModel,
                    LayoutModels.HISTORY_VIEW_SESSIONS_TAB_ID
                );
            }
            return;
        }
    }
    // try again
    setTimeout(() => showSessionsList(navigationStore), 0);
}

ipcRenderer.on("create-plotter-no-data", () => {
    notification.info("No data found that can be converted into a graph.");
});
