import React from "react";
import {
    observable,
    computed,
    action,
    runInAction,
    reaction,
    toJS,
    makeObservable,
    IReactionDisposer
} from "mobx";
import { observer } from "mobx-react";

import { objectEqual, formatDateTimeLong } from "eez-studio-shared/util";
import {
    beginTransaction,
    commitTransaction,
    IStore
} from "eez-studio-shared/store";
import { TIME_UNIT } from "eez-studio-shared/units";

import { Dialog, showDialog } from "eez-studio-ui/dialog";
import {
    TextInputProperty,
    ColorInputProperty,
    PropertyList,
    SelectFromListProperty
} from "eez-studio-ui/properties";
import { IListNode, ListItem } from "eez-studio-ui/list";
import { Icon } from "eez-studio-ui/icon";

import {
    ChartMode,
    IAxisModel,
    ChartsController,
    MeasurementsModel,
    IChartsController
} from "eez-studio-ui/chart/chart";
import { RulersModel, IRulersModel } from "eez-studio-ui/chart/rulers";

import {
    logUpdate,
    IActivityLogEntry,
    activityLogStore,
    getHistoryItemById
} from "instrument/window/history/activity-log";

import { ChartPreview } from "instrument/window/chart-preview";

import { HistoryItem } from "instrument/window/history/item";

import type { Waveform } from "instrument/window/waveform/generic";
import { WaveformDefinitionProperties } from "instrument/window/waveform/WaveformDefinitionProperties";
import { WaveformAxisModel } from "instrument/window/waveform/WaveformAxisModel";
import { ViewOptions } from "instrument/window/waveform/ViewOptions";
import { WaveformTimeAxisModel } from "instrument/window/waveform/time-axis";
import { WaveformToolbar } from "instrument/window/waveform/toolbar";
import type { ChartsDisplayOption } from "instrument/window/lists/common-tools";
import type { IAppStore } from "instrument/window/history/history";

////////////////////////////////////////////////////////////////////////////////

export type IWaveformLink = {
    id: string;
    label: string;
    color: string;
    colorInverse: string;
};

////////////////////////////////////////////////////////////////////////////////

export class MultiWaveformChartsController extends ChartsController {
    constructor(
        public multiWaveform: MultiWaveform,
        mode: ChartMode,
        xAxisModel: IAxisModel,
        viewOptions: ViewOptions
    ) {
        super(mode, xAxisModel, viewOptions);
    }

    get chartViewOptionsProps() {
        return {
            showRenderAlgorithm: true,
            showShowSampledDataOption: false
        };
    }

    get supportRulers() {
        return true;
    }

    isMultiWaveformChartsController = true;
}

////////////////////////////////////////////////////////////////////////////////

