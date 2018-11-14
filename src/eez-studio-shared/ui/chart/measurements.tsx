import * as React from "react";
import * as ReactDOM from "react-dom";
import { observable, computed, action, reaction, runInAction, toJS } from "mobx";
import { observer } from "mobx-react";
import { bind } from "bind-decorator";

import { _map, _difference, _range } from "eez-studio-shared/algorithm";
import { guid, clamp } from "eez-studio-shared/util";
import { stringCompare } from "eez-studio-shared/string";

import { IMeasurementFunction, IChart } from "eez-studio-shared/extensions/extension";
import { extensions } from "eez-studio-shared/extensions/extensions";

import { theme } from "eez-studio-shared/ui/theme";
import { ThemeProvider } from "eez-studio-shared/ui/styled-components";
import styled from "eez-studio-shared/ui/styled-components";
import { IconAction } from "eez-studio-shared/ui/action";
import { DockablePanels } from "eez-studio-shared/ui/side-dock";
import { GenericDialog, IFieldProperties, FieldComponent } from "eez-studio-shared/ui/generic-dialog";
import { SideDockViewContainer } from "eez-studio-shared/ui/side-dock";

import { ChartsController, ChartController } from "eez-studio-shared/ui/chart/chart";
import * as GenericChartModule from "eez-studio-shared/ui/chart/generic-chart";
import { WaveformFormat } from "eez-studio-shared/ui/chart/buffer";

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

        const xNumSamples = b - a + 1;
        if (xNumSamples <= 0) {
            return null;
        }

        return {
            xStartValue: xStartValue,
            xStartIndex: a,
            xNumSamples,

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
                    this.worker = new Worker("../eez-studio-shared/ui/chart/measurement-worker.js");

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

    get chartPanelTitle() {
        const chartControllers = this.measurementsController.chartsController.chartControllers;
        if (chartControllers.length > 1) {
            if (this.arity === 1) {
                return `${this.name} (${
                    chartControllers[this.chartIndex].yAxisController.axisModel.label
                })`;
            } else {
                return `${this.name} (${this.chartIndexes
                    .map(chartIndex => chartControllers[chartIndex].yAxisController.axisModel.label)
                    .join(", ")})`;
            }
        } else {
            return this.name;
        }
    }

    get chartPanelConfiguration() {
        return {
            type: "component",
            componentName: "MeasurementValue",
            id: this.measurementId,
            componentState: {
                measurementId: this.measurementId
            },
            title: this.chartPanelTitle,
            isClosable: false
        };
    }
}

////////////////////////////////////////////////////////////////////////////////

export class MeasurementsModel {
    @observable
    measurements: IMeasurementDefinition[] = [];

    @observable
    chartPanelsViewState: string | undefined;

    constructor(props?: {
        measurements?: (string | IMeasurementDefinition)[];
        chartPanelsViewState?: string;
    }) {
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

            if (props.chartPanelsViewState) {
                this.chartPanelsViewState = props.chartPanelsViewState;
            }
        }
    }
}

////////////////////////////////////////////////////////////////////////////////

export class MeasurementsController {
    constructor(
        public chartsController: ChartsController,
        public measurementsModel: MeasurementsModel
    ) {
        reaction(
            () => toJS(this.measurementsModel.measurements),
            () => {
                const measurements = this.measurementsModel.measurements.map(
                    measurementDefinition => {
                        // reuse existing Measurement object if exists
                        const measurement = this.measurements.find(
                            measurement =>
                                measurementDefinition.measurementId === measurement.measurementId
                        );
                        if (measurement) {
                            return measurement;
                        }

                        // create a new Measurement object
                        return new Measurement(
                            this,
                            measurementDefinition,
                            measurementFunctions
                                .get()
                                .get(measurementDefinition.measurementFunctionId)
                        );
                    }
                );

                this.measurements = measurements;
            }
        );

        this.measurements = this.measurementsModel.measurements.map(
            measurementDefinition =>
                new Measurement(
                    this,
                    measurementDefinition,
                    measurementFunctions.get().get(measurementDefinition.measurementFunctionId)
                )
        );

        //////////

        reaction(
            () => toJS(this.chartMeasurements),
            () => {
                let newChartPanelsViewState: string | undefined;

                if (this.chartMeasurements.length > 0) {
                    if (this.chartPanelsViewState) {
                        const goldenLayout: any = new GoldenLayout(
                            {
                                content: JSON.parse(this.measurementsModel.chartPanelsViewState!)
                            },
                            document.createElement("div")
                        );
                        goldenLayout.registerComponent("MeasurementValue", function() {});
                        goldenLayout.init();

                        const existingChartMeasurementIds = goldenLayout.root
                            .getItemsByType("component")
                            .map((contentItem: any) => contentItem.config.id);

                        const chartMeasurementIds = this.chartMeasurements.map(
                            measurement => measurement.measurementId
                        );

                        const removed = _difference(
                            existingChartMeasurementIds,
                            chartMeasurementIds
                        );
                        const added = _difference(chartMeasurementIds, existingChartMeasurementIds);

                        removed.forEach(id => {
                            const item = goldenLayout.root.getItemsById(id)[0];
                            if (item.parent.type === "stack") {
                                item.parent.setActiveContentItem(item);
                            }
                            item.remove();
                        });

                        added.forEach(id => {
                            const measurement = this.findMeasurementById(id);
                            goldenLayout.root.contentItems[0].addChild(
                                measurement!.chartPanelConfiguration,
                                goldenLayout.root
                            );
                        });

                        goldenLayout.root.getItemsByType("component").map((contentItem: any) => {
                            const measurement = this.findMeasurementById(contentItem.config.id);
                            contentItem.setTitle(measurement!.chartPanelTitle);
                        });

                        newChartPanelsViewState = JSON.stringify(goldenLayout.config.content);
                    } else {
                        newChartPanelsViewState = JSON.stringify(this.defaultChartPanelViewState);
                    }
                } else {
                    newChartPanelsViewState = undefined;
                }

                if (newChartPanelsViewState != this.chartPanelsViewState) {
                    runInAction(() => {
                        this.chartPanelsViewState = newChartPanelsViewState;
                        this.measurementsModel.chartPanelsViewState = newChartPanelsViewState;
                    });
                }
            }
        );

        if (this.measurementsModel.chartPanelsViewState) {
            this.chartPanelsViewState = this.measurementsModel.chartPanelsViewState;
        } else {
            this.chartPanelsViewState = JSON.stringify(this.defaultChartPanelViewState);
        }
    }

