import {
    BB3PlusInstrument,
    FIELDS_INTERVALS
} from "instrument/bb3plus/BB3PlusInstrument";
import {
    SlotFields,
    FieldInfo,
    formatFieldValue,
    formatFieldNumber,
    getFieldTypeName,
    getFieldDirectionName,
    getMeasurementName,
    getUnitName,
    isFieldFloat,
    isFieldSettable,
    formatNumber,
    FIELD_FLAG_PERSISTENT,
    FIELD_FLAG_SAMPLED
} from "instrument/bb3plus/fields-model";
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

// a changed value is marked for this long (ms), fading out
const CHANGE_MARK_TIME = 1000;

function getSlotTitle(slot: number, slotFields: SlotFields) {
    if (slotFields.state == "empty" || slotFields.state == "not started") {
        return `Slot ${slot}: ${slotFields.state}`;
    }
    let title = `Slot ${slot}: ${slotFields.moduleBrand} ${slotFields.moduleName}`;
    if (slotFields.firmwareVersion) {
        title += `, firmware ${slotFields.firmwareVersion}`;
    }
    if (slotFields.serialNumber) {
        title += `, SN ${slotFields.serialNumber}`;
    }
    if (slotFields.state != "ok") {
        title += ` (${slotFields.state})`;
    }
    return title;
}

// the value as a SCPI parameter for DEBUg:MODule:FIELd
function getEditText(field: FieldInfo, value: Buffer | undefined) {
    const text = formatFieldNumber(field, value) ?? "";
    return text == "true" ? "1" : text == "false" ? "0" : text;
}

function getFlags(field: FieldInfo) {
    let flags = "";
    if (field.flags & FIELD_FLAG_PERSISTENT) {
        flags += "P";
    }
    if (field.flags & FIELD_FLAG_SAMPLED) {
        flags += "S";
    }
    return flags;
}

function getSampled(field: FieldInfo) {
    if (!(field.flags & FIELD_FLAG_SAMPLED)) {
        return "";
    }
    let sampled = `up to ${formatNumber(field.maxSampleRate)} SPS`;
    const measurement = getMeasurementName(field.measurement);
    if (measurement) {
        sampled = `${measurement} ch${field.channel + 1}, ${sampled}`;
    }
    return sampled;
}

interface FieldRow {
    field: FieldInfo;
    element: HTMLTableRowElement;
    valueCell: HTMLTableCellElement;
    // what is shown
    value: Buffer | undefined;
    changeTime: number;
    editing: boolean;
}

// the fields of a slot, made again for a new catalog
class SlotSection {
    element: HTMLElement;
    rows: FieldRow[] = [];
    private lastFilter: string | undefined;

    constructor(
        private view: FieldsView,
        public slot: number,
        public slotFields: SlotFields
    ) {
        const title = getSlotTitle(slot, slotFields);
        if (slotFields.fields.length == 0) {
            this.element = h(
                "div",
                { className: "EezStudio_BB3Plus_SlotTitle text-muted" },
                title
            );
            return;
        }

        const tbody = h("tbody");
        for (const field of slotFields.fields) {
            const valueCell = h("td", {
                className: "EezStudio_BB3Plus_FieldValue"
            });
            const row: FieldRow = {
                field,
                element: h(
                    "tr",
                    null,
                    h("td", null, field.name),
                    valueCell,
                    h(
                        "td",
                        { className: "text-muted" },
                        getFieldTypeName(field.type)
                    ),
                    h(
                        "td",
                        { className: "text-muted" },
                        getFieldDirectionName(field.direction)
                    ),
                    h("td", { className: "text-muted" }, getFlags(field)),
                    h("td", { className: "text-muted" }, getSampled(field))
                ),
                valueCell,
                value: undefined,
                changeTime: 0,
                editing: false
            };
            if (isFieldSettable(field)) {
                valueCell.addEventListener("dblclick", () =>
                    this.startEdit(row)
                );
            }
            this.rows.push(row);
            tbody.appendChild(row.element);
        }

        const details = h(
            "details",
            { open: view.isSlotOpen(slot) },
            h("summary", { className: "EezStudio_BB3Plus_SlotTitle" }, title),
            h(
                "table",
                { className: "table table-sm EezStudio_BB3Plus_FieldsTable" },
                h(
                    "thead",
                    null,
                    h(
                        "tr",
                        null,
                        h("th", null, "Field"),
                        h("th", null, "Value"),
                        h("th", null, "Type"),
                        h("th", null, "Dir"),
                        h(
                            "th",
                            {
                                title: "P: persistent (saved in the profiles), S: sampled (streamed)"
                            },
                            "Flags"
                        ),
                        h("th", null, "Sampled")
                    )
                ),
                tbody
            )
        );
        details.addEventListener("toggle", () =>
            view.setSlotOpen(slot, details.open)
        );
        this.element = details;
    }

    update(filter: string, settable: boolean, changedColor: string) {
        const now = performance.now();
        const { values, changeTimes } = this.slotFields;

        for (const row of this.rows) {
            const index = row.field.index;
            if (row.editing) {
                continue;
            }

            const value = values[index];
            if (value !== row.value || row.valueCell.firstChild == null) {
                row.value = value;
                setText(
                    row.valueCell,
                    formatFieldValue(row.field, value) || "-"
                );
            }

            const changeTime = changeTimes[index];
            if (changeTime != row.changeTime) {
                row.changeTime = changeTime;
                if (changeTime > 0 && now - changeTime < CHANGE_MARK_TIME) {
                    row.valueCell.animate(
                        [
                            { backgroundColor: changedColor },
                            { backgroundColor: "transparent" }
                        ],
                        { duration: CHANGE_MARK_TIME, easing: "ease-out" }
                    );
                }
            }

            const rowSettable = settable && isFieldSettable(row.field);
            if (row.valueCell.classList.contains("settable") != rowSettable) {
                setClass(row.valueCell, "settable", rowSettable);
                row.valueCell.title = rowSettable ? "Double click to set" : "";
            }
        }

        if (filter != this.lastFilter) {
            this.lastFilter = filter;
            let anyVisible = false;
            for (const row of this.rows) {
                const visible =
                    !filter ||
                    row.field.name.toLowerCase().indexOf(filter) != -1;
                setVisible(row.element, visible);
                anyVisible = anyVisible || visible;
            }
            const table = this.element.querySelector("table");
            if (table) {
                setVisible(table, anyVisible);
            }
        }
    }

