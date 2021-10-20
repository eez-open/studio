import React from "react";
import { observable, computed, action, runInAction, toJS } from "mobx";
import { observer } from "mobx-react";

import { clamp, objectClone } from "eez-studio-shared/util";
import { _max, _range } from "eez-studio-shared/algorithm";
import {
    Point,
    pointDistance,
    closestPointOnSegment
} from "eez-studio-shared/geometry";
import { capitalize } from "eez-studio-shared/string";
import { IUnit, TIME_UNIT } from "eez-studio-shared/units";

import { validators } from "eez-studio-shared/validation";

import {
    VerticalHeaderWithBody,
    Body,
    Header
} from "eez-studio-ui/header-with-body";
import {
    ChartMode,
    ChartView,
    ChartController,
    getSnapToValue,
    IAxisModel,
    ICursor,
    LineController,
    ILineController,
    MouseHandler
} from "eez-studio-ui/chart/chart";
import {
    globalViewOptions,
    AxisController,
    CONF_CURSOR_RADIUS,
    ChartsController,
    ChartsView
} from "eez-studio-ui/chart/chart";
import { showPopup } from "eez-studio-ui/popup";
import { Toolbar } from "eez-studio-ui/toolbar";
import {
    ButtonAction,
    DropdownButtonAction,
    DropdownItem
} from "eez-studio-ui/action";
import { showGenericDialog } from "eez-studio-ui/generic-dialog";

import type { InstrumentObject } from "instrument/instrument-object";

import type { InstrumentAppStore } from "instrument/window/app-store";

import {
    BaseList,
    BaseListData,
    ListAxisModel,
    getMaxVoltage,
    getMaxCurrent,
    checkPower,
    getPowerLimitErrorMessage
} from "instrument/window/lists/store-renderer";
import {
    displayOption,
    ChartsDisplayOption,
    CommonTools
} from "instrument/window/lists/common-tools";
import { TableLineController } from "instrument/window/lists/table";

////////////////////////////////////////////////////////////////////////////////

// @todo put these in shared/config.ts
const CONF_DRAG_TIME_THRESHOLD = 250;
const CONF_DRAG_DISTANCE_THRESHOLD = 5;

const CONF_ENVELOPE_POINT_RADIUS = CONF_CURSOR_RADIUS;

////////////////////////////////////////////////////////////////////////////////

function getDefaultEnvelopeListData(instrument: InstrumentObject) {
    const voltage = getMaxVoltage(instrument) / 2;
    const current = getMaxCurrent(instrument) / 2;
    return {
        voltage: [
            { time: 0, value: voltage },
            { time: 1, value: voltage }
        ],
        current: [
            { time: 0, value: current },
            { time: 1, value: current }
        ],
        duration: 1,
        numSamples: 256
    };
}

export function createEmptyEnvelopeListData(
    props: { duration: number; numSamples: number },
    instrument: InstrumentObject
) {
    const envelopeListData = objectClone(
        getDefaultEnvelopeListData(instrument)
    );
    envelopeListData.duration = props.duration;
    envelopeListData.numSamples = props.numSamples;
    envelopeListData.voltage[1].time = props.duration;
    envelopeListData.current[1].time = props.duration;
    return envelopeListData;
}

export interface IEnvelopePoint {
    time: number;
    value: number;
}

export class EnvelopeListData extends BaseListData {
    @observable duration: number;
    @observable numSamples: number;
    @observable voltage: IEnvelopePoint[];
    @observable current: IEnvelopePoint[];

    constructor(list: BaseList, props: any) {
        super(list, props);

        const defaultEnvelopeListData = getDefaultEnvelopeListData(
            list.$eez_noser_instrument
        );

        this.duration = props.duration || defaultEnvelopeListData.duration;
        this.numSamples =
            props.numSamples || defaultEnvelopeListData.numSamples;

        this.voltage = props.voltage || defaultEnvelopeListData.voltage;
        this.current = props.current || defaultEnvelopeListData.current;

        this.timeAxisModel = new EnveloperListTimeAxisModel(
            list as EnvelopeList
        );
    }

    toJS() {
        return Object.assign({}, super.toJS(), {
            duration: this.duration,
            numSamples: this.numSamples,
            voltage: toJS(this.voltage),
            current: toJS(this.current)
        });
    }

    applyChanges(changes: any) {
        super.applyChanges(changes);

        if ("duration" in changes) {
            this.duration = changes.duration;
        }

        if ("numSamples" in changes) {
            this.numSamples = changes.numSamples;
        }

        if ("voltage" in changes) {
            this.voltage = changes.voltage;
        }

        if ("current" in changes) {
            this.current = changes.current;
        }
    }
}

export class EnvelopeList extends BaseList {
    @observable data: EnvelopeListData;

    constructor(
        props: any,
        appStore: InstrumentAppStore,
        instrument: InstrumentObject
    ) {
        super(props, appStore, instrument);
        this.type = "envelope";
        this.data = new EnvelopeListData(this, props.data);
    }

    getMaxTime() {
        return Math.max(
            _max(this.data.voltage.map(point => point.time)) || 0,
            _max(this.data.current.map(point => point.time)) || 0,
            this.data.duration
        );
    }

    createChartsController(
        displayOption: ChartsDisplayOption,
        mode: ChartMode
    ): ChartsController {
        return createEnvelopeChartsController(this, displayOption, mode);
    }

    renderDetailsView() {
        return <EnvelopeDetailsView list={this} />;
    }

