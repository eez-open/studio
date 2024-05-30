import React from "react";
import { observer } from "mobx-react";
import { computed, makeObservable, observable, runInAction } from "mobx";

import {
    registerClass,
    makeDerivedClassInfo,
    ProjectType,
    PropertyType,
    EezObject,
    ClassInfo,
    PropertyInfo,
    findPropertyByNameInClassInfo
} from "project-editor/core/object";

import {
    Widget,
    makeDataPropertyInfo,
    makeExpressionProperty,
    makeStylePropertyInfo
} from "project-editor/flow/component";

import type { IFlowContext } from "project-editor/flow/flow-interfaces";

import type { IStore } from "eez-studio-shared/store";
import type { IActivityLogEntry } from "instrument/window/history/activity-log";
import type { IAppStore } from "instrument/window/history/history";
import { specificGroup } from "project-editor/ui-components/PropertyGrid/groups";
import { evalProperty } from "project-editor/flow/helper";

import { WaveformFormat } from "eez-studio-ui/chart/WaveformFormat";

import type { Waveform } from "instrument/window/waveform/generic";
import type { MultiWaveform } from "instrument/window/waveform/multi";
import type { DlogWaveform } from "instrument/window/waveform/dlog";

import type * as ChartPreviewModule from "instrument/window/chart-preview";

import { isArray } from "eez-studio-shared/util";

////////////////////////////////////////////////////////////////////////////////

class WaveformDefinition extends EezObject {
    chartData: string;

    format: string;
    samplingRate: string;
    unitName: string;
    color: string;
    label: string;
    offset: string;
    scale: string;

    static classInfo: ClassInfo = {
        properties: [
            makeExpressionProperty(
                {
                    name: "chartData",
                    displayName: "Chart data",
                    type: PropertyType.MultilineText
                },
                "any"
            ),
            makeExpressionProperty(
                {
                    name: "format",
                    type: PropertyType.MultilineText,
                    formText: `"float", "double", "rigol-byte", "rigol-word", "csv"`
                },
                "string"
            ),
            makeExpressionProperty(
                {
                    name: "samplingRate",
                    type: PropertyType.MultilineText
                },
                "integer"
            ),
            makeExpressionProperty(
                {
                    name: "unitName",
                    displayName: "Unit",
                    type: PropertyType.MultilineText,
                    formText: `"voltage", "current", "watt", "power", "time", "frequency", "joule"`
                },
                "integer"
            ),
            makeExpressionProperty(
                {
                    name: "color",
                    displayName: "Color",
                    type: PropertyType.MultilineText
                },
                "string"
            ),
            makeExpressionProperty(
                {
                    name: "label",
                    type: PropertyType.MultilineText
                },
                "string"
            ),
            makeExpressionProperty(
                {
                    name: "offset",
                    type: PropertyType.MultilineText
                },
                "string"
            ),
            makeExpressionProperty(
                {
                    name: "scale",
                    type: PropertyType.MultilineText
                },
                "string"
            )
        ],
        defaultValue: {},
        listLabel: (waveformDefinition: WaveformDefinition) =>
            waveformDefinition.label
    };

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            chartData: observable,

            format: observable,
            samplingRate: observable,
            unitName: observable,
            color: observable,
            label: observable,
            offset: observable,
            scale: observable
        });
    }
}

