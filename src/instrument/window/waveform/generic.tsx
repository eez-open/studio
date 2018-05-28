import * as React from "react";
import { observable, computed, runInAction, action, toJS, when, reaction } from "mobx";
import { observer } from "mobx-react";
import { bind } from "bind-decorator";
import * as tinycolor from "tinycolor2";

import { objectEqual, objectClone } from "shared/util";
import { capitalize } from "shared/string";
import { beginTransaction, commitTransaction } from "shared/store";
import { logUpdate, IActivityLogEntry } from "shared/activity-log";
import { IUnit, SAMPLING_RATE_UNIT, UNITS } from "shared/units";
import { scheduleTask, Priority } from "shared/scheduler";

import { makeValidator, validators } from "shared/model/validation";

import { Dialog, showDialog } from "shared/ui/dialog";
import { PropertyList, TextInputProperty, SelectProperty } from "shared/ui/properties";
import {
    AxisController,
    ChartController,
    ChartMode,
    ChartsController,
    IAxisModel,
    ZoomMode,
    LineController,
    IViewOptions,
    IViewOptionsAxesLines,
    IViewOptionsAxesLinesType
} from "shared/ui/chart";

import { checkMime } from "instrument/connection/file-type";

import { AppStore } from "instrument/window/app-store";
import { ChartPreview } from "instrument/window/chart-preview";

import { FileHistoryItem } from "instrument/window/history/items/file";

import { initValuesAccesor, WaveformFormat } from "instrument/window/waveform/buffer";
import { IWaveformLink } from "instrument/window/waveform/multi";
import { WaveformTimeAxisModel } from "instrument/window/waveform/time-axis";
import { WaveformLineView } from "instrument/window/waveform/line-view";
import { WaveformToolbar } from "instrument/window/waveform/toolbar";

////////////////////////////////////////////////////////////////////////////////

type IWaveformDefinition = {
    samplingRate: number;
    format: WaveformFormat;
    unitName: keyof typeof UNITS;
    color?: string;
    colorInverse?: string;
    label?: string;
    offset: number;
    scale: number;
    cachedMinValue: number;
    cachedMaxValue: number;
};

export interface IWaveformHistoryItemMessage {
    waveformDefinition: IWaveformDefinition;
    viewOptions: ViewOptions;
    horizontalScale?: number;
    verticalScale?: number;
}

////////////////////////////////////////////////////////////////////////////////

export function isWaveform(activityLogEntry: IActivityLogEntry) {
    return (
        (activityLogEntry as any).waveformDefinition ||
        checkMime(activityLogEntry.message, [
            "application/eez-binary-list",
            "application/eez-raw",
            "text/csv"
        ])
    );
}

////////////////////////////////////////////////////////////////////////////////

export class ViewOptions implements IViewOptions {
    constructor(props?: any) {
        if (props) {
            Object.assign(this, props);
        }
    }

    @observable
    axesLines: IViewOptionsAxesLines = {
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
        snapToGrid: true
    };

    @observable showAxisLabels: boolean = true;
    @observable showZoomButtons: boolean = true;

    setAxesLinesType(type: IViewOptionsAxesLinesType) {
        this.axesLines.type = type;
    }

    setAxesLinesMajorSubdivisionHorizontal(value: number) {
        this.axesLines.majorSubdivision.horizontal = value;
    }

    setAxesLinesMajorSubdivisionVertical(value: number) {
        this.axesLines.majorSubdivision.vertical = value;
    }

    setAxesLinesMinorSubdivisionHorizontal(value: number) {
        this.axesLines.minorSubdivision.horizontal = value;
    }

    setAxesLinesMinorSubdivisionVertical(value: number) {
        this.axesLines.minorSubdivision.vertical = value;
    }

    setAxesLinesStepsX(steps: number[]) {
        this.axesLines.steps.x = steps;
    }

    setAxesLinesStepsY(index: number, steps: number[]): void {
        this.axesLines.steps.y[index] = steps;
    }

    setAxesLinesSnapToGrid(value: boolean): void {
        this.axesLines.snapToGrid = value;
    }

    setShowAxisLabels(value: boolean) {
        this.showAxisLabels = value;
    }

    setShowZoomButtons(value: boolean) {
        this.showZoomButtons = value;
    }
}

////////////////////////////////////////////////////////////////////////////////

const CONF_RANGE_OVERFLOW_PERCENT = 5;

