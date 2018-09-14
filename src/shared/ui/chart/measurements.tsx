import * as React from "react";
import * as ReactDOM from "react-dom";
import { observable, computed, action, runInAction, toJS } from "mobx";
import { observer } from "mobx-react";
import { bind } from "bind-decorator";

import { _map, _difference, _range } from "shared/algorithm";
import { guid, clamp } from "shared/util";
import { stringCompare } from "shared/string";

import { IMeasurementFunction, IChart } from "shared/extensions/extension";
import { extensions } from "shared/extensions/extensions";

import { IconAction } from "shared/ui/action";
import { DockablePanels } from "shared/ui/side-dock";
import { GenericDialog, IFieldProperties, FieldComponent } from "shared/ui/generic-dialog";

import { ChartsController, ChartController } from "shared/ui/chart/chart";
import * as GenericChartModule from "shared/ui/chart/generic-chart";
import { WaveformFormat } from "shared/ui/chart/buffer";

////////////////////////////////////////////////////////////////////////////////

const measurementFunctions = computed(() => {
    const allFunctions = new Map<string, IMeasurementFunction>();

    function loadMeasurementFunctions(
        extensionFolderPath: string,
        functions: IMeasurementFunction[]
    ) {
        functions.forEach((extensionMeasurementFunction: any) => {
            allFunctions.set(
                extensionMeasurementFunction.id,
                Object.assign({}, extensionMeasurementFunction, {
                    script: extensionFolderPath + "/" + extensionMeasurementFunction.script
                })
            );
        });
    }

    extensions.forEach(extension => {
        if (extension.measurementFunctions) {
            loadMeasurementFunctions(
                extension.installationFolderPath!,
                extension.measurementFunctions
            );
        }
    });

    return allFunctions;
});

////////////////////////////////////////////////////////////////////////////////

interface IMeasurementDefinition {
    measurementId: string;
    measurementFunctionId: string;
    chartIndex?: number;
    chartIndexes?: number[];
    parameters?: any;
}

interface ISingleInputMeasurementTaskSpecification {
    xStartValue: number;
    xStartIndex: number;
    xNumSamples: number;

    format: WaveformFormat;
    values: any;
    offset: number;
    scale: number;
    samplingRate: number;

    parameters: any;

    measureFunctionScript: string;
}

class Measurement {
    constructor(
        public measurementsController: MeasurementsController,
        public measurementDefinition: IMeasurementDefinition,
        public measurementFunction: IMeasurementFunction | undefined
    ) {}

    get measurementId() {
        return this.measurementDefinition.measurementId;
    }

    get name() {
        return (
            (this.measurementFunction && this.measurementFunction.name) ||
            this.measurementDefinition.measurementFunctionId
        );
    }

    get arity() {
        return (this.measurementFunction && this.measurementFunction.arity) || 1;
    }

    get parametersDescription() {
        return this.measurementFunction && this.measurementFunction.parametersDescription;
    }

    get parameters() {
        if (this.measurementDefinition.parameters) {
            return this.measurementDefinition.parameters;
        }

        const parameters: any = {};

        if (this.parametersDescription) {
            this.parametersDescription.forEach(parameter => {
                if (parameter.defaultValue) {
                    parameters[parameter.name] = parameter.defaultValue;
                }
            });
        }

        return parameters;
    }

    set parameters(value: any) {
        runInAction(() => (this.measurementDefinition.parameters = value));
    }

    get resultType() {
        return (this.measurementFunction && this.measurementFunction.resultType) || "value";
    }

    get script() {
        return this.measurementFunction && this.measurementFunction.script;
    }

    get chartIndex() {
        return this.measurementDefinition.chartIndex || 0;
    }

    set chartIndex(value: number) {
        runInAction(() => (this.measurementDefinition.chartIndex = value));
    }

