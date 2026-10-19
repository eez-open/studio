import React from "react";

////////////////////////////////////////////////////////////////////////////////

function getDecimals(n: number) {
    const s = n.toString();
    if (s.indexOf("e") != -1) {
        return 0;
    }
    const i = s.indexOf(".");
    return i == -1 ? 0 : Math.min(s.length - i - 1, 6);
}

function roundTo(n: number, decimals: number) {
    return Number(n.toFixed(decimals));
}

// 1 for integers, 0.1 for 1.5, 0.01 for 1.25, ...
function getUnit(value: number) {
    const decimals = getDecimals(value);
    return { decimals, unit: decimals ? Math.pow(10, -decimals) : 1 };
}

function clamp(value: number, min?: number, max?: number) {
    if (min != undefined && value < min) {
        return min;
    }
    if (max != undefined && value > max) {
        return max;
    }
    return value;
}

////////////////////////////////////////////////////////////////////////////////

// Time between two steps while ARROW UP/DOWN is held: slow, then faster and
// finally fast.
const HOLD_PHASES = [
    { until: 700, interval: 200 },
    { until: 1800, interval: 70 },
    { until: Infinity, interval: 25 }
];

const heldInputs = new WeakMap<EventTarget, true>();

// Handles ARROW UP/DOWN in a number input. Shift makes the step 10 times
// bigger. Returns true if the key was handled.
export function handleNumberArrowKey(
    event: React.KeyboardEvent<HTMLInputElement>,
    getValue: () => number | undefined,
    setValue: (value: number) => void,
    bounds?: { min?: number; max?: number }
) {
    if (event.key != "ArrowUp" && event.key != "ArrowDown") {
        return false;
    }

    event.preventDefault();

    const input = event.currentTarget;

    // browser auto-repeat is ignored, repeating is driven by the timer below
    if (heldInputs.has(input)) {
        return true;
    }
    heldInputs.set(input, true);

    const key = event.key;
    const direction = key == "ArrowUp" ? 1 : -1;
    const multiplier = event.shiftKey ? 10 : 1;
    const startTime = Date.now();
    let timer: any;

    const step = () => {
        const current = getValue();
        const base = current == undefined || isNaN(current) ? 0 : current;
        const { decimals, unit } = getUnit(base);
        setValue(
            clamp(
                roundTo(base + direction * unit * multiplier, decimals),
                bounds?.min,
                bounds?.max
            )
        );
    };

    const schedule = () => {
        const elapsed = Date.now() - startTime;
        const phase = HOLD_PHASES.find(phase => elapsed < phase.until)!;
        timer = setTimeout(() => {
            step();
            schedule();
        }, phase.interval);
    };

    const stop = () => {
        clearTimeout(timer);
        heldInputs.delete(input);
        input.removeEventListener("keyup", onKeyUp);
        input.removeEventListener("blur", stop);
    };

    const onKeyUp = (e: KeyboardEvent) => {
        if (e.key == key) {
            stop();
        }
    };

    input.addEventListener("keyup", onKeyUp);
    input.addEventListener("blur", stop);

    step();
    schedule();

    return true;
}

////////////////////////////////////////////////////////////////////////////////

// Label of a number input: dragging it left or right (cursor with horizontal
// arrows) decreases or increases the value, 1 pixel is 1 unit, Shift makes it
// 10 times faster.
export class ScrubLabel extends React.Component<{
    getValue: () => number | undefined;
    setValue: (value: number) => void;
    onStart?: () => void;
    onEnd?: () => void;
    readOnly?: boolean;
    className?: string;
    title?: string;
    children?: React.ReactNode;
}> {
    scrubbing = false;
    accumulated = 0;
    decimals = 0;
    unit = 1;
    pendingValue: number | undefined;
    lastValue: number | undefined;
    frame: number | undefined;

    flush = () => {
        this.frame = undefined;
        if (this.pendingValue != undefined && this.pendingValue != this.lastValue) {
            this.lastValue = this.pendingValue;
            this.props.setValue(this.pendingValue);
        }
    };

    onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
        if (this.props.readOnly || event.button != 0) {
            return;
        }

        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);

        const value = this.props.getValue();
        this.accumulated = value == undefined || isNaN(value) ? 0 : value;
        ({ decimals: this.decimals, unit: this.unit } = getUnit(this.accumulated));
        this.lastValue = value;
        this.pendingValue = undefined;
        this.scrubbing = true;

        this.props.onStart?.();
    };

    onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
        if (!this.scrubbing) {
            return;
        }

        this.accumulated +=
            event.movementX * this.unit * (event.shiftKey ? 10 : 1);

        this.pendingValue = roundTo(
            Math.round(this.accumulated / this.unit) * this.unit,
            this.decimals
        );

        if (this.frame == undefined) {
            this.frame = requestAnimationFrame(this.flush);
        }
    };

    onPointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
        if (!this.scrubbing) {
            return;
        }
        this.scrubbing = false;

        if (this.frame != undefined) {
            cancelAnimationFrame(this.frame);
        }
        this.flush();

        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }

        this.props.onEnd?.();
    };

    render() {
        return (
            <div
                className={this.props.className}
                title={
                    this.props.readOnly
                        ? this.props.title
                        : (this.props.title ? this.props.title + " - " : "") +
                          "Drag left or right to change the value"
                }
                style={
                    this.props.readOnly
                        ? undefined
                        : { cursor: "ew-resize", userSelect: "none" }
                }
                onPointerDown={this.onPointerDown}
                onPointerMove={this.onPointerMove}
                onPointerUp={this.onPointerEnd}
                onPointerCancel={this.onPointerEnd}
            >
                {this.props.children}
            </div>
        );
    }
}
