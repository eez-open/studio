import type { BB3PlusInstrument } from "instrument/bb3plus/BB3PlusInstrument";
import {
    LogRecord,
    LogFilter,
    LOG_LEVEL_NAMES,
    SEVERITIES,
    DEFAULT_LOG_FILTER,
    getLogRecordJson,
    getLogRecordSummary,
    getLogRecordTime,
    isLogFilterActive,
    matchesLogFilter
} from "instrument/bb3plus/log-model";
import { NUM_SLOTS } from "instrument/bb3plus/push-protocol";
import {
    h,
    setText,
    setVisible,
    setClass,
    createSelect,
    setSelectValue,
    BB3PlusView,
    PushStatus,
    ErrorText
} from "instrument/bb3plus/components/dom";

const ROW_HEIGHT = 22;

// how often the receive rates are measured (ms)
const RATE_INTERVAL = 1000;

function formatByteRate(bytesPerSecond: number) {
    if (bytesPerSecond >= 1e6) {
        return `${(bytesPerSecond / 1e6).toFixed(2)} MB/s`;
    }
    if (bytesPerSecond >= 1e3) {
        return `${(bytesPerSecond / 1e3).toFixed(1)} kB/s`;
    }
    return `${Math.round(bytesPerSecond)} B/s`;
}

// rows drawn above and below the visible ones
const OVERSCAN_ROWS = 5;

// The records that pass the filter. The ids of the records are consecutive
// in the array of the instrument (a new array after clear), so only the new
// records are filtered while the filter is the same (the same object, the
// instrument sets a new one on a change), and the oldest records that went
// are removed from the start.
class FilteredRecords {
    private all: LogRecord[] | undefined;
    private filter: LogFilter | undefined;
    private active = false;
    // the id of the newest record filtered
    private lastId = 0;
    records: LogRecord[] = [];

    update(all: LogRecord[], filter: LogFilter) {
        if (all !== this.all || filter !== this.filter) {
            this.all = all;
            this.filter = filter;
            this.active = isLogFilterActive(filter);
            this.lastId = 0;
            this.records = [];
        }

        if (!this.active) {
            this.records = all;
            return all;
        }

        if (all.length == 0) {
            return this.records;
        }

        // the oldest went
        const firstId = all[0].id;
        if (this.records.length > 0 && this.records[0].id < firstId) {
            let low = 0;
            let high = this.records.length;
            while (low < high) {
                const middle = (low + high) >> 1;
                if (this.records[middle].id < firstId) {
                    low = middle + 1;
                } else {
                    high = middle;
                }
            }
            this.records.splice(0, low);
        }

        const lowerText = filter.text.trim().toLowerCase();
        for (
            let i = Math.max(0, this.lastId + 1 - firstId);
            i < all.length;
            i++
        ) {
            if (matchesLogFilter(all[i], filter, lowerText)) {
                this.records.push(all[i]);
            }
        }
        this.lastId = all[all.length - 1].id;
        return this.records;
    }
}

function toggle(list: string[], value: string) {
    return list.indexOf(value) == -1
        ? [...list, value]
        : list.filter(item => item != value);
}

interface Row {
    element: HTMLDivElement;
    time: HTMLSpanElement;
    level: HTMLSpanElement;
    cat: HTMLSpanElement;
    slot: HTMLSpanElement;
    summary: HTMLSpanElement;
    // what is shown
    index: number;
    record: LogRecord | undefined;
}

export class DebugLogView extends BB3PlusView {
    private filtered = new FilteredRecords();
    // the records shown: the first recordCount of them, the array can be
    // the one of the instrument, records are added to it between the updates
    private records: LogRecord[] = [];
    private recordCount = 0;
    private selectedId = 0;
    private follow = true;

    // the update runs in the next frame, once for all the changes before it
    private updateFrame = 0;
    // what the controls show: the filter object and the level
    private shownFilter: LogFilter | undefined;
    private shownLogLevel = -1;
    // the categories shown: the set of the instrument and its size
    private shownCategories: Set<string> | undefined;
    private shownCategoriesSize = 0;
    // the height of the list, from the resize observer (reading it would
    // lay out the page)
    private listHeight = 0;
    // the scroll position the rows are drawn for
    private renderedScrollTop = -1;
    // the scroll position the view set, until its scroll event came: that
    // event isn't a scroll of the user
    private ownScrollTop = -1;

