import React from "react";
import { observable, computed, action, toJS } from "mobx";
import { observer } from "mobx-react";

import { logGet, logUpdate } from "eez-studio-shared/activity-log";
import {
    readCsvFile,
    writeCsvFile,
    getValidFileNameFromFileName
} from "eez-studio-shared/util-electron";
import { stringCompare } from "eez-studio-shared/string";
import { beginTransaction, commitTransaction } from "eez-studio-shared/store";
import { _range } from "eez-studio-shared/algorithm";
import { formatDateTimeLong } from "eez-studio-shared/util";

import { validators } from "eez-studio-shared/validation";

import { Icon } from "eez-studio-ui/icon";
import { Splitter } from "eez-studio-ui/splitter";
import {
    VerticalHeaderWithBody,
    ToolbarHeader,
    Body
} from "eez-studio-ui/header-with-body";
import { IconAction, ButtonAction } from "eez-studio-ui/action";
import { List as ListComponent } from "eez-studio-ui/list";
import { Dialog, showDialog } from "eez-studio-ui/dialog";
import { error, confirm } from "eez-studio-ui/dialog-electron";
import { showGenericDialog } from "eez-studio-ui/generic-dialog";
import * as notification from "eez-studio-ui/notification";
import { PropertyList, NumberInputProperty } from "eez-studio-ui/properties";
// import { SelectProperty } from "eez-studio-ui/properties";
import { Header } from "eez-studio-ui/header-with-body";

import { DEFAULT_INSTRUMENT_PROPERTIES } from "instrument/DEFAULT_INSTRUMENT_PROPERTIES";
import type { InstrumentObject } from "instrument/instrument-object";

import { getList, sendList } from "instrument/connection/list-operations";

import type { InstrumentAppStore } from "instrument/window/app-store";

import {
    BaseList,
    ITableListData
} from "instrument/window/lists/store-renderer";
import {
    createEmptyListData,
    createTableListFromData
} from "instrument/window/lists/factory";

////////////////////////////////////////////////////////////////////////////////

const CONF_DEFAULT_ENVELOPE_LIST_DURATION = 1; // 1 second

////////////////////////////////////////////////////////////////////////////////

@observer
class MasterView extends React.Component<
    {
        appStore: InstrumentAppStore;
        selectedList: BaseList | undefined;
        selectList: (list: BaseList) => void;
    },
    {}
> {
    @computed
    get sortedLists() {
        return this.props.appStore.instrumentLists
            .slice()
            .sort((a, b) => stringCompare(a.name, b.name))
            .map(list => ({
                id: list.id,
                data: list,
                selected:
                    this.props.selectedList !== undefined &&
                    list.id === this.props.selectedList.id
            }));
    }

    addList = () => {
        showGenericDialog({
            dialogDefinition: {
                fields: [
                    {
                        name: "type",
                        type: "enum",
                        enumItems: ["table", "envelope"]
                    },
                    {
                        name: "name",
                        type: "string",
                        validators: [
                            validators.required,
                            validators.unique(
                                {},
                                this.props.appStore.instrumentLists
                            )
                        ]
                    },
                    {
                        name: "description",
                        type: "string"
                    },
                    {
                        name: "duration",
                        unit: "time",
                        validators: [validators.rangeExclusive(0)],
                        visible: (values: any) => values.type === "envelope"
                    },
                    {
                        name: "numSamples",
                        displayName: "No. of samples",
                        type: "integer",
                        validators: [
                            validators.rangeInclusive(
                                1,
                                this.props.appStore.instrument!
                                    .listsMaxPointsProperty
                            )
                        ],
                        visible: (values: any) => values.type === "envelope"
                    }
                ]
            },

            values: {
                type: "table",
                name: "",
                description: "",
                duration: CONF_DEFAULT_ENVELOPE_LIST_DURATION,
                numSamples:
                    this.props.appStore.instrument!.listsMaxPointsProperty
            }
        })
            .then(async result => {
                beginTransaction("Add instrument list");
                let listId =
                    this.props.appStore.instrumentListStore.createObject({
                        type: result.values.type,
                        name: result.values.name,
                        description: result.values.description,
                        data: createEmptyListData(
                            result.values.type,
                            {
                                duration: result.values.duration,
                                numSamples: result.values.numSamples
                            },
                            this.props.appStore.instrument!
                        )
                    });
                commitTransaction();

                await this.props.appStore.navigationStore.changeSelectedListId(
                    listId
                );

                setTimeout(() => {
                    let element = document.querySelector(
                        `.EezStudio_InstrumentList_${listId}`
                    );
                    if (element) {
                        element.scrollIntoView();
                    }
                }, 10);
            })
            .catch(() => {});
    };

    removeList = () => {
        confirm("Are you sure?", undefined, () => {
            beginTransaction("Remove instrument list");
            this.props.appStore.instrumentListStore.deleteObject(
                this.props.selectedList!.toJS()
            );
            commitTransaction();
        });
    };

    render() {
        return (
            <VerticalHeaderWithBody>
                <ToolbarHeader>
                    <IconAction
                        icon="material:add"
                        iconSize={16}
                        title="Add list"
                        onClick={this.addList}
                    />
                    <IconAction
                        icon="material:delete"
                        iconSize={16}
                        title="Remove list"
                        enabled={!!this.props.selectedList}
                        onClick={this.removeList}
                    />
                </ToolbarHeader>
                <Body tabIndex={0}>
                    <ListComponent
                        nodes={this.sortedLists}
                        renderNode={node => (
                            <div
                                className={
                                    "EezStudio_InstrumentList_" + node.id
                                }
                            >
                                {node.data.name}
                            </div>
                        )}
                        selectNode={node => this.props.selectList(node.data)}
                    />
                </Body>
            </VerticalHeaderWithBody>
        );
    }
}

