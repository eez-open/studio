import React from "react";
import {
    observable,
    computed,
    runInAction,
    action,
    toJS,
    makeObservable
} from "mobx";
import { observer } from "mobx-react";
import classNames from "classnames";

import { objectClone } from "eez-studio-shared/util";
import { addAlphaToColor } from "eez-studio-shared/color";
import { _range } from "eez-studio-shared/algorithm";
import {
    IUnit,
    TIME_UNIT_NO_CUSTOM_FORMAT,
    VOLTAGE_UNIT,
    CURRENT_UNIT
} from "eez-studio-shared/units";
import { Point } from "eez-studio-shared/geometry";
import { validators } from "eez-studio-shared/validation";

import { theme } from "eez-studio-ui/theme";
import {
    VerticalHeaderWithBody,
    Body,
    ToolbarHeader,
    Header
} from "eez-studio-ui/header-with-body";
import { Splitter } from "eez-studio-ui/splitter";
import {
    ChartController,
    ChartMode,
    IAxisModel,
    LineController,
    IChartView,
    MouseHandler,
    IAxisController
} from "eez-studio-ui/chart/chart";
import { ChartsController, ChartsView } from "eez-studio-ui/chart/chart";
import { globalViewOptions } from "eez-studio-ui/chart/GlobalViewOptions";
import { Toolbar } from "eez-studio-ui/toolbar";
import {
    ButtonAction,
    DropdownButtonAction,
    DropdownItem
} from "eez-studio-ui/action";
import { showGenericDialog } from "eez-studio-ui/generic-dialog";

import type { IAppStore } from "instrument/window/history/history";

import {
    BaseList,
    BaseListData,
    ChartViewOptions,
    ListAxisModel
} from "instrument/window/lists/store-renderer";
import {
    displayOption,
    ChartsDisplayOption,
    CommonTools
} from "instrument/window/lists/common-tools";

////////////////////////////////////////////////////////////////////////////////

const TABLE_LIST_DATA_DEFAULTS: any = {
    dwell: [],
    voltage: [],
    current: []
};

export function createEmptyTableListData() {
    return objectClone(TABLE_LIST_DATA_DEFAULTS);
}

export class TableListData extends BaseListData {
    dwell: number[];
    voltage: number[];
    current: number[];

    constructor(list: BaseList, props: Partial<TableListData>) {
        super(list, props);

        makeObservable(this, {
            dwell: observable,
            voltage: observable,
            current: observable
        });

        this.dwell = props.dwell || TABLE_LIST_DATA_DEFAULTS.dwell;
        this.voltage = props.voltage || TABLE_LIST_DATA_DEFAULTS.voltage;
        this.current = props.current || TABLE_LIST_DATA_DEFAULTS.current;
    }

    toJS() {
        return Object.assign({}, super.toJS(), {
            dwell: toJS(this.dwell),
            voltage: toJS(this.voltage),
            current: toJS(this.current)
        });
    }

    applyChanges(changes: any) {
        super.applyChanges(changes);

        if ("dwell" in changes) {
            this.dwell = changes.dwell;
        }

        if ("voltage" in changes) {
            this.voltage = changes.voltage;
        }

        if ("current" in changes) {
            this.current = changes.current;
        }
    }
}

export class TableList extends BaseList {
    data: TableListData;

    constructor(props: any) {
        super(props);

        makeObservable(this, {
            data: observable,
            numPoints: computed
        });

        this.type = "table";
        this.data = new TableListData(this, props.data);
    }

    get numPoints() {
        if (this.data.dwell.length == 0) {
            return 0;
        }
        return Math.max(
            this.data.dwell.length,
            this.data.current.length,
            this.data.voltage.length
        );
    }

    getMaxTime() {
        let max = 0;
        const dwellData = this.data.dwell;
        for (let i = 0; i < this.numPoints; i++) {
            max +=
                i < dwellData.length
                    ? dwellData[i]
                    : dwellData[dwellData.length - 1];
        }
        return max;
    }

