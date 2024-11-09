import React from "react";
import {
    observable,
    computed,
    action,
    runInAction,
    toJS,
    makeObservable
} from "mobx";
import { observer } from "mobx-react";
import { range, max } from "lodash";

import { clamp, objectClone } from "eez-studio-shared/util";
import {
    Point,
    pointDistance,
    closestPointOnSegment
} from "eez-studio-shared/geometry";
import { capitalize } from "eez-studio-shared/string";
import {
    CURRENT_UNIT,
    IUnit,
    TIME_UNIT,
    VOLTAGE_UNIT
} from "eez-studio-shared/units";
import { validators } from "eez-studio-shared/validation";

import {
    VerticalHeaderWithBody,
    Body,
    Header
} from "eez-studio-ui/header-with-body";
import {
    ChartMode,
    IChartView,
    ChartController,
    IAxisModel,
    ICursor,
    LineController,
    ILineController,
    MouseHandler,
    IAxisController,
    IChartController
} from "eez-studio-ui/chart/chart";
import {
    CONF_CURSOR_RADIUS,
    ChartsController,
    ChartsView
} from "eez-studio-ui/chart/chart";
import { globalViewOptions } from "eez-studio-ui/chart/GlobalViewOptions";
import { showPopup } from "eez-studio-ui/popup";
import { Toolbar } from "eez-studio-ui/toolbar";
import {
    ButtonAction,
    DropdownButtonAction,
    DropdownItem
} from "eez-studio-ui/action";
import { showGenericDialog } from "eez-studio-ui/generic-dialog";
import { getSnapToValue } from "eez-studio-ui/chart/rulers";

import type { InstrumentObject } from "instrument/instrument-object";

import type {
    IAppStore,
    IInstrumentObject
} from "instrument/window/history/history";

import {
    BaseList,
    BaseListData,
    getMaxVoltage,
    getMaxCurrent,
    checkPower,
    getPowerLimitErrorMessage,
    ChartViewOptions,
    ListAxisModel
} from "instrument/window/lists/store-renderer";
import {
    displayOption,
    ChartsDisplayOption,
    CommonTools
} from "instrument/window/lists/common-tools";
import { TableLineController } from "instrument/window/lists/table";
import { getTableListData } from "instrument/window/lists/table-data";

////////////////////////////////////////////////////////////////////////////////

// @todo put these in shared/config.ts
const CONF_DRAG_TIME_THRESHOLD = 250;
const CONF_DRAG_DISTANCE_THRESHOLD = 5;

const CONF_ENVELOPE_POINT_RADIUS = CONF_CURSOR_RADIUS;

////////////////////////////////////////////////////////////////////////////////