export class EEZChartWidget extends Widget {
    static classInfo = makeDerivedClassInfo(Widget.classInfo, {
        enabledInComponentPalette: (projectType: ProjectType) =>
            projectType === ProjectType.DASHBOARD,

        componentPaletteGroupName: "!1Visualiser",

        properties: [
            makeDataPropertyInfo("data", {
                hideInPropertyGrid: true
            }),
            {
                name: "chartType",
                displayName: "Chart mode",
                type: PropertyType.Enum,
                enumItems: [
                    {
                        id: "single",
                        label: "Single chart"
                    },
                    {
                        id: "multi",
                        label: "Multiple charts"
                    },
                    {
                        id: "dlog",
                        label: "EEZ DLOG"
                    },
                    {
                        id: "history-item",
                        label: "Instrument History Item"
                    }
                ],
                enumDisallowUndefined: true,
                propertyGridGroup: specificGroup
            },
            makeExpressionProperty(
                {
                    name: "chartData",
                    displayName: "Chart data",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup,
                    disabled: (widget: EEZChartWidget) =>
                        widget.chartType == "multi" ||
                        widget.chartType == "history-item"
                },
                "any"
            ),
            makeExpressionProperty(
                {
                    name: "format",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup,
                    formText: `"float", "double", "rigol-byte", "rigol-word", "csv"`,
                    disabled: (widget: EEZChartWidget) =>
                        widget.chartType !== "single"
                },
                "string"
            ),
            makeExpressionProperty(
                {
                    name: "samplingRate",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup,
                    disabled: (widget: EEZChartWidget) =>
                        widget.chartType !== "single"
                },
                "integer"
            ),
            makeExpressionProperty(
                {
                    name: "unitName",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup,
                    disabled: (widget: EEZChartWidget) =>
                        widget.chartType !== "single",
                    formText: `"voltage", "current", "watt", "power", "time", "frequency", "joule"`
                },
                "integer"
            ),
            makeExpressionProperty(
                {
                    name: "color",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup,
                    disabled: (widget: EEZChartWidget) =>
                        widget.chartType !== "single"
                },
                "string"
            ),
            makeExpressionProperty(
                {
                    name: "label",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup,
                    disabled: (widget: EEZChartWidget) =>
                        widget.chartType !== "single"
                },
                "string"
            ),
            makeExpressionProperty(
                {
                    name: "offset",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup,
                    disabled: (widget: EEZChartWidget) =>
                        widget.chartType !== "single"
                },
                "string"
            ),
            makeExpressionProperty(
                {
                    name: "scale",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup,
                    disabled: (widget: EEZChartWidget) =>
                        widget.chartType !== "single"
                },
                "string"
            ),
            {
                name: "charts",
                type: PropertyType.Array,
                typeClass: WaveformDefinition,
                propertyGridGroup: specificGroup,
                partOfNavigation: false,
                enumerable: false,
                defaultValue: [],
                hasExpressionProperties: true,
                disabled: (widget: EEZChartWidget) =>
                    widget.chartType !== "multi"
            },
            makeExpressionProperty(
                {
                    name: "historyItemID",
                    displayName: "History item ID",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup,
                    disabled: (widget: EEZChartWidget) =>
                        widget.chartType != "history-item"
                },
                "string"
            ),
            makeStylePropertyInfo("style", "Default style")
        ],

        defaultValue: {
            left: 0,
            top: 0,
            width: 480,
            height: 320,
            chartType: "single"
        },

        icon: (
            <svg viewBox="0 0 200 200" fill="currentColor">
                <path d="M29.31 175.69a5 5 0 0 1-5-5V29.31a5 5 0 0 1 10 0v141.38a5 5 0 0 1-5 5Z" />
                <path d="M29.31 130a5 5 0 0 1-3.85-8.19l20.69-25a5 5 0 0 1 6.25-1.2l29 15.88 40-40a5 5 0 0 1 5.94-.85L146 80.85l20.42-33.45a5 5 0 0 1 8.58 5.2l-22.89 37.5a5 5 0 0 1-6.67 1.79l-19.55-10.71-40 40a5 5 0 0 1-5.94.85l-28.7-15.69-18.09 21.85a5 5 0 0 1-3.85 1.81ZM170.69 155H29.31a5 5 0 0 1 0-10h141.38a5 5 0 0 1 0 10Z" />
            </svg>
        ),

        getAdditionalFlowProperties: (widget: EEZChartWidget) => {
            const properties: PropertyInfo[] = [];

            for (let i = 0; i < widget.charts.length; i++) {
                for (const propertyName of [
                    "chartData",
                    "format",
                    "samplingRate",
                    "unitName",
                    "color",
                    "label",
                    "offset",
                    "scale"
                ]) {
                    properties.push(
                        Object.assign(
                            {},
                            findPropertyByNameInClassInfo(
                                WaveformDefinition.classInfo,
                                propertyName
                            ),
                            {
                                name: `charts[${i}].${propertyName}`
                            }
                        )
                    );
                }
            }

            return properties;
        }
    });

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            chartType: observable,

            chartData: observable,

