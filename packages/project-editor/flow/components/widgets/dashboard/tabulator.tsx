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
    MessageType,
    WidgetEvents
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
import { evalProperty, evalPropertyWithType } from "project-editor/flow/helper";
import { IDashboardComponentContext } from "eez-studio-types";
import { specificGroup } from "project-editor/ui-components/PropertyGrid/groups";
import { Button } from "eez-studio-ui/button";
import {
    Message,
    ProjectStore,
    createObject,
    getChildOfObject
} from "project-editor/store";
import { IconAction } from "eez-studio-ui/action";
import { showGenericDialog } from "eez-studio-ui/generic-dialog";
import { humanize } from "eez-studio-shared/string";
import {
    getArrayElementTypeFromType,
    getEnumFromType,
    getStructureFromType
} from "project-editor/features/variable/value-type";
import type { IStructure } from "project-editor/features/variable/variable";

////////////////////////////////////////////////////////////////////////////////

const TABULATOR_EVENTS: {
    [eezEventName: string]: {
        tabulatorEventName: keyof TabulatorModule.EventCallBackMethods;
        tabulatorToEezEventData: (data: any) => any;
    };
} = {
    ON_DATA_CHANGED: {
        tabulatorEventName: "dataChanged",
        tabulatorToEezEventData: (data: any) => data
    },
    ON_ROW_SELECTED: {
        tabulatorEventName: "rowSelected",
        tabulatorToEezEventData: (row: TabulatorModule.RowComponent) => ({
            index: row.getTable().rowManager.rows.indexOf((row as any)._row),
            position: row.getPosition()
        })
    },
    ON_ROW_DESELECTED: {
        tabulatorEventName: "rowDeselected",
        tabulatorToEezEventData: (row: TabulatorModule.RowComponent) => ({
            index: row.getTable().rowManager.rows.indexOf((row as any)._row),
            position: row.getPosition()
        })
    }
};

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

function getColumnsFromStructure(
    projectStore: ProjectStore,
    structure: IStructure
): TabulatorColumn[] {
    return structure.fields.map(field => {
        const enumType = getEnumFromType(projectStore.project, field.type);

        const column = new TabulatorColumn();

        column.title = humanize(field.name);
        column.field = field.name;

        if (enumType) {
            const params: any = {};

            enumType.members.forEach(
                enumMember =>
                    (params[enumMember.value.toString()] = enumMember.name)
            );

            column.formatter = "lookup";
            column.formatterParams = JSON.stringify(params, undefined, 2);

            column.editor = "list";
            column.editorParams = JSON.stringify(
                { values: params },
                undefined,
                2
            );
        } else {
            column.formatter = "plaintext";
        }

        return column;
    });
}

