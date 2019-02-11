import React from "react";
import { observer } from "mobx-react";
import classNames from "classnames";

import Paper from "@material-ui/core/Paper";
import TablePagination from "@material-ui/core/TablePagination";

import { _mapValues, _range } from "eez-studio-shared/algorithm";
import { Rect } from "eez-studio-shared/geometry";

import styled from "eez-studio-ui/styled-components";

import { IDataContext } from "eez-studio-page-editor/page-context";

////////////////////////////////////////////////////////////////////////////////

export interface ITableData {
    page: number;
    rowsPerPage: number;
    rows: any[];
    total: number;
    changeRowsPerPage(rowsPerPage: number): void;
    changePage(page: number): void;
}

interface ITableProps {
    rect: Rect;
    dataContext: IDataContext;
    columns: IColumn[];
    data: any[] | ITableData;
    headerHeight: number;
    rowHeight: number;
    footerHeight: number;
    onRowClick: ((dataContext: IDataContext) => void) | undefined;
    maxRows?: number;
}

interface IColumn {
    relativeWidth: number;
    renderHeaderCell(rect: Rect, dataContext: IDataContext): React.ReactNode;
    renderBodyCell(rect: Rect, dataContext: IDataContext): React.ReactNode;
}

interface IRow {}

////////////////////////////////////////////////////////////////////////////////

const HeaderCell = observer(
    ({ column, rect, dataContext }: { column: IColumn; rect: Rect; dataContext: IDataContext }) => {
        return (
            <th
                style={{
                    position: "relative",
                    width: rect.width,
                    height: rect!.height,
                    overflow: "hidden"
                }}
            >
                {column.renderHeaderCell(rect, dataContext)}
            </th>
        );
    }
);

////////////////////////////////////////////////////////////////////////////////

const BodyCell = observer(
    ({ column, rect, dataContext }: { column: IColumn; rect: Rect; dataContext: IDataContext }) => {
        return (
            <td
                style={{
                    position: "relative",
                    width: rect.width,
                    height: rect!.height,
                    overflow: "hidden"
                }}
            >
                {column.renderBodyCell(rect, dataContext)}
            </td>
        );
    }
);

////////////////////////////////////////////////////////////////////////////////

const TableHeader = observer(
    ({
        rect,
        dataContext,
        columns,
        sumOfAllColumnRelativeWidths,
        headerHeight
    }: {
        rect: Rect;
        dataContext: IDataContext;
        columns: IColumn[];
        sumOfAllColumnRelativeWidths: number;
        headerHeight: number;
    }) => {
        let left = 0;
        const top = 0;

        const cells = columns.map((column, i) => {
            let width;
            if (i < columns.length - 1) {
                width = Math.floor(
                    (rect.width * column.relativeWidth) / sumOfAllColumnRelativeWidths
                );
            } else {
                width = rect.width - left;
            }
            let cellRect: Rect = {
                left,
                top,
                width,
                height: headerHeight
            };
            left += width;

            return <HeaderCell key={i} column={column} rect={cellRect} dataContext={dataContext} />;
        });

        return (
            <table style={{ width: rect.width, tableLayout: "fixed" }}>
                <thead>
                    <tr>{cells}</tr>
                </thead>
            </table>
        );
    }
);

////////////////////////////////////////////////////////////////////////////////

const TableBody = observer(
    ({
        rect,
        dataContext,
        columns,
        rows,
        sumOfAllColumnRelativeWidths,
        rowHeight,
        onRowClick
    }: {
        rect: Rect;
        dataContext: IDataContext;
        columns: IColumn[];
        rows: IRow[];
        sumOfAllColumnRelativeWidths: number;
        rowHeight: number;
        onRowClick: ((dataContext: IDataContext) => void) | undefined;
    }) => {
        // calculate cell rects
        let left = 0;
        const top = 0;
        const cellRects = columns.map((column, i) => {
            let width;
            if (i < columns.length - 1) {
                width = Math.floor(
                    (rect.width * column.relativeWidth) / sumOfAllColumnRelativeWidths
                );
            } else {
                width = rect.width - left;
            }
            let cellRect: Rect = {
                left,
                top,
                width,
                height: rowHeight
            };
            left += width;
            return cellRect;
        });

        const tableClassName = classNames({
            clickable: !!onRowClick
        });

        return (
            <table className={tableClassName} style={{ width: rect.width, tableLayout: "fixed" }}>
                <tbody>
                    {rows &&
                        rows.map((row: any, i: number) => {
                            const rowDataContext = dataContext.push(row);
                            return (
                                <tr
                                    key={row._id || i}
                                    onClick={
                                        onRowClick
                                            ? event => {
                                                  event.preventDefault();
                                                  event.stopPropagation();
                                                  onRowClick(rowDataContext);
                                              }
                                            : undefined
                                    }
                                >
                                    {columns.map((column, i) => (
                                        <BodyCell
                                            key={i}
                                            column={column}
                                            rect={cellRects[i]}
                                            dataContext={rowDataContext}
                                        />
                                    ))}
                                </tr>
                            );
                        })}
                </tbody>
            </table>
        );
    }
);

