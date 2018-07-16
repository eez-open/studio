import * as React from "react";
import { observable, computed, action, reaction, toJS } from "mobx";
import { observer } from "mobx-react";
import { bind } from "bind-decorator";
import * as VisibilitySensor from "react-visibility-sensor";

import { objectEqual, objectClone, formatDateTimeLong } from "shared/util";
import { beginTransaction, commitTransaction } from "shared/store";
import { logUpdate, IActivityLogEntry } from "shared/activity-log";

import { Dialog, showDialog } from "shared/ui/dialog";
import {
    TextInputProperty,
    ColorInputProperty,
    PropertyList,
    SelectFromListProperty
} from "shared/ui/properties";
import { IListNode, ListItem } from "shared/ui/list";
import { ChartMode, ChartsController, IAxisModel } from "shared/ui/chart/chart";
import { Icon } from "shared/ui/icon";

import { AppStore } from "instrument/window/app-store";
import { ChartPreview } from "instrument/window/chart-preview";

import { HistoryItem } from "instrument/window/history/item";

import {
    Waveform,
    WaveformDefinitionProperties,
    WaveformAxisModel,
    ViewOptions
} from "instrument/window/waveform/generic";
import { WaveformTimeAxisModel } from "instrument/window/waveform/time-axis";
import { WaveformToolbar } from "instrument/window/waveform/toolbar";

////////////////////////////////////////////////////////////////////////////////

export type IWaveformLink = {
    id: string;
    label: string;
    color: string;
    colorInverse: string;
};

type IMultiWaveformHistoryItemMessage = {
    waveformLinks: IWaveformLink[];
    viewOptions: ViewOptions;
};

////////////////////////////////////////////////////////////////////////////////

class MultiWaveformChartsController extends ChartsController {
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
}

////////////////////////////////////////////////////////////////////////////////

@observer
export class ChartHistoryItemComponent extends React.Component<
    {
        historyItem: MultiWaveform;
    },
    {}
