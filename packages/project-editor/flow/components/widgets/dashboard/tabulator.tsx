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
    getChildOfObject,
    propertyNotFoundMessage,
    propertyNotSetMessage
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
import { ProjectEditor } from "project-editor/project-editor-interface";

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
    printWidget?: (options: any) => void;
    getSheetData?: (lookup: string) => any;
    getInstrumentItemData?: () => {
        itemType: string;
        message: {
            options: any;
        };
    };
    download?: (
        downloadType: TabulatorModule.DownloadType,
        fileName: string,
        params?: TabulatorModule.DownloadOptions,
        filter?: TabulatorModule.RowRangeLookup
    ) => void;
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
                this.tabulator.options.printStyled ?? true,
                this.tabulator.options.printRowRange ?? "active",
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

                if (executionState) {
                    executionState.printWidget = (options: any) => {
                        ipcRenderer.send("printPDF", {
                            content: this.printHtml,
                            options
                        });
                    };
                    executionState.getSheetData = (lookup: string) => {
                        return this.tabulator.getSheetData(lookup);
                    };
                    executionState.getInstrumentItemData = () => {
                        return {
                            itemType: "instrument/tabulator",
                            message: {
                                options: this.options
                            }
                        };
                    };
                    executionState.download = (
                        downloadType: TabulatorModule.DownloadType,
                        fileName: string,
                        params: TabulatorModule.DownloadOptions,
                        filter: TabulatorModule.RowRangeLookup
                    ) => {
                        return this.tabulator.download(
                            downloadType,
                            fileName,
                            params,
                            filter
                        );
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

const HEADER_FILTERS = [
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

const HOZ_ALIGNS = ["left", "center", "right"] as const;

class TabulatorColumn extends EezObject {
    title: string;
    field: string;

    hozAlign: (typeof HOZ_ALIGNS)[number];
    headerHozAlign: (typeof HOZ_ALIGNS)[number];

    formatter: (typeof FORMATTERS)[number];
    formatterParams: string;

    editor: (typeof EDITORS)[number];
    editorParams: string;

    headerFilter: (typeof EDITORS)[number];
    headerFilterParams: string;

    advanced: string;

    static classInfo: ClassInfo = {
        listLabel: (object: TabulatorColumn, collapsed: boolean) =>
            collapsed ? object.field : "",
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
                name: "hozAlign",
                type: PropertyType.Enum,
                enumItems: HOZ_ALIGNS.slice()
                    .sort()
                    .map(id => ({
                        id
                    }))
            },
            {
                name: "headerHozAlign",
                type: PropertyType.Enum,
                enumItems: HOZ_ALIGNS.slice()
                    .sort()
                    .map(id => ({
                        id
                    }))
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
                name: "headerFilter",
                type: PropertyType.Enum,
                enumItems: HEADER_FILTERS.slice()
                    .sort()
                    .map(id => ({
                        id
                    }))
            },
            {
                name: "headerFilterParams",
                type: PropertyType.JSON
            },
            {
                name: "advanced",
                type: PropertyType.JSON
            }
        ],
        defaultValue: {
            formatter: "plaintext",
            editor: "plaintext",
            hozAlign: "left",
            headerHozAlign: "left"
        },
        check: (column: TabulatorColumn, messages: IMessage[]) => {
            if (column.formatterParams) {
                try {
                    JSON.parse(column.formatterParams);
                } catch (err) {
                    messages.push(
                        new Message(
                            MessageType.ERROR,
                            `Invalid JSON: ${err}`,
                            getChildOfObject(column, "formatterParams")
                        )
                    );
                }
            }

            if (column.editorParams) {
                try {
                    JSON.parse(column.editorParams);
                } catch (err) {
                    messages.push(
                        new Message(
                            MessageType.ERROR,
                            `Invalid JSON: ${err}`,
                            getChildOfObject(column, "editorParams")
                        )
                    );
                }
            }

            if (column.headerFilterParams) {
                try {
                    JSON.parse(column.headerFilterParams);
                } catch (err) {
                    messages.push(
                        new Message(
                            MessageType.ERROR,
                            `Invalid JSON: ${err}`,
                            getChildOfObject(column, "headerFilterParams")
                        )
                    );
                }
            }

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
            hozAlign: observable,
            headerHozAlign: observable,
            formatter: observable,
            formatterParams: observable,
            editor: observable,
            editorParams: observable,
            headerFilter: observable,
            headerFilterParams: observable,
            advanced: observable
        });
    }

    getColumnDefinition(): TabulatorModule.ColumnDefinition {
        const columnDefinition: TabulatorModule.ColumnDefinition = {
            title: this.title,
            field: this.field,
            hozAlign: this.hozAlign,
            headerHozAlign: this.headerHozAlign,
            formatter: this.formatter,
            editor: this.editor,
            headerFilter: this.headerFilter
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

        if (this.headerFilterParams) {
            try {
                const headerFilterParams = JSON.parse(this.headerFilterParams);
                columnDefinition.headerFilterParams = headerFilterParams;
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
    headerVisible: boolean;
    movableColumns: boolean;
    pagination: boolean;
    selectableRows: string;

    dataTree: boolean;
    dataTreeStartExpanded: boolean;

    autoColumns: boolean;
    syncColumns: boolean;
    syncStructure: string;
    columns: TabulatorColumn[];

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
                name: "headerVisible",
                type: PropertyType.Boolean,
                checkboxStyleSwitch: true
            },
            {
                name: "movableColumns",
                type: PropertyType.Boolean,
                checkboxStyleSwitch: true
            },
            {
                name: "pagination",
                type: PropertyType.Boolean,
                checkboxStyleSwitch: true
            },
            {
                name: "selectableRows",
                type: PropertyType.String
            },
            {
                name: "dataTree",
                type: PropertyType.Boolean,
                checkboxStyleSwitch: true
            },
            {
                name: "dataTreeStartExpanded",
                type: PropertyType.Boolean,
                checkboxStyleSwitch: true
            },
            {
                name: "autoColumns",
                type: PropertyType.Boolean,
                checkboxStyleSwitch: true
            },
            {
                name: "syncColumns",
                displayName: "Sync columns with structure",
                type: PropertyType.Boolean,
                checkboxStyleSwitch: true,
                disabled: (options: TabulatorOptions) => options.autoColumns
            },
            {
                name: "syncStructure",
                displayName: "Structure",
                type: PropertyType.ObjectReference,
                referencedObjectCollectionPath: "variables/structures",
                disabled: (options: TabulatorOptions) =>
                    options.autoColumns || !options.syncColumns
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
                    if (tabulatorOptions.syncColumns) {
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
                name: "copyOptionsButton",
                type: PropertyType.Any,
                computed: true,
                propertyGridRowComponent: CopyOptionsButton
            }
        ],
        defaultValue: {},
        check: (options: TabulatorOptions, messages: IMessage[]) => {
            try {
                options.getSelectableRows();
            } catch (err) {
                messages.push(
                    new Message(
                        MessageType.ERROR,
                        `"Selectable rows" should be either empty, true, false, number or highlight`,
                        getChildOfObject(options, "selectableRows")
                    )
                );
            }

            if (options.syncColumns) {
                if (options.syncStructure) {
                    const struct = getStructureFromType(
                        ProjectEditor.getProject(options),
                        `struct:${options.syncStructure}`
                    );
                    if (struct) {
                        options.columns.forEach(column => {
                            if (!struct.fieldsMap.get(column.field)) {
                                messages.push(
                                    new Message(
                                        MessageType.ERROR,
                                        `Field "${column.field}" not found in the structure "${options.syncStructure}"`,
                                        getChildOfObject(column, "field")
                                    )
                                );
                            }
                        });
                    } else {
                        messages.push(
                            propertyNotFoundMessage(options, "syncStructure")
                        );
                    }
                } else {
                    messages.push(
                        propertyNotSetMessage(options, "syncStructure")
                    );
                }
            }
        }
    };

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            layout: observable,
            headerVisible: observable,
            movableColumns: observable,
            pagination: observable,
            selectableRows: observable,

            dataTree: observable,
            dataTreeStartExpanded: observable,

            autoColumns: observable,
            syncColumns: observable,
            syncStructure: observable,
            columns: observable
        });
    }

    static getColumnsDefinition(columns: TabulatorColumn[]) {
        return columns.map(column => column.getColumnDefinition());
    }

    getSelectableRows() {
        if (!this.selectableRows) {
            return undefined;
        }

        if (this.selectableRows == "true") {
            return true;
        }

        if (this.selectableRows == "false") {
            return true;
        }

        if (this.selectableRows == "highlight") {
            return "highlight";
        }

        const value = parseInt(this.selectableRows);
        if (isNaN(value)) {
            throw "invalid number";
        }

        return value;
    }

    get tabulatorOptions() {
        const options: TabulatorModule.Options = {
            layout: this.layout,
            headerVisible: this.headerVisible,
            movableColumns: this.movableColumns,
            pagination: this.pagination,
            autoColumns: this.autoColumns,
            dataTree: this.dataTree,
            dataTreeStartExpanded: this.dataTreeStartExpanded
        };

        try {
            options.selectableRows = this.getSelectableRows();
        } catch (err) {}

        if (!this.autoColumns) {
            if (this.syncColumns) {
                const project = ProjectEditor.getProject(this);
                const struct = getStructureFromType(
                    project,
                    `struct:${this.syncStructure}`
                );
                if (struct) {
                    const columns = getColumnsFromStructure(
                        project._store,
                        struct
                    );

                    this.columns.forEach(column => {
                        const columnFromStructure = columns.find(
                            columnFromStructure =>
                                columnFromStructure.field == column.field
                        );

                        if (columnFromStructure) {
                            TabulatorColumn.classInfo.properties.forEach(
                                propertyInfo => {
                                    const propertyName =
                                        propertyInfo.name as keyof TabulatorColumn;

                                    if (column[propertyName]) {
                                        (columnFromStructure as any)[
                                            propertyName
                                        ] = column[propertyName];
                                    }
                                }
                            );
                        }
                    });

                    options.columns =
                        TabulatorOptions.getColumnsDefinition(columns);
                }
            } else {
                options.columns = TabulatorOptions.getColumnsDefinition(
                    this.columns
                );
            }
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
                propertyGridGroup: specificGroup
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
                movableColumns: true,
                pagination: false,
                selectableRows: "false",
                autoColumns: true,
                syncColumns: false,
                syncStructure: "",
                columns: [],
                dataTree: false,
                dataTreeStartExpanded: false
            }
        },

        beforeLoadHook: (object: TabulatorWidget, jsObject: any) => {
            if (jsObject.options == undefined) {
                jsObject.options = {
                    headerVisible: true,
                    movableColumns: true,
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
