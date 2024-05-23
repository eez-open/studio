import { ipcRenderer } from "electron";
import React from "react";
import { makeObservable, observable, toJS } from "mobx";

import * as notification from "eez-studio-ui/notification";

import {
    registerClass,
    makeDerivedClassInfo,
    ProjectType,
    PropertyType
} from "project-editor/core/object";

import { Widget, makeExpressionProperty } from "project-editor/flow/component";
import { IFlowContext } from "project-editor/flow/flow-interfaces";
import { observer } from "mobx-react";

import classNames from "classnames";
import { TABULATOR_ICON } from "project-editor/ui-components/icons";
import { addCssStylesheet, addScript } from "eez-studio-shared/dom";
import { evalProperty } from "project-editor/flow/helper";
import { IDashboardComponentContext } from "eez-studio-types";
import { humanize } from "eez-studio-shared/string";
import { specificGroup } from "project-editor/ui-components/PropertyGrid/groups";

////////////////////////////////////////////////////////////////////////////////

let DataTables: any;

async function getDataTables() {
    if (!DataTables) {
        await addScript("../../libs/data-tables/2.0.7/dataTables.min.js");

        // await addScript("../../libs/data-tables/2.0.7/dataTables.buttons.js");
        // await addScript("../../libs/data-tables/2.0.7/buttons.dataTables.js");
        // await addScript("../../libs/data-tables/2.0.7/jszip.min.js");
        // await addScript("../../libs/data-tables/2.0.7/pdfmake.min.js");
        // await addScript("../../libs/data-tables/2.0.7/vfs_fonts.js");
        // await addScript("../../libs/data-tables/2.0.7/buttons.html5.min.js");

        await addCssStylesheet(
            "data-tables",
            "../../libs/data-tables/2.0.7/dataTables.dataTables.min.css"
        );

        // await addCssStylesheet(
        //     "data-tables-buttons",
        //     "../../libs/data-tables/2.0.7/buttons.dataTables.css"
        // );

        DataTables = (window as any).DataTable;

        ($.fn as any).dataTableExt.sErrMode = "throw";
    }
}

////////////////////////////////////////////////////////////////////////////////

class DataTablesExecutionState {
    printWidget?: () => void;
}

////////////////////////////////////////////////////////////////////////////////

const DataTablesElement = observer(
    class DataTablesElement extends React.Component<{
        widget: DataTablesWidget;
        flowContext: IFlowContext;
        width: number;
        height: number;
    }> {
        ref = React.createRef<HTMLDivElement>();

        constructor(props: any) {
            super(props);

            makeObservable(this, {});
        }

        get tableData() {
            const data = evalProperty(
                this.props.flowContext,
                this.props.widget,
                "data"
            );

            if (!data) {
                return [];
            }

            return toJS(data);
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

        get columnNames() {
            const tableData = this.tableData;

            return tableData && tableData.length > 0
                ? Object.keys(tableData[0])
                : [];
        }

        get columns() {
            return this.columnNames.map(columnName => ({
                title: humanize(columnName)
            }));
        }

        get data() {
            const tableData = this.tableData;
            const columnNames = this.columnNames;

            return tableData.map((row: any) =>
                columnNames.map(columnName => row[columnName])
            );
        }

        get configuration() {
            let configuration = this.tableConfiguration;

            if (!configuration) {
                // default configuration
                configuration = {
                    paging: true,
                    // autoFill: true,
                    // paging: false,
                    scrollCollapse: false,
                    scrollY: "375px"
                    // layout: {
                    //     topStart: {
                    //         buttons: [
                    //             "copyHtml5",
                    //             "excelHtml5",
                    //             "csvHtml5",
                    //             "pdfHtml5"
                    //         ]
                    //     }
                    // }
                };
            }

            return Object.assign(
                {},
                {
                    columns: this.columns,
                    data: this.data
                },
                configuration
            );
        }

        get printConfiguration() {
            return Object.assign({}, this.configuration, {
                paging: false
            });
        }

        get printHtml() {
            const printDiv = document.createElement("div");
            printDiv.classList.add("EezStudio_DataTables");

            const elTable = document.createElement("table");
            elTable.classList.add("stripe");
            elTable.setAttribute("width", "100%");

            try {
                new DataTables(elTable, this.printConfiguration);
            } catch (err) {
                console.log("Print failed", this.printConfiguration, err);
                notification.error("Print failed");
                return;
            }

            printDiv.appendChild(elTable);

            const div = document.createElement("div");
            div.appendChild(printDiv);
            return div.innerHTML;
        }

        async createDataTables(el: HTMLDivElement) {
            await getDataTables();

            const elTable = document.createElement("table");
            elTable.classList.add("stripe");
            elTable.classList.add("hover");
            elTable.setAttribute("width", "100%");

            el.innerHTML = "";
            el.appendChild(elTable);

            try {
                new DataTables(elTable, this.configuration);
            } catch (err) {
                el.innerHTML = "DataTables failure:" + err;
                console.error("DataTables error:", this.configuration, err);
            }

            const flowState = this.props.flowContext.flowState;
            if (flowState) {
                let executionState =
                    flowState.getComponentExecutionState<DataTablesExecutionState>(
                        this.props.widget
                    );

                if (executionState && !executionState.printWidget) {
                    executionState.printWidget = () => {
                        ipcRenderer.send("printPDF", this.printHtml);
                    };
                }
            }
        }

        componentDidMount() {
            if (this.ref.current) {
                this.createDataTables(this.ref.current);
            }
        }

        componentDidUpdate() {
            if (this.ref.current) {
                this.createDataTables(this.ref.current);
            }
        }

        componentWillUnmount(): void {}

        render() {
            const { flowContext } = this.props;

            this.configuration;

            return (
                <div
                    ref={this.ref}
                    style={{
                        width: this.props.width,
                        height: this.props.height,
                        overflow: "hidden"
                    }}
                    className={classNames("EezStudio_DataTables", {
                        interactive: !!flowContext.projectStore.runtime
                    })}
                ></div>
            );
        }
    }
);

export class DataTablesWidget extends Widget {
    static classInfo = makeDerivedClassInfo(Widget.classInfo, {
        enabledInComponentPalette: (projectType: ProjectType) =>
            projectType === ProjectType.DASHBOARD,

        componentPaletteGroupName: "!1Visualiser",

        properties: [
            makeExpressionProperty(
                {
                    name: "configuration",
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
                context.getComponentExecutionState<DataTablesExecutionState>();
            if (!executionState) {
                context.setComponentExecutionState(
                    new DataTablesExecutionState()
                );
            }
        }
    });

    configuration: string;

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            configuration: observable
        });
    }

    override render(
        flowContext: IFlowContext,
        width: number,
        height: number
    ): React.ReactNode {
        return (
            <>
                <DataTablesElement
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

registerClass("DataTablesWidget", DataTablesWidget);
