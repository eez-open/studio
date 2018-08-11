import * as React from "react";
import { observable, computed, action, runInAction } from "mobx";
import { observer } from "mobx-react";

import { _map, _difference } from "shared/algorithm";

import { IMeasurementFunction } from "shared/extensions/extension";
import { measurementFunctions } from "shared/extensions/extensions";

import { IconAction } from "shared/ui/action";

import { ChartsController, ChartController } from "shared/ui/chart/chart";
import { WaveformModel } from "shared/ui/chart/waveform";

export class MeasurementsModel {
    @observable
    measurements: string[] = [];

    @observable
    selectedChartIndex: number = 0;

    constructor(props?: any) {
        if (props) {
            Object.assign(this, props);
        }
    }
}

export class MeasurementsController {
    constructor(
        public chartController: ChartController,
        public waveformModel: WaveformModel,
        public measurementsModel: MeasurementsModel
    ) {}
}

@observer
export class Measurement extends React.Component<{
    chartController: ChartController;
    measurementFunction: IMeasurementFunction;
}> {
    @observable
    value: string = "";
    lastTask: any;
    worker: Worker | undefined;
    workerReady: boolean;
    workerBusy: boolean;
    nextTask: any;

    @computed
    get task() {
        const measurementsController = this.props.chartController.measurementsController;
        const xAxisController = this.props.chartController.xAxisController;

        const length: number = measurementsController.waveformModel.length;

        function xAxisValueToIndex(value: number) {
            return (value / xAxisController.range) * (length - 1);
        }

        const rulersModel = this.props.chartController.rulersController!.rulersModel;

        let xStartValue: number;
        let a: number;
        let b: number;
        if (rulersModel.xAxisRulersEnabled) {
            let x1;
            let x2;
            if (rulersModel.x1 < rulersModel.x2) {
                x1 = rulersModel.x1;
                x2 = rulersModel.x2;
            } else {
                x1 = rulersModel.x2;
                x2 = rulersModel.x1;
            }

            xStartValue = x1;
            a = Math.max(Math.floor(xAxisValueToIndex(x1)), 0);
            b = Math.min(Math.ceil(xAxisValueToIndex(x2)), length - 1);
        } else {
            xStartValue = 0;
            a = 0;
            b = length;
        }

        return {
            format: this.props.chartController.measurementsController.waveformModel.format,
            values: measurementsController.waveformModel.values,
            offset: measurementsController.waveformModel.offset,
            scale: measurementsController.waveformModel.scale,

            xStartValue: xStartValue,
            xSamplingRate: measurementsController.waveformModel.samplingRate,
            xStartIndex: a,
            xNumSamples: b - a + 1,

            measureFunctionScript: this.props.measurementFunction.script
        };
    }

    measureValue() {
        if (this.task != this.lastTask) {
            this.lastTask = this.task;

            if (!this.worker) {
                this.worker = new Worker("../shared/ui/chart/measurement-worker.js");

                this.worker.onmessage = (e: any) => {
                    if (!this.worker) {
                        // worker already terminated
                        return;
                    }

                    if (!this.workerReady) {
                        this.workerReady = true;
                    } else {
                        runInAction(() => {
                            // @TODO precision of 4 decimal places is hardcoded
                            this.value = this.props.chartController.yAxisController.unit.formatValue(
                                e.data,
                                4
                            );
                        });
                    }

                    if (this.nextTask) {
                        this.workerBusy = true;
                        this.worker.postMessage(this.nextTask);
                        this.nextTask = undefined;
                    } else {
                        this.workerBusy = false;
                    }
                };

                this.workerReady = false;
            }

            if (this.workerReady && !this.workerBusy) {
                this.workerBusy = true;
                this.worker.postMessage(this.lastTask);
            } else {
                this.nextTask = this.lastTask;
            }
        }
    }

    componentWillUnmount() {
        if (this.worker) {
            this.worker.terminate();
            this.worker = undefined;
        }
    }

    render() {
        this.measureValue();
        return <input type="text" className="form-control" value={this.value} readOnly={true} />;
    }
}