    @observable
    measurements: Measurement[];

    @computed
    get chartMeasurements() {
        return this.measurements.filter(measurement => {
            return (
                measurement.measurementFunction &&
                measurement.measurementFunction.resultType === "chart"
            );
        });
    }

    @computed
    get isThereAnyMeasurementChart() {
        return this.chartMeasurements.length > 0;
    }

    findMeasurementById(measurementId: string) {
        return this.measurements.find(measurement => measurement.measurementId === measurementId);
    }

    @observable
    chartPanelsViewState: string | undefined;

    get defaultChartPanelViewState() {
        const charts = this.measurements.filter(measurement => measurement.resultType === "chart");
        if (charts.length === 0) {
            return undefined;
        }

        return [
            {
                type: "stack",
                content: charts.map(measurement => measurement.chartPanelConfiguration)
            }
        ];
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
        } = require("eez-studio-shared/ui/chart/generic-chart") as typeof GenericChartModule;

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

const MeasurementsDockViewContainer = styled(SideDockViewContainer)`
    table {
        margin-left: 0;
    }

    & > div {
        border: none;
        padding-bottom: 0;
        margin-bottom: 5px;

        & > table {
            width: 100%;

            font-size: 80%;

            border-spacing: 1px 5px;
            border-collapse: separate;

            & > tbody > tr > td {
                text-align: center;
                background-color: #e5e5e5;
                padding: 5px;
                vertical-align: top;
                line-height: 22px;
            }

            & > tbody > tr > td:first-child {
                white-space: nowrap;
                text-align: left;
                font-weight: bold;
                min-width: 80px;
            }
        }
    }

    .EezStudio_MeasurementsSideDockView_SelectedChartIndexProperty
        > .EezStudio_SideDockView_PropertyLabel
        > span {
        display: inline-block;
        margin-right: 10px;
    }

    .EezStudio_MeasurementsSideDockView_SelectedChartIndexProperty
        > .EezStudio_SideDockView_PropertyLabel
        > select {
        width: auto;
        display: inline-block;
    }

    .EezStudio_PropertyList {
        td {
            vertical-align: center;
        }

        td:nth-child(1) {
            min-width: 50px;
        }

        tr.EezStudio_MeasurementsSideDockView_MeasurementResult_Enclosure {
            td:nth-child(1) {
                font-weight: bold;
            }
        }
    }
`;

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
            <MeasurementsDockViewContainer>
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
            </MeasurementsDockViewContainer>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

@observer
export class ChartMeasurements extends React.Component<{
    measurementsController: MeasurementsController;
}> {
    dockablePanels: DockablePanels | null;

    get measurementsModel() {
        return this.props.measurementsController.measurementsModel;
    }

    @bind
    registerComponents(factory: any) {
        const measurementsController = this.props.measurementsController;

        factory.registerComponent("MeasurementValue", function(container: any, props: any) {
            const measurement = measurementsController.findMeasurementById(props.measurementId);
            if (measurement) {
                ReactDOM.render(
                    <ThemeProvider theme={theme}>
                        <MeasurementValue measurement={measurement} />
                    </ThemeProvider>,
                    container.getElement()[0]
                );
            }
        });
    }

    @computed
    get defaultLayoutConfig() {
        return {
            settings: DockablePanels.DEFAULT_SETTINGS,
            dimensions: DockablePanels.DEFAULT_DIMENSIONS,
            content: JSON.parse(this.props.measurementsController.chartPanelsViewState!)
        };
    }

    updateSize() {
        if (this.dockablePanels) {
            this.dockablePanels.updateSize();
        }
    }

    debounceTimeout: any;

    @bind
    onStateChanged(state: any) {
        const newStateContent = state.content;

        if (this.debounceTimeout) {
            clearTimeout(this.debounceTimeout);
        }

        this.debounceTimeout = setTimeout(() => {
            this.debounceTimeout = undefined;

            // workaround for the possible golden-layout BUG,
            // make sure activeItemIndex is not out of bounds
            const goldenLayout: any = new GoldenLayout(
                {
                    content: newStateContent
                },
                document.createElement("div")
            );
            goldenLayout.registerComponent("MeasurementValue", function() {});
            goldenLayout.init();

            goldenLayout.root
                .getItemsByType("stack")
                .map(
                    (contentItem: any) =>
                        (contentItem.config.activeItemIndex = Math.min(
                            contentItem.config.activeItemIndex,
                            contentItem.config.content.length - 1
                        ))
                );

            const chartPanelsViewState = JSON.stringify(goldenLayout.config.content);

            runInAction(() => (this.measurementsModel.chartPanelsViewState = chartPanelsViewState));
        }, 1000);
    }

    render() {
        return (
            <DockablePanels
                ref={ref => (this.dockablePanels = ref)}
                defaultLayoutConfig={this.defaultLayoutConfig}
                registerComponents={this.registerComponents}
                onStateChanged={this.onStateChanged}
            />
        );
    }
}