            format: observable,
            samplingRate: observable,
            unitName: observable,
            color: observable,
            label: observable,
            offset: observable,
            scale: observable,

            charts: observable,

            historyItemID: observable
        });
    }

    chartType: "single" | "multi" | "dlog" | "history-item";

    chartData: string;

    format: string;
    samplingRate: string;
    unitName: string;
    color: string;
    label: string;
    offset: string;
    scale: string;

    charts: WaveformDefinition[];

    historyItemID: string;

    override render(
        flowContext: IFlowContext,
        width: number,
        height: number
    ): React.ReactNode {
        return (
            <>
                <EEZChartElement
                    widget={this}
                    flowContext={flowContext}
                    width={width}
                    height={height}
                ></EEZChartElement>
                {super.render(flowContext, width, height)}
            </>
        );
    }
}

registerClass("EEZChartWidget", EEZChartWidget);

////////////////////////////////////////////////////////////////////////////////

interface IViewOptions {
    axesLines: {
        type: "dynamic" | "fixed";
        steps: {
            x: number[];
            y: number[];
        };
        majorSubdivision: {
            horizontal: number;
            vertical: number;
        };
        minorSubdivision: {
            horizontal: number;
            vertical: number;
        };
        snapToGrid: boolean;
        defaultZoomMode: "default" | "all";
    };
    showAxisLabels: boolean;
    showZoomButtons: boolean;
}

abstract class EEZChart {
    chart: Waveform | MultiWaveform | DlogWaveform | undefined;
    _store: IStore | undefined;

    constructor(
        public flowContext: IFlowContext,
        public widget: EEZChartWidget
    ) {
        makeObservable(this, {
            chart: observable
        });

        setTimeout(async () => {
            const chart = await this.createChart();
            runInAction(() => {
                this.chart = chart;
            });
        }, 0);
    }

    abstract createChart(): Promise<
        Waveform | MultiWaveform | DlogWaveform | undefined
    >;

    static genData(dataLength: number, fn: (x: number) => number) {
        const data = Buffer.alloc(dataLength * 8);
        for (let i = 0; i < dataLength; i++) {
            data.writeDoubleLE(fn((2 * Math.PI * i) / dataLength), i * 8);
        }
        return data;
    }

    static genDlogData(hex: string) {
        return Buffer.from(hex, "hex");
    }

    get store(): IStore {
        if (this._store) {
            return this._store;
        }

        return {
            storeName: "dummy",
            storeVersion: 0,
            notifySource: {
                id: "dummy",
                filterMessage: () => {
                    console.log("notifySource.filterMessage");
                    return true;
                },
                onNewTarget: () => {
                    console.log("notifySource.onNewTarget");
                }
            },
            createObject: (object, options) => {
                console.log("createObject", object, options);
                return undefined;
            },
            updateObject: (object, options) => {
                // const message = JSON.parse(object.message);
                // const measurements = JSON.stringify(message.measurements);
                // if (
                //     this.widget.measurements &&
                //     this.flowContext.projectStore.runtime!
                // ) {
                //     this.flowContext.projectStore.runtime!.assignProperty(
                //         this.flowContext,
                //         this.widget,
                //         "measurements",
                //         measurements
                //     );
                // }
            },
            deleteObject: (object, options) => {
                console.log("deleteObject", object, options);
            },
            undeleteObject: (object, options) => {
                console.log("undeleteObject", object, options);
            },
            findById: id => {
                console.log("findById", id);
                return undefined;
            },
            findByOid: oid => {
                console.log("findByOid", oid);
                return undefined;
            },
            watch: (objectsCollection, filterSpecification) => {
                console.log("watch", objectsCollection, filterSpecification);
                return "dummy";
            },
            nonTransientAndNonLazyProperties: "dummy",
            dbRowToObject: (row: any) => {
                console.log("dbRowToObject", row);
                return undefined;
            },
            getSourceDescription: (sid: string) => {
                console.log("getSourceDescription", sid);
                return "dummy";
            }
        };
    }

