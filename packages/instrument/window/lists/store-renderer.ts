import { action, computed, observable, toJS, makeObservable } from "mobx";

import { capitalize } from "eez-studio-shared/string";
import {
    IUnit,
    VOLTAGE_UNIT,
    CURRENT_UNIT,
    POWER_UNIT
} from "eez-studio-shared/units";

import type {
    IAxisModel,
    IViewOptionsAxesLines,
    ChartMode,
    ChartsController,
    IViewOptions,
    IViewOptionsAxesLinesType
} from "eez-studio-ui/chart/chart";

import type { InstrumentObject } from "instrument/instrument-object";

import type { ChartsDisplayOption } from "instrument/window/lists/common-tools";
import type { ChartData } from "instrument/window/chart-preview";
import type {
    IAppStore,
    IInstrumentObject
} from "instrument/window/history/history";

////////////////////////////////////////////////////////////////////////////////

const CONF_MAX_VOLTAGE = 40;
const CONF_MAX_CURRENT = 5;

function getFirstChannel(instrument: IInstrumentObject) {
    return instrument.firstChannel;
}

export function getMaxVoltage(instrument: IInstrumentObject): number {
    let maxVoltage;
    const channel = getFirstChannel(instrument);
    if (channel) {
        maxVoltage = channel.maxVoltage;
    }
    return maxVoltage || CONF_MAX_VOLTAGE;
}

export function getMaxCurrent(instrument: IInstrumentObject): number {
    let maxCurrent;
    const channel = getFirstChannel(instrument);
    if (channel) {
        maxCurrent = channel.maxCurrent;
    }
    return maxCurrent || CONF_MAX_CURRENT;
}

export function getMaxPower(instrument: IInstrumentObject): number {
    let maxPower;
    const channel = getFirstChannel(instrument);
    if (channel) {
        maxPower = channel.maxPower;
    }
    return maxPower || CONF_MAX_VOLTAGE * CONF_MAX_CURRENT;
}

export function getPowerLimitErrorMessage(instrument: IInstrumentObject) {
    return `Power limit of ${POWER_UNIT.formatValue(
        getMaxPower(instrument),
        Math.max(
            instrument.getDigits(VOLTAGE_UNIT),
            instrument.getDigits(CURRENT_UNIT)
        )
    )} exceeded`;
}

export function checkVoltage(voltage: number, instrument: IInstrumentObject) {
    const channel = getFirstChannel(instrument);
    if (channel) {
        const maxVoltage = channel.maxVoltage;
        if (maxVoltage !== undefined) {
            if (voltage > maxVoltage) {
                return false;
            }
        }
    }
    return true;
}

export function checkCurrent(current: number, instrument: InstrumentObject) {
    const channel = getFirstChannel(instrument);
    if (channel) {
        const maxCurrent = channel.maxCurrent;
        if (maxCurrent !== undefined) {
            if (current > maxCurrent) {
                return false;
            }
        }
    }
    return true;
}

export function checkPower(power: number, instrument: IInstrumentObject) {
    const channel = getFirstChannel(instrument);
    if (channel) {
        const maxPower = channel.maxPower;
        if (maxPower !== undefined) {
            if (power > maxPower) {
                return false;
            }
        }
    }
    return true;
}

////////////////////////////////////////////////////////////////////////////////

class ListViewOptions {
    axesLines: IViewOptionsAxesLines = {
        type: "dynamic",
        steps: {
            x: [0.01, 0.1, 1, 10],
            y: [
                [0.1, 1, 10],
                [0.01, 0.1, 1]
            ]
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
    };
    showAxisLabels: boolean = true;
    showZoomButtons: boolean = true;

    constructor(props: any) {
        makeObservable(this, {
            axesLines: observable,
            showAxisLabels: observable,
            showZoomButtons: observable
        });

        if (props) {
            this.axesLines = props.axesLines;
            this.showAxisLabels = props.showAxisLabels;
            this.showZoomButtons = props.showZoomButtons;
        }
    }

    toJS() {
        return {
            axesLines: toJS(this.axesLines),
            showAxisLabels: this.showAxisLabels,
            showZoomButtons: this.showZoomButtons
        };
    }

    applyChanges(changes: any) {
        if ("axesLines" in changes) {
            this.axesLines = changes.axesLines;
        }

        if ("showAxisLabels" in changes) {
            this.showAxisLabels = changes.showAxisLabels;
        }

        if ("showZoomButtons" in changes) {
            this.showZoomButtons = changes.showZoomButtons;
        }
    }
}

export class ChartViewOptions implements IViewOptions {
    constructor(private appStore: IAppStore, private list: BaseList) {}

    get axesLines() {
        return this.list.data.viewOptions.axesLines;
    }

    get showAxisLabels() {
        return this.list.data.viewOptions.showAxisLabels;
    }

    set showAxisLabels(value: boolean) {
        this.list.data.viewOptions.showAxisLabels = value;
    }

    get showZoomButtons() {
        return this.list.data.viewOptions.showZoomButtons;
    }