    @computed
    get tableListData() {
        const envelopeListData = this.data;

        const { voltage, current, numSamples, duration } = envelopeListData;

        let timeN = [0];
        let iVoltage = 1;
        let iCurrent = 1;
        while (iVoltage < voltage.length || iCurrent < current.length) {
            if (iCurrent === current.length) {
                timeN.push(voltage[iVoltage].time);
                iVoltage++;
            } else if (iVoltage === voltage.length) {
                timeN.push(current[iCurrent].time);
                iCurrent++;
            } else {
                let voltageTime = voltage[iVoltage].time;
                let currentTime = current[iCurrent].time;
                if (voltageTime < currentTime) {
                    timeN.push(voltageTime);
                    iVoltage++;
                } else if (currentTime < voltageTime) {
                    timeN.push(currentTime);
                    iCurrent++;
                } else {
                    timeN.push(voltageTime);
                    iVoltage++;
                    iCurrent++;
                }
            }
        }

        let timeTemp = [0];
        const minDwell =
            this.$eez_noser_appStore.instrument!.listsMinDwellProperty;
        const maxDwell =
            this.$eez_noser_appStore.instrument!.listsMaxDwellProperty;
        for (let i = 1; i < timeN.length; i++) {
            let dt = timeN[i] - timeTemp[timeTemp.length - 1];
            while (dt > maxDwell) {
                timeTemp.push(timeTemp[timeTemp.length - 1] + maxDwell);
                dt -= maxDwell;
            }
            timeTemp.push(
                timeTemp[timeTemp.length - 1] + Math.max(dt, minDwell)
            );
        }

        timeN = timeTemp;

        let voltageN = [voltage[0].value];
        let currentN = [current[0].value];
        iVoltage = 1;
        iCurrent = 1;
        for (let i = 1; i < timeN.length; i++) {
            while (
                iVoltage < voltage.length &&
                voltage[iVoltage].time < timeN[i]
            ) {
                iVoltage++;
            }
            if (iVoltage === voltage.length) {
                voltageN.push(voltage[voltage.length - 1].value);
            } else {
                voltageN.push(
                    voltage[iVoltage - 1].value +
                        ((timeN[i] - voltage[iVoltage - 1].time) /
                            (voltage[iVoltage].time -
                                voltage[iVoltage - 1].time)) *
                            (voltage[iVoltage].value -
                                voltage[iVoltage - 1].value)
                );
            }

            while (
                iCurrent < current.length &&
                current[iCurrent].time < timeN[i]
            ) {
                iCurrent++;
            }
            if (iCurrent === current.length) {
                currentN.push(current[current.length - 1].value);
            } else {
                currentN.push(
                    current[iCurrent - 1].value +
                        ((timeN[i] - current[iCurrent - 1].time) /
                            (current[iCurrent].time -
                                current[iCurrent - 1].time)) *
                            (current[iCurrent].value -
                                current[iCurrent - 1].value)
                );
            }
        }

        for (let i = 0; i < timeN.length; i++) {
            if (timeN[i] >= duration) {
                if (timeN[i] > duration) {
                    voltageN[i] =
                        voltageN[i - 1] +
                        ((duration - timeN[i - 1]) /
                            (timeN[i] - timeN[i - 1])) *
                            (voltageN[i] - voltageN[i - 1]);

                    currentN[i] =
                        currentN[i - 1] +
                        ((duration - timeN[i - 1]) /
                            (timeN[i] - timeN[i - 1])) *
                            (currentN[i] - currentN[i - 1]);

                    timeN[i] = duration;
                }

                timeN = timeN.slice(0, i + 1);
                voltageN = voltageN.slice(0, i + 1);
                currentN = currentN.slice(0, i + 1);
                break;
            }
        }

        if (timeN[timeN.length - 1] !== duration) {
            timeN.push(duration);
            voltageN.push(voltage[voltage.length - 1].value);
            currentN.push(current[current.length - 1].value);
        }

        let T = 0;
        let N = numSamples;

        for (let i = 1; i < timeN.length; i++) {
            if (
                voltageN[i] === voltageN[i - 1] &&
                currentN[i] === currentN[i - 1]
            ) {
                N--;
            } else {
                T += timeN[i] - timeN[i - 1];
            }
        }

        const dwellS = [];
        const voltageS = [];
        const currentS = [];

        for (let i = 1; i < timeN.length; i++) {
            let dt = timeN[i] - timeN[i - 1];

            if (
                voltageN[i] === voltageN[i - 1] &&
                currentN[i] === currentN[i - 1]
            ) {
                dwellS.push(dt);
                voltageS.push(voltageN[i]);
                currentS.push(currentN[i]);
            } else {
                let n = Math.round((N * dt) / T);

                let dwellSum = 0;
                let dVoltage = voltageN[i] - voltageN[i - 1];
                let dCurrent = currentN[i] - currentN[i - 1];

                for (let j = 0; j < n; j++) {
                    let dwell = (dt - dwellSum) / (n - j);
                    dwellS.push(dwell);

                    voltageS.push(
                        voltageN[i - 1] +
                            ((dwellSum + dwell / 2) * dVoltage) / dt
                    );
                    currentS.push(
                        currentN[i - 1] +
                            ((dwellSum + dwell / 2) * dCurrent) / dt
                    );

                    dwellSum += dwell;
                }

                N -= n;
                T -= dwellSum;
            }
        }

        return {
            dwell: dwellS,
            voltage: voltageS,
            current: currentS
        };
    }

    @computed
    get numPoints() {
        return Math.max(
            this.tableListData.dwell.length,
            this.tableListData.current.length,
            this.tableListData.voltage.length
        );
    }

    @computed
    get powerLimitError() {
        for (let i = 0; i < this.tableListData.dwell.length; i++) {
            let power =
                this.tableListData.voltage[i] * this.tableListData.current[i];
            if (!checkPower(power, this.$eez_noser_instrument)) {
                return getPowerLimitErrorMessage(this.$eez_noser_instrument);
            }
        }
        return undefined;
    }
}

////////////////////////////////////////////////////////////////////////////////

class EnveloperListTimeAxisModel extends ListAxisModel {
    constructor(public $eez_noser_list: EnvelopeList) {
        super($eez_noser_list, TIME_UNIT);
    }

    get minValue(): number {
        return 0;
    }

    @computed
    get maxValue(): number {
        return this.$eez_noser_list.getMaxTime();
    }
}

////////////////////////////////////////////////////////////////////////////////

@observer
class EditEnvelopeValue extends React.Component<
    {
        list: EnvelopeList;
        time: number | undefined;
        minTime: number;
        maxTime: number;
        timeUnit: IUnit;
        value: number;
        minValue: number;
        maxValue: number;
        valueUnit: IUnit;
        onTimeChange: (time: number) => void;
        onValueChange: (value: number) => void;
        onClose: () => void;
        onSave: () => void;
        onRemove: (() => void) | undefined;
    },
    {}