    get chartIndexes() {
        if (this.measurementDefinition.chartIndexes) {
            return this.measurementDefinition.chartIndexes;
        }
        return _range(this.arity);
    }

    set chartIndexes(value: number[]) {
        runInAction(() => (this.measurementDefinition.chartIndexes = value));
    }

    getChartTask(chartIndex: number): ISingleInputMeasurementTaskSpecification | null {
        if (!this.script) {
            return null;
        }

        const waveformModel = this.measurementsController.chartsController.getWaveformModel(
            chartIndex
        );

        if (!waveformModel) {
            return null;
        }

        const length: number = waveformModel.length;

        if (length === 0) {
            return null;
        }

        function xAxisValueToIndex(value: number) {
            return value * waveformModel!.samplingRate;
        }

        const rulersModel = this.measurementsController.chartsController.rulersController!
            .rulersModel;

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
            a = clamp(Math.floor(xAxisValueToIndex(x1)), 0, waveformModel.length);
            b = clamp(Math.ceil(xAxisValueToIndex(x2)), 0, waveformModel.length - 1);
        } else {
            xStartValue = 0;
            a = 0;
            b = waveformModel.length - 1;
        }

        return {
            xStartValue: xStartValue,
            xStartIndex: a,
            xNumSamples: b - a + 1,

            format: waveformModel.format,
            values: waveformModel.values,
            offset: waveformModel.offset,
            scale: waveformModel.scale,
            samplingRate: waveformModel.samplingRate,

            parameters: toJS(this.parameters),

            measureFunctionScript: this.script
        };
    }

    @computed
    get task() {
        if (this.arity === 1) {
            return this.getChartTask(this.chartIndex);
        }

        const tasks = this.chartIndexes
            .map(chartIndex => this.getChartTask(chartIndex))
            .filter(task => task) as ISingleInputMeasurementTaskSpecification[];

        if (tasks.length < this.arity) {
            return null;
        }

        const task = tasks[0];
        let xStartValue = task.xStartValue;
        let xStartIndex = task.xStartIndex;
        let xEndIndex = task.xStartIndex + task.xNumSamples;

        for (let i = 1; i < tasks.length; ++i) {
            const task = tasks[i];

            if (task.xStartIndex > xStartIndex) {
                xStartIndex = task.xStartIndex;
            }

            if (task.xStartIndex + task.xNumSamples < xEndIndex) {
                xEndIndex = task.xStartIndex + task.xNumSamples;
            }
        }

        const xNumSamples = xEndIndex - xStartIndex;
        if (xNumSamples <= 0) {
            return null;
        }

        return {
            xStartValue,
            xStartIndex,
            xNumSamples,

            inputs: tasks.map(task => ({
                format: task.format,
                values: task.values,
                offset: task.offset,
                scale: task.scale,
                samplingRate: task.samplingRate
            })),

            parameters: toJS(this.parameters),

            measureFunctionScript: this.script
        };
    }

    @observable
    _value: number | string | IChart | null = null;

    lastTask: any;

    worker: Worker | null = null;
    workerReadyReceived: boolean;
    workerIdle: boolean;
    workerIdleTimeout: any;
    workerTask: any;

    sendTaskToWorker() {
        this.workerTask = this.lastTask;
        this.worker!.postMessage(this.workerTask);
        this.workerIdle = false;
        if (this.workerIdleTimeout) {
            clearTimeout(this.workerIdleTimeout);
        }
    }

    setWorkerIdle() {
        this.workerTask = null;
        this.workerIdle = true;
        this.workerIdleTimeout = setTimeout(() => {
            this.workerIdleTimeout = undefined;
            this.worker!.terminate();
            this.worker = null;
        }, 10000);
    }

    measureValue(task: any) {
        if (task != this.lastTask) {
            this.lastTask = task;

            if (this.lastTask) {
                if (!this.worker) {
                    this.worker = new Worker("../shared/ui/chart/measurement-worker.js");

                    this.workerReadyReceived = false;

                    this.worker.onmessage = (e: any) => {
                        if (this.worker) {
                            if (!this.workerReadyReceived) {
                                this.workerReadyReceived = true;

                                // worker is now ready
                                if (this.lastTask) {
                                    this.sendTaskToWorker();
                                } else {
                                    this.setWorkerIdle();
                                }
                            } else {
                                // worker done
                                runInAction(() => {
                                    this._value = e.data;
                                });

                                // is there a newer task?
                                if (this.lastTask !== this.workerTask) {
                                    this.sendTaskToWorker();
                                } else {
                                    this.setWorkerIdle();
                                }
                            }
                        }
                    };
                } else {
                    if (this.workerReadyReceived && this.workerIdle) {
                        this.sendTaskToWorker();
                    }
                }
            } else {
                runInAction(() => {
                    this._value = null;
                });
            }
        }
    }

    @computed
    get value(): number | string | IChart | null {
        const task = this.task;
        setTimeout(() => this.measureValue(task), 0);
        return this._value;
    }
}