    async createGenericWaveform({
        id,
        data,
        format,
        samplingRate,
        unitName,
        color,
        label,
        offset,
        scale,
        viewOptions,
        measurements,
        rulers
    }: {
        id: string;
        data: Buffer;
        format: WaveformFormat;
        samplingRate: number;
        unitName: string;
        color: string;
        colorInverse: string;
        label: string;
        offset: number;
        scale: number;
        viewOptions: IViewOptions;
        measurements: any;
        rulers: any;
    }) {
        const activityLogEntry: IActivityLogEntry = {
            id,
            date: new Date(),
            sid: "0",
            oid: "0",
            type: "instrument/file-download",
            message: JSON.stringify({
                sourceFilePath: "",
                state: "success",
                fileType: {
                    mime: "application/eez-raw"
                },
                waveformDefinition: {
                    samplingRate,
                    format,
                    unitName,
                    color,
                    colorInverse: color,
                    label,
                    offset,
                    scale,
                    dataLength: data.length
                },
                viewOptions,
                measurements,
                rulers
            }),
            data,
            deleted: false,
            temporary: false
        };

        const { Waveform } = await import("instrument/window/waveform/generic");

        return new Waveform(this.store, activityLogEntry, {
            toolbar: {
                showConfigureButton: false
            }
        });
    }
}

class SingleEEZChart extends EEZChart {
    constructor(
        flowContext: IFlowContext,
        widget: EEZChartWidget,
        public data: any,
        public format: string,
        public samplingRate: number,
        public unitName: string,
        public color: string,
        public label: string,
        public offset: number,
        public scale: number
    ) {
        super(flowContext, widget);
    }

    createChart = async () => {
        if (!this.data) {
            return undefined;
        }

        let format =
            this.format == "float"
                ? WaveformFormat.FLOATS_32BIT
                : this.format == "double"
                ? WaveformFormat.FLOATS_64BIT
                : this.format == "rigol-byte"
                ? WaveformFormat.RIGOL_BYTE
                : this.format == "rigol-word"
                ? WaveformFormat.RIGOL_WORD
                : this.format == "csv"
                ? WaveformFormat.CSV_STRING
                : WaveformFormat.JS_NUMBERS;

        if (isArray(this.data)) {
            format = WaveformFormat.JS_NUMBERS;
        }

        const { UNITS } = await import("eez-studio-shared/units");

        const unitNameLowerCase = this.unitName.toLowerCase();
        const unitName =
            Object.keys(UNITS).indexOf(unitNameLowerCase) == -1
                ? "unknown"
                : unitNameLowerCase;

        return await this.createGenericWaveform({
            id: "0",

            data: this.data,

            samplingRate: this.samplingRate,
            format,
            unitName,
            color: this.color,
            colorInverse: this.color,
            label: this.label,
            offset: this.offset,
            scale: this.scale,

            viewOptions: {
                axesLines: {
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
                    snapToGrid: true,
                    defaultZoomMode: "all"
                },
                showAxisLabels: true,
                showZoomButtons: true
            },
            measurements: undefined,
            rulers: undefined
        });
    };
}

class MultiEEZChart extends EEZChart {
    constructor(
        flowContext: IFlowContext,
        widget: EEZChartWidget,
        public waveformDefinitions: {
            data: any;
            format: string;
            samplingRate: number;
            unitName: string;
            color: string;
            label: string;
            offset: number;
            scale: number;
        }[]
    ) {
        super(flowContext, widget);
    }

