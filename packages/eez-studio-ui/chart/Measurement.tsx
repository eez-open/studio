import { computed, observable, runInAction } from "mobx";

import { UNITS } from "eez-studio-shared/units";
import { _range } from "eez-studio-shared/algorithm";

import type {
    IChart,
    IMeasurementFunction,
    IMeasureTask
} from "eez-studio-shared/extensions/extension";

import type {
    IMeasurement,
    IMeasurementsController,
    IMeasurementDefinition,
    ISingleInputMeasurementTaskSpecification,
    IMultiInputMeasurementTaskSpecification
} from "eez-studio-ui/chart/chart";

import { initValuesAccesor } from "eez-studio-ui/chart/value-accesor";

import { clamp } from "eez-studio-ui/chart/clamp";

export class Measurement implements IMeasurement {
    constructor(
        public measurementsController: IMeasurementsController,
        public measurementDefinition: IMeasurementDefinition,
        public measurementFunction: IMeasurementFunction | undefined
    ) {}

    @observable dirty = true;

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
            for (
                ++i;
                i < measurements.length &&
                measurements[i].namePrefix !== namePrefix;
                ++i
            ) {}
        }

        if (samePrefixBeforeCounter === 0 && i === measurements.length) {
            // no measurement with the same namePrefix found
            return namePrefix;
        }

        return `${namePrefix} ${samePrefixBeforeCounter + 1}`;
    }

    get arity() {
        return (
            (this.measurementFunction && this.measurementFunction.arity) || 1
        );
    }

    get parametersDescription() {
        return (
            this.measurementFunction &&
            this.measurementFunction.parametersDescription
        );
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
        return (
            (this.measurementFunction && this.measurementFunction.resultType) ||
            "value"
        );
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

    getChartTask(
        chartIndex: number
    ): ISingleInputMeasurementTaskSpecification | null {
        if (!this.script) {
            return null;
        }

        const lineController =
            this.measurementsController.chartsController.lineControllers[
                chartIndex
            ];
        const waveformModel =
            lineController && lineController.getWaveformModel();

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
        let a: number = clamp(
            Math.floor(xAxisValueToIndex(x1)),
            0,
            waveformModel.length
        );
        let b: number = clamp(
            Math.ceil(xAxisValueToIndex(x2)),
            0,
            waveformModel.length - 1
        );

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

            dlog: waveformModel.dlog,

            samplingRate: waveformModel.samplingRate,
            valueUnit: waveformModel.valueUnit
        };
    }

    getMeasureTaskForSingleInput(
        taskSpec: ISingleInputMeasurementTaskSpecification
    ) {
        const accessor = {
            format: taskSpec.format,
            values: taskSpec.values,
            offset: taskSpec.offset,
            scale: taskSpec.scale,
            dlog: taskSpec.dlog,
            length: 0,
            value: (value: number) => 0,
            waveformData: (value: number) => 0
        };

        initValuesAccesor(accessor, true);

        return {
            values: taskSpec.values,
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

    getMeasureTaskForMultipleInputs(
        taskSpec: IMultiInputMeasurementTaskSpecification
    ) {
        const inputs = taskSpec.inputs.map(input => {
            const accessor = {
                format: input.format,
                values: input.values,
                offset: input.offset,
                scale: input.scale,
                dlog: input.dlog,
                length: 0,
                value: (value: number) => 0,
                waveformData: (value: number) => 0
            };

            initValuesAccesor(accessor, true);

            return {
                values: input.values,
                samplingRate: input.samplingRate,
                getSampleValueAtIndex: accessor.value,
                valueUnit: input.valueUnit
            };
        });

        return {
            values: null,
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
                dlog: task.dlog,
                getSampleValueAtIndex: (index: number) => 0
            }))
        });
    }

    @observable result: {
        result: number | string | IChart | null;
        resultUnit?: keyof typeof UNITS | undefined;
    } | null = null;

    refreshResult() {
        if (!this.script) {
            return;
        }

        if (!this.measurementsController.measurementsInterval) {
            return;
        }

        const task = this.task;
        if (!task) {
            return;
        }

        let measureFunction: (task: IMeasureTask) => void;
        measureFunction = (require(this.script) as any).default;
        measureFunction(task);

        runInAction(() => {
            this.result = task;
            this.dirty = false;
        });
    }

    get chartPanelTitle() {
        const lineControllers =
            this.measurementsController.chartsController.lineControllers;
        if (lineControllers.length > 1) {
            if (this.arity === 1) {
                const lineController = lineControllers[this.chartIndex];
                if (lineController) {
                    return `${this.name} (${lineController.label})`;
                }
            } else {
                return `${this.name} (${this.chartIndexes
                    .map(chartIndex => {
                        const lineController = lineControllers[chartIndex];
                        return lineController ? lineController.label : "";
                    })
                    .join(", ")})`;
            }
        }

        return this.name;
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
