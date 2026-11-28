// Small helpers for the views, plain DOM: the views update only the
// elements that changed.

import bootstrap from "bootstrap";

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
    history: "M3.5 12a8.5 8.5 0 1 0 2.5-6M3.5 4v4h4M12 8v4.5l3 2",
    stop: "M7 7h10v10H7z",
    play: "M8 5.5v13l10.5-6.5z",
    eye: "M2.5 12s3.5-6.5 9.5-6.5s9.5 6.5 9.5 6.5s-3.5 6.5-9.5 6.5S2.5 12 2.5 12zM12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6",
    eyeOff: "M3 3l18 18M10.6 5.6c.5-.1.9-.1 1.4-.1c6 0 9.5 6.5 9.5 6.5c-.8 1.4-1.8 2.7-3 3.8M6.5 6.9C3.9 8.6 2.5 12 2.5 12s3.5 6.5 9.5 6.5c1.8 0 3.4-.6 4.8-1.4M9.9 9.9a3 3 0 0 0 4.2 4.2",
    more: "M5.5 12h.01M12 12h.01M18.5 12h.01",
    plus: "M12 5v14M5 12h14",
    target: "M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18M12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8",
    list: "M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01",
    chevronRight: "M9 6l6 6l-6 6",
    check: "M5 12.5l4.5 4.5L19 7.5",
    trash: "M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3",
    close: "M6 6l12 12M18 6L6 18",
    sidePanel: "M3.5 5h17v14h-17zM15 5v14",
    help: "M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.4M12 16.8h.01",
    risingEdge: "M3 18h6l6-12h6",
    fallingEdge: "M3 6h6l6 12h6",
    camera: "M3.5 8.5A1.5 1.5 0 0 1 5 7h2.5L9 4.5h6L16.5 7H19a1.5 1.5 0 0 1 1.5 1.5V18a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 18zM12 9.5a3.5 3.5 0 1 0 0 7a3.5 3.5 0 1 0 0-7",
    // the navigation items
    scope: "M3 5h18v14H3zM5.5 13l2.5-4 3 7 3-9 2.5 6 2-2.5",
    fields: "M4 6h2M10 6h10M4 12h2M10 12h10M4 18h2M10 18h10",
    debugLog:
        "M9 7.5a3 3 0 0 1 6 0M7 10h10v4a5 5 0 0 1-10 0zM12 10v9M3.5 12H7M17 12h3.5M4 18l3-1.5M20 18l-3-1.5M5 6l2.5 2.5M19 6l-2.5 2.5"
};

export function svgIcon(
    path: string,
    size: number = 16,
    strokeWidth: number = 2
) {
    const NS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("width", String(size));
    svg.setAttribute("height", String(size));
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", String(strokeWidth));
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.setAttribute("aria-hidden", "true");
    const element = document.createElementNS(NS, "path");
    element.setAttribute("d", path);
    svg.appendChild(element);
    return svg;
}

// the info icon: a filled circle in the color of the text with a white "i"
export function infoIcon(size: number) {
    const NS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("width", String(size));
    svg.setAttribute("height", String(size));
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    svg.innerHTML =
        '<circle cx="12" cy="12" r="11" fill="currentColor"/>' +
        '<circle cx="12" cy="6.8" r="1.7" fill="#fff"/>' +
        '<rect x="10.4" y="10" width="3.2" height="8.5" rx="1.2" fill="#fff"/>';
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

// A Bootstrap modal with the title and the body (a "modal-body" element),
// removed when it is closed; it follows the theme of Studio.
export function showModal(
    title: string,
    body: HTMLElement,
    dialogClassName: string = "modal-lg modal-dialog-scrollable"
) {
    const dialog = h(
        "div",
        { className: "modal", tabIndex: -1, role: "dialog" },
        h(
            "div",
            { className: "modal-dialog " + dialogClassName },
            h(
                "div",
                { className: "modal-content" },
                h(
                    "div",
                    { className: "modal-header" },
                    h("h5", { className: "modal-title" }, title),
                    h("button", {
                        type: "button",
                        className: "btn-close",
                        "data-bs-dismiss": "modal",
                        ariaLabel: "Close"
                    })
                ),
                body,
                h(
                    "div",
                    { className: "modal-footer" },
                    h(
                        "button",
                        {
                            type: "button",
                            className: "btn btn-primary",
                            "data-bs-dismiss": "modal"
                        },
                        "Close"
                    )
                )
            )
        )
    );
    document.body.append(dialog);
    const modal = new bootstrap.Modal(dialog);
    dialog.addEventListener("hidden.bs.modal", () => {
        modal.dispose();
        dialog.remove();
    });
    modal.show();
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