////////////////////////////////////////////////////////////////////////////////

export class MeasurementsModel {
    @observable
    measurements: IMeasurementDefinition[] = [];

    constructor(props?: { measurements?: (string | IMeasurementDefinition)[] }) {
        if (props) {
            if (props.measurements) {
                this.measurements = props.measurements.map(measurement => {
                    if (typeof measurement === "string") {
                        return {
                            measurementId: guid(),
                            measurementFunctionId: measurement
                        };
                    } else {
                        return measurement;
                    }
                });
            }
        }
    }
}

////////////////////////////////////////////////////////////////////////////////

export class MeasurementsController {
    constructor(
        public chartsController: ChartsController,
        public measurementsModel: MeasurementsModel
    ) {}

    @computed
    get measurements() {
        return this.measurementsModel.measurements.map(measurement => {
            const measurementFunction = measurementFunctions
                .get()
                .get(measurement.measurementFunctionId);

            return new Measurement(this, measurement, measurementFunction);
        });
    }

    getValue(measurementIndex: number) {}

    @computed
    get isThereAnyMeasurementChart() {
        return this.measurements.find(measurement => measurement.resultType === "chart");
    }

    findMeasurementById(measurementId: string) {
        return this.measurements.find(measurement => measurement.measurementId === measurementId);
    }
}

////////////////////////////////////////////////////////////////////////////////