    private levelSelect: HTMLSelectElement;
    private followCheckbox: HTMLInputElement;
    private countText = h("span", { className: "text-muted" });
    private rateText = h("span", {
        className: "text-muted",
        title: "Log records and bytes received per second (push frames with their headers), before the filter"
    });
    private rateTime = 0;
    private rateRecords = 0;
    private rateBytes = 0;
    private droppedText = h("span", {
        className: "text-warning",
        title: "BB3+ dropped them because they were not read fast enough"
    });
    private pushStatus: PushStatus;
    private logError = new ErrorText();

    private maxLevelSelect: HTMLSelectElement;
    private slotSelect: HTMLSelectElement;
    private textInput: HTMLInputElement;
    private severityChips: HTMLSpanElement;
    private categoryChips = h("span", { className: "EezStudio_BB3Plus_Chips" });
    private resetButton: HTMLButtonElement;

    private list: HTMLDivElement;
    private spacer: HTMLDivElement;
    private rows: Row[] = [];
    private details = h("pre", { className: "EezStudio_BB3Plus_LogDetails" });
    private detailsId = -1;

    constructor(bb3PlusInstrument: BB3PlusInstrument) {
        super(bb3PlusInstrument);

        const setFilter = (changes: Partial<LogFilter>) =>
            bb3PlusInstrument.setLogFilter({
                ...bb3PlusInstrument.settings.logFilter,
                ...changes
            });

        // toolbar

        this.levelSelect = createSelect(
            LOG_LEVEL_NAMES.map((name, level) => ({
                value: level,
                label: name
            })),
            {
                style: { width: "160px" },
                title: "BB3+ sends the debug log records up to this level, independent of the level of its debug log file"
            },
            level => bb3PlusInstrument.setLogLevel(level)
        );

        this.followCheckbox = h("input", {
            type: "checkbox",
            className: "form-check-input me-1",
            checked: this.follow,
            onchange: () => {
                this.follow = this.followCheckbox.checked;
                if (this.follow) {
                    this.scrollToEnd();
                }
            }
        });

        this.pushStatus = new PushStatus(bb3PlusInstrument);

        const toolbar = h(
            "div",
            { className: "EezStudio_BB3Plus_Toolbar" },
            h("label", null, "Subscribe up to level"),
            this.levelSelect,
            h(
                "button",
                {
                    className: "btn btn-sm btn-secondary",
                    onclick: () => {
                        this.selectedId = 0;
                        bb3PlusInstrument.clearLog();
                    }
                },
                "Clear"
            ),
            h(
                "label",
                { className: "form-check-label" },
                this.followCheckbox,
                "Follow"
            ),
            this.countText,
            this.rateText,
            this.droppedText,
            this.pushStatus.element,
            this.logError.element
        );

        // filter bar

        this.maxLevelSelect = createSelect(
            LOG_LEVEL_NAMES.slice(1).map((name, i) => ({
                value: i + 1,
                label: name
            })),
            { style: { width: "150px" } },
            maxLevel => setFilter({ maxLevel })
        );

        this.slotSelect = createSelect(
            [
                { value: 0, label: "All slots" },
                { value: -1, label: "No slot" },
                ...Array.from({ length: NUM_SLOTS }, (_, i) => ({
                    value: i + 1,
                    label: `Slot ${i + 1}`
                }))
            ],
            { style: { width: "110px" } },
            slot => setFilter({ slot })
        );

        this.textInput = h("input", {
            type: "search",
            className: "form-control form-control-sm",
            style: { width: "220px" },
            placeholder: "Filter (text in the record)",
            value: bb3PlusInstrument.settings.logFilter.text,
            oninput: () => setFilter({ text: this.textInput.value })
        });

        this.severityChips = h(
            "span",
            { className: "EezStudio_BB3Plus_Chips" },
            ...SEVERITIES.map(sev =>
                h(
                    "button",
                    {
                        className: "btn btn-sm",
                        title: "Show or hide this severity",
                        "data-value": sev,
                        onclick: () =>
                            setFilter({
                                hiddenSeverities: toggle(
                                    bb3PlusInstrument.settings.logFilter
                                        .hiddenSeverities,
                                    sev
                                )
                            })
                    },
                    sev
                )
            )
        );

        this.resetButton = h(
            "button",
            {
                className: "btn btn-sm btn-outline-secondary",
                onclick: () =>
                    bb3PlusInstrument.setLogFilter({ ...DEFAULT_LOG_FILTER })
            },
            "Reset filter"
        );

        const filterBar = h(
            "div",
            { className: "EezStudio_BB3Plus_Toolbar" },
            h("label", null, "Show levels up to"),
            this.maxLevelSelect,
            this.slotSelect,
            this.textInput,
            this.severityChips,
            this.categoryChips,
            this.resetButton
        );

        // list

        this.spacer = h("div", { className: "EezStudio_BB3Plus_LogSpacer" });
        this.list = h(
            "div",
            {
                className: "EezStudio_BB3Plus_LogList",
                onscroll: () => this.onScroll(),
                onclick: (event: MouseEvent) => this.onClick(event)
            },
            this.spacer
        );

        this.element.append(toolbar, filterBar, this.list, this.details);

        const resizeObserver = new ResizeObserver(() => {
            this.listHeight = this.list.clientHeight;
            if (this.follow) {
                this.scrollToEnd();
            } else {
                this.renderRows();
            }
        });
        resizeObserver.observe(this.list);
        this.addDisposer(() => resizeObserver.disconnect());

        this.listen(["log"], () => this.requestUpdate());
        this.listen(["status"], () => this.updateStatus());
        this.addDisposer(() => cancelAnimationFrame(this.updateFrame));
        this.update();
        this.updateStatus();

        this.updateRate();
        const rateTimer = setInterval(() => this.updateRate(), RATE_INTERVAL);
        this.addDisposer(() => clearInterval(rateTimer));
    }