    createChart = async () => {
        const waveformDefinitions = this.waveformDefinitions.filter(
            waveformDefinition => waveformDefinition.data
        );

        if (waveformDefinitions.length === 0) {
            return undefined;
        }

        const { UNITS } = await import("eez-studio-shared/units");

        return await this.createMultiWaveform({
            id: "0",
            waveforms: await Promise.all(
                waveformDefinitions.map((waveformDefinition, i) => {
                    let format =
                        waveformDefinition.format == "float"
                            ? WaveformFormat.FLOATS_32BIT
                            : waveformDefinition.format == "double"
                            ? WaveformFormat.FLOATS_64BIT
                            : waveformDefinition.format == "rigol-byte"
                            ? WaveformFormat.RIGOL_BYTE
                            : waveformDefinition.format == "rigol-word"
                            ? WaveformFormat.RIGOL_WORD
                            : waveformDefinition.format == "csv"
                            ? WaveformFormat.CSV_STRING
                            : WaveformFormat.JS_NUMBERS;

                    if (isArray(waveformDefinition.data)) {
                        format = WaveformFormat.JS_NUMBERS;
                    }

                    const unitName =
                        Object.keys(UNITS).indexOf(
                            waveformDefinition.unitName
                        ) == -1
                            ? "unknown"
                            : waveformDefinition.unitName;

                    return this.createGenericWaveform({
                        id: i.toString(),

                        data: waveformDefinition.data,

                        samplingRate: waveformDefinition.samplingRate,
                        format,
                        unitName,
                        color: waveformDefinition.color,
                        colorInverse: waveformDefinition.color,
                        label: waveformDefinition.label,
                        offset: waveformDefinition.offset,
                        scale: waveformDefinition.scale,

                        viewOptions: {
                            axesLines: {
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
                                snapToGrid: true,
                                defaultZoomMode: "all"
                            },
                            showAxisLabels: true,
                            showZoomButtons: true
                        },
                        measurements: undefined,
                        rulers: undefined
                    });
                })
            ),

            viewOptions: {
                axesLines: {
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
                    snapToGrid: true,
                    defaultZoomMode: "all"
                },
                showAxisLabels: true,
                showZoomButtons: true
            },
            measurements: undefined,
            rulers: undefined
        });
    };

    async createMultiWaveform({
        id,
        waveforms,
        viewOptions,
        measurements,
        rulers
    }: {
        id: string;
        waveforms: Waveform[];
        viewOptions: IViewOptions;
        measurements: any;
        rulers: any;
    }) {
        const waveformLinks = waveforms.map(waveform => ({
            id: waveform.id
        }));

        const activityLogEntry: IActivityLogEntry = {
            id,
            date: new Date(),
            sid: "0",
            oid: "0",
            type: "instrument/chart",
            message: JSON.stringify({
                waveformLinks,
                viewOptions,
                measurements,
                rulers
            }),
            data: null,
            deleted: false,
            temporary: false
        };

        const store = Object.assign({}, this.store, {
            findById: (id: string) => {
                for (const waveform of waveforms) {
                    if (id === waveform.id) {
                        return waveform;
                    }
                }
                return undefined;
            }
        });

        const { MultiWaveform } = await import(
            "instrument/window/waveform/multi"
        );

        return new MultiWaveform(store, activityLogEntry, {
            toolbar: {
                showConfigureButton: false
            }
        });
    }
}

class DLOGEEZChart extends EEZChart {
    constructor(
        flowContext: IFlowContext,
        widget: EEZChartWidget,
        public data: any
    ) {
        super(flowContext, widget);
    }

    async createChart() {
        if (!this.data) {
            return undefined;
        }

        return await this.createDlogWaveform({
            id: "0",
            data: this.data,
            viewOptions: {
                axesLines: {
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
                    snapToGrid: true,
                    defaultZoomMode: "all"
                },
                showAxisLabels: true,
                showZoomButtons: true
            },
            measurements: undefined,
            rulers: undefined
        });
    }

    async createDlogWaveform({
        id,
        data,
        viewOptions,
        measurements,
        rulers
    }: {
        id: string;
        data: Buffer;
        viewOptions: IViewOptions;
        measurements: any;
        rulers: any;
    }) {
        const activityLogEntry: IActivityLogEntry = {
            id,
            date: new Date(),
            sid: "0",
            oid: "0",
            type: "instrument/file-download",
            message: JSON.stringify({
                state: "success",
                dataLength: data?.length ?? 0,
                fileType: { ext: "dlog", mime: "application/eez-dlog" },
                viewOptions,
                measurements,
                rulers
            }),
            data,
            deleted: false,
            temporary: false
        };

        const { DlogWaveform } = await import(
            "instrument/window/waveform/dlog"
        );

        return new DlogWaveform(this.store, activityLogEntry, {
            toolbar: {
                showConfigureButton: false
            }
        });
    }
}

class HistoryItemEEZChart extends EEZChart {
    constructor(
        flowContext: IFlowContext,
        widget: EEZChartWidget,
        public historyItemID: string
    ) {
        super(flowContext, widget);

        (async () => {
            const { activityLogStore } = await import(
                "instrument/window/history/activity-log"
            );

            this._store = activityLogStore;
        })();
    }

