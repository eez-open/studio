import { ipcRenderer } from "electron";
import React from "react";
import { computed, makeObservable, observable, toJS } from "mobx";

import type * as TabulatorModule from "tabulator-tables";
import type * as LuxonModule from "luxon";

import {
    registerClass,
    makeDerivedClassInfo,
    ProjectType,
    PropertyType
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

            const options = Object.assign(
                {
                    autoColumns: configuration ? false : true,

                    persistence: true,
                    persistenceWriterFunc: (id: any, type: any, data: any) => {
                        this.persistance[type] = data;
                    },
                    persistenceReaderFunc: (id: any, type: any) => {
                        return this.persistance[type];
                    }
                },
                configuration,
                {
                    data: this.tableData
                }
            );

            // if (options.spreadsheet) {
            //     if (Array.isArray(options.data) && options)
            //     options.spreadsheetData = options.data;
            //     delete options.data;
            // }

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

export class TabulatorWidget extends Widget {
    static classInfo = makeDerivedClassInfo(Widget.classInfo, {
        enabledInComponentPalette: (projectType: ProjectType) =>
            projectType === ProjectType.DASHBOARD,

        componentPaletteGroupName: "!1Visualiser",

        properties: [
            makeDataPropertyInfo("data", { displayName: "Table data" }, "json"),
            makeExpressionProperty(
                {
                    name: "configuration",
                    displayName: "Advanced conf.",
                    formText: () => (
                        <span>
                            Advanced configuration options are set via JSON
                            values, check{" "}
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
            height: 320
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

    configuration: string;
    persistance: string;

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            configuration: observable,
            persistance: observable
        });
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