> {
    @action.bound
    onVisibilityChange(isVisible: boolean) {
        this.props.historyItem.isVisible = isVisible;
    }

    render() {
        return (
            <VisibilitySensor partialVisibility={true} onChange={this.onVisibilityChange}>
                <div className="EezStudio_HistoryItem EezStudio_HistoryItem_Chart">
                    <Icon className="mr-3" icon={"material:insert_chart"} size={48} />
                    <div>
                        <p>
                            <small className="EezStudio_HistoryItemDate text-muted">
                                {formatDateTimeLong(this.props.historyItem.date)}
                            </small>
                        </p>
                        <ChartPreview data={this.props.historyItem} />
                    </div>
                </div>
            </VisibilitySensor>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

interface ILinkedWaveform {
    waveformLink: IWaveformLink;
    waveform: Waveform;
    yAxisModel: IAxisModel;
}

export class MultiWaveform extends HistoryItem {
    constructor(activityLogEntry: IActivityLogEntry, appStore: AppStore) {
        super(activityLogEntry, appStore);

        // save viewOptions when changed
        reaction(
            () => ({
                message: JSON.parse(this.message),
                viewOptions: toJS(this.viewOptions)
            }),
            arg => {
                if (!objectEqual(arg.message.viewOptions, arg.viewOptions)) {
                    console.log("UPDATED viewOptions");
                    logUpdate(
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
    }

    xAxisModel = new WaveformTimeAxisModel(this);

    @computed
    get parsedMessage() {
        return JSON.parse(this.message);
    }

    @computed
    get waveformLinks(): IWaveformLink[] {
        return this.parsedMessage.waveformLinks || this.parsedMessage;
    }

    @computed
    get linkedWaveforms() {
        return this.waveformLinks
            .map(waveformLink => {
                const waveform = this.appStore!.history.getHistoryItemById(
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

    @computed
    get viewOptions(): ViewOptions {
        return new ViewOptions(
            this.parsedMessage.viewOptions || this.linkedWaveforms[0].waveform.viewOptions
        );
    }

    @computed
    get multiWaveformHistoryItemMessage(): IMultiWaveformHistoryItemMessage {
        return {
            waveformLinks: this.waveformLinks,
            viewOptions: this.viewOptions
        };
    }

    @computed
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

    @computed
    get samplingRate() {
        return this.longestWaveform ? this.longestWaveform.samplingRate : 1;
    }

    @computed
    get length() {
        return this.longestWaveform ? this.longestWaveform.length : 0;
    }

    createChartsController(mode: ChartMode): ChartsController {
        const chartsController = new MultiWaveformChartsController(
            this,
            mode,
            this.xAxisModel,
            this.viewOptions
        );

        this.xAxisModel.chartsController = chartsController;

        chartsController.chartControllers = this.linkedWaveforms.map(
            (linkedWaveform: ILinkedWaveform, i: number) => {
                return linkedWaveform.waveform.createChartController(
                    chartsController,
                    linkedWaveform.waveform.id,
                    linkedWaveform.yAxisModel
                );
            }
        );

        return chartsController;
    }

    renderToolbar(chartsController: ChartsController): JSX.Element {
        return <WaveformToolbar chartsController={chartsController} waveform={this} />;
    }

    openConfigurationDialog() {
        showDialog(<MultiWaveformConfigurationDialog multiWaveform={this} />);
    }

    set isVisible(value: boolean) {
        this.linkedWaveforms.forEach(linkedWaveform => (linkedWaveform.waveform.isVisible = true));
    }

    get xAxisDefaultSubdivisionOffset(): number | undefined {
        return this.linkedWaveforms[0].waveform.xAxisDefaultSubdivisionOffset;
    }

    get xAxisDefaultSubdivisionScale() {
        return this.linkedWaveforms[0].waveform.xAxisDefaultSubdivisionScale;
    }

    get listItemElement(): JSX.Element | null {
        return <ChartHistoryItemComponent historyItem={this} />;
    }
}

////////////////////////////////////////////////////////////////////////////////

class WaveformLinkProperties {
    constructor(public linkedWaveform: ILinkedWaveform) {
        this.props = Object.assign(
            {
                label: this.linkedWaveform.yAxisModel.label,
                color: this.linkedWaveform.yAxisModel.color,
                colorInverse: this.linkedWaveform.yAxisModel.colorInverse
            },
            this.linkedWaveform.waveformLink
        );
    }

    @observable props: IWaveformLink;
    @observable errors: boolean = false;

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
                onChange={action((value: string) => (this.props.colorInverse = value))}
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

@observer
class MultiWaveformConfigurationDialog extends React.Component<
    {
        multiWaveform: MultiWaveform;
    },
    {}
> {
    @observable
    waveforms: IJoinedWaveformLinkAndDefinitionProperties[] = this.props.multiWaveform.linkedWaveforms.map(
        (linkedWaveform: ILinkedWaveform, i: number) => {
            return {
                linkedWaveform,
                waveformLinkProperties: new WaveformLinkProperties(linkedWaveform),
                waveformDefinitionProperties: new WaveformDefinitionProperties(
                    linkedWaveform.waveform.waveformDefinition
                )
            };
        }
    );

    @observable.shallow
    selectedWaveform: IJoinedWaveformLinkAndDefinitionProperties = this.waveforms[0];

    @computed
    get waveformListNodes(): IListNode[] {
        return this.waveforms.map(joinedWaveformLinkAndDefinitionProperties => ({
            id: joinedWaveformLinkAndDefinitionProperties.linkedWaveform.waveformLink.id,
            data: joinedWaveformLinkAndDefinitionProperties,
            selected: joinedWaveformLinkAndDefinitionProperties === this.selectedWaveform
        }));
    }

    @bind
    renderWaveformListNode(node: IListNode) {
        let waveformLinkProperties = node.data as IJoinedWaveformLinkAndDefinitionProperties;

        const errors =
            waveformLinkProperties.waveformLinkProperties.errors ||
            (waveformLinkProperties.waveformDefinitionProperties &&
                waveformLinkProperties.waveformDefinitionProperties.errors);

        return (
            <ListItem
                label={waveformLinkProperties.waveformLinkProperties.props.label || "<no label>"}
                rightIcon={errors ? "material:error_outline" : undefined}
                rightIconClassName="text-danger"
            />
        );
    }

    @action.bound
    selectWaveform(node: IListNode) {
        this.selectedWaveform = node.data;
    }

    @bind
    async handleSubmit() {
        let anyError = false;

        for (let i = 0; i < this.waveforms.length; i++) {
            const waveformLinkProperties = this.waveforms[i];

            if (!(await waveformLinkProperties.waveformLinkProperties.checkValidity())) {
                anyError = true;
            }

            const waveformProperties = waveformLinkProperties.waveformDefinitionProperties;
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
        const waveformLinks = this.waveforms.map(joinedWaveformLinkAndDefinitionProperties => ({
            id: joinedWaveformLinkAndDefinitionProperties.linkedWaveform.waveformLink.id,
            label: joinedWaveformLinkAndDefinitionProperties.waveformLinkProperties.props.label,
            color: joinedWaveformLinkAndDefinitionProperties.waveformLinkProperties.props.color,
            colorInverse:
                joinedWaveformLinkAndDefinitionProperties.waveformLinkProperties.props.colorInverse
        }));
        if (!objectEqual(waveformLinks, this.waveforms.map(x => x.linkedWaveform.waveformLink))) {
            const multiWaveformHistoryItemMessage = Object.assign(
                objectClone(this.props.multiWaveform.multiWaveformHistoryItemMessage),
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
        this.waveforms.forEach(joinedWaveformLinkAndDefinitionProperties => {
            const waveformHistoryItemMessage = JSON.parse(
                joinedWaveformLinkAndDefinitionProperties.linkedWaveform.waveform.message
            );

            if (
                !objectEqual(
                    joinedWaveformLinkAndDefinitionProperties.waveformDefinitionProperties
                        .propsValidated,
                    waveformHistoryItemMessage.waveformDefinition
                )
            ) {
                const newWaveformHistoryItemMessage = Object.assign(waveformHistoryItemMessage, {
                    waveformDefinition:
                        joinedWaveformLinkAndDefinitionProperties.waveformDefinitionProperties
                            .propsValidated
                });

                changedHistoryItems.push({
                    id: joinedWaveformLinkAndDefinitionProperties.linkedWaveform.waveform.id,
                    oid: joinedWaveformLinkAndDefinitionProperties.linkedWaveform.waveform.oid,
                    message: JSON.stringify(newWaveformHistoryItemMessage)
                });
            }
        });

        if (changedHistoryItems.length > 0) {
            beginTransaction("Edit chart configuration");

            changedHistoryItems.forEach(changedHistoryItem => {
                logUpdate(changedHistoryItem, {
                    undoable: true
                });
            });

            commitTransaction();
        }

        return true;
    }

    render() {
        return (
            <Dialog large={false} onOk={this.handleSubmit}>
                <div className="EezStudio_MultiWaveform_Configuration_Dialog_Body">
                    <PropertyList>
                        <SelectFromListProperty
                            nodes={this.waveformListNodes}
                            renderNode={this.renderWaveformListNode}
                            onChange={this.selectWaveform}
                        />
                    </PropertyList>
                    <PropertyList>
                        {this.selectedWaveform.waveformLinkProperties.render()}
                        {this.selectedWaveform.waveformDefinitionProperties &&
                            this.selectedWaveform.waveformDefinitionProperties.render()}
                    </PropertyList>
                </div>
            </Dialog>
        );
    }
}
