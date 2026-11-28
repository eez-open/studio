// The help of the scope measurements: a dialog (a Bootstrap modal, it
// follows the Studio theme) with what is measured, illustrations of the
// levels of a pulse, of the top and the base, of the time measurements and
// of the edges between the samples, the tables of the measurements, tips.

import { h, showModal } from "instrument/bb3plus/components/dom";
import {
    TRACE_COLOR,
    ACCENT_COLOR,
    curve,
    text,
    frame,
    dashedLine,
    dimension,
    verticalDimension,
    svg
} from "instrument/bb3plus/components/help-svg";

// A pulse with an overshoot after its rising edge and an undershoot after
// its falling edge: the levels max, top, base and min, the peak to peak, the
// amplitude, the overshoot and the undershoot (shaded).
function valuesIllustration() {
    const maxY = 46;
    const topY = 70;
    const baseY = 150;
    const minY = 170;
    const left = 40;
    const right = 480;
    // a ramp to the peak, then down to the level (exponential)
    const f = (x: number) => {
        const edge = (
            start: number,
            from: number,
            peak: number,
            level: number
        ) =>
            x < start + 12
                ? from + ((peak - from) * (x - start)) / 12
                : level + (peak - level) * Math.exp(-(x - start - 12) / 9);
        if (x < 110) return baseY;
        if (x < 280) return edge(110, baseY, maxY, topY);
        if (x < 390) return edge(280, topY, minY, baseY);
        return edge(390, baseY, maxY, topY);
    };
    // the overshoot and the undershoot: between the trace and the level
    const shade = (x0: number, x1: number, level: number) =>
        `<path d="M${x0} ${level}${curve(x0, x1, f, 1).replace(/^M/, "L")}L${x1} ${level}Z" fill="${ACCENT_COLOR}" fill-opacity="0.35"/>`;
    const level = (y: number, label: string, labelY = y + 4) =>
        dashedLine(left, right, y) + text(right + 6, labelY, label, "start");
    // where the ramps cross the level after which they are shaded
    const crossing = (
        start: number,
        from: number,
        peak: number,
        level: number
    ) => start + (12 * (level - from)) / (peak - from);
    return svg(
        680,
        205,
        frame(left, 20, right, 190) +
            shade(crossing(110, baseY, maxY, topY), 170, topY) +
            shade(crossing(390, baseY, maxY, topY), 450, topY) +
            shade(crossing(280, topY, minY, baseY), 340, baseY) +
            level(maxY, "Max", maxY + 1) +
            level(topY, "Top", topY + 7) +
            level(baseY, "Base", baseY - 1) +
            level(minY, "Min", minY + 6) +
            `<path d="${curve(left, right, f, 1)}" fill="none" stroke="${TRACE_COLOR}" stroke-width="2"/>` +
            text(
                132,
                maxY - 6,
                "overshoot",
                "start",
                `fill="${ACCENT_COLOR}"`
            ) +
            text(
                306,
                minY + 15,
                "undershoot",
                "start",
                `fill="${ACCENT_COLOR}"`
            ) +
            verticalDimension(545, maxY, minY, "Pk-Pk") +
            verticalDimension(605, topY, baseY, "Amplitude")
    );
}