    // the records and bytes received per second since the last call
    private updateRate() {
        const { logRecordsReceived, logBytesReceived } = this.bb3PlusInstrument;
        const now = performance.now();
        if (this.rateTime) {
            const seconds = (now - this.rateTime) / 1000;
            const records = (logRecordsReceived - this.rateRecords) / seconds;
            const bytes = (logBytesReceived - this.rateBytes) / seconds;
            setText(
                this.rateText,
                `${Math.round(records)} records/s, ${formatByteRate(bytes)}`
            );
        } else {
            setText(this.rateText, "0 records/s, 0 B/s");
        }
        this.rateTime = now;
        this.rateRecords = logRecordsReceived;
        this.rateBytes = logBytesReceived;
    }

    mounted() {
        super.mounted();
        // the list has its size now
        this.listHeight = this.list.clientHeight;
        if (this.follow) {
            this.scrollToEnd();
        } else {
            this.renderRows();
        }
    }

    private updateStatus() {
        const bb3PlusInstrument = this.bb3PlusInstrument;
        this.pushStatus.update();
        this.logError.update(bb3PlusInstrument.logError);
        setText(
            this.droppedText,
            `${bb3PlusInstrument.droppedLogRecords} dropped`
        );
        setVisible(this.droppedText, bb3PlusInstrument.droppedLogRecords > 0);
    }

    private requestUpdate() {
        if (!this.updateFrame) {
            this.updateFrame = requestAnimationFrame(() => {
                this.updateFrame = 0;
                this.update();
            });
        }
    }