    getRange(model: ListAxisModel) {
        function getRangeFromNumberArray(arr: number[]) {
            if (arr.length == 0) {
                return {
                    from: model.minValue,
                    to: model.maxValue
                };
            }
            let min = model.maxValue;
            let max = model.minValue;

            for (let i = 0; i < arr.length; i++) {
                if (arr[i] < min) {
                    min = arr[i];
                }
                if (arr[i] > max) {
                    max = arr[i];
                }
            }

            return {
                from: min,
                to: max
            };
        }

        if (model.unit.name == "voltage") {
            return getRangeFromNumberArray(this.data.voltage);
        } else if (model.unit.name == "current") {
            return getRangeFromNumberArray(this.data.current);
        } else {
            return {
                from: 0,
                to: this.getMaxTime()
            };
        }
    }

    createChartsController(
        appStore: IAppStore,
        displayOption: ChartsDisplayOption,
        mode: ChartMode
    ): ChartsController {
        return createTableChartsController(appStore, this, displayOption, mode);
    }

    renderDetailsView(appStore: IAppStore): React.ReactNode {
        return <TableDetailsView appStore={appStore} list={this} />;
    }
}

////////////////////////////////////////////////////////////////////////////////

type CellKey = "dwell" | "voltage" | "current";

////////////////////////////////////////////////////////////////////////////////

const selectedCell = observable<{
    index: number;
    key: CellKey;
}>({
    index: 0,
    key: "dwell"
});

////////////////////////////////////////////////////////////////////////////////

export class TableLineController extends LineController {
    constructor(
        appStore: IAppStore,
        public id: string,
        yAxisController: IAxisController
    ) {
        super(id, yAxisController);

        makeObservable(this, {
            tableData: computed,
            dwells: computed,
            values: computed,
            size: computed,
            yMin: computed,
            yMax: computed
        });
    }

    get list() {
        return (this.yAxisController.chartsController as TableChartsController)
            .list;
    }

    get tableData() {
        return this.list.data;
    }

    get dwells(): number[] {
        return this.tableData.dwell;
    }

    get values(): number[] {
        return this.tableData[
            this.yAxisController.unit.name as "voltage" | "current"
        ];
    }

    get size(): number {
        return this.list.numPoints;
    }

    get yMin(): number {
        //return Math.min(...this.values);
        return this.yAxisController.axisModel.minValue;
    }

    get yMax(): number {
        //return Math.max(...this.values);
        return this.yAxisController.axisModel.maxValue;
    }

    getWaveformModel() {
        return null;
    }

    getNearestValuePoint(point: Point): Point {
        // TODO
        return { x: 0, y: 0 };
    }