// a pulse with noise and a sine, each with the histogram of its values
// (the bars right of it): the top and the base at the fullest bins of the
// upper and the lower half, the sine at its peaks
function levelsIllustration() {
    const noise = (x: number) =>
        2.5 * Math.sin(x * 1.7) + 2 * Math.sin(x * 3.1 + 1) + Math.sin(x * 7.3);
    const pulse = (x: number) => {
        const p = (x - 30) % 100;
        const level =
            p < 8
                ? 140 - (90 * p) / 8
                : p < 50
                  ? 50
                  : p < 58
                    ? 50 + (90 * (p - 50)) / 8
                    : 140;
        return level + noise(x);
    };
    const sine = (x: number) =>
        95 - 45 * Math.sin(((x - 450) / 70) * 2 * Math.PI);

    // the histogram of f from x0 to x1 in bins of 5 px from y 25 to 165, bars
    // from barX at most 60 px long; the fullest bin of each half marked
    const histogram = (
        f: (x: number) => number,
        x0: number,
        x1: number,
        barX: number
    ) => {
        const binHeight = 5;
        const bins = new Array(28).fill(0);
        for (let x = x0; x <= x1; x += 0.25) {
            const bin = Math.floor((f(x) - 25) / binHeight);
            if (bin >= 0 && bin < bins.length) {
                bins[bin]++;
            }
        }
        const most = Math.max(...bins);
        // the upper half of the values is the upper half of the plot
        const fullest = (from: number, to: number) => {
            let best = from;
            for (let i = from; i < to; i++) {
                if (bins[i] > bins[best]) best = i;
            }
            return best;
        };
        const marked = [fullest(0, 14), fullest(14, 28)];
        return {
            bars: bins
                .map((count, i) =>
                    count == 0
                        ? ""
                        : `<rect x="${barX}" y="${25 + i * binHeight + 0.5}" width="${Math.max(1.5, (60 * count) / most)}" height="${binHeight - 1}" ` +
                          (marked.includes(i)
                              ? `fill="${ACCENT_COLOR}"/>`
                              : `fill="currentColor" fill-opacity="0.35"/>`)
                )
                .join(""),
            levels: marked.map(i => 25 + (i + 0.5) * binHeight)
        };
    };

    const pulseHistogram = histogram(pulse, 30, 330, 338);
    const sineHistogram = histogram(sine, 450, 590, 598);
    const [pulseTop, pulseBase] = pulseHistogram.levels;
    return svg(
        680,
        212,
        frame(30, 20, 330, 170) +
            dashedLine(30, 400, pulseTop, ACCENT_COLOR, 0.9) +
            dashedLine(30, 400, pulseBase, ACCENT_COLOR, 0.9) +
            `<path d="${curve(30, 330, pulse, 1)}" fill="none" stroke="${TRACE_COLOR}" stroke-width="1.5"/>` +
            pulseHistogram.bars +
            text(404, pulseTop + 4, "Top", "start", `fill="${ACCENT_COLOR}"`) +
            text(
                404,
                pulseBase + 4,
                "Base",
                "start",
                `fill="${ACCENT_COLOR}"`
            ) +
            text(
                215,
                190,
                "a pulse with noise: Top and Base are its flat levels"
            ) +
            frame(450, 20, 590, 170) +
            `<path d="${curve(450, 590, sine, 1)}" fill="none" stroke="${TRACE_COLOR}" stroke-width="1.5"/>` +
            sineHistogram.bars +
            text(560, 190, "a sine: the most values at its peaks,") +
            text(560, 205, "Top = Max, Base = Min")
    );
}

// a pulse with slow edges, the levels 10, 50 and 90 % of the amplitude, the
// crossings, the rise and the fall time, the widths and the period
function timeIllustration() {
    const left = 50;
    const right = 630;
    const topY = 40;
    const baseY = 130;
    const levelY = (part: number) => baseY - part * (baseY - topY);
    const ramp = 60;
    const rises = [100, 460];
    const fall = 300;
    const f = (x: number) => {
        if (x < rises[0]) return baseY;
        if (x < rises[0] + ramp)
            return baseY - ((baseY - topY) * (x - rises[0])) / ramp;
        if (x < fall) return topY;
        if (x < fall + ramp) return topY + ((baseY - topY) * (x - fall)) / ramp;
        if (x < rises[1]) return baseY;
        if (x < rises[1] + ramp)
            return baseY - ((baseY - topY) * (x - rises[1])) / ramp;
        return topY;
    };
    // where an edge crosses the level (part of the amplitude)
    const rising = (start: number, part: number) => start + part * ramp;
    const falling = (part: number) => fall + (1 - part) * ramp;
    const crossings: [number, number][] = [
        [rising(rises[0], 0.1), 0.1],
        [rising(rises[0], 0.5), 0.5],
        [rising(rises[0], 0.9), 0.9],
        [falling(0.9), 0.9],
        [falling(0.5), 0.5],
        [falling(0.1), 0.1],
        [rising(rises[1], 0.5), 0.5]
    ];
    // a thin line from a crossing down to the dimension line at y
    const guide = (x: number, part: number, y: number) =>
        `<line x1="${x}" y1="${levelY(part)}" x2="${x}" y2="${y + 4}" stroke="currentColor" stroke-opacity="0.35"/>`;
    const middle1 = rising(rises[0], 0.5);
    const middle2 = falling(0.5);
    const middle3 = rising(rises[1], 0.5);
    return svg(
        680,
        268,
        frame(left, 20, right, 150) +
            [0.1, 0.5, 0.9]
                .map(
                    part =>
                        dashedLine(left, right, levelY(part)) +
                        text(
                            left - 6,
                            levelY(part) + 4,
                            `${part * 100} %`,
                            "end"
                        )
                )
                .join("") +
            text(right + 6, topY + 4, "Top", "start") +
            text(right + 6, baseY + 4, "Base", "start") +
            `<path d="${curve(left, right, f, 1)}" fill="none" stroke="${TRACE_COLOR}" stroke-width="2"/>` +
            crossings
                .map(
                    ([x, part]) =>
                        `<circle cx="${x}" cy="${levelY(part)}" r="3.5" fill="${ACCENT_COLOR}"/>`
                )
                .join("") +
            guide(rising(rises[0], 0.1), 0.1, 172) +
            guide(rising(rises[0], 0.9), 0.9, 172) +
            guide(falling(0.9), 0.9, 172) +
            guide(falling(0.1), 0.1, 172) +
            guide(middle1, 0.5, 244) +
            guide(middle2, 0.5, 208) +
            guide(middle3, 0.5, 244) +
            dimension(
                rising(rises[0], 0.1),
                rising(rises[0], 0.9),
                172,
                "Rise time",
                "left"
            ) +
            dimension(falling(0.9), falling(0.1), 172, "Fall time", "right") +
            dimension(middle1, middle2, 208, "+Width") +
            dimension(middle2, middle3, 208, "−Width") +
            dimension(middle1, middle3, 244, "Period")
    );
}