    private update() {
        const bb3PlusInstrument = this.bb3PlusInstrument;
        const { settings, logRecords } = bb3PlusInstrument;
        const filter = settings.logFilter;

        // controls, when the settings changed
        if (
            filter !== this.shownFilter ||
            settings.logLevel != this.shownLogLevel
        ) {
            this.shownFilter = filter;
            this.shownLogLevel = settings.logLevel;
            setSelectValue(this.levelSelect, settings.logLevel);
            setSelectValue(this.maxLevelSelect, filter.maxLevel);
            setSelectValue(this.slotSelect, filter.slot);
            if (this.textInput.value != filter.text) {
                this.textInput.value = filter.text;
            }
            for (const button of Array.from(this.severityChips.children)) {
                const hidden =
                    filter.hiddenSeverities.indexOf(
                        (button as HTMLElement).dataset.value!
                    ) != -1;
                setClass(button, "btn-secondary", !hidden);
                setClass(button, "btn-outline-secondary", hidden);
            }
            setVisible(this.resetButton, isLogFilterActive(filter));
            // the hidden categories
            this.shownCategories = undefined;
        }
        this.updateCategories(filter);

        // records; while not following, the record at the top stays there
        // when the oldest went
        const topRecord = this.follow ? undefined : this.getTopRecord();
        this.records = this.filtered.update(logRecords, filter);
        this.recordCount = this.records.length;
        setText(
            this.countText,
            this.recordCount == logRecords.length
                ? `${this.recordCount} records`
                : `${this.recordCount} of ${logRecords.length} records`
        );

        const height = this.recordCount * ROW_HEIGHT + "px";
        if (this.spacer.style.height != height) {
            this.spacer.style.height = height;
        }
        if (this.follow) {
            this.scrollToEnd();
        } else if (topRecord) {
            const index = this.findRecordIndex(topRecord.id);
            if (index != topRecord.index) {
                this.list.scrollTop += (index - topRecord.index) * ROW_HEIGHT;
                this.ownScrollTop = this.list.scrollTop;
            }
            this.renderRows();
        } else {
            this.renderRows();
        }
        this.updateDetails();
    }

    // the record in the top row and its index
    private getTopRecord() {
        let top: Row | undefined;
        const index = Math.floor(this.list.scrollTop / ROW_HEIGHT);
        for (const row of this.rows) {
            if (row.record && row.index == index) {
                top = row;
            }
        }
        return top ? { id: top.record!.id, index: top.index } : undefined;
    }

    // the index of the first record shown with this id or a newer one
    private findRecordIndex(id: number) {
        let low = 0;
        let high = this.recordCount;
        while (low < high) {
            const middle = (low + high) >> 1;
            if (this.records[middle].id < id) {
                low = middle + 1;
            } else {
                high = middle;
            }
        }
        return low;
    }

    // when a category came, the categories were cleared or the filter changed
    private updateCategories(filter: LogFilter) {
        const logCategories = this.bb3PlusInstrument.logCategories;
        if (
            logCategories === this.shownCategories &&
            logCategories.size == this.shownCategoriesSize
        ) {
            return;
        }
        this.shownCategories = logCategories;
        this.shownCategoriesSize = logCategories.size;

        const categories = Array.from(
            new Set([...Array.from(logCategories), ...filter.hiddenCategories])
        ).sort();
        this.categoryChips.replaceChildren(
            ...categories.map(cat => {
                const hidden = filter.hiddenCategories.indexOf(cat) != -1;
                return h(
                    "button",
                    {
                        className:
                            "btn btn-sm " +
                            (hidden
                                ? "btn-outline-secondary"
                                : "btn-secondary"),
                        title: "Show or hide this category",
                        onclick: () =>
                            this.bb3PlusInstrument.setLogFilter({
                                ...this.bb3PlusInstrument.settings.logFilter,
                                hiddenCategories: toggle(
                                    this.bb3PlusInstrument.settings.logFilter
                                        .hiddenCategories,
                                    cat
                                )
                            })
                    },
                    cat
                );
            })
        );
    }

    // and draws the rows; the end from the record count and the list height,
    // without reading the layout
    private scrollToEnd() {
        const top = Math.max(
            0,
            this.recordCount * ROW_HEIGHT - this.listHeight
        );
        // a scroll of the user whose event didn't come yet stays (the rows
        // are drawn for it then), when the end didn't move
        if (top != this.renderedScrollTop) {
            this.list.scrollTop = top;
            this.ownScrollTop = top;
        }
        this.renderRows(top);
    }

    private onScroll() {
        if (this.list.clientHeight == 0) {
            // hidden, the scroll position is 0 then
            return;
        }
        const scrollTop = this.list.scrollTop;
        const own = scrollTop == this.ownScrollTop;
        this.ownScrollTop = -1;
        if (own) {
            // the scrolling of the view, the rows are drawn
            return;
        }
        // following while at the end
        const atEnd =
            scrollTop + this.listHeight >= (this.recordCount - 1) * ROW_HEIGHT;
        if (atEnd != this.follow) {
            this.follow = atEnd;
            this.followCheckbox.checked = atEnd;
        }
        this.renderRows(scrollTop);
    }

