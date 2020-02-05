import React from "react";
import ReactDOM from "react-dom";
import { observable, computed, reaction, action, runInAction, toJS } from "mobx";
import { observer } from "mobx-react";
import { bind } from "bind-decorator";

import { _map, _difference, _range } from "eez-studio-shared/algorithm";
import { clamp } from "eez-studio-shared/util";
import { guid } from "eez-studio-shared/guid";
import { stringCompare } from "eez-studio-shared/string";
import { UNITS } from "eez-studio-shared/units";

import { IMeasurementFunction, IMeasureTask, IChart } from "eez-studio-shared/extensions/extension";
import { extensions } from "eez-studio-shared/extensions/extensions";

import { theme } from "eez-studio-ui/theme";
import { ThemeProvider } from "eez-studio-ui/styled-components";
import styled from "eez-studio-ui/styled-components";
import { IconAction } from "eez-studio-ui/action";
import { DockablePanels } from "eez-studio-ui/side-dock";
import { GenericDialog, IFieldProperties, FieldComponent } from "eez-studio-ui/generic-dialog";
import { SideDockViewContainer } from "eez-studio-ui/side-dock";
import * as notification from "eez-studio-ui/notification";
import { cssTransition } from "react-toastify";

import { ChartsController, ChartController } from "eez-studio-ui/chart/chart";
import * as GenericChartModule from "eez-studio-ui/chart/generic-chart";
import { WaveformFormat, initValuesAccesor } from "eez-studio-ui/chart/buffer";

////////////////////////////////////////////////////////////////////////////////

const CONF_MAX_NUM_SAMPLES_TO_SHOW_CALCULATING_MESSAGE = 1000000;

////////////////////////////////////////////////////////////////////////////////

let calculatingToastId: any;

const Fade = cssTransition({
    enter: "fadeIn",
    exit: "fadeOut",
    duration: 0
});

function showCalculating() {
    if (!calculatingToastId) {
        calculatingToastId = notification.info("Calculating...", {
            transition: Fade,
            closeButton: false
        });
    }
}

function hideCalculating() {
    if (calculatingToastId) {
        notification.dismiss(calculatingToastId);
        calculatingToastId = undefined;
    }
}

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

interface IInput {
    format: WaveformFormat;
    values: any;
    offset: number;
    scale: number;
    samplingRate: number;
    valueUnit: keyof typeof UNITS;
}

interface ISingleInputMeasurementTaskSpecification extends IInput {
    xStartValue: number;
    xStartIndex: number;
    xNumSamples: number;
}

interface IMultiInputMeasurementTaskSpecification {
    xStartValue: number;
    xStartIndex: number;
    xNumSamples: number;

    inputs: IInput[];
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

    get namePrefix() {
        return (
            (this.measurementFunction && this.measurementFunction.name) ||
            this.measurementDefinition.measurementFunctionId
        );
    }