    set showZoomButtons(value: boolean) {
        this.list.data.viewOptions.showZoomButtons = value;
    }

    setAxesLinesType(newType: IViewOptionsAxesLinesType) {
        const oldType = this.axesLines.type;
        this.appStore.undoManager!.addCommand(
            `Edit ${this.list.type} list`,
            this.appStore.instrumentListStore!,
            this.list,
            {
                execute: action(() => {
                    this.axesLines.type = newType;
                }),
                undo: action(() => {
                    this.axesLines.type = oldType;
                })
            }
        );
    }

    setAxesLinesMajorSubdivisionHorizontal(newValue: number) {
        const oldValue = this.axesLines.majorSubdivision.horizontal;
        this.appStore.undoManager!.addCommand(
            `Edit ${this.list.type} list`,
            this.appStore.instrumentListStore!,
            this.list,
            {
                execute: action(() => {
                    this.axesLines.majorSubdivision.horizontal = newValue;
                }),
                undo: action(() => {
                    this.axesLines.majorSubdivision.horizontal = oldValue;
                })
            }
        );
    }

    setAxesLinesMajorSubdivisionVertical(newValue: number) {
        const oldValue = this.axesLines.majorSubdivision.vertical;
        this.appStore.undoManager!.addCommand(
            `Edit ${this.list.type} list`,
            this.appStore.instrumentListStore!,
            this.list,
            {
                execute: action(() => {
                    this.axesLines.majorSubdivision.vertical = newValue;
                }),
                undo: action(() => {
                    this.axesLines.majorSubdivision.vertical = oldValue;
                })
            }
        );
    }

    setAxesLinesMinorSubdivisionHorizontal(newValue: number) {
        const oldValue = this.axesLines.minorSubdivision.horizontal;
        this.appStore.undoManager!.addCommand(
            `Edit ${this.list.type} list`,
            this.appStore.instrumentListStore!,
            this.list,
            {
                execute: action(() => {
                    this.axesLines.minorSubdivision.horizontal = newValue;
                }),
                undo: action(() => {
                    this.axesLines.minorSubdivision.horizontal = oldValue;
                })
            }
        );
    }

    setAxesLinesMinorSubdivisionVertical(newValue: number) {
        const oldValue = this.axesLines.minorSubdivision.vertical;
        this.appStore.undoManager!.addCommand(
            `Edit ${this.list.type} list`,
            this.appStore.instrumentListStore!,
            this.list,
            {
                execute: action(() => {
                    this.axesLines.minorSubdivision.vertical = newValue;
                }),
                undo: action(() => {
                    this.axesLines.minorSubdivision.vertical = oldValue;
                })
            }
        );
    }

    setAxesLinesStepsX(newValue: number[]) {
        const oldValue = this.axesLines.steps.x;
        this.appStore.undoManager!.addCommand(
            `Edit ${this.list.type} list`,
            this.appStore.instrumentListStore!,
            this.list,
            {
                execute: action(() => {
                    this.axesLines.steps.x = newValue;
                }),
                undo: action(() => {
                    this.axesLines.steps.x = oldValue;
                })
            }
        );
    }

    setAxesLinesStepsY(index: number, newValue: number[]): void {
        const oldValue = this.axesLines.steps.y[index];
        this.appStore.undoManager!.addCommand(
            `Edit ${this.list.type} list`,
            this.appStore.instrumentListStore!,
            this.list,
            {
                execute: action(() => {
                    this.axesLines.steps.y[index] = newValue;
                }),
                undo: action(() => {
                    this.axesLines.steps.y[index] = oldValue;
                })
            }
        );
    }

    setAxesLinesSnapToGrid(newValue: boolean): void {
        const oldValue = this.axesLines.snapToGrid;
        this.appStore.undoManager!.addCommand(
            `Edit ${this.list.type} list`,
            this.appStore.instrumentListStore!,
            this.list,
            {
                execute: action(() => {
                    this.axesLines.snapToGrid = newValue;
                }),
                undo: action(() => {
                    this.axesLines.snapToGrid = oldValue;
                })
            }
        );
    }

    setShowAxisLabels(newValue: boolean) {
        const oldValue = this.showAxisLabels;
        this.appStore.undoManager!.addCommand(
            `Edit ${this.list.type} list`,
            this.appStore.instrumentListStore!,
            this.list,
            {
                execute: action(() => {
                    this.showAxisLabels = newValue;
                }),
                undo: action(() => {
                    this.showAxisLabels = oldValue;
                })
            }
        );
    }

