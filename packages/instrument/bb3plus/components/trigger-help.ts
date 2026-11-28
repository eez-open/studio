// The help of the scope trigger: a dialog (a Bootstrap modal, it follows the
// Studio theme) with what the trigger does and illustrations of the edge and
// the level, the pre-trigger, the modes and the next trigger.

import { h, showModal } from "instrument/bb3plus/components/dom";
import {
    TRACE_COLOR,
    curve,
    text,
    frame,
    svg
} from "instrument/bb3plus/components/help-svg";

// the level line across a frame with the tag "T" at its right end
function levelLine(x0: number, x1: number, y: number, color: string) {
    return (
        `<line x1="${x0}" y1="${y}" x2="${x1}" y2="${y}" stroke="${color}" stroke-width="1.5"/>` +
        `<rect x="${x1 - 15}" y="${y - 7}" width="14" height="14" fill="${color}"/>` +
        text(x1 - 8, y + 4, "T", "middle", 'fill="#000" font-weight="bold" font-size="10"')
    );
}

// A sine crossing the level rising at the trigger point, the window of the
// span around it: before and after the trigger, the time labels from it.
function windowIllustration(trigger: string) {
    const level = 70;
    const triggerX = 320;
    // 90 - 50 sin(...) = level at the trigger point, rising
    const phase = (Math.asin((90 - level) / 50) / (2 * Math.PI)) * 160;
    const f = (x: number) =>
        90 - 50 * Math.sin((2 * Math.PI * (x - triggerX + phase)) / 160);
    return svg(
        640,
        215,
        frame(40, 20, 600, 160) +
            `<path d="${curve(40, 600, f)}" fill="none" stroke="${TRACE_COLOR}" stroke-width="2"/>` +
            levelLine(40, 600, level, trigger) +
            `<line x1="${triggerX}" y1="20" x2="${triggerX}" y2="160" stroke="${trigger}" stroke-opacity="0.7"/>` +
            `<circle cx="${triggerX}" cy="${level}" r="4.5" fill="${trigger}"/>` +
            text(triggerX + 8, 36, "the trigger: rising through the level", "start") +
            text(40, 176, "−5 ms", "start") +
            text(triggerX, 176, "0", "middle") +
            text(600, 176, "+5 ms", "end") +
            // the parts of the window
            `<path d="M40 186v8M40 190H${triggerX - 4}M${triggerX - 4} 186v8" stroke="currentColor" fill="none"/>` +
            `<path d="M${triggerX + 4} 186v8M${triggerX + 4} 190H600M600 186v8" stroke="currentColor" fill="none"/>` +
            text((40 + triggerX) / 2, 208, "before the trigger (pre-trigger 50 %)") +
            text((triggerX + 600) / 2, 208, "after the trigger")
    );
}

// The samples of a rising and of a falling ramp through the level, the
// crossing between the two samples around it.
function edgeIllustration(trigger: string) {
    const level = 75;
    const ys = [118, 108, 95, 82, 66, 52, 40, 33, 30];
    const panel = (x0: number, rising: boolean, caption: string) => {
        const points = ys.map((y, i) => ({
            x: x0 + 20 + i * 30,
            y: rising ? y : ys[ys.length - 1 - i]
        }));
        let crossing = 0;
        for (let i = 1; i < points.length; i++) {
            const a = points[i - 1];
            const b = points[i];
            if ((a.y - level) * (b.y - level) <= 0 && a.y != level) {
                crossing = a.x + ((a.y - level) / (a.y - b.y)) * (b.x - a.x);
                break;
            }
        }
        return (
            frame(x0, 20, x0 + 280, 130) +
            levelLine(x0, x0 + 280, level, trigger) +
            `<path d="${points.map((p, i) => `${i ? "L" : "M"}${p.x} ${p.y}`).join("")}" fill="none" stroke="${TRACE_COLOR}" stroke-opacity="0.5"/>` +
            points
                .map(p => `<circle cx="${p.x}" cy="${p.y}" r="3" fill="${TRACE_COLOR}"/>`)
                .join("") +
            `<line x1="${crossing}" y1="20" x2="${crossing}" y2="130" stroke="${trigger}" stroke-opacity="0.7" stroke-dasharray="4 3"/>` +
            `<circle cx="${crossing}" cy="${level}" r="5.5" fill="none" stroke="${trigger}" stroke-width="2"/>` +
            text(x0 + 140, 150, caption) +
            text(x0 + 140, 166, "the trigger between the two samples", "middle", 'fill-opacity="0.7"')
        );
    };
    return svg(
        640,
        175,
        panel(30, true, "Rising: from below the level to it or above") +
            panel(330, false, "Falling: from above the level to it or below")
    );
}