function buildColumnsFromStructure(
    structureName: string,
    tabulatorOptions: TabulatorOptions,
    projectStore: ProjectStore
) {
    const structure = projectStore.project.variables.structures.find(
        structure => structure.name == structureName
    );
    if (!structure) {
        return;
    }

    projectStore.undoManager.setCombineCommands(true);

    if (tabulatorOptions.columns.length > 0) {
        projectStore.deleteObjects(tabulatorOptions.columns);
    }

    const columns = getColumnsFromStructure(projectStore, structure);

    for (const columnProperties of columns) {
        const column = createObject<TabulatorColumn>(
            projectStore,
            columnProperties,
            TabulatorColumn
        );

        projectStore.addObject(tabulatorOptions.columns, column);
    }

    projectStore.undoManager.setCombineCommands(false);
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
            let valueWithType = evalPropertyWithType(
                this.props.flowContext,
                this.props.widget,
                "data"
            );

            let data = valueWithType?.value;

            if (!data || !Array.isArray(data)) {
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

            return {
                data,
                valueType: valueWithType?.valueType ?? ("any" as const)
            };
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
            const tableData = this.tableData;

            let configuration = this.tableConfiguration;

            const widgetOptions = this.props.widget.options.tabulatorOptions;

            if (widgetOptions.autoColumns) {
                if (tableData) {
                    const elementType = getArrayElementTypeFromType(
                        tableData.valueType
                    );

                    if (elementType) {
                        const structure = getStructureFromType(
                            this.props.flowContext.projectStore.project,
                            elementType
                        );
                        if (structure) {
                            widgetOptions.columns =
                                TabulatorOptions.getColumnsDefinition(
                                    getColumnsFromStructure(
                                        this.props.flowContext.projectStore,
                                        structure
                                    )
                                );

                            widgetOptions.autoColumns = false;
                        }
                    }
                }
            }

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
                    data: tableData?.data
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

        triggerEvent(eventName: string, data: any) {
            const { flowContext, widget } = this.props;

            if (
                !flowContext.projectStore.runtime ||
                !flowContext.projectStore.projectTypeTraits.isDashboard ||
                !widget.eventHandlers.find(
                    eventHandler => eventHandler.eventName == eventName
                )
            ) {
                return undefined;
            }

            if (flowContext.projectStore.runtime) {
                flowContext.projectStore.runtime.executeWidgetAction(
                    flowContext,
                    widget,
                    eventName,
                    data,
                    `json`
                );
            }
        }

        async createTabulator(el: HTMLDivElement) {
            const Tabulator = getTabulator();

            this.tabulator = new Tabulator(el, this.options);

            const { flowContext, widget } = this.props;

            // register event handlers
            const runtime = flowContext.projectStore.runtime;
            if (runtime) {
                widget.eventHandlers.forEach(eventHandler => {
                    const eezEventName = eventHandler.eventName;
                    const tabulatorEvent =
                        TABULATOR_EVENTS[eventHandler.eventName];

                    this.tabulator.on(
                        tabulatorEvent.tabulatorEventName,
                        (data: any) => {
                            runtime.executeWidgetAction(
                                flowContext,
                                widget,
                                eezEventName,
                                tabulatorEvent.tabulatorToEezEventData(data),
                                `json`
                            );
                        }
                    );
                });
            }

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
        copy = () => {
            clipboard.writeText(
                `json\`${JSON.stringify(
                    (this.props.objects[0] as TabulatorOptions)
                        .tabulatorOptions,
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
                    title="Copy options as a JSON literal to the clipboard"
                >
                    Copy Options
                </Button>
            );
        }
    }
);

const FORMATTERS = [
    "plaintext",
    "textarea",
    "html",
    "money",
    "image",
    "datetime",
    "datetimediff",
    "link",
    "tickCross",
    "color",
    "star",
    "traffic",
    "progress",
    "lookup",
    "buttonTick",
    "buttonCross",
    "rownum",
    "handle",
    "rowSelection",
    "responsiveCollapse"
] as const;

const EDITORS = [
    "input",
    "textarea",
    "number",
    "range",
    "tickCross",
    "star",
    "list",
    "date",
    "time",
    "datetime"
] as const;

class TabulatorColumn extends EezObject {
    title: string;
    field: string;
    formatter: (typeof FORMATTERS)[number];
    formatterParams: string;
    editor: (typeof EDITORS)[number];
    editorParams: string;
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
                enumItems: FORMATTERS.slice()
                    .sort()
                    .map(id => ({
                        id
                    }))
            },
            {
                name: "formatterParams",
                type: PropertyType.JSON
            },
            {
                name: "editor",
                type: PropertyType.Enum,
                enumItems: EDITORS.slice()
                    .sort()
                    .map(id => ({
                        id
                    }))
            },
            {
                name: "editorParams",
                type: PropertyType.JSON
            },
            {
                name: "advanced",
                type: PropertyType.JSON
            }
        ],
        defaultValue: {
            formatter: "auto",
            editor: "plaintext"
        },
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
            formatterParams: observable,
            editor: observable,
            editorParams: observable,
            advanced: observable
        });
    }

    getColumnDefinition(): TabulatorModule.ColumnDefinition {
        const columnDefinition: TabulatorModule.ColumnDefinition = {
            title: this.title,
            field: this.field,
            formatter: this.formatter,
            editor: this.editor
        };

        if (this.advanced) {
            try {
                const advanced = JSON.parse(this.advanced);
                Object.assign(columnDefinition, advanced);
            } catch (err) {}
        }

        if (this.formatterParams) {
            try {
                const formatterParams = JSON.parse(this.formatterParams);
                columnDefinition.formatterParams = formatterParams;
            } catch (err) {}
        }

        if (this.editorParams) {
            try {
                const editorParams = JSON.parse(this.editorParams);
                columnDefinition.editorParams = editorParams;
            } catch (err) {}
        }

        if (this.advanced) {
            try {
                const advanced = JSON.parse(this.advanced);
                Object.assign(columnDefinition, advanced);
            } catch (err) {}
        }

        return columnDefinition;
    }
}

class TabulatorOptions extends EezObject {
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

    static classInfo: ClassInfo = {
        listLabel: (object: TabulatorColumn) => "",
        properties: [
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
                enumDisallowUndefined: true
            },
            {
                name: "autoColumns",
                type: PropertyType.Boolean,
                checkboxStyleSwitch: true
            },
            {
                name: "columns",
                type: PropertyType.Array,
                typeClass: TabulatorColumn,
                defaultValue: [],
                disabled: (options: TabulatorOptions) => options.autoColumns,
                arrayPropertyEditorAdditionalButtons: (
                    tabulatorOptions: TabulatorOptions,
                    propertyInfo,
                    projectStore
                ) => {
                    if (projectStore.project.variables.structures.length == 0) {
                        return [];
                    }
                    return [
                        <IconAction
                            key="build-from-structure"
                            icon={
                                <svg viewBox="0 0 20 20">
                                    <path d="M15 9h-3v2h3v3h2v-3h3V9h-3V6h-2v3zM0 3h10v2H0V3zm0 8h10v2H0v-2zm0-4h10v2H0V7zm0 8h10v2H0v-2z" />
                                </svg>
                            }
                            iconSize={16}
                            onClick={event => {
                                event.preventDefault();

                                (async () => {
                                    const result = await showGenericDialog({
                                        dialogDefinition: {
                                            title: "Select Structure",
                                            fields: [
                                                {
                                                    name: "structure",
                                                    type: "enum",
                                                    enumItems:
                                                        projectStore.project.variables.structures.map(
                                                            structure => ({
                                                                id: structure.name,
                                                                label: structure.name
                                                            })
                                                        )
                                                }
                                            ]
                                        },
                                        values: {
                                            structure:
                                                projectStore.project.variables
                                                    .structures[0].name
                                        },
                                        dialogContext: projectStore.project
                                    });

                                    buildColumnsFromStructure(
                                        result.values.structure,
                                        tabulatorOptions,
                                        projectStore
                                    );
                                })();
                            }}
                            title="Build From Structure Definition"
                        />
                    ];
                }
            },
            {
                name: "pagination",
                type: PropertyType.Boolean,
                checkboxStyleSwitch: true
            },
            {
                name: "headerVisible",
                type: PropertyType.Boolean,
                checkboxStyleSwitch: true
            },
            {
                name: "copyOptionsButton",
                type: PropertyType.Any,
                computed: true,
                propertyGridRowComponent: CopyOptionsButton
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
            layout: observable,
            autoColumns: observable,
            columns: observable,
            pagination: observable,
            headerVisible: observable
        });
    }

    static getColumnsDefinition(columns: TabulatorColumn[]) {
        return columns.map(column => column.getColumnDefinition());
    }

    get tabulatorOptions() {
        const options: TabulatorModule.Options = {
            layout: this.layout,
            autoColumns: this.autoColumns,
            pagination: this.pagination,
            headerVisible: this.headerVisible
        };

        if (!this.autoColumns) {
            options.columns = TabulatorOptions.getColumnsDefinition(
                this.columns
            );
        }

        return options;
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
                name: "options",
                displayName: "Basic options",
                type: PropertyType.Object,
                typeClass: TabulatorOptions,
                propertyGridGroup: specificGroup,
                enumerable: false
            },
            makeExpressionProperty(
                {
                    name: "configuration",
                    displayName: "Advanced options",
                    formText: () => (
                        <span>
                            Advanced options are set via JSON value, check{" "}
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
                    displayName: "Persistent configuration",
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
            options: {
                layout: "fitColumns",
                headerVisible: true,
                autoColumns: true
            }
        },

        beforeLoadHook: (object: TabulatorWidget, jsObject: any) => {
            if (jsObject.options == undefined) {
                jsObject.options = {
                    headerVisible: true,
                    autoColumns: true
                };
            }

            if (jsObject.layout != undefined) {
                jsObject.options.layout = jsObject.layout;
                delete jsObject.layout;
            }

            if (jsObject.autoColumns != undefined) {
                jsObject.options.autoColumns = jsObject.autoColumns;
                delete jsObject.autoColumns;
            }

            if (jsObject.columns != undefined) {
                jsObject.options.columns = jsObject.columns;
                delete jsObject.columns;
            }

            if (jsObject.pagination != undefined) {
                jsObject.options.pagination = jsObject.pagination;
                delete jsObject.pagination;
            }

            if (jsObject.headerVisible != undefined) {
                jsObject.options.headerVisible = jsObject.headerVisible;
                delete jsObject.headerVisible;
            }
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

        widgetEvents: (() => {
            const widgetEvents: WidgetEvents = {};

            Object.keys(TABULATOR_EVENTS).forEach((eezEvent, i) => {
                widgetEvents[eezEvent] = {
                    code: i + 1,
                    paramExpressionType: "json"
                };
            });
            return widgetEvents;
        })()
    });

    options: TabulatorOptions;

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