@observer
export class MeasurementsDockView extends React.Component<{ chartsController: ChartsController }> {
    get measurementModel() {
        return this.props.chartsController.chartControllers[0].measurementsController
            .measurementsModel;
    }

    get chartController() {
        return this.props.chartsController.chartControllers[
            Math.min(
                this.measurementModel.selectedChartIndex,
                this.props.chartsController.chartControllers.length - 1
            )
        ];
    }

    get measurementsController() {
        return this.chartController.measurementsController;
    }

    @computed
    get availableMeasurements() {
        return _difference(
            Array.from(measurementFunctions.keys()),
            this.measurementsController.measurementsModel.measurements
        );
    }

    render() {
        return (
            <div className="EezStudio_MeasurementsSideDockView EezStudio_SideDockView">
                {this.props.chartsController.chartControllers.length > 1 && (
                    <div className="EezStudio_MeasurementsSideDockView_SelectedChartIndexProperty">
                        <div className="EezStudio_SideDockView_PropertyLabel">
                            <span>Measure:</span>
                            <select
                                className="form-control"
                                title="Chart rendering algorithm"
                                value={
                                    this.measurementsController.measurementsModel.selectedChartIndex
                                }
                                onChange={action(
                                    (event: React.ChangeEvent<HTMLSelectElement>) =>
                                        (this.measurementsController.measurementsModel.selectedChartIndex = parseInt(
                                            event.target.value
                                        ))
                                )}
                            >
                                {this.props.chartsController.chartControllers.map(
                                    (chartController: ChartController, chartIndex: number) => (
                                        <option key={chartIndex.toString()} value={chartIndex}>
                                            {chartController.yAxisController.axisModel.label}
                                        </option>
                                    )
                                )}
                            </select>
                        </div>
                    </div>
                )}
                <div>
                    <table>
                        <tbody>
                            {_map(
                                this.measurementsController.measurementsModel.measurements,
                                measurementId => {
                                    const measurementFunction = measurementFunctions.get(
                                        measurementId
                                    );

                                    return (
                                        <tr key={measurementId}>
                                            <td>
                                                {measurementFunction
                                                    ? measurementFunction.name
                                                    : measurementId}
                                            </td>
                                            <td>
                                                {measurementFunction ? (
                                                    <Measurement
                                                        chartController={this.chartController}
                                                        measurementFunction={measurementFunction}
                                                    />
                                                ) : (
                                                    "?"
                                                )}
                                            </td>
                                            <td>
                                                <IconAction
                                                    icon="material:delete"
                                                    title="Remove measurement"
                                                    style={{ color: "#333" }}
                                                    onClick={() => {
                                                        runInAction(() => {
                                                            this.measurementsController.measurementsModel.measurements.splice(
                                                                this.measurementsController.measurementsModel.measurements.indexOf(
                                                                    measurementId
                                                                ),
                                                                1
                                                            );
                                                        });
                                                    }}
                                                />
                                            </td>
                                        </tr>
                                    );
                                }
                            )}
                        </tbody>
                    </table>
                </div>
                {this.availableMeasurements.length > 0 && (
                    <div className="dropdown">
                        <button
                            className="btn btn-sm btn-secondary dropdown-toggle"
                            type="button"
                            data-toggle="dropdown"
                        >
                            Add Measurement
                        </button>
                        <div className="dropdown-menu">
                            {_map(this.availableMeasurements, measurementId => {
                                return (
                                    <a
                                        key={measurementId}
                                        className="dropdown-item"
                                        href="#"
                                        onClick={action(() => {
                                            this.measurementsController.measurementsModel.measurements.push(
                                                measurementId
                                            );
                                        })}
                                    >
                                        {measurementFunctions.get(measurementId)!.name}
                                    </a>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        );
    }
}