    render(clipId: string) {
        return (
            <TableLineView
                key={this.id}
                tableLineController={this}
                clipId={clipId}
            />
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

export const TableLineView = observer(
    class TableLineView extends React.Component<
        {
            tableLineController: TableLineController;
            clipId: string;
        },
        {}
    > {
        render() {
            const tableLineController = this.props.tableLineController;
            const { dwells, values, size } = tableLineController;
            const yAxisController = tableLineController.yAxisController;
            const chartsController = yAxisController.chartsController;
            const xAxisController = chartsController.xAxisController;
            const { chartLeft, chartBottom } = chartsController;

            let path;

            for (let i = 0; i < size; i++) {
                if (i === 0) {
                    path = `M${chartLeft + xAxisController.valueToPx(0)} ${
                        chartBottom -
                        yAxisController.valueToPx(
                            (values.length > 0 && values[0]) || 0
                        )
                    }`;
                } else {
                    if (i < values.length) {
                        path +=
                            " v " +
                            -(values[i] - (values[i - 1] || 0)) *
                                yAxisController.scale;
                    }
                }
                path +=
                    " h " +
                    (i < dwells.length
                        ? dwells[i]
                        : dwells[dwells.length - 1] || 1) *
                        xAxisController.scale;
            }

            return (
                <path
                    d={path}
                    style={{ pointerEvents: "none" }}
                    stroke={yAxisController.axisModel.color}
                    clipPath={`url(#${this.props.clipId})`}
                    strokeWidth={1}
                    strokeOpacity={1}
                    fillOpacity={0}
                />
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

function executeCommand(
    appStore: IAppStore,
    list: TableList,
    modificator: (data: TableListData) => void
) {
    let oldData = objectClone(list.data);
    let newData = objectClone(list.data);

    runInAction(() => {
        modificator(newData);
    });

    appStore.undoManager!.addCommand(
        "Edit table list",
        appStore.instrumentListStore!,
        list,
        {
            execute: action(() => {
                list.data.applyChanges(newData);
            }),
            undo: action(() => {
                list.data.applyChanges(oldData);
            })
        }
    );
}

function cellKeyFromUnit(unit: IUnit): CellKey {
    if (unit === TIME_UNIT_NO_CUSTOM_FORMAT) {
        return "dwell";
    }
    return unit.name as "voltage" | "current";
}

////////////////////////////////////////////////////////////////////////////////

const TableChartsHeader = observer(
    class TableChartsHeader extends React.Component<{
        appStore: IAppStore;
        chartsController: ChartsController;
    }> {
        get list() {
            return (this.props.chartsController as TableChartsController).list;
        }

        editProperties = () => {
            showGenericDialog({
                dialogDefinition: {
                    fields: [
                        {
                            name: "name",
                            type: "string",
                            validators: [
                                validators.required,
                                validators.unique(
                                    this.list,
                                    this.props.appStore.instrumentLists!
                                )
                            ]
                        },
                        {
                            name: "description",
                            type: "string"
                        }
                    ]
                },

                values: {
                    name: this.list.name,
                    description: this.list.description
                }
            })
                .then(result => {
                    const list = this.list;

                    const oldName = list.name;
                    const oldDescription = list.description;

                    const newName = result.values.name;
                    const newDescription = result.values.description;

                    if (
                        oldName !== newName ||
                        oldDescription !== newDescription
                    ) {
                        this.props.appStore.undoManager!.addCommand(
                            "Edit envelope list",
                            this.props.appStore.instrumentListStore!,
                            list,
                            {
                                execute: action(() => {
                                    list.name = newName;
                                    list.description = newDescription;
                                }),
                                undo: action(() => {
                                    list.name = oldName;
                                    list.description = oldDescription;
                                })
                            }
                        );
                    }
                })
                .catch(() => {});
        };

        render() {
            return (
                <Header className="EezStudio_ListChartViewHeader">
                    <Toolbar>
                        <ButtonAction
                            text="Edit Properties"
                            className="btn-secondary"
                            title="Edit properties"
                            onClick={this.editProperties}
                        />
                        <CommonTools
                            chartsController={this.props.chartsController}
                        />
                    </Toolbar>
                </Header>
            );
        }
    }
);

interface CellProps {
    index: number;
    unit: IUnit;
    value: number | undefined;
    onChange: (index: number, unit: IUnit, value: string) => void;
    onFocus: () => void;
    setError(error: string | undefined): void;
}

const Cell = observer(
    class Cell extends React.Component<CellProps, {}> {
        value: string = Cell.getValue(this.props);

        constructor(props: CellProps) {
            super(props);

            makeObservable(this, {
                value: observable,
                componentDidUpdate: action
            });
        }

        static getValue(props: CellProps): string {
            if (props.value == undefined) {
                return "";
            }
            return props.unit.formatValue(props.value);
        }

        componentDidUpdate(prevProps: any) {
            if (this.props != prevProps) {
                this.value = Cell.getValue(this.props);
            }
        }

        onBlur = (e: React.FocusEvent<HTMLElement>) => {
            this.props.onChange(
                this.props.index,
                this.props.unit,
                (e.target as HTMLElement).innerText
            );
        };

        static focusNext(element: HTMLElement, offset: number) {
            element.blur();
            setTimeout(() => {
                let cells = $(element).parents("tbody").find("td");

                let nextCellIndex = cells.index(element) + offset;

                if (nextCellIndex < 0) {
                    nextCellIndex += cells.length;
                } else if (nextCellIndex >= cells.length) {
                    nextCellIndex -= cells.length;
                }

                if (!cells.eq(nextCellIndex).attr("contenteditable")) {
                    nextCellIndex += offset;

                    if (nextCellIndex < 0) {
                        nextCellIndex += cells.length;
                    } else if (nextCellIndex >= cells.length) {
                        nextCellIndex -= cells.length;
                    }
                }

                cells[nextCellIndex].focus();
            }, 0);
        }

        static getCaretPosition(editableDiv: Element) {
            var caretPos = 0,
                sel,
                range;
            sel = window.getSelection();
            if (sel != null && sel.rangeCount) {
                range = sel.getRangeAt(0);
                if (range.commonAncestorContainer.parentNode === editableDiv) {
                    caretPos = range.endOffset;
                }
            }
            return caretPos;
        }

        onKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
            if (e.key === "Enter") {
                e.preventDefault();
                e.stopPropagation();
                Cell.focusNext(e.target as HTMLElement, 1);
            } else if (e.key === "Escape") {
                e.currentTarget.innerText = Cell.getValue(this.props);
                this.props.setError(undefined);
            } else if (!e.shiftKey && !e.ctrlKey) {
                if (e.key === "ArrowUp") {
                    e.preventDefault();
                    e.stopPropagation();
                    Cell.focusNext(e.target as HTMLElement, -4);
                } else if (e.key === "ArrowDown") {
                    e.preventDefault();
                    e.stopPropagation();
                    Cell.focusNext(e.target as HTMLElement, 4);
                } else if (e.key === "ArrowLeft") {
                    if (
                        e.altKey ||
                        e.metaKey ||
                        Cell.getCaretPosition(e.target as Element) === 0
                    ) {
                        e.preventDefault();
                        e.stopPropagation();
                        Cell.focusNext(e.target as HTMLElement, -1);
                    }
                } else if (e.key === "ArrowRight") {
                    if (
                        e.altKey ||
                        e.metaKey ||
                        Cell.getCaretPosition(e.target as Element) ===
                            (e.target as HTMLElement).innerText.length
                    ) {
                        e.preventDefault();
                        e.stopPropagation();
                        Cell.focusNext(e.target as HTMLElement, 1);
                    }
                }
            }
        };

        render() {
            const { index, unit, onFocus } = this.props;
            const className = classNames(
                "EezStudio_CellTd",
                `EezStudio_TableListEditor_Cell_${index}_${cellKeyFromUnit(
                    unit
                )}`,
                {
                    selected:
                        index === selectedCell.index &&
                        cellKeyFromUnit(unit) === selectedCell.key
                }
            );
            return (
                <td
                    className={className}
                    contentEditable
                    suppressContentEditableWarning
                    onFocus={onFocus}
                    onBlur={this.onBlur}
                    onKeyDown={this.onKeyDown}
                >
                    {this.value}
                </td>
            );
        }
    }
);

export const Table = observer(
    class Table extends React.Component<
        {
            appStore: IAppStore;
            list: TableList;
            className?: string;
            onCellFocus: (index: number, key: CellKey) => void;
            setError(error: string | undefined): void;
        },
        {}
    > {
        error: string | undefined;

        constructor(props: {
            appStore: IAppStore;
            list: TableList;
            className?: string;
            onCellFocus: (index: number, key: CellKey) => void;
            setError(error: string | undefined): void;
        }) {
            super(props);

            makeObservable(this, {
                error: observable,
                data: computed,
                isMaxPointsReached: computed,
                numRows: computed,
                onValueChange: action.bound
            });
        }

        get data() {
            return this.props.list.data;
        }

        get isMaxPointsReached() {
            return (
                this.props.list.numPoints >=
                this.props.appStore.instrument.listsMaxPointsProperty
            );
        }

        get numRows() {
            return this.isMaxPointsReached
                ? this.props.list.numPoints
                : this.props.list.numPoints + 1;
        }

        getValue(index: number, key: CellKey) {
            const array = this.data[key];
            if (array && index < array.length) {
                return array[index];
            }
            return undefined;
        }

        onValueChange(index: number, unit: IUnit, value: string) {
            let key = cellKeyFromUnit(unit);
            let array = this.data[key];
            let currentValue =
                array && index < array.length ? array[index] : undefined;
            let numValue = unit.parseValue(value);
            if (numValue != currentValue) {
                if (typeof numValue !== "number") {
                    $(
                        `.EezStudio_TableListEditor_Cell_${index}_${key}`
                    ).focus();
                    this.props.setError("Invalid value");
                    return;
                }

                if (key === "voltage" || key === "current") {
                } else {
                    if (numValue <= 0) {
                        $(
                            `.EezStudio_TableListEditor_Cell_${index}_${key}`
                        ).focus();
                        this.props.setError("Invalid value");
                        return;
                    }
                }

                executeCommand(this.props.appStore, this.props.list, data => {
                    let array: any = data[key];
                    if (!array) {
                        array = [];
                        data[key] = array;
                    }

                    for (let i = index - 1; i >= 0 && isNaN(array[i]); i--) {
                        array[i] = numValue;
                    }

                    array[index] = numValue;

                    while (
                        array.length > 0 &&
                        !array[array.length - 1] &&
                        array[array.length - 1] !== 0
                    ) {
                        array.splice(array.length - 1, 1);
                    }
                });
            }

            this.props.setError(undefined);
            return true;
        }

        render() {
            return (
                <table className={this.props.className}>
                    <thead>
                        <tr>
                            <th />
                            <th>Dwell</th>
                            <th>Voltage</th>
                            <th>Current</th>
                        </tr>
                    </thead>
                    <tbody>
                        {_range(this.numRows).map(index => (
                            <tr key={index}>
                                <td>{index + 1}</td>
                                <Cell
                                    index={index}
                                    unit={TIME_UNIT_NO_CUSTOM_FORMAT}
                                    value={this.getValue(index, "dwell")}
                                    onChange={this.onValueChange}
                                    onFocus={() =>
                                        this.props.onCellFocus(index, "dwell")
                                    }
                                    setError={this.props.setError}
                                />
                                <Cell
                                    index={index}
                                    unit={VOLTAGE_UNIT}
                                    value={this.getValue(index, "voltage")}
                                    onChange={this.onValueChange}
                                    onFocus={() =>
                                        this.props.onCellFocus(index, "voltage")
                                    }
                                    setError={this.props.setError}
                                />
                                <Cell
                                    index={index}
                                    unit={CURRENT_UNIT}
                                    value={this.getValue(index, "current")}
                                    onChange={this.onValueChange}
                                    onFocus={() =>
                                        this.props.onCellFocus(index, "current")
                                    }
                                    setError={this.props.setError}
                                />
                            </tr>
                        ))}
                    </tbody>
                </table>
            );
        }
    }
);

export const TableDetailsView = observer(
    class TableDetailsView extends React.Component<{
        appStore: IAppStore;
        list: TableList;
    }> {
        list: TableList = this.props.list;

        constructor(props: { appStore: IAppStore; list: TableList }) {
            super(props);

            makeObservable(this, {
                list: observable,
                chartsController: computed,
                componentDidUpdate: action,
                onCellFocus: action.bound,
                isMaxPointsReached: computed,
                error: observable,
                setError: action.bound
            });
        }

        get chartsController() {
            return createTableChartsController(
                this.props.appStore,
                this.list,
                displayOption.get() as ChartsDisplayOption,
                "editable"
            );
        }

        componentDidUpdate(prevProps: any) {
            if (this.props != prevProps) {
                this.list = this.props.list;
            }
        }

        onCellFocus(index: number, key: CellKey) {
            selectedCell.index = index;
            selectedCell.key = key;
        }

        get isLastRow() {
            return selectedCell.index === this.props.list.numPoints;
        }

        get isMaxPointsReached() {
            return (
                this.props.list.numPoints >=
                this.props.appStore.instrument.listsMaxPointsProperty
            );
        }

        get canInsertRowAbove() {
            return !this.isMaxPointsReached && !this.isLastRow;
        }

        insertRowAbove = () => {
            if (this.canInsertRowAbove) {
                const index = selectedCell.index;
                const key = selectedCell.key;

                executeCommand(this.props.appStore, this.props.list, data => {
                    if (index < data.dwell.length) {
                        data.dwell.splice(index, 0, data.dwell[index]);
                    }
                    if (index < data.voltage.length) {
                        data.voltage.splice(index, 0, data.voltage[index]);
                    }
                    if (index < data.current.length) {
                        data.current.splice(index, 0, data.current[index]);
                    }
                });

                setTimeout(() => {
                    $(
                        `.EezStudio_TableListEditor_Cell_${index}_${key}`
                    ).focus();
                }, 10);
            }
        };

        get canInsertRowBelow() {
            return !this.isMaxPointsReached && !this.isLastRow;
        }

        insertRowBelow = () => {
            if (this.canInsertRowBelow) {
                const index = selectedCell.index;
                const key = selectedCell.key;

                executeCommand(this.props.appStore, this.props.list, data => {
                    if (index < data.dwell.length) {
                        data.dwell.splice(index + 1, 0, data.dwell[index]);
                    }
                    if (index < data.voltage.length) {
                        data.voltage.splice(index + 1, 0, data.voltage[index]);
                    }
                    if (index < data.current.length) {
                        data.current.splice(index + 1, 0, data.current[index]);
                    }
                });

                setTimeout(() => {
                    $(
                        `.EezStudio_TableListEditor_Cell_${index + 1}_${key}`
                    ).focus();
                }, 10);
            }
        };

        get canDeleteRow() {
            return !this.isLastRow;
        }

        deleteRow = () => {
            if (this.canDeleteRow) {
                const index = selectedCell.index;
                const key = selectedCell.key;

                executeCommand(this.props.appStore, this.props.list, data => {
                    if (index < data.dwell.length) {
                        data.dwell.splice(index, 1);
                    }
                    if (index < data.voltage.length) {
                        data.voltage.splice(index, 1);
                    }
                    if (index < data.current.length) {
                        data.current.splice(index, 1);
                    }
                });

                setTimeout(() => {
                    $(
                        `.EezStudio_TableListEditor_Cell_${index}_${key}`
                    ).focus();
                }, 10);
            }
        };

        get canClearColumn() {
            return (
                selectedCell.index <
                this.props.list.data[selectedCell.key].length
            );
        }

        clearColumn = () => {
            if (this.canClearColumn) {
                const index = selectedCell.index;
                const key = selectedCell.key;

                executeCommand(this.props.appStore, this.props.list, data => {
                    data[key].splice(index, data[key].length - index);
                });

                setTimeout(() => {
                    $(
                        `.EezStudio_TableListEditor_Cell_${index}_${key}`
                    ).focus();
                }, 10);
            }
        };

        get canDeleteAllFromCursor() {
            return !this.isLastRow;
        }

        deleteAllFromCursor = () => {
            if (this.canDeleteAllFromCursor) {
                const index = selectedCell.index;
                const key = selectedCell.key;

                executeCommand(this.props.appStore, this.props.list, data => {
                    data.dwell.splice(index, data.dwell.length - index);
                    data.voltage.splice(index, data.voltage.length - index);
                    data.current.splice(index, data.current.length - index);
                });

                setTimeout(() => {
                    $(
                        `.EezStudio_TableListEditor_Cell_${index}_${key}`
                    ).focus();
                }, 10);
            }
        };

        get canDeleteAll() {
            return this.props.list.numPoints > 0;
        }

        deleteAll = () => {
            if (this.canDeleteAll) {
                const key = selectedCell.key;

                executeCommand(this.props.appStore, this.props.list, data => {
                    data.dwell = [];
                    data.voltage = [];
                    data.current = [];
                });

                setTimeout(() => {
                    $(`.EezStudio_TableListEditor_Cell_0_${key}`).focus();
                }, 10);
            }
        };

        error: string | undefined;

        setError(error: string | undefined) {
            this.error = error;
        }

        render() {
            const { list } = this.props;

            return (
                <Splitter
                    type="vertical"
                    sizes="66%|34%"
                    persistId="instrument/lists/table"
                >
                    <VerticalHeaderWithBody>
                        <TableChartsHeader
                            appStore={this.props.appStore}
                            chartsController={this.chartsController}
                        />
                        <Body>
                            <ChartsView
                                chartsController={this.chartsController}
                                tabIndex={0}
                            />
                        </Body>
                    </VerticalHeaderWithBody>

                    <VerticalHeaderWithBody>
                        <ToolbarHeader className="EezStudio_TableListEditorToolbarHeader">
                            <DropdownButtonAction
                                text="Insert"
                                title="Insert rows"
                                className="btn-secondary"
                            >
                                <DropdownItem
                                    text="Insert row above"
                                    onClick={this.insertRowAbove}
                                    disabled={!this.canInsertRowAbove}
                                />
                                <DropdownItem
                                    text="Insert row below"
                                    onClick={this.insertRowBelow}
                                    disabled={!this.canInsertRowBelow}
                                />
                            </DropdownButtonAction>
                            <DropdownButtonAction
                                text="Delete"
                                title="Delete cells"
                                className="btn-secondary"
                            >
                                <DropdownItem
                                    text="Delete row"
                                    onClick={this.deleteRow}
                                    disabled={!this.canDeleteRow}
                                />
                                <DropdownItem
                                    text="Clear column from cursor down"
                                    onClick={this.clearColumn}
                                    disabled={!this.canClearColumn}
                                />
                                <DropdownItem
                                    text="Delete all from cursor down"
                                    onClick={this.deleteAllFromCursor}
                                    disabled={!this.canDeleteAllFromCursor}
                                />
                                <DropdownItem
                                    text="Delete all"
                                    onClick={this.deleteAll}
                                />
                            </DropdownButtonAction>
                            {this.isMaxPointsReached && (
                                <div className="text-success">
                                    Max no. of points reached.
                                </div>
                            )}
                            {<div className="text-danger">{this.error}</div>}
                        </ToolbarHeader>
                        <Body className="EezStudio_TableListEditorBody">
                            <Table
                                appStore={this.props.appStore}
                                className="EezStudio_TableListEditorTable"
                                list={list}
                                onCellFocus={this.onCellFocus}
                                setError={this.setError}
                            />
                        </Body>
                    </VerticalHeaderWithBody>
                </Splitter>
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

class TableChartsController extends ChartsController {
    constructor(
        appStore: IAppStore,
        public list: TableList,
        mode: ChartMode,
        xAxisModel: IAxisModel
    ) {
        super(mode, xAxisModel, new ChartViewOptions(appStore, list));
    }

    get chartViewOptionsProps() {
        return {
            showRenderAlgorithm: false,
            showShowSampledDataOption: false
        };
    }
}

////////////////////////////////////////////////////////////////////////////////

class TableChartController extends ChartController {
    constructor(
        chartsController: TableChartsController,
        displayOption: ChartsDisplayOption
    ) {
        super(chartsController, displayOption);
    }

    onDragStart(
        chartView: IChartView,
        event: PointerEvent
    ): MouseHandler | undefined {
        let point = this.chartView!.transformEventPoint(event);
        const pointTime = this.xAxisController.pxToValue(point.x);

        const list = (this.chartsController as TableChartsController).list;
        const data = list.data;
        if (data.dwell.length === 0) {
            return;
        }
        let time = 0;
        let lastDwell: number | undefined = data.dwell[0];
        for (let i = 0; i < list.numPoints; i++) {
            let dwell: number | undefined = data.dwell[i];
            if (isNaN(dwell)) {
                dwell = lastDwell;
            }
            if (dwell === undefined) {
                return;
            }
            lastDwell = dwell;
            if (pointTime >= time && pointTime < time + lastDwell) {
                runInAction(() => {
                    selectedCell.index = i;
                });
                setTimeout(() => {
                    $(
                        `.EezStudio_TableListEditor_Cell_${i}_${selectedCell.key}`
                    ).focus();
                }, 10);
                return;
            }
            time += lastDwell;
        }

        return undefined;
    }

    customRender() {
        const data = (this.chartsController as TableChartsController).list.data;
        if (data.dwell.length === 0) {
            return null;
        }

        let time = 0;
        let lastDwell: number | undefined = data.dwell[0];
        for (let i = 0; i <= selectedCell.index; i++) {
            let dwell: number;
            if (i < data.dwell.length) {
                dwell = data.dwell[i];
            } else {
                dwell = lastDwell;
            }
            if (isNaN(dwell)) {
                dwell = lastDwell;
            }
            if (dwell === undefined) {
                return null;
            }
            time += dwell;
            lastDwell = dwell;
        }

        if (lastDwell === undefined) {
            return null;
        }

        let x1 = this.xAxisController.valueToPx(time - lastDwell);
        if (x1 < 0) {
            x1 = 0;
        }
        let x2 = this.xAxisController.valueToPx(time);
        if (x2 > this.chartsController.chartWidth) {
            x2 = this.chartsController.chartWidth;
        }

        let x = this.chartsController.chartLeft + x1;
        let width = x2 - x1;

        if (width <= 0) {
            return null;
        }

        let y = this.chartsController.chartTop;
        let height = this.chartsController.chartHeight;

        const fill = addAlphaToColor(
            theme().selectionBackgroundColor,
            globalViewOptions.blackBackground ? 0.4 : 0.1
        );

        return <rect x={x} y={y} width={width} height={height} fill={fill} />;
    }
}

////////////////////////////////////////////////////////////////////////////////

export function createTableChartsController(
    appStore: IAppStore,
    list: TableList,
    displayOption: ChartsDisplayOption,
    mode: ChartMode
) {
    const chartsController = new TableChartsController(
        appStore,
        list,
        mode,
        new ListAxisModel(appStore, list, TIME_UNIT_NO_CUSTOM_FORMAT)
    );

    const charts: ChartController[] = [];

    if (displayOption === "both") {
        const chartController = new TableChartController(
            chartsController,
            displayOption
        );

        chartController.createYAxisController(
            new ListAxisModel(appStore, list, VOLTAGE_UNIT)
        );
        chartController.createYAxisControllerOnRightSide(
            new ListAxisModel(appStore, list, CURRENT_UNIT)
        );

        chartController.lineControllers.push(
            new TableLineController(
                appStore,
                "envelope-sample-data-" +
                    chartController.yAxisController.position,
                chartController.yAxisController
            )
        );
        chartController.lineControllers.push(
            new TableLineController(
                appStore,
                "envelope-sample-data-" +
                    chartController.yAxisControllerOnRightSide!.position,
                chartController.yAxisControllerOnRightSide!
            )
        );

        charts.push(chartController);
    } else {
        if (displayOption === "voltage" || displayOption === "split") {
            const chartController = new TableChartController(
                chartsController,
                "voltage"
            );
            chartController.createYAxisController(
                new ListAxisModel(appStore, list, VOLTAGE_UNIT)
            );
            chartController.lineControllers.push(
                new TableLineController(
                    appStore,
                    "envelope-sample-data-" +
                        chartController.yAxisController.position,
                    chartController.yAxisController
                )
            );
            charts.push(chartController);
        }

        if (displayOption === "current" || displayOption === "split") {
            const chartController = new TableChartController(
                chartsController,
                "current"
            );
            chartController.createYAxisController(
                new ListAxisModel(appStore, list, CURRENT_UNIT)
            );
            chartController.lineControllers.push(
                new TableLineController(
                    appStore,
                    "envelope-sample-data-" +
                        chartController.yAxisController.position,
                    chartController.yAxisController
                )
            );
            charts.push(chartController);
        }
    }

    chartsController.chartControllers = charts;

    return chartsController;
}
