import { ipcRenderer } from "electron";
import React from "react";
import { computed, makeObservable, observable, runInAction, toJS } from "mobx";
import { clipboard } from "electron";

import type * as TabulatorModule from "tabulator-tables";
import type * as LuxonModule from "luxon";

import * as notification from "eez-studio-ui/notification";

import {
    registerClass,
    makeDerivedClassInfo,
    ProjectType,
    PropertyType,
    EezObject,
    ClassInfo,
    PropertyProps,
    IMessage,
    MessageType
} from "project-editor/core/object";

import {
    Widget,
    makeDataPropertyInfo,
    makeExpressionProperty
} from "project-editor/flow/component";
import { IFlowContext } from "project-editor/flow/flow-interfaces";
import { observer } from "mobx-react";

import classNames from "classnames";
import { TABULATOR_ICON } from "project-editor/ui-components/icons";
import { evalProperty } from "project-editor/flow/helper";
import { IDashboardComponentContext } from "eez-studio-types";
import { specificGroup } from "project-editor/ui-components/PropertyGrid/groups";
import { Button } from "eez-studio-ui/button";
import { Message, getChildOfObject } from "project-editor/store";

////////////////////////////////////////////////////////////////////////////////

let _Tabulator: typeof TabulatorModule.TabulatorFull | undefined;

function getTabulator() {
    if (!_Tabulator) {
        const luxon = require("luxon") as typeof LuxonModule;
        (window as any).luxon = luxon;

        _Tabulator =
            require("tabulator-tables") as typeof TabulatorModule.TabulatorFull;
    }
    return _Tabulator;
}

////////////////////////////////////////////////////////////////////////////////

function openLink(url: string) {
    const { shell } = require("electron");
    shell.openExternal(url);
}

////////////////////////////////////////////////////////////////////////////////

export class TabulatorExecutionState {
    printWidget?: () => void;
    getSheetData?: (lookup: string) => any;
}

////////////////////////////////////////////////////////////////////////////////

const TabulatorElement = observer(
    class TabulatorElement extends React.Component<{
        widget: TabulatorWidget;
        flowContext: IFlowContext;
        width: number;
        height: number;
    }> {
        ref = React.createRef<HTMLDivElement>();

        tabulator: TabulatorModule.Tabulator;

        defaultPersistance: any = {};

        constructor(props: any) {
            super(props);

            makeObservable(this, {
                options: computed
            });
        }

        get tableData() {
            let data = evalProperty(
                this.props.flowContext,
                this.props.widget,
                "data"
            );

            if (!Array.isArray(data)) {
                return undefined;
            }

            data = toJS(data);

            // workaround: The Tabulator library does not know how to work with Date objects, so it needs to be converted to an ISO string.
            data.forEach((row: any) => {
                Object.keys(row).forEach(key => {
                    if (row[key] instanceof Date) {
                        row[key] = row[key].toISOString();
                    }
                });
            });

            return data;
        }

        get tableConfiguration() {
            const configuration = evalProperty(
                this.props.flowContext,
                this.props.widget,
                "configuration"
            );

            if (!configuration) {
                return undefined;
            }

            return toJS(configuration);
        }

        get options(): TabulatorModule.Options {
            let configuration = this.tableConfiguration;

            const widgetOptions = this.props.widget.tabulatorOptions;

            // persistence
            if (this.props.flowContext.flowState) {
                widgetOptions.persistence = true;

                widgetOptions.persistenceWriterFunc = (
                    id: any,
                    type: any,
                    data: any
                ) => {
                    runInAction(() => {
                        this.persistance[type] = data;
                    });
                };

                widgetOptions.persistenceReaderFunc = (id: any, type: any) => {
                    return this.persistance[type];
                };
            }

            const options: TabulatorModule.Options = Object.assign(
                {
                    data: this.tableData
                },
                widgetOptions,
                configuration
            );

            return options;
        }

        get persistance() {
            return (
                evalProperty(
                    this.props.flowContext,
                    this.props.widget,
                    "persistance"
                ) ?? this.defaultPersistance
            );
        }

        get printHtml() {
            this.tabulator.modules.export.ge;

            const printDiv = document.createElement("div");
            printDiv.classList.add("tabulator-print-fullscreen");

            if (typeof this.tabulator.options.printHeader == "string") {
                const headerEl = document.createElement("div");
                headerEl.classList.add("tabulator-print-header");
                headerEl.innerHTML = this.tabulator.options.printHeader;
                printDiv.appendChild(headerEl);
            }

            const tableEl = this.tabulator.modules.export.generateTable(
                this.tabulator.options.printConfig,
                this.tabulator.options.printStyled,
                /*this.tabulator.options.printRowRange || */ "active",
                "print"
            );
            printDiv.appendChild(tableEl);

            if (typeof this.tabulator.options.printFooter == "string") {
                const footerEl = document.createElement("div");
                footerEl.classList.add("tabulator-print-footer");
                footerEl.innerHTML = this.tabulator.options.printFooter;
                printDiv.appendChild(footerEl);
            }

            const div = document.createElement("div");
            div.appendChild(printDiv);
            return div.innerHTML;
        }

        onDataChanged = (data: any[]) => {
            const { flowContext, widget } = this.props;

            if (
                !flowContext.projectStore.runtime ||
                !flowContext.projectStore.projectTypeTraits.isDashboard ||
                !widget.eventHandlers.find(
                    eventHandler => eventHandler.eventName == "ON_DATA_CHANGED"
                )
            ) {
                return undefined;
            }

            if (flowContext.projectStore.runtime) {
                flowContext.projectStore.runtime.executeWidgetAction(
                    flowContext,
                    widget,
                    "ON_DATA_CHANGED",
                    data,
                    `json`
                );
            }
        };

        async createTabulator(el: HTMLDivElement) {
            if (this.tabulator) {
                this.tabulator.off("dataChanged", this.onDataChanged);
                this.tabulator.destroy();
            }

            const Tabulator = getTabulator();

            this.tabulator = new Tabulator(el, this.options);

            this.tabulator.on("dataChanged", this.onDataChanged);

            const flowState = this.props.flowContext.flowState;
            if (flowState) {
                let executionState =
                    flowState.getComponentExecutionState<TabulatorExecutionState>(
                        this.props.widget
                    );

                if (executionState && !executionState.printWidget) {
                    executionState.printWidget = () => {
                        ipcRenderer.send("printPDF", this.printHtml);
                    };
                    executionState.getSheetData = (lookup: string) => {
                        return this.tabulator.getSheetData(lookup);
                    };
                }
            }
        }

        componentDidMount() {
            if (this.ref.current) {
                this.createTabulator(this.ref.current);
            }
        }

        async componentDidUpdate() {
            if (this.ref.current) {
                this.createTabulator(this.ref.current);
            }
        }

        componentWillUnmount(): void {
            if (this.tabulator) {
                this.tabulator.off("dataChanged", this.onDataChanged);
            }
        }

        render() {
            const { flowContext } = this.props;

            // observe if data or config objects changed
            this.options;

            // observe if persistence object changed
            this.persistance;

            // observe if flow state has changed
            this.props.flowContext.flowState?.getComponentExecutionState<TabulatorExecutionState>(
                this.props.widget
            );

            return (
                <div
                    ref={this.ref}
                    style={{
                        width: this.props.width,
                        height: this.props.height
                    }}
                    className={classNames("EezStudio_Tabulator", {
                        interactive: !!flowContext.projectStore.runtime
                    })}
                ></div>
            );
        }
    }
);