// where the trigger is in the window for 0, 50 and 100 % pre-trigger
function preTriggerIllustration(trigger: string) {
    const parts = [
        { position: 0, caption: "0 %: only after the trigger" },
        { position: 0.5, caption: "50 %: half before, half after" },
        { position: 1, caption: "100 %: only before the trigger" }
    ];
    return svg(
        640,
        95,
        parts
            .map((part, i) => {
                const x0 = 20 + i * 210;
                const x = x0 + 1 + part.position * 178;
                return (
                    frame(x0, 15, x0 + 180, 60) +
                    `<line x1="${x}" y1="15" x2="${x}" y2="60" stroke="${trigger}" stroke-width="2"/>` +
                    `<circle cx="${x}" cy="37.5" r="4" fill="${trigger}"/>` +
                    text(x0 + 90, 80, part.caption)
                );
            })
            .join("")
    );
}

// What each mode shows over time, with three triggers and then none.
function modesIllustration(trigger: string) {
    const left = 100;
    const right = 620;
    const triggers = [180, 280, 340];
    const autoBack = 470;
    const bar = (
        y: number,
        x0: number,
        x1: number,
        label: string,
        captured: boolean
    ) =>
        `<rect x="${x0 + 1}" y="${y}" width="${x1 - x0 - 2}" height="22" rx="3" ` +
        (captured
            ? `fill="${trigger}" fill-opacity="0.35"/>`
            : `fill="currentColor" fill-opacity="0.12"/>`) +
        text((x0 + x1) / 2, y + 15, label);
    const rows = [
        { name: "Off", bars: [[left, right, "the samples scroll as they come", false]] },
        {
            name: "Auto",
            bars: [
                [left, 180, "scrolling", false],
                [180, 280, "window 1", true],
                [280, 340, "2", true],
                [340, autoBack, "window 3", true],
                [autoBack, right, "scrolling again", false]
            ]
        },
        {
            name: "Normal",
            bars: [
                [left, 180, "scrolling", false],
                [180, 280, "window 1", true],
                [280, 340, "2", true],
                [340, right, "window 3 stays until the next trigger", true]
            ]
        },
        {
            name: "Single",
            bars: [
                [left, 180, "scrolling", false],
                [180, right, "window 1, the scope stops", true]
            ]
        }
    ] as { name: string; bars: [number, number, string, boolean][] }[];
    let content =
        text(10, 34, "Triggers", "start", 'font-weight="bold"') +
        `<line x1="${left}" y1="40" x2="${right}" y2="40" stroke="currentColor" stroke-opacity="0.4"/>` +
        text(right, 58, "time →", "end", 'fill-opacity="0.7"');
    const rowY = (i: number) => 72 + i * 48;
    for (const x of triggers) {
        content +=
            `<path d="M${x} 28l-6 10h12z" fill="${trigger}"/>` +
            `<line x1="${x}" y1="42" x2="${x}" y2="${rowY(rows.length - 1) + 30}" stroke="${trigger}" stroke-opacity="0.5" stroke-dasharray="3 3"/>`;
    }
    rows.forEach((row, i) => {
        const y = rowY(i);
        content += text(10, y + 15, row.name, "start", 'font-weight="bold"');
        for (const [x0, x1, label, captured] of row.bars) {
            content += bar(y, x0, x1, label, captured);
        }
    });
    // Auto: back to scrolling after the timeout
    const autoY = rowY(1);
    content +=
        `<path d="M340 ${autoY - 5}h${autoBack - 340}M340 ${autoY - 8}v6M${autoBack} ${autoY - 8}v6" stroke="currentColor" fill="none" stroke-opacity="0.7"/>` +
        text((340 + autoBack) / 2, autoY - 10, "no trigger for 2 × span (at least 0.5 s)", "middle", 'font-size="11" fill-opacity="0.8"');
    return svg(640, rowY(rows.length - 1) + 38, content);
}

// The search goes on after the end of the window shown: the crossings in it
// are skipped.
function nextTriggerIllustration(trigger: string) {
    const level = 70;
    const period = 70;
    const first = 120;
    const phase = (Math.asin((80 - level) / 45) / (2 * Math.PI)) * period;
    const f = (x: number) =>
        80 - 45 * Math.sin((2 * Math.PI * (x - first + phase)) / period);
    // windows of 200 px, pre-trigger 25 %
    const windows = [first, first + 3 * period];
    let content = "";
    windows.forEach((t, i) => {
        const x0 = t - 50;
        const x1 = t + 150;
        content +=
            `<rect x="${x0}" y="20" width="${x1 - x0}" height="120" fill="${trigger}" fill-opacity="${i ? 0.12 : 0.22}" stroke="${trigger}" stroke-opacity="0.6"/>` +
            text((x0 + x1) / 2, 34, `window ${i + 1}`);
    });
    content +=
        frame(30, 20, 610, 140) +
        `<path d="${curve(30, 610, f)}" fill="none" stroke="${TRACE_COLOR}" stroke-width="2"/>` +
        levelLine(30, 610, level, trigger);
    // the rising crossings up to the end of window 2 (the one after it would
    // be the next trigger)
    for (let x = first; x < windows[1] + 150; x += period) {
        const isTrigger = windows.includes(x);
        content += isTrigger
            ? `<circle cx="${x}" cy="${level}" r="5" fill="${trigger}"/>`
            : `<circle cx="${x}" cy="${level}" r="4.5" fill="none" stroke="currentColor" stroke-opacity="0.6" stroke-width="1.5"/>`;
    }
    content +=
        text(first + period * 1.5, 160, "skipped: in window 1", "middle", 'fill-opacity="0.7"') +
        text(windows[1], 178, "the next trigger: after window 1", "middle") +
        text(windows[1] + period * 1.5, 160, "skipped: in window 2", "middle", 'fill-opacity="0.7"');
    return svg(640, 185, content);
}