    @computed
    get name() {
        const namePrefix = this.namePrefix;

        let samePrefixBeforeCounter = 0;

        const measurements = this.measurementsController.measurements;

        let i;
        for (i = 0; i < measurements.length && measurements[i] !== this; ++i) {
            if (measurements[i].namePrefix === namePrefix) {
                samePrefixBeforeCounter++;
            }
        }

        if (i < measurements.length) {
            for (++i; i < measurements.length && measurements[i].namePrefix !== namePrefix; ++i) {}
        }

        if (samePrefixBeforeCounter === 0 && i === measurements.length) {
            // no measurement with the same namePrefix found
            return namePrefix;
        }

        return `${namePrefix} ${samePrefixBeforeCounter + 1}`;
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

        const { x1, x2 } = this.measurementsController.measurementsInterval!;

        let xStartValue: number = x1;
        let a: number = clamp(Math.floor(xAxisValueToIndex(x1)), 0, waveformModel.length);
        let b: number = clamp(Math.ceil(xAxisValueToIndex(x2)), 0, waveformModel.length - 1);

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

            valueUnit: waveformModel.valueUnit
        };
    }

    getMeasureTaskForSingleInput(taskSpec: ISingleInputMeasurementTaskSpecification) {
        const accessor = {
            format: taskSpec.format,
            values: taskSpec.values,
            offset: taskSpec.offset,
            scale: taskSpec.scale,
            length: 0,
            value: (value: number) => 0,
            waveformData: (value: number) => 0
        };

        initValuesAccesor(accessor, true);

        return {
            xStartValue: taskSpec.xStartValue,
            xStartIndex: taskSpec.xStartIndex,
            xNumSamples: taskSpec.xNumSamples,
            samplingRate: taskSpec.samplingRate,
            getSampleValueAtIndex: accessor.value,
            valueUnit: taskSpec.valueUnit,
            inputs: [],
            parameters: this.parameters,
            result: null
        };
    }

    getMeasureTaskForMultipleInputs(taskSpec: IMultiInputMeasurementTaskSpecification) {
        const inputs = taskSpec.inputs.map(input => {
            const accessor = {
                format: input.format,
                values: input.values,
                offset: input.offset,
                scale: input.scale,
                length: 0,
                value: (value: number) => 0,
                waveformData: (value: number) => 0
            };

            initValuesAccesor(accessor, true);

            return {
                samplingRate: input.samplingRate,
                getSampleValueAtIndex: accessor.value,
                valueUnit: input.valueUnit
            };
        });

        return {
            xStartValue: taskSpec.xStartValue,
            xStartIndex: taskSpec.xStartIndex,
            xNumSamples: taskSpec.xNumSamples,
            samplingRate: taskSpec.inputs[0].samplingRate,
            getSampleValueAtIndex: inputs[0].getSampleValueAtIndex,
            valueUnit: inputs[0].valueUnit,
            inputs,
            parameters: this.parameters,
            result: null
        };
    }

    get task(): IMeasureTask | null {
        if (!this.script) {
            return null;
        }

        if (this.arity === 1) {
            const singleInputTaskSpec = this.getChartTask(this.chartIndex);
            if (!singleInputTaskSpec) {
                return null;
            }
            return this.getMeasureTaskForSingleInput(singleInputTaskSpec);
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

        return this.getMeasureTaskForMultipleInputs({
            xStartValue,
            xStartIndex,
            xNumSamples,

            inputs: tasks.map(task => ({
                format: task.format,
                values: task.values,
                offset: task.offset,
                scale: task.scale,
                samplingRate: task.samplingRate,
                valueUnit: task.valueUnit,
                getSampleValueAtIndex: (index: number) => 0
            }))
        });
    }

    @computed
    get result(): {
        result: number | string | IChart | null;
        resultUnit?: keyof typeof UNITS | undefined;
    } | null {
        if (!this.script) {
            return null;
        }

        if (!this.measurementsController.measurementsInterval) {
            return null;
        }

        const task = this.task;
        if (!task) {
            return null;
        }

        let measureFunction: (task: IMeasureTask) => void;
        measureFunction = (require(this.script) as any).default;
        measureFunction(task);
        return task;
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

        this.timeoutId = setTimeout(() => {
            this.timeoutId = undefined;
            this.startMeasurement(this.calcMeasurementsInterval());
        }, 500);

        reaction(
            () => ({
                isAnimationActive: this.chartsController.xAxisController.isAnimationActive,
                measurementsInterval: this.calcMeasurementsInterval(),
                measurements: this.measurementsModel.measurements
            }),
            ({ isAnimationActive, measurementsInterval, measurements }) => {
                if (!isAnimationActive && measurements.length > 0) {
                    this.startMeasurement(measurementsInterval);
                }
            }
        );
    }

    @observable
    measurements: Measurement[];

    @observable
    measurementsInterval: { x1: number; x2: number } | undefined;

    timeoutId: any;

    calcMeasurementsInterval() {
        const rulersModel = this.chartsController.rulersController!.rulersModel;

        let x1: number;
        let x2: number;
        if (rulersModel.xAxisRulersEnabled) {
            if (rulersModel.x1 < rulersModel.x2) {
                x1 = rulersModel.x1;
                x2 = rulersModel.x2;
            } else {
                x1 = rulersModel.x2;
                x2 = rulersModel.x1;
            }
        } else {
            x1 = this.chartsController.xAxisController.from;
            x2 = this.chartsController.xAxisController.to;
        }

        let numSamples = 0;

        for (let i = 0; i < this.chartsController.chartControllers.length; ++i) {
            const waveformModel = this.chartsController.getWaveformModel(i);
            if (waveformModel) {
                numSamples = Math.max(numSamples, waveformModel.samplingRate * (x2 - x1));
            }
        }

        return { x1, x2, numSamples };
    }

    startMeasurement(measurementsInterval: { x1: number; x2: number; numSamples: number }) {
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
            this.timeoutId = undefined;
        }

        if (measurementsInterval.numSamples > CONF_MAX_NUM_SAMPLES_TO_SHOW_CALCULATING_MESSAGE) {
            showCalculating();
            this.timeoutId = setTimeout(() => {
                this.timeoutId = undefined;
                runInAction(() => (this.measurementsInterval = measurementsInterval));
                setTimeout(() => {
                    hideCalculating();
                }, 10);
            }, 150);
        } else {
            runInAction(() => (this.measurementsInterval = measurementsInterval));
        }
    }

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

const ChartContainerDiv = styled.div`
    flex-grow: 1;
    flex-direction: column;

    background-color: #f0f0f0;
    display: flex;
    padding-top: 10px;

    > div {
        flex-grow: 1;
        border-top: 1px solid #ddd;
    }

    height: 100%;

    & > .EezStudio_ChartView {
        position: static;
        width: auto;
        height: auto;
    }
`;

@observer
export class MeasurementValue extends React.Component<{
    measurement: Measurement;
    inDockablePanel?: boolean;
}> {
    render() {
        if (!this.props.measurement.script) {
            return "?";
        }

        const measurementResult = this.props.measurement.result;

        if (measurementResult === null || measurementResult.result === null) {
            if (this.props.inDockablePanel) {
                return null;
            }
            return <input type="text" className="form-control" value={""} readOnly={true} />;
        }

        if (typeof measurementResult.result === "string") {
            return measurementResult.result;
        }

        if (typeof measurementResult.result === "number") {
            let unit;
            if (measurementResult.resultUnit) {
                unit = UNITS[measurementResult.resultUnit];
            }

            if (!unit) {
                unit = this.props.measurement.measurementsController.chartsController
                    .chartControllers[this.props.measurement.chartIndex].yAxisController.unit;
            }

            const strValue = unit.formatValue(measurementResult.result, 4);

            return <input type="text" className="form-control" value={strValue} readOnly={true} />;
        }

        const {
            GenericChart
        } = require("eez-studio-ui/chart/generic-chart") as typeof GenericChartModule;

        return (
            <ChartContainerDiv>
                <GenericChart chart={measurementResult.result} />
            </ChartContainerDiv>
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
                        embedded={true}
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

            availableMeasurements.push(measurementFunction);
        }
        return availableMeasurements.sort((a, b) => stringCompare(a.name, b.name)).map(a => a.id);
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
                        <MeasurementValue measurement={measurement} inDockablePanel={true} />
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