    private onClick(event: MouseEvent) {
        const element = (event.target as HTMLElement).closest(
            ".EezStudio_BB3Plus_LogRow"
        ) as HTMLElement | null;
        if (!element) {
            return;
        }
        const index = parseInt(element.dataset.index!);
        const record =
            index < this.recordCount ? this.records[index] : undefined;
        if (record) {
            this.selectedId = record.id;
            for (const row of this.rows) {
                setClass(
                    row.element,
                    "selected",
                    row.record?.id == this.selectedId
                );
            }
            this.updateDetails();
        }
    }

    private createRow(): Row {
        const row: Row = {
            element: h("div", {
                className: "EezStudio_BB3Plus_LogRow",
                style: { display: "none" }
            }),
            time: h("span", { className: "time" }),
            level: h("span", { className: "level" }),
            cat: h("span", { className: "cat" }),
            slot: h("span", { className: "slot" }),
            summary: h("span", { className: "summary" }),
            index: -1,
            record: undefined
        };
        row.element.style.height = ROW_HEIGHT + "px";
        row.element.append(row.time, row.level, row.cat, row.slot, row.summary);
        this.spacer.appendChild(row.element);
        return row;
    }

    private hideRow(row: Row) {
        row.index = -1;
        row.record = undefined;
        setVisible(row.element, false);
    }

    // Only the visible rows are elements. The row of a record is the one of
    // its index modulo the number of rows: a record keeps its row while it is
    // visible, only the rows of the records that came into view change.
    private renderRows(scrollTop = this.list.scrollTop) {
        this.renderedScrollTop = scrollTop;
        const first = Math.max(
            0,
            Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN_ROWS
        );
        const last = Math.min(
            this.recordCount - 1,
            Math.ceil((scrollTop + this.listHeight) / ROW_HEIGHT) +
                OVERSCAN_ROWS
        );
        const count = Math.max(0, last - first + 1);

        if (this.rows.length < count) {
            // the rows of the indexes change
            for (const row of this.rows) {
                this.hideRow(row);
            }
            while (this.rows.length < count) {
                this.rows.push(this.createRow());
            }
        }

        // the rows that went out of view
        for (const row of this.rows) {
            if (row.index != -1 && (row.index < first || row.index > last)) {
                this.hideRow(row);
            }
        }

        const numRows = this.rows.length;
        for (let index = first; index <= last; index++) {
            const row = this.rows[index % numRows];
            const record = this.records[index];
            if (row.index != index) {
                if (row.index == -1) {
                    setVisible(row.element, true);
                }
                row.index = index;
                row.element.style.transform = `translateY(${
                    index * ROW_HEIGHT
                }px)`;
                row.element.dataset.index = String(index);
            }
            if (row.record !== record) {
                row.record = record;
                setText(row.time, getLogRecordTime(record));
                setText(row.level, String(record.level));
                setText(
                    row.cat,
                    record.type ? `${record.cat}/${record.type}` : record.cat
                );
                setText(row.slot, record.slot ? String(record.slot) : "");
                setText(row.summary, getLogRecordSummary(record));
                setClass(row.element, "error", record.sev == "error");
                setClass(row.element, "warning", record.sev == "warning");
                // a new selection sets the class of all rows (onClick)
                setClass(row.element, "selected", record.id == this.selectedId);
            }
        }
    }

    // the selected record, its JSON
    private updateDetails() {
        const all = this.bb3PlusInstrument.logRecords;
        let selected: LogRecord | undefined;
        if (this.selectedId && all.length > 0) {
            selected = all[this.selectedId - all[0].id];
            if (selected?.id != this.selectedId) {
                selected = undefined;
            }
        }
        const id = selected ? selected.id : 0;
        if (id != this.detailsId) {
            this.detailsId = id;
            let text = "";
            if (selected) {
                const json = getLogRecordJson(selected);
                text = json
                    ? JSON.stringify(json, undefined, 2)
                    : selected.line;
            }
            this.details.textContent = text;
            setVisible(this.details, !!selected);
        }
    }
}
