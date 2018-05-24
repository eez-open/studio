import * as React from "react";
import { observable, computed, action, runInAction, toJS, values } from "mobx";
import { observer } from "mobx-react";
import { bind } from "bind-decorator";

import { logGet, logUpdate } from "shared/activity-log";
import { readCsvFile, writeCsvFile, getValidFileNameFromFileName } from "shared/util";
import { stringCompare } from "shared/string";
import { beginTransaction, commitTransaction } from "shared/store";
import { _range } from "shared/algorithm";

import { validators } from "shared/model/validation";

import { Icon } from "shared/ui/icon";
import { Container } from "shared/ui/container";
import { Splitter } from "shared/ui/splitter";
import { VerticalHeaderWithBody, ToolbarHeader, Header, Body } from "shared/ui/header-with-body";
import { IconAction, ButtonAction } from "shared/ui/action";
import { List as ListComponent } from "shared/ui/list";
import { Dialog, showDialog, error, confirm } from "shared/ui/dialog";
import { showGenericDialog } from "shared/ui/generic-dialog";
import * as notification from "shared/ui/notification";
import { PropertyList, SelectProperty } from "shared/ui/properties";

import { DEFAULT_INSTRUMENT_PROPERTIES } from "instrument/import";
import { InstrumentObject } from "instrument/instrument-object";

import { appStore } from "instrument/window/app-store";
import { navigationStore } from "instrument/window/app";
import { undoManager } from "instrument/window/undo";

import { getList, sendList } from "instrument/connection/list-operations";

import { instrumentListStore } from "instrument/window/lists/store";
import { BaseList, instrumentLists, ITableListData } from "instrument/window/lists/store-renderer";
import { createEmptyListData, createTableListFromData } from "instrument/window/lists/factory";

////////////////////////////////////////////////////////////////////////////////

const CONF_DEFAULT_ENVELOPE_LIST_DURATION = 1; // 1 second

////////////////////////////////////////////////////////////////////////////////

@observer
class MasterView extends React.Component<
    {
        selectedList: BaseList | undefined;
        selectList: (list: BaseList) => void;
    },
    {}
> {
    constructor(props: any) {
        super(props);

        this.removeList = this.removeList.bind(this);
    }

    @computed
    get sortedLists() {
        return Array.from(instrumentLists.values())
            .sort((a, b) => stringCompare(a.name, b.name))
            .map(list => ({
                id: list.id,
                data: list,
                selected:
                    this.props.selectedList !== undefined && list.id === this.props.selectedList.id
            }));
    }

    addList() {
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
                            validators.unique({}, values(instrumentLists))
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
                                appStore.instrument!.getListsMaxPointsProperty()
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
                numSamples: appStore.instrument!.getListsMaxPointsProperty()
            }
        })
            .then(result => {
                beginTransaction("Add instrument list");
                let listId = instrumentListStore.createObject({
                    type: result.values.type,
                    name: result.values.name,
                    description: result.values.description,
                    data: createEmptyListData(result.values.type, {
                        duration: result.values.duration,
                        numSamples: result.values.numSamples
                    })
                });
                commitTransaction();

                navigationStore.selectedListId = listId;

                setTimeout(() => {
                    let element = document.querySelector(`.EezStudio_InstrumentList_${listId}`);
                    if (element) {
                        element.scrollIntoView();
                    }
                }, 10);
            })
            .catch(() => {});
    }

    removeList() {
        confirm("Are you sure?", undefined, () => {
            beginTransaction("Remove instrument list");
            instrumentListStore.deleteObject(toJS(this.props.selectedList));
            commitTransaction();
        });
    }

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
                        icon="material:remove"
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
                            <div className={"EezStudio_InstrumentList_" + node.id}>
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
export class DetailsView extends React.Component<{ list: BaseList | undefined }, {}> {
    render() {
        const { list } = this.props;
        const description = list && list.description;
        return (
            <VerticalHeaderWithBody>
                {description && (
                    <Header className="EezStudio_ListEditor_ListDescription">
                        <Icon icon="material:comment" /> {description}
                    </Header>
                )}
                <Body>{list && list.renderDetailsView()}</Body>
            </VerticalHeaderWithBody>
        );
    }
}

@observer
export class ListsEditor extends React.Component<{ instrument: InstrumentObject }, {}> {
    @computed
    get selectedList() {
        return navigationStore.selectedListId
            ? instrumentLists.get(navigationStore.selectedListId)
            : undefined;
    }