const CopyOptionsButton = observer(
    class CopyOptionsButton extends React.Component<PropertyProps> {
        get tabulatorWidget() {
            return this.props.objects[0] as TabulatorWidget;
        }

        copy = () => {
            clipboard.writeText(
                `json\`${JSON.stringify(
                    this.tabulatorWidget.tabulatorOptions,
                    undefined,
                    2
                )}\``
            );

            notification.info(
                "The options are copied as a JSON literal to the clipboard"
            );
        };

        render() {
            return (
                <Button
                    color="secondary"
                    size="small"
                    onClick={this.copy}
                    style={{
                        marginTop: 10,
                        marginBottom: 10
                    }}
                >
                    Copy Options
                </Button>
            );
        }
    }
);

class TabulatorColumn extends EezObject {
    title: string;
    field: string;
    formatter:
        | "plaintext"
        | "textarea"
        | "html"
        | "money"
        | "image"
        | "datetime"
        | "datetimediff"
        | "link"
        | "tickCross"
        | "color"
        | "star"
        | "traffic"
        | "progress"
        | "lookup"
        | "buttonTick"
        | "buttonCross"
        | "rownum"
        | "handle"
        | "rowSelection"
        | "responsiveCollapse";
    advanced: string;

    static classInfo: ClassInfo = {
        listLabel: (object: TabulatorColumn) => "",
        properties: [
            {
                name: "title",
                type: PropertyType.MultilineText
            },
            {
                name: "field",
                type: PropertyType.MultilineText
            },
            {
                name: "formatter",
                type: PropertyType.Enum,
                enumItems: [
                    { id: "plaintext" },
                    { id: "textarea" },
                    { id: "html" },
                    { id: "money" },
                    { id: "image" },
                    { id: "datetime" },
                    { id: "datetimediff" },
                    { id: "link" },
                    { id: "tickCross" },
                    { id: "color" },
                    { id: "star" },
                    { id: "traffic" },
                    { id: "progress" },
                    { id: "lookup" },
                    { id: "buttonTick" },
                    { id: "buttonCross" },
                    { id: "rownum" },
                    { id: "handle" },
                    { id: "rowSelection" },
                    { id: "responsiveCollapse" }
                ]
            },
            {
                name: "advanced",
                type: PropertyType.JSON
            }
        ],
        defaultValue: {},
        check: (column: TabulatorColumn, messages: IMessage[]) => {
            if (column.advanced) {
                try {
                    JSON.parse(column.advanced);
                } catch (err) {
                    messages.push(
                        new Message(
                            MessageType.ERROR,
                            `Invalid JSON: ${err}`,
                            getChildOfObject(column, "advanced")
                        )
                    );
                }
            }
        }
    };

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            title: observable,
            field: observable,
            formatter: observable,
            advanced: observable
        });
    }
}