////////////////////////////////////////////////////////////////////////////////

const TableContainer: any = styled(Paper)`
    & > div {
        &:nth-child(1) {
            border-bottom: 1px solid rgba(192, 192, 192, 0.8);
        }

        &:nth-child(3) {
            min-height: 0;
            overflow: hidden;
            border-top: 1px solid rgba(192, 192, 192, 0.8);
        }

        & > table {
            td,
            th {
                box-sizing: border-box;
                padding: 2px 4px;
            }

            td:last-child,
            th:last-child {
            }

            thead > tr {
                background-color: rgba(210, 210, 210, 0.8);
            }

            tbody > tr {
                border-bottom: 1px solid rgba(220, 220, 220, 0.8);
            }

            tbody > tr:last-child {
                border-bottom: none;
            }

            tbody > tr:nth-child(odd) {
                background-color: rgba(235, 235, 235, 0.8);
            }
        }

        & > table.clickable > tbody > tr {
            cursor: pointer;
        }
    }
`;

export const Table = observer(
    ({
        rect,
        dataContext,
        columns,
        data,
        headerHeight,
        rowHeight,
        footerHeight,
        onRowClick,
        maxRows
    }: ITableProps) => {
        const sumOfAllColumnRelativeWidths = columns.reduce(
            (sum, column) => (sum += column.relativeWidth),
            0
        );

        const headerRect = {
            left: 0,
            top: 0,
            width: rect.width,
            height: headerHeight
        };

        const bodyRect = {
            left: 0,
            top: 0,
            width: rect.width,
            height: rect.height - headerHeight - footerHeight
        };

        let rows;
        let pagination;

        if (Array.isArray(data)) {
            rows = data;
        } else {
            rows = data.rows;
            pagination = (
                <TablePagination
                    rowsPerPageOptions={[5, 10, 25, 50, 100, 250, 500, 1000]}
                    component="div"
                    count={data.total}
                    rowsPerPage={data.rowsPerPage}
                    page={data.page}
                    backIconButtonProps={{
                        "aria-label": "Previous Page"
                    }}
                    nextIconButtonProps={{
                        "aria-label": "Next Page"
                    }}
                    onChangePage={(event, page) => {
                        data.changePage(page);
                    }}
                    onChangeRowsPerPage={event => {
                        data.changeRowsPerPage(parseInt(event.target.value));
                    }}
                />
            );
        }

        if (maxRows != undefined) {
            rows = rows.slice(0, maxRows);
        }

        return (
            <TableContainer>
                <div
                    style={{
                        height: headerRect.height,
                        overflow: "hidden"
                    }}
                >
                    <TableHeader
                        rect={headerRect}
                        dataContext={dataContext}
                        columns={columns}
                        sumOfAllColumnRelativeWidths={sumOfAllColumnRelativeWidths}
                        headerHeight={headerHeight}
                    />
                </div>
                <div
                    style={{
                        height: bodyRect.height,
                        overflowX: "hidden",
                        overflowY: "auto"
                    }}
                >
                    <TableBody
                        rect={bodyRect}
                        dataContext={dataContext}
                        columns={columns}
                        rows={rows}
                        sumOfAllColumnRelativeWidths={sumOfAllColumnRelativeWidths}
                        rowHeight={rowHeight}
                        onRowClick={onRowClick}
                    />
                </div>
                <div
                    style={{
                        height: footerHeight
                    }}
                >
                    {pagination}
                </div>
            </TableContainer>
        );
    }
);