    render() {
        return (
            <Container>
                <Splitter
                    type="horizontal"
                    sizes="240px|100%"
                    persistId="instrument/lists/splitter"
                >
                    <MasterView
                        selectedList={this.selectedList}
                        selectList={action(
                            (list: BaseList) => (navigationStore.selectedListId = list.id)
                        )}
                    />
                    <DetailsView list={this.selectedList} />
                </Splitter>
            </Container>
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
    @observable channelIndex: number = 0;

    @bind
    handleSubmit() {
        this.props.callback(this.channelIndex);
        return true;
    }

    render() {
        const { label, numChannels } = this.props;

        return (
            <Dialog onOk={this.handleSubmit}>
                <PropertyList>
                    <SelectProperty
                        name={label}
                        value={this.channelIndex.toString()}
                        onChange={action((value: string) => (this.channelIndex = parseInt(value)))}
                    >
                        {_range(numChannels).map(channelIndex => (
                            <option key={channelIndex} value={channelIndex}>
                                {channelIndex + 1}
                            </option>
                        ))}
                    </SelectProperty>
                </PropertyList>
            </Dialog>
        );
    }
}

async function selectChannel(label: string, numChannels: number) {
    return new Promise<number>(resolve => {
        showDialog(
            <SelectChannelDialog label={label} callback={resolve} numChannels={numChannels} />
        );
    });
}

////////////////////////////////////////////////////////////////////////////////

function getCsvDataColumnDefinitions() {
    return [
        {
            id: "dwell",
            digits: appStore.instrument!.getListsDwellDigitsProperty()
        },
        {
            id: "voltage",
            digits: appStore.instrument!.getListsVoltageDigitsProperty()
        },
        {
            id: "current",
            digits: appStore.instrument!.getListsCurrentDigitsProperty()
        }
    ];
}

export function saveTableListData(listName: string, tableListData: ITableListData) {
    EEZStudio.electron.remote.dialog.showSaveDialog(
        EEZStudio.electron.remote.getCurrentWindow(),
        {
            defaultPath: getValidFileNameFromFileName(listName) + ".csv",
            filters: [{ name: "CSV Files", extensions: ["csv"] }]
        },
        async filePath => {
            if (filePath) {
                try {
                    await writeCsvFile(filePath, tableListData, getCsvDataColumnDefinitions());
                    notification.success(`List exported to "${filePath}".`);
                } catch (err) {
                    error("Failed to write CSV file.", err.toString());
                }
            }
        }
    );
}

////////////////////////////////////////////////////////////////////////////////

@observer
export class ListsButtons extends React.Component<{ instrument: InstrumentObject }, {}> {
    @computed
    get selectedList() {
        return navigationStore.selectedListId
            ? instrumentLists.get(navigationStore.selectedListId)
            : undefined;
    }

    @bind
    import() {
        EEZStudio.electron.remote.dialog.showOpenDialog(
            EEZStudio.electron.remote.getCurrentWindow(),
            {
                properties: ["openFile"],
                filters: [
                    { name: "CSV Files", extensions: ["csv"] },
                    { name: "All Files", extensions: ["*"] }
                ]
            },
            async filePaths => {
                if (filePaths && filePaths[0]) {
                    let data = await readCsvFile(filePaths[0], getCsvDataColumnDefinitions());

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
                                        validators.unique({}, values(instrumentLists))
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
                        .then(result => {
                            let list = createTableListFromData(data);
                            list.name = result.values.name;
                            list.description = result.values.description;

                            beginTransaction("Import instrument list");
                            let listId = instrumentListStore.createObject(toJS(list));
                            commitTransaction();

                            runInAction(() => (navigationStore.selectedListId = listId));

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
            }
        );
    }

    @bind
    export() {
        if (this.selectedList) {
            saveTableListData(this.selectedList.name, this.selectedList.tableListData);
        }
    }

    get numChannels(): number {
        const channels = this.props.instrument.getChannelsProperty();
        if (channels) {
            return channels.length;
        }
        return DEFAULT_INSTRUMENT_PROPERTIES.properties.channels!.length;
    }

    @bind
    async getList() {
        let channelIndex = await selectChannel("Get list from channel:", this.numChannels);

        let listData, logId: string;
        try {
            ({ listData, logId } = await getList(this.props.instrument.id, channelIndex));
        } catch (err) {
            notification.error(`Failed to get list: ${err.toString()}`);
            return;
        }

        const tableListData = Object.assign({}, listData[0]);
        const tableList = createTableListFromData(tableListData);

        showGenericDialog({
            dialogDefinition: {
                fields: [
                    {
                        name: "name",
                        type: "string",
                        validators: [
                            validators.required,
                            validators.unique({}, values(instrumentLists))
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
            .then(result => {
                tableList.name = result.values.name;
                tableList.description = result.values.description;

                beginTransaction("Get instrument list");
                let listId = instrumentListStore.createObject(toJS(tableList));
                commitTransaction();

                runInAction(() => (navigationStore.selectedListId = listId));

                setTimeout(() => {
                    let element = document.querySelector(`.EezStudio_InstrumentList_${listId}`);
                    if (element) {
                        element.scrollIntoView();
                    }
                }, 10);

                // set list name in activity log
                let activityLog = logGet(logId);

                let message = JSON.parse(activityLog.message);
                message.listName = tableList.name;
                activityLog.message = JSON.stringify(message);

                logUpdate(activityLog, {
                    undoable: false
                });
            })
            .catch(() => {});
    }

    @bind
    async sendList() {
        if (this.selectedList) {
            let channelIndex = await selectChannel("Send list to channel:", this.numChannels);
            const channel = this.selectedList.tableListData;
            try {
                await sendList(
                    this.props.instrument.id,
                    channelIndex,
                    this.selectedList.name,
                    toJS(channel)
                );
                notification.success(`List sent.`);
            } catch (err) {
                notification.error(`Failed to send list: ${err.toString()}`);
            }
        }
    }

    render() {
        return (
            <React.Fragment>
                {undoManager.modified && (
                    <ButtonAction
                        text="Save"
                        icon="material:save"
                        className="btn-secondary"
                        title="Save changes"
                        onClick={undoManager.commit}
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
                    title="Get list from instrument"
                    className="btn-secondary"
                    enabled={this.props.instrument.connection.isConnected}
                    onClick={this.getList}
                />
                <ButtonAction
                    key="send"
                    text="Send"
                    title="Send list to instrument"
                    className="btn-secondary"
                    enabled={
                        this.props.instrument.connection.isConnected &&
                        this.selectedList !== undefined
                    }
                    onClick={this.sendList}
                />
            </React.Fragment>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

export function render(instrument: InstrumentObject) {
    return <ListsEditor instrument={instrument} />;
}

export function toolbarButtonsRender(instrument: InstrumentObject) {
    return <ListsButtons instrument={instrument} />;
}