@observer
export class DetailsView extends React.Component<
    { list: BaseList | undefined },
    {}
> {
    render() {
        const { list } = this.props;

        const description = list && list.description;
        const modifiedAtStr =
            list && list.modifiedAt
                ? formatDateTimeLong(list.modifiedAt)
                : undefined;

        return (
            <VerticalHeaderWithBody>
                {(description || modifiedAtStr) && (
                    <Header className="EezStudio_PanelHeader EezStudio_ListHeader">
                        <Icon icon="material:comment" />{" "}
                        <span className="">{description}</span>{" "}
                        {modifiedAtStr && (
                            <span className="font-weight-light">
                                {description ? " - " : ""}Modified at{" "}
                                {modifiedAtStr}
                            </span>
                        )}
                    </Header>
                )}
                <Body>{list && list.renderDetailsView()}</Body>
            </VerticalHeaderWithBody>
        );
    }
}

@observer
export class ListsEditor extends React.Component<
    { appStore: InstrumentAppStore },
    {}
> {
    @computed
    get selectedList() {
        return this.props.appStore.instrumentLists.find(
            list =>
                list.id == this.props.appStore.navigationStore.selectedListId
        );
    }

    render() {
        return (
            <Splitter
                type="horizontal"
                sizes="240px|100%"
                persistId="instrument/lists/splitter"
            >
                <MasterView
                    appStore={this.props.appStore}
                    selectedList={this.selectedList}
                    selectList={action((list: BaseList) =>
                        this.props.appStore.navigationStore.changeSelectedListId(
                            list.id
                        )
                    )}
                />
                <DetailsView list={this.selectedList} />
            </Splitter>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

@observer
export class SelectChannelDialog extends React.Component<
    {
        label: string;
        numChannels: number;
        callback: (channelIndex: number) => void;
    },
    {}
> {
    static lastChannelIndex = 1;
    @observable channelIndex: number = SelectChannelDialog.lastChannelIndex;
    @observable inputErrors: string[] = [];

    @action.bound
    handleSubmit() {
        if (this.channelIndex <= 0) {
            this.inputErrors = ["Invalid value"];
            return false;
        }

        SelectChannelDialog.lastChannelIndex = this.channelIndex;
        this.props.callback(this.channelIndex - 1);
        return true;
    }

    render() {
        const { label } = this.props;

        // const {numChannels} = this.props;
        // const property = (
        //     <SelectProperty
        //         name={label}
        //         value={this.channelIndex.toString()}
        //         onChange={action((value: string) => (this.channelIndex = parseInt(value)))}
        //     >
        //         {_range(numChannels).map(channelIndex => (
        //             <option key={channelIndex} value={channelIndex}>
        //                 {channelIndex + 1}
        //             </option>
        //         ))}
        //     </SelectProperty>
        // );

        const property = (
            <NumberInputProperty
                name={label}
                value={this.channelIndex}
                onChange={action(value => (this.channelIndex = value))}
                min={1}
                errors={this.inputErrors}
            ></NumberInputProperty>
        );

        return (
            <Dialog onOk={this.handleSubmit}>
                <PropertyList>{property}</PropertyList>
            </Dialog>
        );
    }
}

async function selectChannel(label: string, numChannels: number) {
    return new Promise<number>(resolve => {
        showDialog(
            <SelectChannelDialog
                label={label}
                callback={resolve}
                numChannels={numChannels}
            />
        );
    });
}

////////////////////////////////////////////////////////////////////////////////

export function getCsvDataColumnDefinitions(instrument: InstrumentObject) {
    return [
        {
            id: "dwell",
            digits: instrument.listsDwellDigitsProperty
        },
        {
            id: "voltage",
            digits: instrument.listsVoltageDigitsProperty
        },
        {
            id: "current",
            digits: instrument.listsCurrentDigitsProperty
        }
    ];
}

export async function saveTableListData(
    instrument: InstrumentObject,
    listName: string,
    tableListData: ITableListData
) {
    const result = await EEZStudio.remote.dialog.showSaveDialog(
        EEZStudio.remote.getCurrentWindow(),
        {
            defaultPath: listName
                ? getValidFileNameFromFileName(listName) + ".list"
                : undefined,
            filters: [{ name: "EEZ List Files", extensions: ["list"] }]
        }
    );
    let filePath = result.filePath;
    if (filePath) {
        if (!filePath.toLowerCase().endsWith(".list")) {
            filePath += ".list";
        }

        try {
            await writeCsvFile(
                filePath,
                tableListData,
                getCsvDataColumnDefinitions(instrument)
            );
            notification.success(`List exported to "${filePath}".`);
        } catch (err) {
            error("Failed to write list file.", err.toString());
        }
    }
}

////////////////////////////////////////////////////////////////////////////////

@observer
export class ListsButtons extends React.Component<
    { appStore: InstrumentAppStore },
    {}
> {
    @computed
    get selectedList() {
        return this.props.appStore.instrumentLists.find(
            list =>
                list.id == this.props.appStore.navigationStore.selectedListId
        );
    }

    import = async () => {
        const result = await EEZStudio.remote.dialog.showOpenDialog(
            EEZStudio.remote.getCurrentWindow(),
            {
                properties: ["openFile"],
                filters: [
                    { name: "CSV Files", extensions: ["csv"] },
                    { name: "All Files", extensions: ["*"] }
                ]
            }
        );

        const filePaths = result.filePaths;
        if (filePaths && filePaths[0]) {
            let data = await readCsvFile(
                filePaths[0],
                getCsvDataColumnDefinitions(this.props.appStore.instrument!)
            );

            if (!data) {
                error("Failed to load CSV file.", undefined);
                return;
            }

            showGenericDialog({
                dialogDefinition: {
                    fields: [
                        {
                            name: "name",
                            type: "string",
                            validators: [
                                validators.required,
                                validators.unique(
                                    {},
                                    this.props.appStore.instrumentLists
                                )
                            ]
                        },
                        {
                            name: "description",
                            type: "string"
                        }
                    ]
                },

                values: {
                    name: "",
                    description: ""
                }
            })
                .then(async result => {
                    let list = createTableListFromData(
                        data,
                        this.props.appStore,
                        this.props.appStore.instrument!
                    );
                    list.name = result.values.name;
                    list.description = result.values.description;

                    beginTransaction("Import instrument list");
                    let listId =
                        this.props.appStore.instrumentListStore.createObject(
                            list.toJS()
                        );
                    commitTransaction();

                    await this.props.appStore.navigationStore.changeSelectedListId(
                        listId
                    );

                    setTimeout(() => {
                        let element = document.querySelector(
                            `.EezStudio_InstrumentList_${listId}`
                        );
                        if (element) {
                            element.scrollIntoView();
                        }
                    }, 10);
                })
                .catch(() => {});
        }
    };

    export = () => {
        if (this.selectedList) {
            saveTableListData(
                this.props.appStore.instrument!,
                this.selectedList.name,
                this.selectedList.tableListData
            );
        }
    };

    get numChannels(): number {
        const channels = this.props.appStore.instrument!.channelsProperty;
        if (channels) {
            return channels.length;
        }
        return DEFAULT_INSTRUMENT_PROPERTIES.properties.channels!.length;
    }

    getList = async () => {
        let channelIndex = await selectChannel(
            "Get list from channel:",
            this.numChannels
        );

        let listData, logId: string;
        try {
            ({ listData, logId } = await getList(
                this.props.appStore.history.oid,
                channelIndex
            ));
        } catch (err) {
            notification.error(`Failed to get list: ${err.toString()}`);
            return;
        }

        const tableListData = Object.assign({}, listData[0]);
        const tableList = createTableListFromData(
            tableListData,
            this.props.appStore,
            this.props.appStore.instrument!
        );

        showGenericDialog({
            dialogDefinition: {
                fields: [
                    {
                        name: "name",
                        type: "string",
                        validators: [
                            validators.required,
                            validators.unique(
                                {},
                                this.props.appStore.instrumentLists
                            )
                        ]
                    },
                    {
                        name: "description",
                        type: "string"
                    }
                ]
            },

            values: {
                name: "",
                description: ""
            }
        })
            .then(async result => {
                tableList.name = result.values.name;
                tableList.description = result.values.description;

                beginTransaction("Get instrument list");
                let listId =
                    this.props.appStore.instrumentListStore.createObject(
                        tableList.toJS()
                    );
                commitTransaction();

                await this.props.appStore.navigationStore.changeSelectedListId(
                    listId
                );

                setTimeout(() => {
                    let element = document.querySelector(
                        `.EezStudio_InstrumentList_${listId}`
                    );
                    if (element) {
                        element.scrollIntoView();
                    }
                }, 10);

                // set list name in activity log
                let activityLog = logGet(
                    this.props.appStore.history.options.store,
                    logId
                );

                let message = JSON.parse(activityLog.message);
                message.listName = tableList.name;
                activityLog.message = JSON.stringify(message);

                logUpdate(
                    this.props.appStore.history.options.store,
                    activityLog,
                    {
                        undoable: false
                    }
                );
            })
            .catch(() => {});
    };

    sendList = async () => {
        if (this.selectedList) {
            let channelIndex = await selectChannel(
                "Send list to channel:",
                this.numChannels
            );
            const channel = this.selectedList.tableListData;
            try {
                await sendList(
                    this.props.appStore.history.oid,
                    channelIndex,
                    this.selectedList.name,
                    {
                        dwell: toJS(channel.dwell),
                        current: toJS(channel.current),
                        voltage: toJS(channel.voltage)
                    }
                );
                notification.success(`List sent.`);
            } catch (err) {
                notification.error(`Failed to send list: ${err.toString()}`);
            }
        }
    };

    updateModifedAt() {
        const list = this.selectedList;
        if (list) {
            let oldModifiedAt = list.modifiedAt;
            let newModifedAt = new Date();
            list.$eez_noser_appStore.undoManager.addCommand(
                "Set list modifiedAt",
                list.$eez_noser_appStore.instrumentListStore,
                list,
                {
                    execute: action(() => {
                        list.modifiedAt = newModifedAt;
                    }),
                    undo: action(() => {
                        list.modifiedAt = oldModifiedAt;
                    })
                }
            );
        }
    }

    render() {
        return (
            <React.Fragment>
                {this.props.appStore.undoManager.modified && (
                    <ButtonAction
                        text="Save"
                        icon="material:save"
                        className="btn-secondary"
                        title="Save changes"
                        onClick={() => {
                            this.updateModifedAt();
                            this.props.appStore.undoManager.commit();
                        }}
                    />
                )}
                <ButtonAction
                    key="import"
                    text="Import"
                    title="Import list from file"
                    className="btn-secondary"
                    onClick={this.import}
                />
                <ButtonAction
                    key="export"
                    text="Export"
                    title="Export list to file"
                    className="btn-secondary"
                    enabled={this.selectedList !== undefined}
                    onClick={this.export}
                />
                <ButtonAction
                    key="get"
                    text="Get"
                    title="Get list from instrument channel"
                    className="btn-secondary"
                    enabled={
                        this.props.appStore.instrument!.connection.isConnected
                    }
                    onClick={this.getList}
                />
                <ButtonAction
                    key="send"
                    text="Send"
                    title="Send list to instrument channel"
                    className="btn-secondary"
                    enabled={
                        this.props.appStore.instrument!.connection
                            .isConnected && this.selectedList !== undefined
                    }
                    onClick={this.sendList}
                />
            </React.Fragment>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

export function render(appStore: InstrumentAppStore) {
    return <ListsEditor appStore={appStore} />;
}

export function toolbarButtonsRender(appStore: InstrumentAppStore) {
    return appStore.instrument ? <ListsButtons appStore={appStore} /> : <div />;
}