export class WaveformAxisModel implements IAxisModel {
    constructor(private waveform: Waveform, private waveformLink: IWaveformLink | undefined) {}

    @computed
    get minValue() {
        return (
            this.waveform.minValue -
            CONF_RANGE_OVERFLOW_PERCENT / 100 * (this.waveform.maxValue - this.waveform.minValue)
        );
    }

    @computed
    get maxValue() {
        return (
            this.waveform.maxValue +
            CONF_RANGE_OVERFLOW_PERCENT / 100 * (this.waveform.maxValue - this.waveform.minValue)
        );
    }

    @computed
    get defaultFrom() {
        return this.minValue;
    }

    @computed
    get defaultTo() {
        return this.maxValue;
    }

    @computed
    get unit() {
        return UNITS[this.waveform.waveformDefinition.unitName];
    }

    @observable
    dynamic: {
        zoomMode: ZoomMode;
        from: number;
        to: number;
    } = {
        zoomMode: "default",
        from: 0,
        to: 0
    };

    @observable
    fixed: {
        zoomMode: ZoomMode;
        subdivisionOffset: number;
        subdivisonScale: number;
    } = {
        zoomMode: "default",
        subdivisionOffset: 0,
        subdivisonScale: 0
    };

    get defaultSubdivisionOffset(): number | undefined {
        return this.waveform.yAxisDefaultSubdivisionOffset;
    }

    get defaultSubdivisionScale() {
        return this.waveform.yAxisDefaultSubdivisionScale;
    }

    get label() {
        return (
            (this.waveformLink && this.waveformLink.label) ||
            this.waveform.waveformDefinition.label ||
            capitalize(this.unit.name)
        );
    }

    get color() {
        return (
            (this.waveformLink && this.waveformLink.color) ||
            this.waveform.waveformDefinition.color ||
            this.unit.color
        );
    }

    get colorInverse() {
        let color =
            (this.waveformLink && this.waveformLink.colorInverse) ||
            this.waveform.waveformDefinition.colorInverse;
        if (color) {
            return color;
        }

        color =
            (this.waveformLink && this.waveformLink.color) ||
            this.waveform.waveformDefinition.color;
        if (color) {
            // make color a little bit darker to look better on white background
            const c = tinycolor(color);
            const hsl = c.toHsl();
            hsl.l = hsl.l - 0.15;
            return tinycolor(hsl).toHexString();
        }

        return this.unit.colorInverse;
    }
}

////////////////////////////////////////////////////////////////////////////////

export class WaveformChartsController extends ChartsController {
    constructor(public waveform: Waveform, mode: ChartMode, xAxisModel: IAxisModel) {
        super(mode, xAxisModel, waveform.viewOptions);
    }
}

////////////////////////////////////////////////////////////////////////////////