// the status next to Run / Stop
const STATUSES: [string, string][] = [
    ["Running", "the trigger is off, the samples scroll as they come"],
    ["Armed", "waiting for a trigger"],
    ["Triggered", "a trigger was found, its window is (being) shown"],
    ["Auto", "Auto: no trigger for a while, the samples scroll"],
    ["Stopped", "the scope is stopped, the last window stays (if there was a trigger)"],
    ["No source", "there is no trace to trigger on"]
];

// shows the help, triggerColor is the color of the trigger in the plot (it
// differs between the themes)
export function showTriggerHelp(triggerColor: string) {
    const body = h("div", { className: "modal-body" });
    // an illustration (the SVG markup made here)
    const html = (markup: string) => {
        const div = h("div");
        div.innerHTML = markup;
        return div;
    };
    // a title and its parts, a string is an illustration
    const section = (title: string, ...parts: (string | HTMLElement)[]) => {
        body.append(h("h6", { style: { marginTop: "16px" } }, title));
        for (const part of parts) {
            body.append(typeof part == "string" ? html(part) : part);
        }
    };
    const p = (content: string) =>
        h("p", { style: { marginBottom: "6px" } }, content);

    body.append(
        p(
            "The trigger makes a repeating signal stand still. Studio looks in the samples it receives for the moment the source trace crosses the trigger level in the chosen direction (the edge), and shows the window of the span around that moment. The trigger is at time 0: the time axis and the cursor values count from it."
        ),
        html(windowIllustration(triggerColor)),
        p(
            "Span 10 ms, pre-trigger 50 %: the window shows the 5 ms before the trigger and the 5 ms after it."
        )
    );

    section(
        "Edge and level",
        p(
            "The time of the trigger is between the two samples around the level (linear), so the trigger point doesn't jump by a whole sample. Missing samples (a gap) are never an edge."
        ),
        edgeIllustration(triggerColor),
        p(
            "Drag the line with the tag T in the plot to change the level (Esc while dragging puts it back), or type it in. For a digital input (DIN) choose the pin instead of the level: rising is 0 → 1, falling is 1 → 0."
        )
    );

    section(
        "Pre-trigger",
        p("The part of the window before the trigger."),
        preTriggerIllustration(triggerColor),
        p(
            "Type it in Pre in the toolbar or drag the trigger point line (the handle at the top of the plot; dashed while waiting for a trigger). A window shown moves around its trigger at once: it keeps a whole span before the trigger, after it only the samples of its window."
        )
    );

    const modes = h(
        "ul",
        { style: { marginBottom: "6px" } },
        h("li", null, h("b", null, "Off"), ": no trigger, the samples scroll as they come."),
        h(
            "li",
            null,
            h("b", null, "Auto"),
            ": as Normal, but without a trigger for twice the span (at least 0.5 s) the samples scroll again, so a signal without edges is still seen."
        ),
        h("li", null, h("b", null, "Normal"), ": each trigger shows its window, it stays until the next trigger."),
        h(
            "li",
            null,
            h("b", null, "Single"),
            ": the first trigger shows its window and stops the scope. Run arms the trigger again."
        )
    );
    section(
        "Modes",
        modes,
        modesIllustration(triggerColor),
        p("Before the first trigger the samples scroll (the status is Armed). Choosing a mode runs the scope.")
    );

    section(
        "The next trigger",
        p(
            "After a window is shown, the search goes on after its end: the edges inside the window shown are skipped, so each window has new samples."
        ),
        nextTriggerIllustration(triggerColor),
        p(
            "A window is shown when all the traces have their samples up to its end; a trace that stopped holds it back at most 2 s after the end."
        )
    );

    const table = h(
        "table",
        { className: "table table-sm", style: { width: "auto" } },
        h(
            "tbody",
            null,
            ...STATUSES.map(([status, meaning]) =>
                h("tr", null, h("td", null, h("b", null, status)), h("td", null, meaning))
            )
        )
    );
    section("Status", table);

    section(
        "Tips",
        h(
            "ul",
            null,
            h("li", null, "Zoom into a window: the trigger stays where it is in the window."),
            h("li", null, "After Single (or Stop) zoom and move in the window like in any stopped plot."),
            h("li", null, "Save to history saves the window shown as a DLOG chart."),
            h("li", null, "The source is one of the traces; a new source puts the level in the middle of its samples.")
        )
    );

    showModal("How the trigger works", body);
}