@observer
export class MeasurementValue extends React.Component<{
    measurement: Measurement;
}> {
    render() {
        if (!this.props.measurement.script) {
            return "?";
        }

        const value = this.props.measurement.value;

        if (value === null) {
            return null;
        }

        if (typeof value === "string") {
            return value;
        }

        if (typeof value === "number") {
            const strValue = this.props.measurement.measurementsController.chartsController.chartControllers[
                this.props.measurement.chartIndex
            ].yAxisController.unit.formatValue(value, 4);

            return <input type="text" className="form-control" value={strValue} readOnly={true} />;
        }

        const {
            GenericChart
        } = require("shared/ui/chart/generic-chart") as typeof GenericChartModule;

        return (
            <div className="EezStudio_MeasurementChartContainer">
                <div>
                    <GenericChart chart={value} />
                </div>
            </div>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

@observer
class MeasurementInputField extends FieldComponent {
    render() {
        const measurement = this.props.dialogContext;
        const inputIndex = parseInt(this.props.fieldProperties.name.slice(INPUT_FILED_NAME.length));
        return (
            <select
                className="form-control"
                title="Chart rendering algorithm"
                value={
                    measurement.arity === 1
                        ? measurement.chartIndex
                        : measurement.chartIndexes[inputIndex]
                }
                onChange={action((event: React.ChangeEvent<HTMLSelectElement>) => {
                    const newChartIndex = parseInt(event.target.value);

                    if (measurement.arity === 1) {
                        measurement.chartIndex = newChartIndex;
                    } else {
                        const newChartIndexes = measurement.chartIndexes.slice();
                        newChartIndexes[inputIndex] = newChartIndex;
                        measurement.chartIndexes = newChartIndexes;
                    }
                })}
            >
                {measurement.measurementsController.chartsController.chartControllers.map(
                    (chartController: ChartController, chartIndex: number) => (
                        <option key={chartIndex.toString()} value={chartIndex}>
                            {chartController.yAxisController.axisModel.label}
                        </option>
                    )
                )}
            </select>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

@observer
class MeasurementResultField extends FieldComponent {
    render() {
        const measurement = this.props.dialogContext;
        return <MeasurementValue measurement={measurement} />;
    }
}

////////////////////////////////////////////////////////////////////////////////

const INPUT_FILED_NAME = "___input___";
const RESULT_FILED_NAME = "___result___";

class MeasurementComponent extends React.Component<{
    measurement: Measurement;
}> {
    get numCharts() {
        return this.props.measurement.measurementsController.chartsController.chartControllers
            .length;
    }

    get isResultVisible() {
        return this.props.measurement.resultType !== "chart";
    }

    get deleteAction() {
        const measurement = this.props.measurement;
        const measurements = measurement.measurementsController.measurementsModel.measurements;
        const index = measurements.indexOf(measurement.measurementDefinition);
        return (
            <IconAction
                icon="material:delete"
                title="Remove measurement"
                style={{ color: "#333" }}
                onClick={() => {
                    runInAction(() => {
                        measurements.splice(index, 1);
                    });
                }}
            />
        );
    }

    get dialogDefinition() {
        const { measurement } = this.props;

        let fields: IFieldProperties[] = [];

        if (this.numCharts > 1) {
            fields = fields.concat(
                _range(measurement.arity).map(inputIndex => {
                    return {
                        name: `${INPUT_FILED_NAME}${inputIndex}`,
                        displayName: measurement.arity === 1 ? "Input" : `Input ${inputIndex + 1}`,
                        type: MeasurementInputField
                    } as IFieldProperties;
                })
            );
        }

        if (measurement.parametersDescription) {
            fields = fields.concat(measurement.parametersDescription);
        }

        if (this.isResultVisible) {
            fields.push({
                name: RESULT_FILED_NAME,
                displayName: "Result",
                type: MeasurementResultField,
                enclosureClassName: "EezStudio_MeasurementsSideDockView_MeasurementResult_Enclosure"
            });
        }

        return {
            fields
        };
    }

    get dialogValues() {
        return this.props.measurement.parameters;
    }

    @action.bound
    onValueChange(name: string, value: string) {
        this.props.measurement.parameters = Object.assign({}, this.props.measurement.parameters, {
            [name]: value
        });
    }

    render() {
        const { measurement } = this.props;

        let content;

        if (this.numCharts > 1 || this.props.measurement.parametersDescription) {
            content = (
                <td>
                    <GenericDialog
                        dialogDefinition={this.dialogDefinition}
                        dialogContext={measurement}
                        values={this.dialogValues}
                        modal={false}
                        onValueChange={this.onValueChange}
                    />
                </td>
            );
        } else {
            // simplify in case of single chart and no measurement function parameters
            content = (
                <td>
                    {this.isResultVisible && (
                        <MeasurementValue measurement={this.props.measurement} />
                    )}
                </td>
            );
        }

        return (
            <React.Fragment>
                <tr key={measurement.measurementId}>
                    <td>{measurement.name}</td>
                    {content}
                    <td>{this.deleteAction}</td>
                </tr>
            </React.Fragment>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

@observer
export class MeasurementsDockView extends React.Component<{
    measurementsController: MeasurementsController;
}> {
    get measurementModel() {
        return this.props.measurementsController.measurementsModel;
    }

    get numCharts() {
        return this.props.measurementsController.chartsController.chartControllers.length;
    }

    @computed
    get availableMeasurements() {
        const availableMeasurements = [];
        for (const [measurementFunctionId, measurementFunction] of measurementFunctions.get()) {
            if ((measurementFunction.arity || 1) > this.numCharts) {
                continue;
            }

            if (
                !measurementFunction.parametersDescription &&
                this.numCharts === 1 &&
                this.measurementModel.measurements.find(
                    measurement => measurement.measurementFunctionId === measurementFunctionId
                )
            ) {
                continue;
            }

            availableMeasurements.push(measurementFunctionId);
        }
        return availableMeasurements.sort(stringCompare);
    }

    render() {
        return (
            <div className="EezStudio_MeasurementsSideDockView EezStudio_SideDockView">
                <div>
                    <table>
                        <tbody>
                            {_map(this.props.measurementsController.measurements, measurement => (
                                <MeasurementComponent
                                    key={measurement.measurementId}
                                    measurement={measurement}
                                />
                            ))}
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
                            {_map(this.availableMeasurements, measurementFunctionId => {
                                return (
                                    <a
                                        key={measurementFunctionId}
                                        className="dropdown-item"
                                        href="#"
                                        onClick={action(() => {
                                            this.props.measurementsController.measurementsModel.measurements.push(
                                                {
                                                    measurementId: guid(),
                                                    measurementFunctionId
                                                }
                                            );
                                        })}
                                    >
                                        {
                                            measurementFunctions.get().get(measurementFunctionId)!
                                                .name
                                        }
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

////////////////////////////////////////////////////////////////////////////////

@observer
export class ChartMeasurements extends React.Component<{
    measurementsController: MeasurementsController;
}> {
    dockablePanels: DockablePanels | null;

    get measurementModel() {
        return this.props.measurementsController.measurementsModel;
    }

    @bind
    registerComponents(factory: any) {
        const measurementsController = this.props.measurementsController;

        factory.registerComponent("MeasurementValue", function(container: any, props: any) {
            const measurement = measurementsController.findMeasurementById(props.measurementId);
            if (measurement) {
                ReactDOM.render(
                    <MeasurementValue measurement={measurement} />,
                    container.getElement()[0]
                );
            }
        });
    }

    @computed
    get defaultLayoutConfig() {
        const content = [
            {
                type: "stack",
                content: this.props.measurementsController.measurements
                    .filter(measurement => measurement.resultType === "chart")
                    .map(measurement => {
                        let title;

                        const chartControllers = this.props.measurementsController.chartsController
                            .chartControllers;
                        if (chartControllers.length > 1) {
                            if (measurement.arity === 1) {
                                title = `${measurement.name} (${
                                    chartControllers[measurement.chartIndex].yAxisController
                                        .axisModel.label
                                })`;
                            } else {
                                title = `${measurement.name} (${measurement.chartIndexes
                                    .map(
                                        chartIndex =>
                                            chartControllers[chartIndex].yAxisController.axisModel
                                                .label
                                    )
                                    .join(", ")})`;
                            }
                        } else {
                            title = measurement.name;
                        }

                        return {
                            type: "component",
                            componentName: "MeasurementValue",
                            componentState: {
                                measurementId: measurement.measurementId
                            },
                            title,
                            isClosable: false
                        };
                    })
            }
        ];

        const defaultLayoutConfig = {
            settings: DockablePanels.DEFAULT_SETTINGS,
            dimensions: DockablePanels.DEFAULT_DIMENSIONS,
            content: content
        };

        return defaultLayoutConfig;
    }

    updateSize() {
        if (this.dockablePanels) {
            this.dockablePanels.updateSize();
        }
    }

    render() {
        return (
            <DockablePanels
                ref={ref => (this.dockablePanels = ref)}
                defaultLayoutConfig={this.defaultLayoutConfig}
                registerComponents={this.registerComponents}
            />
        );
    }
}