    setShowZoomButtons(newValue: boolean) {
        const oldValue = this.showZoomButtons;
        this.appStore.undoManager!.addCommand(
            `Edit ${this.list.type} list`,
            this.appStore.instrumentListStore!,
            this.list,
            {
                execute: action(() => {
                    this.showZoomButtons = newValue;
                }),
                undo: action(() => {
                    this.showZoomButtons = oldValue;
                })
            }
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

export class ListAxis {
    dynamic: any;
    fixed: any;

    constructor(props: ListAxis) {
        this.dynamic = (props && props.dynamic) || {
            zoomMode: "all",
            from: 0,
            to: 0
        };

        this.fixed = (props && props.fixed) || {
            zoomMode: "all",
            subdivisionOffset: 0,
            subdivisonScale: 0
        };

        makeObservable(this, {
            dynamic: observable,
            fixed: observable
        });
    }

    applyChanges(changes: any) {
        if ("dynamic" in changes) {
            this.dynamic = changes.dynamic;
        }

        if ("fixed" in changes) {
            this.fixed = changes.fixed;
        }
    }
}

export class ListAxisModel implements IAxisModel {
    unit: IUnit;

    constructor(
        public appStore: IAppStore,
        public list: BaseList,
        unit: IUnit
    ) {
        makeObservable(this, {
            listAxis: computed
        });

        this.unit = unit.clone();
        this.unit.precision = appStore.instrument.getDigits(unit);
    }

    get listAxis() {
        return this.unit.name == "time"
            ? this.list.data.timeAxis
            : this.unit.name == "voltage"
            ? this.list.data.voltageAxis
            : this.list.data.currentAxis;
    }

    get dynamic() {
        return this.listAxis.dynamic;
    }

    get fixed() {
        return this.listAxis.fixed;
    }

    get minValue(): number {
        return 0;
    }

    get maxValue(): number {
        return this.unit.name === "time"
            ? this.list.getMaxTime()
            : this.unit.name === "voltage"
            ? getMaxVoltage(this.appStore.instrument)
            : getMaxCurrent(this.appStore.instrument);
    }

    get defaultFrom() {
        return this.minValue;
    }

    get defaultTo() {
        return this.maxValue;
    }

    get defaultSubdivisionOffset() {
        return undefined;
    }

    get defaultSubdivisionScale() {
        return undefined;
    }

    get label() {
        return capitalize(this.unit.name);
    }

    get color() {
        return this.unit.color;
    }

    get colorInverse() {
        return this.unit.colorInverse;
    }
}

////////////////////////////////////////////////////////////////////////////////

export type IListType = "table" | "envelope";

export interface ITableListData {
    dwell: number[];
    voltage: number[];
    current: number[];
}

export class BaseListData {
    viewOptions: ListViewOptions;

    timeAxis: ListAxis;
    voltageAxis: ListAxis;
    currentAxis: ListAxis;

    constructor(list: BaseList, props: Partial<BaseListData>) {
        makeObservable(this, {
            viewOptions: observable,
            timeAxis: observable,
            voltageAxis: observable,
            currentAxis: observable
        });

        this.viewOptions = new ListViewOptions(props.viewOptions);

        this.timeAxis = new ListAxis(
            props.timeAxis || (props as any).timeAxisModel
        );
        this.voltageAxis = new ListAxis(
            props.voltageAxis || (props as any).voltageAxisModel
        );
        this.currentAxis = new ListAxis(
            props.currentAxis || (props as any).currentAxisModel
        );
    }

    toJS() {
        return {
            viewOptions: this.viewOptions.toJS()
        };
    }

    applyChanges(changes: any) {
        if ("viewOptions" in changes) {
            this.viewOptions.applyChanges(changes.viewOptions);
        }

        if ("timeAxis" in changes) {
            this.timeAxis.applyChanges(changes.timeAxis);
        }

        if ("voltageAxis" in changes) {
            this.voltageAxis.applyChanges(changes.voltageAxis);
        }

        if ("currentAxis" in changes) {
            this.currentAxis.applyChanges(changes.currentAxis);
        }
    }
}

export abstract class BaseList implements ChartData {
    id: string;
    name: string;
    description: string;
    modifiedAt: Date | null;

    type: string;
    abstract data: BaseListData;

    isZoomable = false;

    constructor(public props: any) {
        makeObservable(this, {
            name: observable,
            description: observable,
            modifiedAt: observable
        });

        this.id = props.id;
        this.name = props.name;
        this.description = props.description;
        this.modifiedAt = props.modifiedAt;
    }

    toJS() {
        return {
            id: this.id,
            name: this.name,
            description: this.description,
            modifiedAt: this.modifiedAt,
            type: this.type,
            data: this.data.toJS()
        };
    }

    applyChanges(changes: any) {
        if ("name" in changes) {
            this.name = changes.name;
        }

        if ("description" in changes) {
            this.description = changes.description;
        }

        if ("data" in changes) {
            this.data.applyChanges(changes.data);
        }

        if ("modifiedAt" in changes) {
            this.modifiedAt = new Date(changes.modifiedAt);
        }
    }

    renderToolbar(chartsController: ChartsController): React.ReactNode {
        return null;
    }

    abstract getMaxTime(): number;

    abstract createChartsController(
        appStore: IAppStore,
        displayOption: ChartsDisplayOption,
        mode: ChartMode
    ): ChartsController;

    abstract renderDetailsView(appStore: IAppStore): React.ReactNode;
}