export class TabulatorWidget extends Widget {
    static classInfo = makeDerivedClassInfo(Widget.classInfo, {
        enabledInComponentPalette: (projectType: ProjectType) =>
            projectType === ProjectType.DASHBOARD,

        componentPaletteGroupName: "!1Visualiser",

        properties: [
            makeDataPropertyInfo("data", {}, "json"),
            {
                name: "layout",
                type: PropertyType.Enum,
                enumItems: [
                    {
                        id: "fitData"
                    },
                    {
                        id: "fitColumns"
                    },
                    {
                        id: "fitDataFill"
                    },
                    {
                        id: "fitDataStretch"
                    },
                    {
                        id: "fitDataTable"
                    }
                ],
                enumDisallowUndefined: true,
                propertyGridGroup: specificGroup
            },
            {
                name: "autoColumns",
                type: PropertyType.Boolean,
                checkboxStyleSwitch: true,
                propertyGridGroup: specificGroup
            },
            {
                name: "columns",
                type: PropertyType.Array,
                typeClass: TabulatorColumn,
                propertyGridGroup: specificGroup,
                defaultValue: [],
                disabled: (widget: TabulatorWidget) => widget.autoColumns
            },
            {
                name: "pagination",
                type: PropertyType.Boolean,
                checkboxStyleSwitch: true,
                propertyGridGroup: specificGroup
            },
            {
                name: "headerVisible",
                type: PropertyType.Boolean,
                checkboxStyleSwitch: true,
                propertyGridGroup: specificGroup
            },
            {
                name: "copyOptionsButton",
                type: PropertyType.Any,
                propertyGridGroup: specificGroup,
                computed: true,
                propertyGridRowComponent: CopyOptionsButton
            },
            makeExpressionProperty(
                {
                    name: "configuration",
                    displayName: "Advanced conf.",
                    formText: () => (
                        <span>
                            Advanced configuration options are set via JSON
                            value, check{" "}
                            <a
                                href="#"
                                onClick={event => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    openLink("https://tabulator.info/docs/6.2");
                                }}
                            >
                                Tabulator documentation
                            </a>{" "}
                            for available options.
                        </span>
                    ),
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup
                },
                "json"
            ),
            makeExpressionProperty(
                {
                    name: "persistance",
                    displayName: "Persistent conf.",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup
                },
                "json"
            )
        ],

        defaultValue: {
            left: 0,
            top: 0,
            width: 320,
            height: 320,
            headerVisible: true,
            autoColumns: true
        },

        icon: TABULATOR_ICON,

        showTreeCollapseIcon: "never",

        execute: (context: IDashboardComponentContext) => {
            Widget.classInfo.execute!(context);

            let executionState =
                context.getComponentExecutionState<TabulatorExecutionState>();
            if (!executionState) {
                context.setComponentExecutionState(
                    new TabulatorExecutionState()
                );
            }
        },

        widgetEvents: {
            ON_DATA_CHANGED: {
                code: 1,
                paramExpressionType: `json`
            }
        }
    });

    layout:
        | "fitData"
        | "fitColumns"
        | "fitDataFill"
        | "fitDataStretch"
        | "fitDataTable"
        | undefined;
    autoColumns: boolean;
    columns: TabulatorColumn[];
    pagination: boolean;
    headerVisible: boolean;

    configuration: string;
    persistance: string;

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            layout: observable,
            autoColumns: observable,
            columns: observable,
            pagination: observable,
            configuration: observable,
            persistance: observable,
            headerVisible: observable
        });
    }

    get tabulatorOptions() {
        const options: TabulatorModule.Options = {
            layout: this.layout,
            autoColumns: this.autoColumns,
            pagination: this.pagination,
            headerVisible: this.headerVisible
        };

        if (!this.autoColumns) {
            options.columns = this.columns.map(column => {
                const options = {
                    title: column.title,
                    field: column.field,
                    formatter: column.formatter
                };

                try {
                    const advanced = JSON.parse(column.advanced);
                    Object.assign(options, advanced);
                } catch (err) {}

                return options;
            });
        }

        return options;
    }

    override render(
        flowContext: IFlowContext,
        width: number,
        height: number
    ): React.ReactNode {
        return (
            <>
                <TabulatorElement
                    widget={this}
                    flowContext={flowContext}
                    width={width}
                    height={height}
                />
                {super.render(flowContext, width, height)}
            </>
        );
    }
}

registerClass("TabulatorWidget", TabulatorWidget);
