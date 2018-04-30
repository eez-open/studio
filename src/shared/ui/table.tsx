import * as React from "react";
import * as classNames from "classnames";

interface IColumn {
    name: string;
    title: string;
    render?: (column: IColumn, row: IRow) => JSX.Element;
}

interface IRow {
    id: string;
    selected: boolean;
    [key: string]: any;
}

export class Table extends React.Component<
    {
        className?: string;
        columns: IColumn[];
        rows: IRow[];
    },
    {}
> {
    render() {
        let className = classNames("EezStudio_Table table", this.props.className);

        return (
            <table className={className} tabIndex={-1}>
                <thead>
                    <tr>{this.props.columns.map(column => <th>{column.title}</th>)}</tr>
                </thead>
                <tbody>
                    {this.props.rows.map(row => (
                        <tr>
                            {this.props.columns.map(column => (
                                <td>
                                    {column.render ? column.render(column, row) : row[column.name]}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        );
    }
}