> {
    constructor(props: any) {
        super(props);

        this.onTimeChange = this.onTimeChange.bind(this);
        this.onValueChange = this.onValueChange.bind(this);
    }

    @observable time =
        this.props.time && this.props.timeUnit.formatValue(this.props.time);
    @observable timeError: string | undefined;
    @observable value = this.props.valueUnit.formatValue(this.props.value);
    @observable valueError: string | undefined;

    @observable lastTime: number | undefined = this.props.time;
    @observable lastValue: number = this.props.value;

    @computed
    get canSave() {
        return (
            !this.timeError &&
            !this.valueError &&
            (this.props.time !== this.lastTime ||
                this.props.value !== this.lastValue)
        );
    }

    @action
    onTimeChange(event: React.ChangeEvent<HTMLInputElement>) {
        this.time = event.target.value;
        let time = this.props.timeUnit.parseValue(this.time);
        if (typeof time === "number") {
            if (time < this.props.minTime || time > this.props.maxTime) {
                this.timeError = `Allowed range: ${this.props.timeUnit.formatValue(
                    this.props.minTime
                )} - ${this.props.timeUnit.formatValue(this.props.maxTime)}`;
                this.props.onTimeChange(this.props.time!);
            } else {
                this.props.onTimeChange(time);
                this.lastTime = time;
                this.timeError = this.props.list.powerLimitError;
            }
        } else {
            this.timeError = "Invalid value";
            this.props.onTimeChange(this.props.time!);
        }
    }

    @action
    onValueChange(event: React.ChangeEvent<HTMLInputElement>) {
        this.value = event.target.value;
        let value = this.props.valueUnit.parseValue(this.value);
        if (typeof value === "number") {
            if (value < this.props.minValue || value > this.props.maxValue) {
                this.valueError = `Allowed range: ${this.props.valueUnit.formatValue(
                    this.props.minValue
                )} - ${this.props.valueUnit.formatValue(this.props.maxValue)}`;
                this.props.onValueChange(this.props.value);
            } else {
                this.lastValue = value;
                this.props.onValueChange(value);
                this.valueError = this.props.list.powerLimitError;
            }
        } else {
            this.valueError = "Invalid value";
            this.props.onValueChange(this.props.value);
        }
    }

    render() {
        return (
            <div className="EezStudio_EditEnvelopeValueContainer">
                <table>
                    <tbody>
                        <tr>
                            <td colSpan={2} className="text-center">
                                {this.props.onRemove && (
                                    <button
                                        className="btn btn-sm btn-danger"
                                        onClick={this.props.onRemove}
                                    >
                                        Remove
                                    </button>
                                )}
                            </td>
                        </tr>
                        <tr>
                            <td colSpan={2}>
                                <div className="separator" />
                            </td>
                        </tr>
                        {this.props.time !== undefined && (
                            <tr>
                                <td>
                                    <label>Time</label>
                                </td>
                                <td>
                                    <input
                                        type="text"
                                        className="form-control"
                                        value={this.time}
                                        onChange={this.onTimeChange}
                                    />
                                </td>
                            </tr>
                        )}
                        {this.timeError && (
                            <tr>
                                <td />
                                <td className="text-danger">
                                    {this.timeError}
                                </td>
                            </tr>
                        )}
                        <tr>
                            <td>
                                <label>
                                    {capitalize(this.props.valueUnit.name)}
                                </label>
                            </td>
                            <td>
                                <input
                                    type="text"
                                    className="form-control"
                                    value={this.value}
                                    onChange={this.onValueChange}
                                />
                            </td>
                        </tr>
                        {this.valueError && (
                            <tr>
                                <td />
                                <td className="text-danger">
                                    {this.valueError}
                                </td>
                            </tr>
                        )}
                        <tr>
                            <td />
                            <td>
                                <button
                                    className="btn btn-success"
                                    onClick={this.props.onSave}
                                    disabled={!this.canSave}
                                >
                                    Save
                                </button>
                                &nbsp;
                                <button
                                    className="btn btn-default"
                                    onClick={this.props.onClose}
                                >
                                    Cancel
                                </button>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

export class DragEnvelopePointMouseHandler implements MouseHandler {
    newValue = false;

    target: EventTarget | null = null;
    startEnvelopeValue: IEnvelopePoint;

    startTime: number = 0;
    startPoint: Point = { x: 0, y: 0 };
    lastPoint: Point = { x: 0, y: 0 };

    cursor = "move";

    constructor(
        public chartView: ChartView,
        public valueIndex: number,
        public lineController: EnvelopeLineController
    ) {
        const values = lineController.values;
        this.startEnvelopeValue = { ...values[this.valueIndex] };
        this.startTime = new Date().getTime();
    }

    get list() {
        return (
            this.lineController.yAxisController
                .chartsController as EnvelopeChartsController
        ).list;
    }

    get xAxisController() {
        return this.lineController.yAxisController.chartsController
            .xAxisController;
    }

    get yAxisController() {
        return this.lineController.yAxisController;
    }

    get values() {
        return this.lineController.values;
    }

    get isDragged() {
        return (
            new Date().getTime() - this.startTime > CONF_DRAG_TIME_THRESHOLD ||
            pointDistance(this.startPoint, this.lastPoint) >
                CONF_DRAG_DISTANCE_THRESHOLD
        );
    }

    get isChanged() {
        const value = this.values[this.valueIndex];
        return (
            this.startEnvelopeValue.time !== value.time ||
            this.startEnvelopeValue.value !== value.value
        );
    }

    down(point: SVGPoint, event: PointerEvent) {
        this.startPoint = point;
        this.lastPoint = point;
        this.target = event.target!;
    }

    @action
    move(point: SVGPoint, event: PointerEvent) {
        this.lastPoint = point;

        if (this.isDragged) {
            if (this.valueIndex > 0) {
                const time = getSnapToValue(
                    event,
                    this.xAxisController.pxToValue(point.x),
                    this.xAxisController
                );
                this.values[this.valueIndex].time = clamp(
                    time,
                    this.values[this.valueIndex - 1].time,
                    this.valueIndex + 1 < this.values.length
                        ? this.values[this.valueIndex + 1].time
                        : this.xAxisController.maxValue
                );
            }

            const value = getSnapToValue(
                event,
                this.yAxisController.pxToValue(point.y),
                this.yAxisController
            );

            this.values[this.valueIndex].value = clamp(
                value,
                this.yAxisController.minValue,
                this.yAxisController.maxValue
            );
        }
    }

    editPoint(
        index: number,
        oldTime: number,
        oldValue: number,
        newTime: number,
        newValue: number
    ) {
        // we will remove unnecessary points
        if (
            index - 1 >= 0 &&
            this.values[index - 1].time === newTime &&
            this.values[index - 1].value === newValue
        ) {
            // join this point with previous point
            const removedPoint = this.values[index - 1];
            this.list.$eez_noser_appStore.undoManager.addCommand(
                "Edit envelope list",
                this.list.$eez_noser_appStore.instrumentListStore,
                this.list,
                {
                    execute: action(() => {
                        this.values.splice(index - 1, 1);
                        this.values[index - 1].time = newTime;
                        this.values[index - 1].value = newValue;
                    }),
                    undo: action(() => {
                        this.values.splice(index - 1, 0, removedPoint);
                        this.values[index].time = oldTime;
                        this.values[index].value = oldValue;
                    })
                }
            );
        } else if (
            index + 1 < this.values.length &&
            this.values[index + 1].time === newTime &&
            this.values[index + 1].value === newValue
        ) {
            // join this point with next point
            const removedPoint = this.values[index + 1];
            this.list.$eez_noser_appStore.undoManager.addCommand(
                "Edit envelope list",
                this.list.$eez_noser_appStore.instrumentListStore,
                this.list,
                {
                    execute: action(() => {
                        this.values.splice(index + 1, 1);
                        this.values[index].time = newTime;
                        this.values[index].value = newValue;
                    }),
                    undo: action(() => {
                        this.values.splice(index + 1, 0, removedPoint);
                        this.values[index].time = oldTime;
                        this.values[index].value = oldValue;
                    })
                }
            );
        } else if (
            index - 2 >= 0 &&
            this.values[index - 2].time === newTime &&
            this.values[index - 2].value === newValue
        ) {
            // remove previous point and join this point with one before previous point
            const removedPoint1 = this.values[index - 2];
            const removedPoint2 = this.values[index - 1];
            this.list.$eez_noser_appStore.undoManager.addCommand(
                "Edit envelope list",
                this.list.$eez_noser_appStore.instrumentListStore,
                this.list,
                {
                    execute: action(() => {
                        this.values.splice(index - 2, 2);
                        this.values[index - 2].time = newTime;
                        this.values[index - 2].value = newValue;
                    }),
                    undo: action(() => {
                        this.values.splice(
                            index - 2,
                            0,
                            removedPoint1,
                            removedPoint2
                        );
                        this.values[index].time = oldTime;
                        this.values[index].value = oldValue;
                    })
                }
            );
        } else if (
            index + 2 < this.values.length &&
            this.values[index + 2].time === newTime &&
            this.values[index + 2].value === newValue
        ) {
            // remove next point and join this point with one after next point
            const removedPoint1 = this.values[index + 1];
            const removedPoint2 = this.values[index + 2];
            this.list.$eez_noser_appStore.undoManager.addCommand(
                "Edit envelope list",
                this.list.$eez_noser_appStore.instrumentListStore,
                this.list,
                {
                    execute: action(() => {
                        this.values.splice(index + 1, 2);
                        this.values[index].time = newTime;
                        this.values[index].value = newValue;
                    }),
                    undo: action(() => {
                        this.values.splice(
                            index + 1,
                            0,
                            removedPoint1,
                            removedPoint2
                        );
                        this.values[index].time = oldTime;
                        this.values[index].value = oldValue;
                    })
                }
            );
        } else if (index - 2 >= 0 && this.values[index - 2].time === newTime) {
            // remove previous point
            const removedPoint = this.values[index - 1];
            this.list.$eez_noser_appStore.undoManager.addCommand(
                "Edit envelope list",
                this.list.$eez_noser_appStore.instrumentListStore,
                this.list,
                {
                    execute: action(() => {
                        this.values.splice(index - 1, 1);
                        this.values[index - 1].time = newTime;
                        this.values[index - 1].value = newValue;
                    }),
                    undo: action(() => {
                        this.values.splice(index - 1, 0, removedPoint);
                        this.values[index].time = oldTime;
                        this.values[index].value = oldValue;
                    })
                }
            );
        } else if (
            index + 2 < this.values.length &&
            this.values[index + 2].time === newTime
        ) {
            // remove next point
            const removedPoint = this.values[index + 1];
            this.list.$eez_noser_appStore.undoManager.addCommand(
                "Edit envelope list",
                this.list.$eez_noser_appStore.instrumentListStore,
                this.list,
                {
                    execute: action(() => {
                        this.values.splice(index + 1, 1);
                        this.values[index].time = newTime;
                        this.values[index].value = newValue;
                    }),
                    undo: action(() => {
                        this.values.splice(index + 1, 0, removedPoint);
                        this.values[index].time = oldTime;
                        this.values[index].value = oldValue;
                    })
                }
            );
        } else {
            // just change this point
            this.list.$eez_noser_appStore.undoManager.addCommand(
                "Edit envelope list",
                this.list.$eez_noser_appStore.instrumentListStore,
                this.list,
                {
                    execute: action(() => {
                        this.values[index].time = newTime;
                        this.values[index].value = newValue;
                    }),
                    undo: action(() => {
                        this.values[index].time = oldTime;
                        this.values[index].value = oldValue;
                    })
                }
            );
        }
    }

    up(
        point: SVGPoint | undefined,
        event: PointerEvent | undefined,
        cancel: boolean
    ) {
        if (this.isChanged) {
            const oldTime = this.startEnvelopeValue.time;
            const oldValue = this.startEnvelopeValue.value;

            if (this.list.powerLimitError) {
                this.values[this.valueIndex].time = oldTime;
                this.values[this.valueIndex].value = oldValue;
            } else {
                const newTime = this.values[this.valueIndex].time;
                const newValue = this.values[this.valueIndex].value;

                this.editPoint(
                    this.valueIndex,
                    oldTime,
                    oldValue,
                    newTime,
                    newValue
                );
            }
        }

        if (!this.isDragged && !this.newValue && this.chartView.svg) {
            const target = $(this.chartView.svg).find(
                `[data-value-index=${this.valueIndex}]`
            );
            if (target.length) {
                this.showEditEnvelopePointPopup(target[0]);
            }
        }
    }

    showEditEnvelopePointPopup(targetElement: Element) {
        const values = this.lineController.values;

        let time = undefined;
        let minTime = this.xAxisController.minValue;
        let maxTime = this.xAxisController.maxValue;
        let onRemove;

        if (this.valueIndex > 0) {
            time = values[this.valueIndex].time;
            minTime = values[this.valueIndex - 1].time;
            if (this.valueIndex + 1 < values.length) {
                maxTime = values[this.valueIndex + 1].time;
            }

            if (values.length > 2) {
                onRemove = () => {
                    popup.dispose();

                    const value = values[this.valueIndex];

                    this.list.$eez_noser_appStore.undoManager.addCommand(
                        "Edit envelope list",
                        this.list.$eez_noser_appStore.instrumentListStore,
                        this.list,
                        {
                            execute: action(() => {
                                values.splice(this.valueIndex, 1);
                            }),

                            undo: action(() => {
                                values.splice(this.valueIndex, 0, value);
                            })
                        }
                    );
                };
            }
        }

        const oldTime = this.values[this.valueIndex].time;
        const oldValue = this.values[this.valueIndex].value;

        const popup = showPopup(
            targetElement,
            <EditEnvelopeValue
                list={this.list}
                time={time}
                minTime={minTime}
                maxTime={maxTime}
                timeUnit={this.xAxisController.unit}
                value={this.values[this.valueIndex].value}
                minValue={this.lineController.yAxisController.minValue}
                maxValue={this.lineController.yAxisController.maxValue}
                valueUnit={this.lineController.yAxisController.unit}
                onTimeChange={time => {
                    runInAction(() => {
                        values[this.valueIndex].time = time;
                    });
                }}
                onValueChange={value => {
                    runInAction(() => {
                        values[this.valueIndex].value = value;
                    });
                }}
                onClose={() => {
                    popup.dispose();

                    runInAction(() => {
                        this.values[this.valueIndex].time = oldTime;
                        this.values[this.valueIndex].value = oldValue;
                    });
                }}
                onSave={() => {
                    popup.dispose();

                    const newTime = this.values[this.valueIndex].time;
                    const newValue = this.values[this.valueIndex].value;

                    this.editPoint(
                        this.valueIndex,
                        oldTime,
                        oldValue,
                        newTime,
                        newValue
                    );
                }}
                onRemove={onRemove}
            />
        );
    }

    updateCursor(event: PointerEvent | undefined, cursor: ICursor) {
        cursor.visible = true;
        cursor.time = this.values[this.valueIndex].time;
        cursor.value = this.values[this.valueIndex].value;
        cursor.lineController = this.lineController;
        cursor.addPoint = false;
        cursor.error = this.list.powerLimitError;
    }

    render() {
        return null;
    }
}

export class EnvelopeLineController extends LineController {
    constructor(public id: string, yAxisController: AxisController) {
        super(id, yAxisController);
    }

    get list() {
        return (
            this.yAxisController.chartsController as EnvelopeChartsController
        ).list;
    }

    @computed
    get values() {
        return this.list.data[
            this.yAxisController.unit.name as "voltage" | "current"
        ] as IEnvelopePoint[];
    }

    @computed
    get yMin(): number {
        //return Math.min(...this.values.map(value => value.value));
        return this.yAxisController.axisModel.minValue;
    }

    @computed
    get yMax(): number {
        //return Math.max(...this.values.map(value => value.value));
        return this.yAxisController.axisModel.maxValue;
    }

    getWaveformModel() {
        return null;
    }

    getNearestValuePoint(point: Point): Point {
        // TODO
        return { x: 0, y: 0 };
    }

    updateCursor(cursor: ICursor, point: Point, event: PointerEvent) {
        const time = getSnapToValue(
            event,
            this.xAxisController.pxToValue(point.x),
            this.xAxisController
        );

        let x = this.xAxisController.valueToPx(time);
        if (x < 0 || x > this.xAxisController.chartsController.chartWidth) {
            return;
        }

        const value = getSnapToValue(
            event,
            this.yAxisController.pxToValue(point.y),
            this.yAxisController
        );

        let y = this.yAxisController.valueToPx(value);
        if (y < 0 || y > this.yAxisController.chartsController.chartHeight) {
            return;
        }

        cursor.visible = true;
        cursor.lineController = this;

        for (let i = 0; i < this.values.length; i++) {
            if (
                pointDistance(
                    { x, y },
                    {
                        x: this.xAxisController.valueToPx(this.values[i].time),
                        y: this.yAxisController.valueToPx(this.values[i].value)
                    }
                ) <= CONF_ENVELOPE_POINT_RADIUS ||
                pointDistance(point, {
                    x: this.xAxisController.valueToPx(this.values[i].time),
                    y: this.yAxisController.valueToPx(this.values[i].value)
                }) < pointDistance(point, { x, y })
            ) {
                cursor.time = this.values[i].time;
                cursor.value = this.values[i].value;
                cursor.addPoint = false;
                return;
            }
        }

        let i;
        for (i = 0; i < this.values.length; i++) {
            if (x < this.xAxisController.valueToPx(this.values[i].time)) {
                break;
            }
        }

        cursor.time = time;
        cursor.value = value;
        cursor.valueIndex = i;

        // check power limit error
        const newValue = {
            time: cursor.time,
            value: cursor.value
        };
        this.values.splice(cursor.valueIndex, 0, newValue);
        cursor.error =
            time < 0 ? "Time must be >= 0" : this.list.powerLimitError;
        this.values.splice(cursor.valueIndex, 1);

        cursor.addPoint = !cursor.error;
    }

    addPoint(chartView: ChartView, cursor: ICursor): MouseHandler | undefined {
        // add new value
        const value = {
            time: cursor.time,
            value: cursor.value
        };

        let valueIndex = cursor.valueIndex;
        if (valueIndex === -1) {
            valueIndex = this.values.length;
        }

        if (
            valueIndex - 2 >= 0 &&
            this.values[valueIndex - 2].time === value.time
        ) {
            valueIndex--;
            const oldValue = this.values[valueIndex];
            this.list.$eez_noser_appStore.undoManager.addCommand(
                "Edit envelope list",
                this.list.$eez_noser_appStore.instrumentListStore,
                this.list,
                {
                    execute: action(() => {
                        this.values[valueIndex] = value;
                    }),
                    undo: action(() => {
                        this.values[valueIndex] = oldValue;
                    })
                }
            );
        } else {
            this.list.$eez_noser_appStore.undoManager.addCommand(
                "Edit envelope list",
                this.list.$eez_noser_appStore.instrumentListStore,
                this.list,
                {
                    execute: action(() => {
                        this.values.splice(valueIndex, 0, value);
                    }),
                    undo: action(() => {
                        this.values.splice(valueIndex, 1);
                    })
                }
            );
        }

        const mouseHandler = new DragEnvelopePointMouseHandler(
            chartView,
            valueIndex,
            this
        );

        mouseHandler.newValue = true;

        return mouseHandler;
    }

    onDragStart(
        chartView: ChartView,
        event: PointerEvent
    ): MouseHandler | undefined {
        let valueIndex = parseInt(
            $(event.target!)
                .closest("[data-value-index]")
                .attr("data-value-index") || ""
        );

        let lineControllerId = $(event.target!)
            .closest("[data-line-controller-id]")
            .attr("data-line-controller-id");

        if (
            typeof valueIndex === "number" &&
            !isNaN(valueIndex) &&
            lineControllerId === this.id
        ) {
            // move existing value
            return new DragEnvelopePointMouseHandler(
                chartView,
                valueIndex,
                this
            );
        }
        return undefined;
    }

    render(clipId: string) {
        return (
            <EnvelopeLineView
                key={this.id}
                envelopeLineController={this}
                clipId={clipId}
            />
        );
    }

    closestPoint(point: Point): Point | undefined {
        let minDistance: number | undefined = undefined;
        let closestPoint: Point | undefined;

        for (let i = 1; i < this.values.length; i++) {
            const pointOnSegment = closestPointOnSegment(
                point,
                {
                    x: this.xAxisController.valueToPx(this.values[i - 1].time),
                    y: this.yAxisController.valueToPx(this.values[i - 1].value)
                },
                {
                    x: this.xAxisController.valueToPx(this.values[i].time),
                    y: this.yAxisController.valueToPx(this.values[i].value)
                }
            );

            const distance = pointDistance(point, pointOnSegment);

            if (minDistance === undefined || distance < minDistance) {
                minDistance = distance;
                closestPoint = pointOnSegment;
            }
        }

        return closestPoint;
    }
}

////////////////////////////////////////////////////////////////////////////////

@observer
class EnvelopeLine extends React.Component<
    {
        chartLeft: number;
        chartBottom: number;
        from: IEnvelopePoint;
        to: IEnvelopePoint;
        xFrom: number;
        xScale: number;
        yFrom: number;
        yScale: number;
        axisModel: IAxisModel;
    },
    {}
> {
    render() {
        const {
            chartLeft,
            chartBottom,
            from,
            to,
            xFrom,
            xScale,
            yFrom,
            yScale,
            axisModel
        } = this.props;
        return (
            <line
                x1={chartLeft + (from.time - xFrom) * xScale}
                y1={chartBottom - (from.value - yFrom) * yScale}
                x2={chartLeft + (to.time - xFrom) * xScale}
                y2={chartBottom - (to.value - yFrom) * yScale}
                stroke={axisModel.color}
                strokeWidth={1}
                strokeOpacity={1}
            />
        );
    }
}

@observer
class EnvelopeLines extends React.Component<
    {
        envelopeLineController: EnvelopeLineController;
    },
    {}
> {
    render() {
        const envelopeLineController = this.props.envelopeLineController;
        const { values } = envelopeLineController;
        const yAxisController = envelopeLineController.yAxisController;
        const chartsController = yAxisController.chartsController;
        const xAxisController = chartsController.xAxisController;
        const { chartLeft, chartBottom } = chartsController;

        return (
            <g>
                {_range(values.length - 1).map(i => (
                    <EnvelopeLine
                        key={i}
                        chartLeft={chartLeft}
                        chartBottom={chartBottom}
                        from={values[i]}
                        to={values[i + 1]}
                        xFrom={xAxisController.from}
                        xScale={xAxisController.scale}
                        yFrom={yAxisController.from}
                        yScale={yAxisController.scale}
                        axisModel={yAxisController.axisModel}
                    />
                ))}
            </g>
        );
    }
}

@observer
class EnvelopeValue extends React.Component<
    {
        index: number;
        value: IEnvelopePoint;
        chartLeft: number;
        chartBottom: number;
        xFrom: number;
        xScale: number;
        yFrom: number;
        yScale: number;
        radius: number;
        axisModel: IAxisModel;
    },
    {}
> {
    render() {
        const {
            index,
            value,
            chartLeft,
            chartBottom,
            xFrom,
            xScale,
            yFrom,
            yScale,
            radius,
            axisModel
        } = this.props;
        return (
            <circle
                className="EezStudio_EnvelopeValueCircle"
                data-value-index={index}
                cx={chartLeft + (value.time - xFrom) * xScale}
                cy={chartBottom - (value.value - yFrom) * yScale}
                r={radius}
                stroke={axisModel.color}
                fill={axisModel.color}
            />
        );
    }
}

@observer
class EnvelopeValues extends React.Component<
    {
        envelopeLineController: EnvelopeLineController;
    },
    {}
> {
    render() {
        const envelopeLineController = this.props.envelopeLineController;
        const { values } = envelopeLineController;
        const yAxisController = envelopeLineController.yAxisController;
        const chartsController = yAxisController.chartsController;
        const xAxisController = chartsController.xAxisController;
        const { chartLeft, chartBottom } = chartsController;

        return (
            <g data-line-controller-id={envelopeLineController.id}>
                {values.map((value, i) => (
                    <EnvelopeValue
                        key={i}
                        index={i}
                        value={value}
                        chartLeft={chartLeft}
                        chartBottom={chartBottom}
                        xFrom={xAxisController.from}
                        xScale={xAxisController.scale}
                        yFrom={yAxisController.from}
                        yScale={yAxisController.scale}
                        radius={CONF_ENVELOPE_POINT_RADIUS}
                        axisModel={yAxisController.axisModel}
                    />
                ))}
            </g>
        );
    }
}

@observer
export class EnvelopeLineView extends React.Component<
    {
        envelopeLineController: EnvelopeLineController;
        clipId: string;
    },
    {}
> {
    render() {
        return (
            <g clipPath={`url(#${this.props.clipId})`}>
                <EnvelopeLines
                    envelopeLineController={this.props.envelopeLineController}
                />
                <EnvelopeValues
                    envelopeLineController={this.props.envelopeLineController}
                />
            </g>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

@observer
class EnvelopeChartsHeader extends React.Component<
    { chartsController: ChartsController },
    {}
> {
    get list() {
        return (this.props.chartsController as EnvelopeChartsController).list;
    }

    editProperties = () => {
        showGenericDialog({
            dialogDefinition: {
                fields: [
                    {
                        name: "name",
                        type: "string",
                        validators: [
                            validators.required,
                            validators.unique(
                                this.list,
                                this.list.$eez_noser_appStore.instrumentLists
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
                        validators: [validators.rangeExclusive(0)]
                    },
                    {
                        name: "numSamples",
                        displayName: "No. of samples",
                        type: "integer",
                        validators: [
                            validators.rangeInclusive(
                                1,
                                this.list.$eez_noser_appStore.instrument!
                                    .listsMaxPointsProperty
                            )
                        ]
                    }
                ]
            },

            values: {
                name: this.list.name,
                description: this.list.description,
                duration: this.list.data.duration,
                numSamples: this.list.data.numSamples
            }
        })
            .then(result => {
                const list = this.list;

                const oldName = list.name;
                const oldDescription = list.description;
                const oldDuration = list.data.duration;
                const oldNumSamples = list.data.numSamples;

                const newName = result.values.name;
                const newDescription = result.values.description;
                const newDuration = result.values.duration;
                const newNumSamples = result.values.numSamples;

                if (
                    oldName !== newName ||
                    oldDescription !== newDescription ||
                    oldDuration !== newDuration ||
                    oldNumSamples !== newNumSamples
                ) {
                    this.list.$eez_noser_appStore.undoManager.addCommand(
                        "Edit envelope list",
                        this.list.$eez_noser_appStore.instrumentListStore,
                        list,
                        {
                            execute: action(() => {
                                list.name = newName;
                                list.description = newDescription;
                                list.data.duration = newDuration;
                                list.data.numSamples = newNumSamples;
                            }),
                            undo: action(() => {
                                list.name = oldName;
                                list.description = oldDescription;
                                list.data.duration = oldDuration;
                                list.data.numSamples = oldNumSamples;
                            })
                        }
                    );
                }
            })
            .catch(() => {});
    };

    get canClearAllPoints() {
        return this.canClearAllVoltagePoints || this.canClearAllCurrentPoints;
    }

    @action.bound
    clearAllPoints() {
        if (this.canClearAllPoints) {
            const oldVoltage = this.list.data.voltage;
            const oldCurrent = this.list.data.current;

            const defaultEnvelopeListData = getDefaultEnvelopeListData(
                this.list.$eez_noser_instrument
            );

            const newVoltage = objectClone(defaultEnvelopeListData.voltage);
            newVoltage[1].time = this.list.data.duration;

            const newCurrent = objectClone(defaultEnvelopeListData.current);
            newCurrent[1].time = this.list.data.duration;

            this.list.$eez_noser_appStore.undoManager.addCommand(
                "Edit envelope list",
                this.list.$eez_noser_appStore.instrumentListStore,
                this.list,
                {
                    execute: action(() => {
                        this.list.data.voltage = newVoltage;
                        this.list.data.current = newCurrent;
                    }),
                    undo: action(() => {
                        this.list.data.voltage = oldVoltage;
                        this.list.data.current = oldCurrent;
                    })
                }
            );
        }
    }

    get canClearAllVoltagePoints() {
        return (
            this.list.data.voltage.length > 2 ||
            this.list.data.voltage[1].time !== this.list.data.duration
        );
    }

    @action.bound
    clearAllVoltagePoints() {
        if (this.canClearAllVoltagePoints) {
            const oldVoltage = this.list.data.voltage;

            const defaultEnvelopeListData = getDefaultEnvelopeListData(
                this.list.$eez_noser_instrument
            );

            const newVoltage = defaultEnvelopeListData.voltage.slice();
            newVoltage[1].time = this.list.data.duration;

            this.list.$eez_noser_appStore.undoManager.addCommand(
                "Edit envelope list",
                this.list.$eez_noser_appStore.instrumentListStore,
                this.list,
                {
                    execute: action(() => {
                        this.list.data.voltage = newVoltage;
                    }),
                    undo: action(() => {
                        this.list.data.voltage = oldVoltage;
                    })
                }
            );
        }
    }

    get canClearAllCurrentPoints() {
        return (
            this.list.data.current.length > 2 ||
            this.list.data.current[1].time !== this.list.data.duration
        );
    }

    @action.bound
    clearAllCurrentPoints() {
        if (this.canClearAllCurrentPoints) {
            const oldCurrent = this.list.data.current;

            const defaultEnvelopeListData = getDefaultEnvelopeListData(
                this.list.$eez_noser_instrument
            );

            const newCurrent = defaultEnvelopeListData.current.slice();
            newCurrent[1].time = this.list.data.duration;

            this.list.$eez_noser_appStore.undoManager.addCommand(
                "Edit envelope list",
                this.list.$eez_noser_appStore.instrumentListStore,
                this.list,
                {
                    execute: action(() => {
                        this.list.data.current = newCurrent;
                    }),
                    undo: action(() => {
                        this.list.data.current = oldCurrent;
                    })
                }
            );
        }
    }

    render() {
        return (
            <Header className="EezStudio_ListChartViewHeader">
                <Toolbar>
                    <Toolbar>
                        <ButtonAction
                            text="Edit Properties"
                            className="btn-secondary"
                            title="Edit properties"
                            onClick={this.editProperties}
                        />
                        <DropdownButtonAction
                            text="Clear Points"
                            title="Clear points"
                            className="btn-secondary"
                        >
                            <DropdownItem
                                text="Clear All Points"
                                onClick={this.clearAllPoints}
                                disabled={!this.canClearAllPoints}
                            />
                            <DropdownItem
                                text="Clear All Voltage Points"
                                onClick={this.clearAllVoltagePoints}
                                disabled={!this.canClearAllVoltagePoints}
                            />
                            <DropdownItem
                                text="Clear All Current Points"
                                onClick={this.clearAllCurrentPoints}
                                disabled={!this.canClearAllCurrentPoints}
                            />
                        </DropdownButtonAction>
                    </Toolbar>
                    <CommonTools
                        chartsController={this.props.chartsController}
                    />
                </Toolbar>
            </Header>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

interface EnvelopeDetailsViewProps {
    list: EnvelopeList;
}

@observer
export class EnvelopeDetailsView extends React.Component<
    EnvelopeDetailsViewProps,
    {}
> {
    @observable list: EnvelopeList = this.props.list;

    @computed
    get chartsController() {
        return createEnvelopeChartsController(
            this.list,
            displayOption.get() as ChartsDisplayOption,
            "editable"
        );
    }

    @action
    componentDidUpdate(prevProps: any) {
        if (this.props != prevProps) {
            this.list = this.props.list;
        }
    }

    render() {
        return (
            <VerticalHeaderWithBody>
                <EnvelopeChartsHeader
                    chartsController={this.chartsController}
                />
                <Body>
                    <ChartsView
                        chartsController={this.chartsController}
                        tabIndex={0}
                    />
                </Body>
            </VerticalHeaderWithBody>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

export class EnvelopeChartsController extends ChartsController {
    constructor(
        public list: EnvelopeList,
        mode: ChartMode,
        xAxisModel: IAxisModel
    ) {
        super(mode, xAxisModel, list.data.viewOptions);
    }

    get chartViewOptionsProps() {
        return {
            showRenderAlgorithm: false,
            showShowSampledDataOption: true
        };
    }
}

////////////////////////////////////////////////////////////////////////////////

class EnvelopeChartController extends ChartController {
    constructor(
        chartsController: EnvelopeChartsController,
        displayOption: ChartsDisplayOption
    ) {
        super(chartsController, displayOption);
    }

    customRender() {
        const envelopeChartsController = this
            .chartsController as EnvelopeChartsController;
        const data = envelopeChartsController.list.data;
        const invalidRegion =
            envelopeChartsController.xAxisController.maxValue - data.duration;
        if (invalidRegion > 0) {
            let x =
                Math.round(
                    this.chartsController.chartLeft +
                        Math.max(
                            this.xAxisController.valueToPx(data.duration),
                            0
                        )
                ) + 0.5;
            if (x < this.chartsController.chartRight) {
                let width = this.xAxisController.valueToPx(invalidRegion);
                let y = this.chartsController.chartTop;
                let height = this.chartsController.chartHeight;

                // render invalid region
                return (
                    <rect
                        x={x}
                        y={y}
                        width={width}
                        height={height}
                        fill="rgba(255, 0, 0, 0.1)"
                    />
                );
            }
        }

        return null;
    }
}

////////////////////////////////////////////////////////////////////////////////

function getLineControllers(
    list: EnvelopeList,
    axisController: AxisController
) {
    const lineControllers: ILineController[] = [];

    lineControllers.push(
        new EnvelopeLineController(
            "envelope-" + axisController.position,
            axisController
        )
    );

    if (globalViewOptions.showSampledData) {
        lineControllers.push(
            new TableLineController(
                "envelope-sample-data-" + axisController.position,
                axisController
            )
        );
    }

    return lineControllers;
}

export function createEnvelopeChartsController(
    list: EnvelopeList,
    displayOption: ChartsDisplayOption,
    mode: ChartMode
) {
    const chartsController = new EnvelopeChartsController(
        list,
        mode,
        list.data.timeAxisModel
    );

    const charts: ChartController[] = [];

    if (displayOption === "both") {
        const chartController = new EnvelopeChartController(
            chartsController,
            displayOption
        );

        chartController.createYAxisController(list.data.voltageAxisModel);
        chartController.createYAxisControllerOnRightSide(
            list.data.currentAxisModel
        );

        chartController.lineControllers.push(
            ...getLineControllers(list, chartController.yAxisController)
        );
        chartController.lineControllers.push(
            ...getLineControllers(
                list,
                chartController.yAxisControllerOnRightSide!
            )
        );

        charts.push(chartController);
    } else {
        if (displayOption === "voltage" || displayOption === "split") {
            const chartController = new EnvelopeChartController(
                chartsController,
                "voltage"
            );
            chartController.createYAxisController(list.data.voltageAxisModel);
            chartController.lineControllers.push(
                ...getLineControllers(list, chartController.yAxisController)
            );
            charts.push(chartController);
        }

        if (displayOption === "current" || displayOption === "split") {
            const chartController = new EnvelopeChartController(
                chartsController,
                "current"
            );
            chartController.createYAxisController(list.data.currentAxisModel);
            chartController.lineControllers.push(
                ...getLineControllers(list, chartController.yAxisController)
            );
            charts.push(chartController);
        }
    }

    chartsController.chartControllers = charts;

    return chartsController;
}
