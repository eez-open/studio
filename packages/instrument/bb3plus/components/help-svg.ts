// The parts of the illustrations of the help dialogs (trigger-help.ts,
// measure-help.ts): SVG markup drawn with currentColor (it follows the
// theme) and colors readable in both themes.

// a trace in the illustrations
export const TRACE_COLOR = "#3584e4";
// what an illustration points out
export const ACCENT_COLOR = "#e8590c";

// the path of y = f(x) from x0 to x1
export function curve(
    x0: number,
    x1: number,
    f: (x: number) => number,
    step = 2
) {
    let d = "";
    for (let x = x0; x <= x1 + 1e-9; x += step) {
        d += `${d ? "L" : "M"}${x.toFixed(1)} ${f(x).toFixed(1)}`;
    }
    return d;
}

export function text(
    x: number,
    y: number,
    content: string,
    anchor: "start" | "middle" | "end" = "middle",
    extra = ""
) {
    return `<text x="${x}" y="${y}" text-anchor="${anchor}" ${extra}>${content}</text>`;
}

export function frame(x0: number, y0: number, x1: number, y1: number) {
    return `<rect x="${x0}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}" fill="none" stroke="currentColor" stroke-opacity="0.3"/>`;
}

// a dashed horizontal line
export function dashedLine(
    x0: number,
    x1: number,
    y: number,
    color = "currentColor",
    opacity = 0.5
) {
    return `<line x1="${x0}" y1="${y}" x2="${x1}" y2="${y}" stroke="${color}" stroke-opacity="${opacity}" stroke-dasharray="4 3"/>`;
}

// a dimension line from x0 to x1 at y with its label under it, or left or
// right of it
export function dimension(
    x0: number,
    x1: number,
    y: number,
    label: string,
    labelSide: "below" | "left" | "right" = "below"
) {
    return (
        `<path d="M${x0} ${y}H${x1}M${x0} ${y - 4}v8M${x1} ${y - 4}v8" stroke="currentColor" fill="none"/>` +
        (labelSide == "left"
            ? text(x0 - 6, y + 4, label, "end")
            : labelSide == "right"
              ? text(x1 + 6, y + 4, label, "start")
              : text((x0 + x1) / 2, y + 15, label))
    );
}

// a vertical dimension line from y0 to y1 at x with its label right of it
export function verticalDimension(
    x: number,
    y0: number,
    y1: number,
    label: string,
    color = "currentColor"
) {
    return (
        `<path d="M${x} ${y0}V${y1}M${x - 4} ${y0}h8M${x - 4} ${y1}h8" stroke="${color}" fill="none"/>` +
        text(x + 7, (y0 + y1) / 2 + 4, label, "start", `fill="${color}"`)
    );
}

export function svg(width: number, height: number, content: string) {
    return (
        `<svg viewBox="0 0 ${width} ${height}" width="100%" style="max-width: ${width}px; display: block; margin: 8px auto 4px" ` +
        `fill="currentColor" font-size="12" font-family="inherit" xmlns="http://www.w3.org/2000/svg">${content}</svg>`
    );
}