    private startEdit(row: FieldRow) {
        const bb3PlusInstrument = this.view.bb3PlusInstrument;
        if (row.editing || !bb3PlusInstrument.isPushConnected) {
            return;
        }
        row.editing = true;

        const field = row.field;
        const input = h("input", {
            className: "form-control form-control-sm",
            value: getEditText(field, this.slotFields.values[field.index])
        });
        const unit = isFieldFloat(field) ? getUnitName(field.unit) : "";

        let done = false;
        const finish = (commit: boolean) => {
            if (done) {
                return;
            }
            done = true;
            const text = input.value.trim();
            row.editing = false;
            row.value = undefined;
            row.valueCell.replaceChildren();
            this.view.update();
            if (commit && text) {
                bb3PlusInstrument.setModuleField(this.slot, field, text);
            }
        };

        input.addEventListener("keydown", event => {
            if (event.key == "Enter") {
                finish(true);
            } else if (event.key == "Escape") {
                finish(false);
            }
        });
        input.addEventListener("blur", () => finish(false));

        row.valueCell.replaceChildren(input, unit ? h("span", null, unit) : "");
        input.focus();
        input.select();
    }
}

export class FieldsView extends BB3PlusView {
    private intervalSelect: HTMLSelectElement;
    private filterInput: HTMLInputElement;
    private pushStatus: PushStatus;
    private fieldsError = new ErrorText();
    private setFieldError = new ErrorText();
    private slotContainers: HTMLElement[] = [];
    private sections: (SlotSection | undefined)[] = [];
    private waiting: HTMLElement;
    // the slots the user closed
    private closedSlots = new Set<number>();

    constructor(bb3PlusInstrument: BB3PlusInstrument) {
        super(bb3PlusInstrument);

        const { settings } = bb3PlusInstrument;

        this.intervalSelect = createSelect(
            FIELDS_INTERVALS.map(interval => ({
                value: interval,
                label: `${interval} ms`
            })),
            {
                style: { width: "100px" },
                title: "BB3+ sends the values that changed at most this often"
            },
            interval => bb3PlusInstrument.setFieldsInterval(interval)
        );

        this.filterInput = h("input", {
            type: "search",
            className: "form-control form-control-sm",
            style: { width: "220px" },
            placeholder: "Filter (field name)",
            value: settings.fieldsFilter,
            oninput: () =>
                bb3PlusInstrument.setFieldsFilter(this.filterInput.value)
        });

        this.pushStatus = new PushStatus(bb3PlusInstrument);

        this.waiting = h(
            "div",
            { className: "text-muted" },
            "Waiting for the module fields..."
        );

        const body = h("div", {
            className: "EezStudio_BB3Plus_Body EezStudio_BB3Plus_Fields"
        });
        for (let i = 0; i < NUM_SLOTS; i++) {
            const container = h("div");
            this.slotContainers.push(container);
            this.sections.push(undefined);
            body.appendChild(container);
        }
        body.appendChild(this.waiting);

        this.element.append(
            h(
                "div",
                { className: "EezStudio_BB3Plus_Toolbar" },
                h("label", null, "Update every"),
                this.intervalSelect,
                this.filterInput,
                this.pushStatus.element,
                this.fieldsError.element,
                this.setFieldError.element
            ),
            body
        );

        this.listen(["fields", "status"], () => this.update());
        this.update();
    }

    isSlotOpen(slot: number) {
        return !this.closedSlots.has(slot);
    }

    setSlotOpen(slot: number, open: boolean) {
        if (open) {
            this.closedSlots.delete(slot);
        } else {
            this.closedSlots.add(slot);
        }
    }

    update() {
        const bb3PlusInstrument = this.bb3PlusInstrument;
        const { settings } = bb3PlusInstrument;

        setSelectValue(this.intervalSelect, settings.fieldsInterval);
        if (this.filterInput.value != settings.fieldsFilter) {
            this.filterInput.value = settings.fieldsFilter;
        }
        this.pushStatus.update();
        this.fieldsError.update(bb3PlusInstrument.fieldsError);
        this.setFieldError.update(bb3PlusInstrument.setFieldError);

        const filter = settings.fieldsFilter.trim().toLowerCase();
        const settable = bb3PlusInstrument.isPushConnected;
        const changedColor =
            getComputedStyle(this.element)
                .getPropertyValue("--bb3plus-changed")
                .trim() || "rgba(242, 191, 51, 0.6)";

        let anyKnown = false;
        bb3PlusInstrument.fields.slots.forEach((slotFields, i) => {
            let section = this.sections[i];
            if (section?.slotFields !== slotFields) {
                // a new catalog
                section = slotFields
                    ? new SlotSection(this, i + 1, slotFields)
                    : undefined;
                this.sections[i] = section;
                this.slotContainers[i].replaceChildren(
                    ...(section ? [section.element] : [])
                );
            }
            if (section) {
                anyKnown = true;
                section.update(filter, settable, changedColor);
            }
        });

        setVisible(
            this.waiting,
            !anyKnown && bb3PlusInstrument.isPushConnected
        );
    }
}