export const ChartHistoryItemComponent = observer(
    class ChartHistoryItemComponent extends React.Component<{
        appStore: IAppStore;
        historyItem: MultiWaveform;
    }> {
        setVisibleTimeoutId: any;

        render() {
            return (
                <div className="EezStudio_ChartHistoryItem">
                    <Icon
                        className="me-3"
                        icon={"material:insert_chart"}
                        size={48}
                    />
                    <div>
                        <p>
                            <small className="EezStudio_HistoryItemDate">
                                {formatDateTimeLong(
                                    this.props.historyItem.date
                                )}
                            </small>
                        </p>
                        <ChartPreview
                            appStore={this.props.appStore}
                            data={this.props.historyItem}
                        />
                    </div>
                </div>
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

interface ILinkedWaveform {
    waveformLink: IWaveformLink;
    waveform: Waveform;
    yAxisModel: IAxisModel;
}

export class MultiWaveform extends HistoryItem {
    dispose1: IReactionDisposer | undefined;
    dispose2: IReactionDisposer | undefined;
    dispose3: IReactionDisposer | undefined;
    dispose4: IReactionDisposer | undefined;

    constructor(store: IStore, activityLogEntry: IActivityLogEntry) {
        super(store, activityLogEntry);

        makeObservable(this, {
            waveformLinks: observable,
            messageObject: computed,
            measurements: computed,
            linkedWaveforms: computed,
            longestWaveform: computed,
            xAxisUnit: computed,
            samplingRate: computed,
            length: computed
        });

        const message = JSON.parse(this.message);

        this.waveformLinks = message.waveformLinks || message;

        // update waveformLinks when message changes
        this.dispose1 = reaction(
            () => ({
                message: JSON.parse(this.message),
                waveformLinks: toJS(this.waveformLinks)
            }),
            arg => {
                if (
                    !objectEqual(arg.message.waveformLinks, arg.waveformLinks)
                ) {
                    runInAction(
                        () => (this.waveformLinks = arg.message.waveformLinks)
                    );
                }
            }
        );

        this.viewOptions = new ViewOptions(
            message.viewOptions || this.linkedWaveforms[0].waveform.viewOptions
        );

        // save viewOptions when changed
        this.dispose2 = reaction(
            () => ({
                message: JSON.parse(this.message),
                viewOptions: toJS(this.viewOptions)
            }),
            arg => {
                if (!objectEqual(arg.message.viewOptions, arg.viewOptions)) {
                    logUpdate(
                        activityLogStore,
                        {
                            id: this.id,
                            oid: this.oid,
                            message: JSON.stringify(
                                Object.assign(arg.message, {
                                    viewOptions: arg.viewOptions
                                })
                            )
                        },
                        {
                            undoable: false
                        }
                    );
                }
            }
        );

        this.rulers = new RulersModel(message.rulers);
        this.rulers.initYRulers(this.waveformLinks.length);

        // save rulers when changed
        this.dispose3 = reaction(
            () => toJS(this.rulers),
            rulers => {
                if (rulers.pauseDbUpdate) {
                    return;
                }
                delete rulers.pauseDbUpdate;

                const message = JSON.parse(this.message);
                if (!objectEqual(message.rulers, rulers)) {
                    logUpdate(
                        activityLogStore,
                        {
                            id: this.id,
                            oid: this.oid,
                            message: JSON.stringify(
                                Object.assign(message, {
                                    rulers
                                })
                            )
                        },
                        {
                            undoable: false
                        }
                    );
                }
            }
        );

        // save measurements when changed
        this.dispose4 = reaction(
            () => toJS(this.measurements),
            measurements => {
                const message = JSON.parse(this.message);
                if (!objectEqual(message.measurements, measurements)) {
                    const messageStr = JSON.stringify(
                        Object.assign(message, {
                            measurements
                        })
                    );
                    runInAction(() => (this.message = messageStr));
                    logUpdate(
                        activityLogStore,
                        {
                            id: this.id,
                            oid: this.oid,
                            message: messageStr
                        },
                        {
                            undoable: false
                        }
                    );
                }
            }
        );
    }

    xAxisModel = new WaveformTimeAxisModel(this);

    waveformLinks: IWaveformLink[];

    viewOptions: ViewOptions;

    rulers: IRulersModel;

    get messageObject() {
        return JSON.parse(this.message);
    }

    get measurements() {
        return new MeasurementsModel(this.messageObject.measurements);
    }

    get linkedWaveforms() {
        return this.waveformLinks
            .map(waveformLink => {
                const waveform = getHistoryItemById(
                    this.store,
                    waveformLink.id
                )! as Waveform;
                return {
                    waveformLink,
                    waveform,
                    yAxisModel: new WaveformAxisModel(waveform, waveformLink)
                };
            })
            .filter(waveformLink => !!waveformLink.waveform);
    }

    get longestWaveform() {
        let longestWaveform;
        let maxTime;
        for (let i = 0; i < this.linkedWaveforms.length; i++) {
            const waveform = this.linkedWaveforms[i].waveform;
            let time = waveform.length / waveform.samplingRate;
            if (maxTime === undefined || time > maxTime) {
                longestWaveform = waveform;
                maxTime = time;
            }
        }
        return longestWaveform;
    }

    get xAxisUnit() {
        return TIME_UNIT;
    }

    get samplingRate() {
        return this.longestWaveform ? this.longestWaveform.samplingRate : 1;
    }

    get length() {
        return this.longestWaveform ? this.longestWaveform.length : 0;
    }

    chartsController: ChartsController;

    createChartsController(
        appStore: IAppStore,
        displayOption: ChartsDisplayOption,
        mode: ChartMode
    ): ChartsController {
        if (this.chartsController) {
            this.chartsController.destroy();
        }

        const chartsController = new MultiWaveformChartsController(
            this,
            mode,
            this.xAxisModel,
            this.viewOptions
        );
        this.chartsController = chartsController;

        this.xAxisModel.chartsController = chartsController;

        chartsController.chartControllers = this.linkedWaveforms.map(
            (linkedWaveform: ILinkedWaveform, i: number) => {
                const chartController =
                    linkedWaveform.waveform.createChartController(
                        chartsController,
                        linkedWaveform.waveform.id,
                        linkedWaveform.yAxisModel
                    );

                return chartController;
            }
        );

        chartsController.createRulersController(this.rulers);
        chartsController.createMeasurementsController(this.measurements);

        return chartsController;
    }

    renderToolbar(chartsController: IChartsController): React.ReactNode {
        return (
            <WaveformToolbar
                chartsController={chartsController}
                waveform={this}
            />
        );
    }

    openConfigurationDialog() {
        showDialog(<MultiWaveformConfigurationDialog multiWaveform={this} />);
    }

    get xAxisDefaultSubdivisionOffset(): number | undefined {
        return this.linkedWaveforms[0].waveform.xAxisDefaultSubdivisionOffset;
    }

    get xAxisDefaultSubdivisionScale() {
        return this.linkedWaveforms[0].waveform.xAxisDefaultSubdivisionScale;
    }

    getListItemElement(appStore: IAppStore): React.ReactNode {
        return (
            <ChartHistoryItemComponent appStore={appStore} historyItem={this} />
        );
    }

    isZoomable = true;

    override dispose() {
        super.dispose();

        if (this.dispose1) {
            this.dispose1();
        }

        if (this.dispose2) {
            this.dispose2();
        }

        if (this.dispose3) {
            this.dispose3();
        }

        if (this.dispose4) {
            this.dispose4();
        }
    }
}

////////////////////////////////////////////////////////////////////////////////

class WaveformLinkProperties {
    constructor(public linkedWaveform: ILinkedWaveform) {
        makeObservable(this, {
            props: observable,
            errors: observable
        });

        this.props = Object.assign(
            {
                label: this.linkedWaveform.yAxisModel.label,
                color: this.linkedWaveform.yAxisModel.color,
                colorInverse: this.linkedWaveform.yAxisModel.colorInverse
            },
            this.linkedWaveform.waveformLink
        );
    }

    props: IWaveformLink;
    errors: boolean = false;

    async checkValidity() {
        return true;
    }

    render() {
        return [
            <TextInputProperty
                key="label"
                name="Label"
                value={this.props.label || ""}
                onChange={action((value: string) => (this.props.label = value))}
            />,
            <ColorInputProperty
                key="color"
                name="Color"
                value={this.props.color || "#ffffff"}
                onChange={action((value: string) => (this.props.color = value))}
            />,
            <ColorInputProperty
                key="colorInverse"
                name="Color inverse"
                value={this.props.colorInverse || "#000000"}
                onChange={action(
                    (value: string) => (this.props.colorInverse = value)
                )}
            />
        ];
    }
}

////////////////////////////////////////////////////////////////////////////////

interface IJoinedWaveformLinkAndDefinitionProperties {
    linkedWaveform: ILinkedWaveform;
    waveformLinkProperties: WaveformLinkProperties;
    waveformDefinitionProperties: WaveformDefinitionProperties;
}

const MultiWaveformConfigurationDialog = observer(
    class MultiWaveformConfigurationDialog extends React.Component<{
        multiWaveform: MultiWaveform;
    }> {
        waveforms: IJoinedWaveformLinkAndDefinitionProperties[] =
            this.props.multiWaveform.linkedWaveforms.map(
                (linkedWaveform: ILinkedWaveform, i: number) => {
                    return {
                        linkedWaveform,
                        waveformLinkProperties: new WaveformLinkProperties(
                            linkedWaveform
                        ),
                        waveformDefinitionProperties:
                            new WaveformDefinitionProperties(
                                linkedWaveform.waveform.waveformDefinition
                            )
                    };
                }
            );

        selectedWaveform: IJoinedWaveformLinkAndDefinitionProperties =
            this.waveforms[0];

        constructor(props: any) {
            super(props);

            makeObservable(this, {
                waveforms: observable,
                selectedWaveform: observable.shallow,
                waveformListNodes: computed,
                selectWaveform: action.bound
            });
        }

        get waveformListNodes(): IListNode[] {
            return this.waveforms.map(
                joinedWaveformLinkAndDefinitionProperties => ({
                    id: joinedWaveformLinkAndDefinitionProperties.linkedWaveform
                        .waveformLink.id,
                    data: joinedWaveformLinkAndDefinitionProperties,
                    selected:
                        joinedWaveformLinkAndDefinitionProperties ===
                        this.selectedWaveform
                })
            );
        }

        renderWaveformListNode = (node: IListNode) => {
            let waveformLinkProperties =
                node.data as IJoinedWaveformLinkAndDefinitionProperties;

            const errors =
                waveformLinkProperties.waveformLinkProperties.errors ||
                (waveformLinkProperties.waveformDefinitionProperties &&
                    waveformLinkProperties.waveformDefinitionProperties.errors);

            return (
                <ListItem
                    label={
                        waveformLinkProperties.waveformLinkProperties.props
                            .label || "<no label>"
                    }
                    rightIcon={errors ? "material:error_outline" : undefined}
                    rightIconClassName="text-danger"
                />
            );
        };

        selectWaveform(node: IListNode) {
            this.selectedWaveform = node.data;
        }

        handleSubmit = async () => {
            let anyError = false;

            for (let i = 0; i < this.waveforms.length; i++) {
                const waveformLinkProperties = this.waveforms[i];

                if (
                    !(await waveformLinkProperties.waveformLinkProperties.checkValidity())
                ) {
                    anyError = true;
                }

                const waveformProperties =
                    waveformLinkProperties.waveformDefinitionProperties;
                if (waveformProperties) {
                    if (!(await waveformProperties.checkValidity())) {
                        anyError = true;
                    }
                }
            }

            if (anyError) {
                return false;
            }

            const changedHistoryItems: {
                id: string;
                oid: string;
                message: string;
            }[] = [];

            // update chart history item (if changed)
            const waveformLinks = this.waveforms.map(
                joinedWaveformLinkAndDefinitionProperties => ({
                    id: joinedWaveformLinkAndDefinitionProperties.linkedWaveform
                        .waveformLink.id,
                    label: joinedWaveformLinkAndDefinitionProperties
                        .waveformLinkProperties.props.label,
                    color: joinedWaveformLinkAndDefinitionProperties
                        .waveformLinkProperties.props.color,
                    colorInverse:
                        joinedWaveformLinkAndDefinitionProperties
                            .waveformLinkProperties.props.colorInverse
                })
            );
            if (
                !objectEqual(
                    waveformLinks,
                    this.waveforms.map(x => x.linkedWaveform.waveformLink)
                )
            ) {
                const multiWaveformHistoryItemMessage = Object.assign(
                    JSON.parse(this.props.multiWaveform.message),
                    {
                        waveformLinks
                    }
                );

                changedHistoryItems.push({
                    id: this.props.multiWaveform.id,
                    oid: this.props.multiWaveform.oid,
                    message: JSON.stringify(multiWaveformHistoryItemMessage)
                });
            }

            // update waveform history item's (if changed)
            this.waveforms.forEach(
                joinedWaveformLinkAndDefinitionProperties => {
                    const waveformHistoryItemMessage = JSON.parse(
                        joinedWaveformLinkAndDefinitionProperties.linkedWaveform
                            .waveform.message
                    );

                    if (
                        !objectEqual(
                            joinedWaveformLinkAndDefinitionProperties
                                .waveformDefinitionProperties.propsValidated,
                            waveformHistoryItemMessage.waveformDefinition
                        )
                    ) {
                        const newWaveformHistoryItemMessage = Object.assign(
                            waveformHistoryItemMessage,
                            {
                                waveformDefinition:
                                    joinedWaveformLinkAndDefinitionProperties
                                        .waveformDefinitionProperties
                                        .propsValidated
                            }
                        );

                        changedHistoryItems.push({
                            id: joinedWaveformLinkAndDefinitionProperties
                                .linkedWaveform.waveform.id,
                            oid: joinedWaveformLinkAndDefinitionProperties
                                .linkedWaveform.waveform.oid,
                            message: JSON.stringify(
                                newWaveformHistoryItemMessage
                            )
                        });
                    }
                }
            );

            if (changedHistoryItems.length > 0) {
                beginTransaction("Edit chart configuration");

                changedHistoryItems.forEach(changedHistoryItem => {
                    logUpdate(activityLogStore, changedHistoryItem, {
                        undoable: true
                    });
                });

                commitTransaction();
            }

            return true;
        };

        render() {
            return (
                <Dialog size="medium" onOk={this.handleSubmit}>
                    <div className="EezStudio_MultiWaveformConfigurationDialogBody">
                        <PropertyList>
                            <SelectFromListProperty
                                nodes={this.waveformListNodes}
                                renderNode={this.renderWaveformListNode}
                                onChange={this.selectWaveform}
                            />
                        </PropertyList>
                        <PropertyList>
                            {this.selectedWaveform.waveformLinkProperties.render()}
                            {this.selectedWaveform
                                .waveformDefinitionProperties &&
                                this.selectedWaveform.waveformDefinitionProperties.render()}
                        </PropertyList>
                    </div>
                </Dialog>
            );
        }
    }
);
