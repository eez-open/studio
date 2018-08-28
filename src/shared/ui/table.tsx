import * as React from "react";
import { observable, computed, action } from "mobx";
import { observer } from "mobx-react";
import * as classNames from "classnames";

import { capitalize } from "shared/string";

////////////////////////////////////////////////////////////////////////////////

export interface IColumn {
    name: string;
    title: string;
    sortEnabled: boolean;
}

export interface IRow {
    id: string;
    selected: boolean;
    [key: string]: any;
    className: string;
    onClick: () => void;
    onDoubleClick: () => void;
}

////////////////////////////////////////////////////////////////////////////////

interface ITableProps {
    persistId: string;
    className?: string;
    columns: IColumn[];
    rows: IRow[];
    defaultSortColumn: string;
}

interface ISortOrderItem {
    columnName: string;
    asc: boolean;
}

@observer
export class Table extends React.Component<ITableProps> {
    constructor(props: ITableProps) {
        super(props);

        this.updateSortOrder(props);
    }

    componentWillReceiveProps(props: ITableProps) {
        this.updateSortOrder(props);
    }

    @action
    updateSortOrder(props: ITableProps) {
        let sortOrderJSON = localStorage.getItem(props.persistId + "/sort-order");
        let sortOrder: ISortOrderItem[];
        if (sortOrderJSON) {
            sortOrder = JSON.parse(sortOrderJSON);
        } else {
            sortOrder = props.columns
                .filter(column => column.sortEnabled && column.name !== props.defaultSortColumn)
                .map(column => ({
                    columnName: column.name,
                    asc: true
                }));

            sortOrder.unshift({
                columnName: props.defaultSortColumn,
                asc: true
            });
        }

        this.sortOrder = sortOrder;
    }

    @observable
    sortOrder: ISortOrderItem[];

    @computed
    get firstColumnUsedForSorting() {
        for (let i = 0; i < this.sortOrder.length; ++i) {
            const column = this.props.columns.find(
                column => column.name === this.sortOrder[i].columnName
            );
            if (column) {
                return column;
            }
        }

        return undefined;
    }

    @action
    onColumnClicked(column: IColumn) {
        if (!column.sortEnabled) {
            return;
        }

        for (let i = 0; i < this.sortOrder.length; ++i) {
            if (
                this.firstColumnUsedForSorting &&
                this.firstColumnUsedForSorting.name === column.name
            ) {
                this.sortOrder[i].asc = !this.sortOrder[i].asc;
                return;
            }

            if (this.sortOrder[i].columnName === column.name) {
                const sortColumn = this.sortOrder[i];
                this.sortOrder.splice(i, 1);
                this.sortOrder.unshift(sortColumn);
                return;
            }
        }
    }

    columnClassName(column: IColumn) {
        let className = "col" + capitalize(column.name);

        if (column.sortEnabled) {
            className += " sort-enabled";

            if (this.firstColumnUsedForSorting === column) {
                className += this.sortOrder[0].asc ? " sort-asc" : " sort-desc";
            }
        }

        return className;
    }

    @computed
    get rows() {
        return this.props.rows.sort((r1, r2) => {
            for (let i = 0; i < this.sortOrder.length; ++i) {
                const column = this.props.columns.find(
                    column => column.name === this.sortOrder[i].columnName
                );
                if (column) {
                    let value1 = r1[column.name];
                    let value2 = r2[column.name];

                    if (typeof value1 === "string") {
                        value1 = value1.toLocaleLowerCase();
                    }

                    if (typeof value2 === "string") {
                        value2 = value2.toLocaleLowerCase();
                    }

                    if (value1 < value2) {
                        return this.sortOrder[i].asc ? -1 : 1;
                    }

                    if (value1 > value2) {
                        return this.sortOrder[i].asc ? 1 : -1;
                    }
                }
            }
            return 0;
        });
    }

    render() {
        let className = classNames("EezStudio_Table table", this.props.className);

        return (
            <table className={className} tabIndex={-1}>
                <thead>
                    <tr>
                        {this.props.columns.map(column => (
                            <th
                                key={column.name}
                                className={this.columnClassName(column)}
                                onClick={() => this.onColumnClicked(column)}
                            >
                                {column.title}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {this.rows.map(row => (
                        <tr key={row.id} className={row.className}>
                            {this.props.columns.map(column => (
                                <td
                                    key={column.name}
                                    className={"col" + capitalize(column.name)}
                                    onClick={row.onClick}
                                    onDoubleClick={row.onDoubleClick}
                                >
                                    {column.name + "Component" in row
                                        ? row[column.name + "Component"]
                                        : row[column.name]}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        );
    }
}