// the samples of a slow and of a fast edge, the crossings of 10 and 90 %
// between them, the rise time
function samplesIllustration() {
    const topY = 30;
    const baseY = 130;
    const low = baseY - 0.1 * (baseY - topY);
    const high = baseY - 0.9 * (baseY - topY);
    const spacing = 24;
    const panel = (x0: number, values: number[], caption: string) => {
        const points = values.map((y, i) => ({ x: x0 + 18 + i * spacing, y }));
        // the first crossing of the level going up (y going down)
        const cross = (level: number) => {
            for (let i = 1; i < points.length; i++) {
                const a = points[i - 1];
                const b = points[i];
                if (a.y > level && b.y <= level) {
                    return a.x + ((a.y - level) / (a.y - b.y)) * (b.x - a.x);
                }
            }
            return x0;
        };
        const x10 = cross(low);
        const x90 = cross(high);
        return (
            frame(x0, 20, x0 + 300, 140) +
            dashedLine(x0, x0 + 300, low) +
            dashedLine(x0, x0 + 300, high) +
            text(x0 + 296, low - 4, "10 %", "end", 'fill-opacity="0.7"') +
            text(x0 + 296, high + 13, "90 %", "end", 'fill-opacity="0.7"') +
            `<path d="${points.map((p, i) => `${i ? "L" : "M"}${p.x} ${p.y}`).join("")}" fill="none" stroke="${TRACE_COLOR}" stroke-opacity="0.5"/>` +
            points
                .map(
                    p =>
                        `<circle cx="${p.x}" cy="${p.y}" r="3" fill="${TRACE_COLOR}"/>`
                )
                .join("") +
            `<line x1="${x10}" y1="${low}" x2="${x10}" y2="152" stroke="${ACCENT_COLOR}" stroke-opacity="0.7" stroke-dasharray="3 2"/>` +
            `<line x1="${x90}" y1="${high}" x2="${x90}" y2="152" stroke="${ACCENT_COLOR}" stroke-opacity="0.7" stroke-dasharray="3 2"/>` +
            `<circle cx="${x10}" cy="${low}" r="4.5" fill="none" stroke="${ACCENT_COLOR}" stroke-width="2"/>` +
            `<circle cx="${x90}" cy="${high}" r="4.5" fill="none" stroke="${ACCENT_COLOR}" stroke-width="2"/>` +
            dimension(x10, x90, 152, "rise time") +
            text(x0 + 150, 190, caption)
        );
    };
    const slow = Array.from(
        { length: 12 },
        (_, i) => baseY - (baseY - topY) / (1 + Math.exp(-(i - 5.5) * 1.1))
    );
    const fast = Array.from({ length: 12 }, (_, i) => (i < 6 ? baseY : topY));
    return svg(
        680,
        200,
        panel(20, slow, "a slow edge: the crossings between the samples") +
            panel(360, fast, "faster than the samples: 0.8 × the sample period")
    );
}