    createChart = async () => {
        const { activityLogStore } = await import(
            "instrument/window/history/activity-log"
        );

        const activityLogEntry = activityLogStore.findById(this.historyItemID);
        if (!activityLogEntry) {
            return undefined;
        }

        const { Waveform } = await import("instrument/window/waveform/generic");

        return new Waveform(this.store, activityLogEntry, {
            toolbar: {
                showConfigureButton: true
            }
        });
    };
}

////////////////////////////////////////////////////////////////////////////////

const EEZChartElement = observer(
    class EEZChartElement extends React.Component<{
        widget: EEZChartWidget;
        flowContext: IFlowContext;
        width: number;
        height: number;
    }> {
        constructor(props: any) {
            super(props);

            makeObservable(this, {
                eezChart: computed
            });
        }

        cacheHistoryItemID: any;
        cacheChart: any;

        get appStore(): IAppStore {
            return {
                selectHistoryItemsSpecification: undefined,
                history: {} as any,
                deletedItemsHistory: {} as any,
                isHistoryItemSelected: (id: any) => {
                    console.log("isHistoryItemSelected", id);
                    return false;
                },
                selectHistoryItem: (id: string, selected: boolean) => {
                    console.log("selectHistoryItem", id, selected);
                },

                selectedHistoryItems: new Map<string, boolean>(),
                selectHistoryItems: (specification: any) => {
                    console.log("selectHistoryItems", specification);
                },

                oids: [],

                instrument: undefined as any,
                instrumentListStore: undefined,
                instrumentLists: [],
                undoManager: undefined,

                navigationStore: {
                    navigateToHistory: () => {
                        console.log("navigateToHistory");
                    },
                    navigateToDeletedHistoryItems: () => {
                        console.log("navigateToDeletedHistoryItems");
                    },
                    navigateToSessionsList: () => {
                        console.log("navigateToSessionsList");
                    },
                    mainHistoryView: undefined,
                    selectedListId: undefined,
                    changeSelectedListId: async (
                        listId: string | undefined
                    ) => {
                        console.log("changeSelectedListId", listId);
                    }
                },

                filters: undefined as any,

                findListIdByName: (listName: any) => undefined
            };
        }

        get eezChart(): EEZChart {
            const { widget, flowContext } = this.props;

            if (widget.chartType === "single") {
                return new SingleEEZChart(
                    flowContext,
                    widget,
                    evalProperty(flowContext, widget, "chartData") ??
                        (!flowContext.flowState
                            ? EEZChart.genData(1000, Math.sin)
                            : undefined),
                    evalProperty(flowContext, widget, "format") ??
                        (!flowContext.flowState ? "double" : undefined),
                    evalProperty(flowContext, widget, "samplingRate") ??
                        (!flowContext.flowState ? 1000 : undefined),
                    evalProperty(flowContext, widget, "unitName") ??
                        (!flowContext.flowState ? "voltage" : undefined),
                    evalProperty(flowContext, widget, "color") ??
                        (!flowContext.flowState ? "#bb8100" : undefined),
                    evalProperty(flowContext, widget, "label") ??
                        (!flowContext.flowState
                            ? "Channel 1 Voltage"
                            : undefined),
                    evalProperty(flowContext, widget, "offset") ??
                        (!flowContext.flowState ? 0 : undefined),
                    evalProperty(flowContext, widget, "scale") ??
                        (!flowContext.flowState ? 1 : undefined)
                );
            }

            if (widget.chartType === "multi") {
                return new MultiEEZChart(
                    flowContext,
                    widget,
                    widget.charts.map((chart, i) => ({
                        data:
                            evalProperty(
                                flowContext,
                                widget,
                                `charts[${i}].chartData`
                            ) ??
                            (!flowContext.flowState
                                ? EEZChart.genData(1000, Math.sin)
                                : undefined),
                        format:
                            evalProperty(
                                flowContext,
                                widget,
                                `charts[${i}].format`
                            ) ??
                            (!flowContext.flowState ? "double" : undefined),
                        samplingRate:
                            evalProperty(
                                flowContext,
                                widget,
                                `charts[${i}].samplingRate`
                            ) ?? (!flowContext.flowState ? 1000 : undefined),
                        unitName: evalProperty(
                            flowContext,
                            widget,
                            `charts[${i}].unitName`
                        ),
                        color:
                            evalProperty(
                                flowContext,
                                widget,
                                `charts[${i}].color`
                            ) ??
                            (!flowContext.flowState ? "#bb8100" : undefined),
                        label:
                            evalProperty(
                                flowContext,
                                widget,
                                `charts[${i}].label`
                            ) ??
                            (!flowContext.flowState
                                ? "Channel 1 Voltage"
                                : undefined),
                        offset:
                            evalProperty(
                                flowContext,
                                widget,
                                `charts[${i}].offset`
                            ) ?? (!flowContext.flowState ? 0 : undefined),
                        scale:
                            evalProperty(
                                flowContext,
                                widget,
                                `charts[${i}].scale`
                            ) ?? (!flowContext.flowState ? 1 : undefined)
                    }))
                );
            }

            if (widget.chartType === "history-item") {
                if (flowContext.flowState) {
                    const historyItemID = evalProperty(
                        flowContext,
                        widget,
                        "historyItemID"
                    );

                    if (
                        historyItemID != undefined &&
                        historyItemID == this.cacheHistoryItemID
                    ) {
                        return this.cacheChart;
                    }

                    this.cacheHistoryItemID = historyItemID;
                    this.cacheChart = new HistoryItemEEZChart(
                        flowContext,
                        widget,
                        historyItemID
                    );

                    return this.cacheChart;
                }

                return new SingleEEZChart(
                    flowContext,
                    widget,
                    EEZChart.genData(1000, Math.sin),
                    "double",
                    1000,
                    "voltage",
                    "#bb8100",
                    "Channel 1 Voltage",
                    0,
                    1
                );
            }

            const data = evalProperty(flowContext, widget, "chartData");

            return new DLOGEEZChart(
                flowContext,
                widget,
                flowContext.flowState
                    ? data
                    : EEZChart.genDlogData(
                          "45455a2d444c4f4702000200f8000000030001070002472691640b0003000000000000f03f04000400070005330000000700060000000004000a0807000b0ad7a33c04000f0007000c0000000007000d0000803f03000e05001e010105001f0113080020010000000008002101000020420f002201444350343035202331205505002301010c00250100000000000000000c002601000000000000f03f05001e020305001f02130800200200000000080021020100a0400f002202444350343035202331204905002302010c00250200000000000000000c002602000000000000f03f040024000600320195010600330103030000370000295c0d4101002040295c0d4101002040295c0d41010020407b14d640ad1cfa3fcdcca040518db73f48e10441c1ca1140295c0d4101002040295c0d4101002040295c0d41010020407b14a24090c2b53f1f85f740f2d21140295c0d4101002040295c0d4101002040295c0d419eef1f40713da640ea26b93f713de640806afc3f295c0d4101002040295c0d41cff71f40295c0d41518d1f407b14a240ea26b93f1f85f740e4a50740295c0d4101002040295c0d4101002040295c0d41010020406666a640c74bbf3f713de640806afc3f295c0d4101002040295c0d4101002040295c0d419eef1f4085eba140ea26b93f6666e640b39d0740295c0d41cff71f40295c0d4101002040295c0d410100204085eba140f2d2b53f1f85f740f2d21140295c0d4101002040295c0d4101002040295c0d419eef1f406666a640ea26b93f6666e6401e5afc3f295c0d41cff71f40295c0d4101002040295c0d41ee7c1f407b14a240ea26b93f1f85f740e4a50740295c0d4101002040295c0d41cff71f40295c0d41cff71f406666a6402a5cbf3f713de640806afc3f"
                      )
            );
        }

        render() {
            const { flowContext } = this.props;

            const { ChartPreview } =
                require("instrument/window/chart-preview") as typeof ChartPreviewModule;

            return (
                <div
                    style={{
                        pointerEvents: flowContext.flowState ? "all" : "none"
                    }}
                >
                    {this.eezChart.chart && (
                        <ChartPreview
                            appStore={this.appStore}
                            data={this.eezChart.chart}
                        />
                    )}
                </div>
            );
        }
    }
);
