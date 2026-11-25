// Small helpers for the views, plain DOM: the views update only the
// elements that changed.

import type {
    BB3PlusInstrument,
    BB3PlusChange
} from "instrument/bb3plus/BB3PlusInstrument";

type Child = Node | string | number | undefined | null | false;

// the properties of the element: className, style (object), on... (event
// listeners), others as properties of the element (value, title, ...)
type Props = { [name: string]: any };

export function h<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    props?: Props | null,
    ...children: Child[]
): HTMLElementTagNameMap[K] {
    const element = document.createElement(tag);
    if (props) {
        for (const name of Object.keys(props)) {
            const value = props[name];
            if (value == undefined) {
                continue;
            }
            if (name == "style") {
                Object.assign(element.style, value);
            } else if (name.startsWith("on") && typeof value == "function") {
                element.addEventListener(name.substring(2), value);
            } else if (name.startsWith("data-")) {
                element.setAttribute(name, String(value));
            } else {
                (element as any)[name] = value;
            }
        }
    }
    append(element, children);
    return element;
}

export function append(element: Node, children: Child[]) {
    for (const child of children) {
        if (child == undefined || child === false) {
            continue;
        }
        element.appendChild(
            typeof child == "object"
                ? child
                : document.createTextNode(String(child))
        );
    }
}

export function setText(element: HTMLElement, text: string) {
    if (element.textContent != text) {
        element.textContent = text;
    }
}

export function setVisible(element: HTMLElement, visible: boolean) {
    const display = visible ? "" : "none";
    if (element.style.display != display) {
        element.style.display = display;
    }
}

export function setClass(element: Element, name: string, on: boolean) {
    if (element.classList.contains(name) != on) {
        element.classList.toggle(name, on);
    }
}

// the icons of the buttons: path data of a 24 x 24 outline drawn with the
// text color
export const ICONS = {
    zoomIn: "M10.5 4a6.5 6.5 0 1 0 0 13a6.5 6.5 0 1 0 0-13M15.5 15.5L21 21M7.5 10.5h6M10.5 7.5v6",
    zoomOut:
        "M10.5 4a6.5 6.5 0 1 0 0 13a6.5 6.5 0 1 0 0-13M15.5 15.5L21 21M7.5 10.5h6",
    zoomReset: "M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5",
    scales: "M4 6h16M9 3.5v5M4 12h16M15 9.5v5M4 18h16M7 15.5v5",
    // the navigation items
    scope: "M3 5h18v14H3zM5.5 13l2.5-4 3 7 3-9 2.5 6 2-2.5",
    fields: "M4 6h2M10 6h10M4 12h2M10 12h10M4 18h2M10 18h10",
    debugLog:
        "M9 7.5a3 3 0 0 1 6 0M7 10h10v4a5 5 0 0 1-10 0zM12 10v9M3.5 12H7M17 12h3.5M4 18l3-1.5M20 18l-3-1.5M5 6l2.5 2.5M19 6l-2.5 2.5"
};

export function svgIcon(path: string, size: number = 16) {
    const NS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("width", String(size));
    svg.setAttribute("height", String(size));
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "2");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.setAttribute("aria-hidden", "true");
    const element = document.createElementNS(NS, "path");
    element.setAttribute("d", path);
    svg.appendChild(element);
    return svg;
}

// a <select> of the values, onChange gets the selected one
export function createSelect<T extends string | number>(
    options: { value: T; label: string }[],
    props: Props,
    onChange: (value: T) => void
) {
    const select = h("select", {
        className: "form-select form-select-sm",
        ...props
    });
    setSelectOptions(select, options);
    select.addEventListener("change", () => {
        const option = options.find(
            option => String(option.value) == select.value
        );
        if (option) {
            onChange(option.value);
        }
    });
    return select;
}

export function setSelectOptions(
    select: HTMLSelectElement,
    options: { value: string | number; label: string }[]
) {
    select.replaceChildren(
        ...options.map(option =>
            h("option", { value: String(option.value) }, option.label)
        )
    );
}

export function setSelectValue(
    select: HTMLSelectElement,
    value: string | number
) {
    if (select.value != String(value)) {
        select.value = String(value);
    }
}

// The base of the views: the element shown and the listeners removed by
// destroy. Studio keeps the views of the sections visited, hidden: while
// hidden a view isn't updated, the listeners of the changes run when it is
// shown again.
export class BB3PlusView {
    element: HTMLElement;
    private disposers: (() => void)[] = [];
    private visible = false;
    private pendingListeners = new Set<() => void>();

    constructor(public bb3PlusInstrument: BB3PlusInstrument) {
        this.element = h("div", { className: "EezStudio_BB3Plus_View" });

        // after a frame, so also when the window comes back from minimized
        const resizeObserver = new ResizeObserver(() => this.checkVisible());
        resizeObserver.observe(this.element);
        this.addDisposer(() => resizeObserver.disconnect());
    }

    // the element is in the document now
    mounted() {
        this.checkVisible();
    }

    private checkVisible() {
        const visible =
            this.element.clientWidth > 0 || this.element.clientHeight > 0;
        if (visible == this.visible) {
            return;
        }
        this.visible = visible;
        if (visible) {
            const listeners = Array.from(this.pendingListeners);
            this.pendingListeners.clear();
            for (const listener of listeners) {
                listener();
            }
        }
    }

    protected listen(changes: BB3PlusChange[], listener: () => void) {
        for (const change of changes) {
            this.disposers.push(
                this.bb3PlusInstrument.on(change, () => {
                    if (this.visible) {
                        listener();
                    } else {
                        this.pendingListeners.add(listener);
                    }
                })
            );
        }
    }

    protected addDisposer(disposer: () => void) {
        this.disposers.push(disposer);
    }

    destroy() {
        for (const disposer of this.disposers) {
            disposer();
        }
        this.disposers = [];
    }
}

// the state of the push port connection, empty while it is connected
export class PushStatus {
    element = h("span", { className: "EezStudio_BB3Plus_Status" });

    constructor(private bb3PlusInstrument: BB3PlusInstrument) {
        this.update();
    }

    update() {
        const bb3PlusInstrument = this.bb3PlusInstrument;
        let text = "";
        let error = false;
        if (!bb3PlusInstrument.instrumentConnected) {
            text = "Not connected.";
        } else if (!bb3PlusInstrument.pushAddress) {
            text =
                "Connect over Ethernet (SCPI port 5025) to use the push port.";
        } else if (bb3PlusInstrument.pushState == "connecting") {
            text = `Connecting to the push port ${bb3PlusInstrument.pushAddress.port}...`;
        } else if (bb3PlusInstrument.pushState == "error") {
            text = `${bb3PlusInstrument.pushError}, trying again...`;
            error = true;
        }
        setText(this.element, text);
        setClass(this.element, "text-danger", error);
        setVisible(this.element, text != "");
    }
}

// an error text, hidden when there is none
export class ErrorText {
    element = h("span", { className: "text-danger" });

    constructor() {
        this.update(undefined);
    }

    update(text: string | undefined) {
        setText(this.element, text ?? "");
        setVisible(this.element, !!text);
    }
}