export class Waveform extends FileHistoryItem {
    constructor(activityLogEntry: IActivityLogEntry | FileHistoryItem, appStore: AppStore) {
        super(activityLogEntry, appStore);

        when(
            () => this.transferSucceeded && this.isVisible,
            () => {
                scheduleTask(`Load waveform ${this.id}`, Priority.Lowest, () => {
                    this.initWaveformDefinition();
                });
            }
        );

        // save viewOptions when changed
        reaction(
            () => ({
                message: this.message,
                viewOptions: this.viewOptions
            }),
            () => {
                let message = JSON.parse(this.message);
                let viewOptions = toJS(this.viewOptions);

                if (!objectEqual(message.viewOptions, viewOptions)) {
                    logUpdate(
                        {
                            id: this.id,
                            oid: this.oid,
                            message: JSON.stringify(
                                Object.assign(message, {
                                    viewOptions
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

    initValuesAccesor() {
        initValuesAccesor(this);
    }

    findRange() {
        let minValue;
        let maxValue;
        if (this.length > 0) {
            minValue = this.waveformData(0);
            maxValue = this.waveformData(0);
            for (let i = 1; i < this.length; ++i) {
                const value = this.waveformData(i);
                if (value < minValue) {
                    minValue = value;
                } else if (value > maxValue) {
                    maxValue = value;
                }
            }
        } else {
            minValue = 0;
            maxValue = 0;
        }
        this.waveformDefinition.cachedMinValue = minValue;
        this.waveformDefinition.cachedMaxValue = maxValue;
    }

    guessWaveformFormat() {
        let format: WaveformFormat = WaveformFormat.UNKNOWN;
        if (this.fileTypeAsDisplayString === "text/csv") {
            format = WaveformFormat.CSV_STRING;
        } else {
            format = WaveformFormat.RIGOL_BYTE;
        }
        return format;
    }

    getDefaultWaveformDefinition(): IWaveformDefinition {
        return {
            samplingRate: 1000000,
            format: this.guessWaveformFormat(),
            unitName: "voltage",
            offset: 0,
            scale: 1,
            cachedMinValue: 0,
            cachedMaxValue: 0
        };
    }

    migrateWaveformDefinition() {
        let migrated = false;

        if (this.waveformDefinition.samplingRate === undefined) {
            this.waveformDefinition.samplingRate = 1000000;
            migrated = true;
        }

        if (this.waveformDefinition.offset === undefined) {
            this.waveformDefinition.offset = 0;
            migrated = true;
        }

        if (this.waveformDefinition.scale === undefined) {
            this.waveformDefinition.scale = 1;
            migrated = true;
        }

        if (
            this.waveformDefinition.cachedMinValue == null ||
            this.waveformDefinition.cachedMaxValue == null
        ) {
            migrated = true;
        }

        return migrated;
    }

    @action.bound
    initWaveformDefinition() {
        let migrated = false;

        if (this.waveformHistoryItemMessage.waveformDefinition) {
            this.waveformDefinition = this.waveformHistoryItemMessage.waveformDefinition;
            migrated = this.migrateWaveformDefinition();
        } else {
            this.waveformDefinition = this.getDefaultWaveformDefinition();
            migrated = true;
        }

        this.initValuesAccesor();

        if (migrated) {
            this.findRange();
            this.updateWaveformDefinition();
        }
    }

    updateWaveformDefinition(changes?: Partial<IWaveformDefinition>) {
        logUpdate(
            {
                id: this.id,
                oid: this.oid,
                message: JSON.stringify(
                    Object.assign({}, this.waveformHistoryItemMessage, {
                        waveformDefinition: Object.assign(
                            {},
                            toJS(this.waveformDefinition),
                            changes
                        )
                    })
                )
            },
            {
                undoable: false
            }
        );
    }

    @computed
    get values(): any {
        if (typeof this.data === "string") {
            return new Uint8Array(new Buffer(this.data, "binary").buffer);
        }
        return this.data;
    }

    @computed
    get waveformHistoryItemMessage(): IWaveformHistoryItemMessage {
        return JSON.parse(this.message);
    }

    @observable.shallow waveformDefinition = this.getDefaultWaveformDefinition();

    @observable length: number = 0;

    get format() {
        return this.waveformDefinition.format;
    }

    get offset() {
        return this.waveformDefinition.offset;
    }

    set offset(value: number) {
        this.waveformDefinition.offset = value;
        this.updateWaveformDefinition();
    }

    get scale() {
        return this.waveformDefinition.scale;
    }

    set scale(value: number) {
        this.waveformDefinition.scale = value;
        this.updateWaveformDefinition();
    }

    @computed
    get samplingRate() {
        return this.waveformDefinition.samplingRate;
    }

    @computed
    get viewOptions() {
        let message = JSON.parse(this.message);
        let viewOptions: ViewOptions;
        if (message.viewOptions) {
            viewOptions = new ViewOptions(message.viewOptions);
        } else {
            viewOptions = new ViewOptions();
        }
        return viewOptions;
    }

    xAxisModel = new WaveformTimeAxisModel(this);

    createChartsController(mode: ChartMode): ChartsController {
        const chartsController = new WaveformChartsController(this, mode, this.xAxisModel);

        this.xAxisModel.chartsController = chartsController;

        chartsController.chartControllers = [
            this.createChartController(chartsController, "unknown", this.yAxisModel)
        ];

        return chartsController;
    }

    createChartController(chartsController: ChartsController, id: string, axisModel: IAxisModel) {
        const chartController = new ChartController(chartsController, id);

        chartController.createYAxisController(UNITS[this.waveformDefinition.unitName], axisModel);

        chartController.lineControllers.push(
            new WaveformLineController(
                "waveform-" + chartController.yAxisController.position,
                this,
                chartController.yAxisController
            )
        );

        return chartController;
    }

    yAxisModel = new WaveformAxisModel(this, undefined);

    value(index: number) {
        return 0;
    }

    waveformData(index: number) {
        return 0;
    }

    waveformDataToValue(waveformDataValue: number) {
        return this.offset + waveformDataValue * this.scale;
    }

    get minValue() {
        if (
            this.waveformDefinition.format === WaveformFormat.RIGOL_BYTE ||
            this.waveformDefinition.format === WaveformFormat.RIGOL_WORD
        ) {
            return this.waveformDataToValue(this.waveformDefinition.cachedMinValue);
        } else {
            return this.waveformDefinition.cachedMinValue;
        }
    }

    get maxValue() {
        if (
            this.waveformDefinition.format === WaveformFormat.RIGOL_BYTE ||
            this.waveformDefinition.format === WaveformFormat.RIGOL_WORD
        ) {
            return this.waveformDataToValue(this.waveformDefinition.cachedMaxValue);
        } else {
            return this.waveformDefinition.cachedMaxValue;
        }
    }

    renderToolbar(chartsController: ChartsController): JSX.Element {
        return <WaveformToolbar chartsController={chartsController} waveform={this} />;
    }

    openConfigurationDialog() {
        showDialog(<WaveformConfigurationDialog waveform={this} />);
    }

    get xAxisDefaultSubdivisionOffset(): number | undefined {
        return this.waveformHistoryItemMessage.horizontalScale !== undefined ? 0 : undefined;
    }

    get xAxisDefaultSubdivisionScale() {
        return this.waveformHistoryItemMessage.horizontalScale;
    }

    @computed
    get yAxisDefaultSubdivisionOffsetAndScale() {
        if (this.waveformHistoryItemMessage.verticalScale) {
            const verticalScale = this.waveformHistoryItemMessage.verticalScale;
            const min = Math.floor(this.yAxisModel.minValue / verticalScale) * verticalScale;
            const max = Math.ceil(this.yAxisModel.maxValue / verticalScale) * verticalScale;
            const subdivision = this.waveformHistoryItemMessage.viewOptions.axesLines
                .majorSubdivision.vertical;

            return {
                offset: (min + max) / 2 - verticalScale * subdivision / 2,
                scale: verticalScale
            };
        }

        return {
            offset: undefined,
            scale: undefined
        };
    }

    get yAxisDefaultSubdivisionOffset(): number | undefined {
        return this.yAxisDefaultSubdivisionOffsetAndScale.offset;
    }

    get yAxisDefaultSubdivisionScale() {
        return this.yAxisDefaultSubdivisionOffsetAndScale.scale;
    }

    get previewElement() {
        return <ChartPreview data={this} />;
    }
}

////////////////////////////////////////////////////////////////////////////////

class WaveformLineController extends LineController {
    constructor(
        public id: string,
        public waveform: Waveform,
        public yAxisController: AxisController
    ) {
        super(id, yAxisController);
    }

    @computed
    get yMin(): number {
        return this.yAxisController.axisModel.minValue;
    }

    @computed
    get yMax(): number {
        return this.yAxisController.axisModel.maxValue;
    }

    render(): JSX.Element {
        return <WaveformLineView key={this.id} waveformLineController={this} useWorker={true} />;
    }
}

////////////////////////////////////////////////////////////////////////////////

export class WaveformDefinitionProperties {
    constructor(public waveformDefinition: IWaveformDefinition) {
        const unit = UNITS[this.waveformDefinition.unitName];

        this.props = {
            samplingRate: SAMPLING_RATE_UNIT.formatValue(this.waveformDefinition.samplingRate),
            format: this.waveformDefinition.format,
            unit,
            offset: unit.formatValue(this.waveformDefinition.offset),
            scale: unit.formatValue(this.waveformDefinition.scale)
        };

        this.propsValidated = objectClone(this.waveformDefinition);
    }

    @observable
    props: {
        samplingRate: string;
        format: WaveformFormat;
        unit: IUnit;
        offset: string;
        scale: string;
    };

    propsValidated: IWaveformDefinition;

    @observable errors: boolean;

    validator = makeValidator({
        samplingRate: [
            validators.required,
            () => {
                let samplingRate = SAMPLING_RATE_UNIT.parseValue(this.props.samplingRate);
                if (typeof samplingRate !== "number") {
                    return "Invalid value.";
                }
                this.propsValidated.samplingRate = samplingRate;
                return null;
            },
            () => {
                return validators.rangeExclusive(0)(this.propsValidated, "sampling rate");
            }
        ],

        offset: [
            validators.required,
            () => {
                let offset = this.props.unit.parseValue(this.props.offset);
                if (typeof offset !== "number") {
                    return "Invalid value.";
                }
                this.propsValidated.offset = offset;
                return null;
            }
        ],

        scale: [
            validators.required,
            () => {
                let scale = this.props.unit.parseValue(this.props.scale);
                if (typeof scale !== "number") {
                    return "Invalid value.";
                }
                this.propsValidated.scale = scale;
                return null;
            },
            () => {
                if (this.propsValidated.scale <= 0) {
                    return "Must be greater than 0";
                }
                return null;
            }
        ]
    });

    async checkValidity() {
        const result = await this.validator.checkValidity(this.props);

        runInAction(() => {
            this.errors = !result;
        });

        if (!result) {
            return undefined;
        }

        this.propsValidated.format = this.props.format;
        this.propsValidated.unitName = this.props.unit.name as keyof typeof UNITS;

        return this.propsValidated;
    }

    get units(): IUnit[] {
        const units: IUnit[] = [];
        Object.keys(UNITS).forEach((unitName: keyof typeof UNITS) => {
            if (units.indexOf(UNITS[unitName]) === -1) {
                units.push(UNITS[unitName]);
            }
        });
        return units;
    }

    render() {
        return [
            <TextInputProperty
                key="samplingRate"
                name="Sampling rate"
                value={this.props.samplingRate}
                onChange={action((value: string) => (this.props.samplingRate = value))}
                errors={this.validator.errors.samplingRate}
            />,
            <SelectProperty
                key="format"
                name="Format"
                value={this.props.format.toString()}
                onChange={action((value: string) => (this.props.format = parseInt(value)))}
            >
                <option value={WaveformFormat.UNKNOWN.toString()}>Unknown</option>
                <option value={WaveformFormat.UINT8_ARRAY_OF_FLOATS.toString()}>Float</option>
                <option value={WaveformFormat.RIGOL_BYTE.toString()}>Byte (Rigol)</option>
                <option value={WaveformFormat.RIGOL_WORD.toString()}>Word (Rigol)</option>
                <option value={WaveformFormat.CSV_STRING.toString()}>CSV</option>
            </SelectProperty>,
            <SelectProperty
                key="unit"
                name="Unit"
                value={this.props.unit.name}
                onChange={action((value: keyof typeof UNITS) => (this.props.unit = UNITS[value]))}
            >
                {this.units.map(unit => (
                    <option key={unit.name} value={unit.name}>
                        {capitalize(unit.name)}
                    </option>
                ))}
            </SelectProperty>,
            <TextInputProperty
                key="offset"
                name="Offset"
                value={this.props.offset}
                onChange={action((value: string) => (this.props.offset = value))}
                errors={this.validator.errors.offset}
            />,
            <TextInputProperty
                key="scale"
                name="Scale"
                value={this.props.scale}
                onChange={action((value: string) => (this.props.scale = value))}
                errors={this.validator.errors.scale}
            />
        ];
    }
}

////////////////////////////////////////////////////////////////////////////////

@observer
class WaveformConfigurationDialog extends React.Component<
    {
        waveform: Waveform;
    },
    {}
> {
    waveformProperties: WaveformDefinitionProperties = new WaveformDefinitionProperties(
        this.props.waveform.waveformDefinition
    );

    @bind
    async handleSubmit() {
        const newWaveformDefinition = await this.waveformProperties.checkValidity();
        if (!newWaveformDefinition) {
            return false;
        }

        if (!objectEqual(this.props.waveform.waveformDefinition, newWaveformDefinition)) {
            const message = JSON.stringify(
                Object.assign({}, this.props.waveform.fileState, {
                    waveformDefinition: newWaveformDefinition
                })
            );

            beginTransaction("Edit waveform configuration");
            logUpdate(
                {
                    id: this.props.waveform.id,
                    oid: this.props.waveform.oid,
                    message
                },
                {
                    undoable: true
                }
            );
            commitTransaction();
        }

        return true;
    }

    render() {
        return (
            <Dialog onOk={this.handleSubmit}>
                <PropertyList>{this.waveformProperties.render()}</PropertyList>
            </Dialog>
        );
    }
}