function getDefaultEnvelopeListData(instrument: IInstrumentObject) {
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
    duration: number;
    numSamples: number;
    voltage: IEnvelopePoint[];
    current: IEnvelopePoint[];

    constructor(list: BaseList, props: any) {
        super(list, props);

        makeObservable(this, {
            duration: observable,
            numSamples: observable,
            voltage: observable,
            current: observable
        });

        this.duration = props.duration;
        this.numSamples = props.numSamples;
        this.voltage = props.voltage;
        this.current = props.current;
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
    data: EnvelopeListData;

    constructor(props: any) {
        super(props);

        makeObservable(this, {
            data: observable
        });

        this.type = "envelope";
        this.data = new EnvelopeListData(this, props.data);
    }

    getMaxTime() {
        return Math.max(
            max(this.data.voltage.map(point => point.time)) || 0,
            max(this.data.current.map(point => point.time)) || 0,
            this.data.duration
        );
    }

    getRange(model: ListAxisModel) {
        function getRangeFromEnvelopePoints(points: IEnvelopePoint[]) {
            if (points.length == 0) {
                return {
                    from: model.minValue,
                    to: model.maxValue
                };
            }
            let min = model.maxValue;
            let max = model.minValue;

            for (let i = 0; i < points.length; i++) {
                if (points[i].value < min) {
                    min = points[i].value;
                }
                if (points[i].value > max) {
                    max = points[i].value;
                }
            }

            return {
                from: min,
                to: max
            };
        }

        if (model.unit.name == "voltage") {
            return getRangeFromEnvelopePoints(this.data.voltage);
        } else if (model.unit.name == "current") {
            return getRangeFromEnvelopePoints(this.data.current);
        } else {
            return {
                from: 0,
                to: this.getMaxTime()
            };
        }
    }

    createChartsController(
        appStore: IAppStore,
        displayOption: ChartsDisplayOption,
        mode: ChartMode
    ): ChartsController {
        return createEnvelopeChartsController(
            appStore,
            this,
            displayOption,
            mode
        );
    }

    renderDetailsView(appStore: IAppStore): React.ReactNode {
        return <EnvelopeDetailsView appStore={appStore} list={this} />;
    }
}

////////////////////////////////////////////////////////////////////////////////

const EditEnvelopeValue = observer(
    class EditEnvelopeValue extends React.Component<
        {
            appStore: IAppStore;
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

            makeObservable(this, {
                time: observable,
                timeError: observable,
                value: observable,
                valueError: observable,
                lastTime: observable,
                lastValue: observable,
                canSave: computed,
                instrument: computed,
                tableListData: computed,
                powerLimitError: computed,
                onTimeChange: action,
                onValueChange: action
            });
        }

        time =
            this.props.time && this.props.timeUnit.formatValue(this.props.time);
        timeError: string | undefined;
        value = this.props.valueUnit.formatValue(this.props.value);
        valueError: string | undefined;

        lastTime: number | undefined = this.props.time;
        lastValue: number = this.props.value;

        get canSave() {
            return (
                !this.timeError &&
                !this.valueError &&
                (this.props.time !== this.lastTime ||
                    this.props.value !== this.lastValue)
            );
        }

        get instrument() {
            return this.props.appStore.instrument;
        }

        get tableListData() {
            return getTableListData(this.props.list, this.instrument);
        }

        get powerLimitError() {
            for (let i = 0; i < this.tableListData.dwell.length; i++) {
                let power =
                    this.tableListData.voltage[i] *
                    this.tableListData.current[i];
                if (!checkPower(power, this.instrument)) {
                    return getPowerLimitErrorMessage(this.instrument);
                }
            }
            return undefined;
        }

        onTimeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
            this.time = event.target.value;
            let time = this.props.timeUnit.parseValue(this.time);
            if (typeof time === "number") {
                if (time < this.props.minTime || time > this.props.maxTime) {
                    this.timeError = `Allowed range: ${this.props.timeUnit.formatValue(
                        this.props.minTime
                    )} - ${this.props.timeUnit.formatValue(
                        this.props.maxTime
                    )}`;
                    this.props.onTimeChange(this.props.time!);
                } else {
                    this.props.onTimeChange(time);
                    this.lastTime = time;
                    this.timeError = this.powerLimitError;
                }
            } else {
                this.timeError = "Invalid value";
                this.props.onTimeChange(this.props.time!);
            }
        };

        onValueChange = (event: React.ChangeEvent<HTMLInputElement>) => {
            this.value = event.target.value;
            let value = this.props.valueUnit.parseValue(this.value);
            if (typeof value === "number") {
                if (
                    value < this.props.minValue ||
                    value > this.props.maxValue
                ) {
                    this.valueError = `Allowed range: ${this.props.valueUnit.formatValue(
                        this.props.minValue
                    )} - ${this.props.valueUnit.formatValue(
                        this.props.maxValue
                    )}`;
                    this.props.onValueChange(this.props.value);
                } else {
                    this.lastValue = value;
                    this.props.onValueChange(value);
                    this.valueError = this.powerLimitError;
                }
            } else {
                this.valueError = "Invalid value";
                this.props.onValueChange(this.props.value);
            }
        };

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
);

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
        public appStore: IAppStore,
        public chartView: IChartView,
        public valueIndex: number,
        public lineController: EnvelopeLineController
    ) {
        makeObservable(this, {
            instrument: computed,
            tableListData: computed,
            powerLimitError: computed,
            move: action
        });

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

    get instrument() {
        return this.appStore.instrument;
    }

    get tableListData() {
        return getTableListData(this.list, this.instrument);
    }

    get powerLimitError() {
        for (let i = 0; i < this.tableListData.dwell.length; i++) {
            let power =
                this.tableListData.voltage[i] * this.tableListData.current[i];
            if (!checkPower(power, this.instrument)) {
                return getPowerLimitErrorMessage(this.instrument);
            }
        }
        return undefined;
    }

    down(point: SVGPoint, event: PointerEvent) {
        this.startPoint = point;
        this.lastPoint = point;
        this.target = event.target!;
    }

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
            this.appStore.undoManager!.addCommand(
                "Edit envelope list",
                this.appStore.instrumentListStore!,
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
            this.appStore.undoManager!.addCommand(
                "Edit envelope list",
                this.appStore.instrumentListStore!,
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
            this.appStore.undoManager!.addCommand(
                "Edit envelope list",
                this.appStore.instrumentListStore!,
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
            this.appStore.undoManager!.addCommand(
                "Edit envelope list",
                this.appStore.instrumentListStore!,
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
            this.appStore.undoManager!.addCommand(
                "Edit envelope list",
                this.appStore.instrumentListStore!,
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
            this.appStore.undoManager!.addCommand(
                "Edit envelope list",
                this.appStore.instrumentListStore!,
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
            this.appStore.undoManager!.addCommand(
                "Edit envelope list",
                this.appStore.instrumentListStore!,
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

            if (this.powerLimitError) {
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

                    this.appStore.undoManager!.addCommand(
                        "Edit envelope list",
                        this.appStore.instrumentListStore!,
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
                appStore={this.appStore}
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
        cursor.error = this.powerLimitError;
    }

    render() {
        return null;
    }
}

export class EnvelopeLineController extends LineController {
    constructor(
        private appStore: IAppStore,
        public id: string,
        yAxisController: IAxisController
    ) {
        super(id, yAxisController);

        makeObservable(this, {
            values: computed,
            yMin: computed,
            yMax: computed,
            instrument: computed,
            tableListData: computed,
            limitError: computed
        });
    }

    get list() {
        return (
            this.yAxisController.chartsController as EnvelopeChartsController
        ).list;
    }

    get values() {
        return this.list.data[
            this.yAxisController.unit.name as "voltage" | "current"
        ] as IEnvelopePoint[];
    }

    get yMin(): number {
        //return Math.min(...this.values.map(value => value.value));
        return this.yAxisController.axisModel.minValue;
    }

    get yMax(): number {
        //return Math.max(...this.values.map(value => value.value));
        return this.yAxisController.axisModel.maxValue;
    }

    get instrument() {
        return this.appStore.instrument;
    }

    get tableListData() {
        return getTableListData(this.list, this.instrument);
    }

    get limitError() {
        const maxVoltage = getMaxVoltage(this.instrument);
        for (let i = 0; i < this.tableListData.voltage.length; i++) {
            if (this.tableListData.voltage[i] < 0) {
                return "Voltage must be >= 0";
            }
            if (this.tableListData.voltage[i] > maxVoltage) {
                return (
                    "Voltage must be <= " +
                    VOLTAGE_UNIT.formatValue(
                        maxVoltage,
                        this.instrument.getDigits(VOLTAGE_UNIT)
                    )
                );
            }
        }

        const maxCurrent = getMaxCurrent(this.instrument);
        for (let i = 0; i < this.tableListData.current.length; i++) {
            if (this.tableListData.current[i] < 0) {
                return "Current must be >= 0";
            }
            if (this.tableListData.current[i] > maxCurrent) {
                return (
                    "Current must be <= " +
                    CURRENT_UNIT.formatValue(
                        maxCurrent,
                        this.instrument.getDigits(VOLTAGE_UNIT)
                    )
                );
            }
        }

        for (let i = 0; i < this.tableListData.dwell.length; i++) {
            let power =
                this.tableListData.voltage[i] * this.tableListData.current[i];
            if (!checkPower(power, this.instrument)) {
                return getPowerLimitErrorMessage(this.instrument);
            }
        }

        return undefined;
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
            time < 0
                ? "Time must be >= 0"
                : time > this.list.data.duration
                ? "Time must be <= " +
                  TIME_UNIT.formatValue(this.list.data.duration)
                : this.limitError;
        this.values.splice(cursor.valueIndex, 1);

        cursor.addPoint = !cursor.error;
    }

    addPoint(chartView: IChartView, cursor: ICursor): MouseHandler | undefined {
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
            this.appStore.undoManager!.addCommand(
                "Edit envelope list",
                this.appStore.instrumentListStore!,
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
            this.appStore.undoManager!.addCommand(
                "Edit envelope list",
                this.appStore.instrumentListStore!,
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
            this.appStore,
            chartView,
            valueIndex,
            this
        );

        mouseHandler.newValue = true;

        return mouseHandler;
    }

    onDragStart(
        chartView: IChartView,
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
                this.appStore,
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

const EnvelopeLine = observer(
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
);

const EnvelopeLines = observer(
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
                    {range(values.length - 1).map(i => (
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
);

const EnvelopeValue = observer(
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
);

const EnvelopeValues = observer(
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
);

export const EnvelopeLineView = observer(
    class EnvelopeLineView extends React.Component<
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
                        envelopeLineController={
                            this.props.envelopeLineController
                        }
                    />
                    <EnvelopeValues
                        envelopeLineController={
                            this.props.envelopeLineController
                        }
                    />
                </g>
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

const EnvelopeChartsHeader = observer(
    class EnvelopeChartsHeader extends React.Component<{
        appStore: IAppStore;
        chartsController: ChartsController;
    }> {
        constructor(props: {
            appStore: IAppStore;
            chartsController: ChartsController;
        }) {
            super(props);

            makeObservable(this, {
                clearAllPoints: action.bound,
                clearAllVoltagePoints: action.bound,
                clearAllCurrentPoints: action.bound
            });
        }

        get list() {
            return (this.props.chartsController as EnvelopeChartsController)
                .list;
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
                            validators: [validators.rangeExclusive(0)]
                        },
                        {
                            name: "numSamples",
                            displayName: "No. of samples",
                            type: "integer",
                            validators: [
                                validators.rangeInclusive(
                                    1,
                                    this.props.appStore.instrument
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
                        this.props.appStore.undoManager!.addCommand(
                            "Edit envelope list",
                            this.props.appStore.instrumentListStore!,
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
            return (
                this.canClearAllVoltagePoints || this.canClearAllCurrentPoints
            );
        }

        clearAllPoints = () => {
            if (this.canClearAllPoints) {
                const oldVoltage = this.list.data.voltage;
                const oldCurrent = this.list.data.current;

                const defaultEnvelopeListData = getDefaultEnvelopeListData(
                    this.props.appStore.instrument
                );

                const newVoltage = defaultEnvelopeListData.voltage.slice();
                newVoltage[1].time = this.list.data.duration;

                const newCurrent = defaultEnvelopeListData.current.slice();
                newCurrent[1].time = this.list.data.duration;

                this.props.appStore.undoManager!.addCommand(
                    "Edit envelope list",
                    this.props.appStore.instrumentListStore!,
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
        };

        get canClearAllVoltagePoints() {
            return (
                this.list.data.voltage.length > 2 ||
                this.list.data.voltage[1].time !== this.list.data.duration
            );
        }

        clearAllVoltagePoints = () => {
            if (this.canClearAllVoltagePoints) {
                const oldVoltage = this.list.data.voltage;

                const defaultEnvelopeListData = getDefaultEnvelopeListData(
                    this.props.appStore.instrument
                );

                const newVoltage = defaultEnvelopeListData.voltage.slice();
                newVoltage[1].time = this.list.data.duration;

                this.props.appStore.undoManager!.addCommand(
                    "Edit envelope list",
                    this.props.appStore.instrumentListStore!,
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
        };

        get canClearAllCurrentPoints() {
            return (
                this.list.data.current.length > 2 ||
                this.list.data.current[1].time !== this.list.data.duration
            );
        }

        clearAllCurrentPoints = () => {
            if (this.canClearAllCurrentPoints) {
                const oldCurrent = this.list.data.current;

                const defaultEnvelopeListData = getDefaultEnvelopeListData(
                    this.props.appStore.instrument
                );

                const newCurrent = defaultEnvelopeListData.current.slice();
                newCurrent[1].time = this.list.data.duration;

                this.props.appStore.undoManager!.addCommand(
                    "Edit envelope list",
                    this.props.appStore.instrumentListStore!,
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
        };

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
);

////////////////////////////////////////////////////////////////////////////////

export const EnvelopeDetailsView = observer(
    class EnvelopeDetailsView extends React.Component<{
        appStore: IAppStore;
        list: EnvelopeList;
    }> {
        list: EnvelopeList = this.props.list;

        constructor(props: { appStore: IAppStore; list: EnvelopeList }) {
            super(props);

            makeObservable(this, {
                list: observable,
                chartsController: computed,
                componentDidUpdate: action
            });
        }

        get chartsController() {
            return createEnvelopeChartsController(
                this.props.appStore,
                this.list,
                displayOption.get() as ChartsDisplayOption,
                "editable"
            );
        }

        componentDidUpdate(prevProps: any) {
            if (this.props != prevProps) {
                this.list = this.props.list;
            }
        }

        render() {
            return (
                <VerticalHeaderWithBody>
                    <EnvelopeChartsHeader
                        appStore={this.props.appStore}
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
);

////////////////////////////////////////////////////////////////////////////////

export class EnvelopeChartsController extends ChartsController {
    constructor(
        appStore: IAppStore,
        public list: EnvelopeList,
        mode: ChartMode,
        xAxisModel: IAxisModel
    ) {
        super(mode, xAxisModel, new ChartViewOptions(appStore, list));
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
    appStore: IAppStore,
    list: EnvelopeList,
    axisController: IAxisController
) {
    const lineControllers: ILineController[] = [];

    lineControllers.push(
        new EnvelopeLineController(
            appStore,
            "envelope-" + axisController.position,
            axisController
        )
    );

    if (globalViewOptions.showSampledData) {
        lineControllers.push(
            new TableLineController(
                appStore,
                "envelope-sample-data-" + axisController.position,
                axisController
            )
        );
    }

    return lineControllers;
}

export function createEnvelopeChartsController(
    appStore: IAppStore,
    list: EnvelopeList,
    displayOption: ChartsDisplayOption,
    mode: ChartMode
) {
    const chartsController = new EnvelopeChartsController(
        appStore,
        list,
        mode,
        new ListAxisModel(appStore, list, TIME_UNIT)
    );

    const charts: IChartController[] = [];

    if (displayOption === "both") {
        const chartController = new EnvelopeChartController(
            chartsController,
            displayOption
        );

        chartController.createYAxisController(
            new ListAxisModel(appStore, list, VOLTAGE_UNIT)
        );
        chartController.createYAxisControllerOnRightSide(
            new ListAxisModel(appStore, list, CURRENT_UNIT)
        );

        chartController.lineControllers.push(
            ...getLineControllers(
                appStore,
                list,
                chartController.yAxisController
            )
        );
        chartController.lineControllers.push(
            ...getLineControllers(
                appStore,
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
            chartController.createYAxisController(
                new ListAxisModel(appStore, list, VOLTAGE_UNIT)
            );
            chartController.lineControllers.push(
                ...getLineControllers(
                    appStore,
                    list,
                    chartController.yAxisController
                )
            );
            charts.push(chartController);
        }

        if (displayOption === "current" || displayOption === "split") {
            const chartController = new EnvelopeChartController(
                chartsController,
                "current"
            );
            chartController.createYAxisController(
                new ListAxisModel(appStore, list, CURRENT_UNIT)
            );
            chartController.lineControllers.push(
                ...getLineControllers(
                    appStore,
                    list,
                    chartController.yAxisController
                )
            );
            charts.push(chartController);
        }
    }

    chartsController.chartControllers = charts;

    return chartsController;
}