const VALUES: [string, string][] = [
    ["Mean", "the average of the samples"],
    ["RMS", "the root mean square: √(the average of the squares)"],
    [
        "AC RMS",
        "the RMS of the samples minus the mean (the standard deviation): the ripple and the noise without the DC value"
    ],
    ["Max, Min", "the highest and the lowest sample"],
    ["Pk-Pk", "Max − Min"],
    [
        "Top, Base",
        "the levels a pulse stays at (see below); without flat levels Max and Min"
    ],
    ["Amplitude", "Top − Base"],
    ["Overshoot", "(Max − Top) / Amplitude, in %"],
    ["Undershoot", "(Base − Min) / Amplitude, in %"]
];

const TIMES: [string, string][] = [
    [
        "Period",
        "the average time from a rising edge to the next one, at 50 % (at least two rising edges)"
    ],
    ["Frequency", "1 / Period"],
    ["Rise time", "the average time of the rising edges from 10 % to 90 %"],
    ["Fall time", "the average time of the falling edges from 90 % to 10 %"],
    [
        "+Width",
        "the average time from a rising edge to the next falling edge, at 50 %"
    ],
    [
        "−Width",
        "the average time from a falling edge to the next rising edge, at 50 %"
    ],
    ["+Duty, −Duty", "+Width / Period, −Width / Period, in %"]
];

export function showMeasureHelp() {
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
    const p = (...content: (string | HTMLElement)[]) =>
        h("p", { style: { marginBottom: "6px" } }, ...content);
    const table = (rows: [string, string][]) =>
        h(
            "table",
            { className: "table table-sm", style: { marginBottom: "6px" } },
            h(
                "tbody",
                null,
                ...rows.map(([name, meaning]) =>
                    h(
                        "tr",
                        null,
                        h(
                            "td",
                            { style: { whiteSpace: "nowrap", width: "1%" } },
                            h("b", null, name)
                        ),
                        h("td", null, meaning)
                    )
                )
            )
        );

    body.append(
        p(
            "The measurements are made from the samples of the time window shown: the whole span, the part zoomed in to, or the window of the trigger shown. While the scope runs they are made again a few times a second (less often with very many samples), while it is stopped they stay. Each channel card shows the mean and the peak to peak of its channel, the measure bar the measurements chosen. A measurement that can't be made shows —, e.g. the period without two rising edges."
        ),
        p(
            "Choose them with ",
            h("b", null, "+ Measurement"),
            " in the measure bar or ",
            h("b", null, "Measurements"),
            " in the menu (⋯) of a channel card. To remove one, point at it in the measure bar and click its ×. They are kept with the channels of the instrument."
        )
    );

    section("Values", valuesIllustration(), table(VALUES));

    section(
        "Top and base",
        p(
            "Top and base are the levels a pulse stays at: the most common value of the upper and of the lower half of the samples (from a histogram of their values). The spikes of an overshoot and the noise don't move them, so the overshoot is measured from the flat top, not from the peak."
        ),
        levelsIllustration(),
        p(
            "A signal without flat levels (a sine, a triangle) has its most values at its peaks or none more common than the others: Top is then Max and Base is Min, its overshoot 0 %."
        )
    );

    section(
        "Time",
        p(
            "The edges go between 10 % and 90 % of the amplitude (from the base to the top): a rising edge from below 10 % to above 90 %, a falling edge back. The wiggles of the noise between those levels are not edges. The widths and the period are measured at 50 %."
        ),
        timeIllustration(),
        table(TIMES)
    );

    section(
        "Edges and samples",
        p(
            "Each crossing of a level is between the two samples around it (linear), so a time doesn't jump by whole samples. An edge faster than the samples (from below 10 % to above 90 % in one sample) shows as 0.8 × the sample period: raise the rate to measure fast edges (16 kSPS: 62.5 us per sample)."
        ),
        samplesIllustration()
    );

    section(
        "Tips",
        h(
            "ul",
            null,
            h(
                "li",
                null,
                "The times are the averages of all the edges in the window. To measure one edge, zoom in to it."
            ),
            h(
                "li",
                null,
                "Mean, RMS and AC RMS of a repeating signal are exact over whole periods; with many periods in the window the error is small."
            ),
            h(
                "li",
                null,
                "AC RMS on the voltage of a power supply output is its ripple and noise."
            ),
            h(
                "li",
                null,
                "At a rate lower than the module reads, BB3+ sends the averages of the readings: short peaks are lower, so Max and the overshoot are smaller. Raise the rate to see them."
            ),
            h(
                "li",
                null,
                "Missing samples (a gap) are skipped: no edge, width or period is measured across a gap."
            ),
            h("li", null, "A hidden channel is still measured.")
        )
    );

    showModal("How the measurements work", body);
}
