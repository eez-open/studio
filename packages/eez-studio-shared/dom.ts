export function closest(element: any, predicate: (element: any) => boolean) {
    while (element) {
        if (predicate(element)) {
            return element;
        }
        element = element.parentNode;
    }
}

export function closestByClass(element: any, className: string) {
    return closest(element, (element: any) => {
        const elementClassName =
            element.getAttribute && element.getAttribute("class");
        if (!elementClassName) {
            return false;
        }
        return elementClassName.indexOf(className) !== -1;
    });
}

export function closestBySelector(element: any, selector: string) {
    return closest(element, (element: any) => {
        return element.matches && element.matches(selector);
    });
}

export function hasClass(element: any, className: string) {
    return (
        element &&
        element.className &&
        element.className.match(new RegExp("\\b" + className + "\\b"))
    );
}

export function addScript(src: string) {
    return new Promise(resolve => {
        let script = document.createElement("script");
        script.type = "text/javascript";
        script.src = src;
        script.onload = resolve;
        document.body.appendChild(script);
    });
}

export function addCssStylesheet(id: string, href: string) {
    if (!document.getElementById(id) && document.head) {
        let link = document.createElement("link");
        link.id = id;
        link.rel = "stylesheet";
        link.type = "text/css";
        link.href = href;
        document.head.appendChild(link);
    }
}

export function scrollIntoViewIfNeeded(el: HTMLElement) {
    if ((el as any).scrollIntoViewIfNeeded) {
        (el as any).scrollIntoViewIfNeeded();
    } else {
        el.scrollIntoView();
    }
}

////////////////////////////////////////////////////////////////////////////////

/**
 * Calls onFrame on every animation frame, but only while the element returned
 * by getElement is rendered. Inactive tabs stay mounted with display:none, so
 * a plain requestAnimationFrame loop would keep running there forever.
 *
 * While the element is hidden the loop sleeps and a ResizeObserver wakes it
 * when the element gets a size again, so the element must have a non-zero size
 * when visible. While getElement returns nothing the loop sleeps until wake().
 */
export class VisibleAnimationFrameLoop {
    private running = false;
    private waiting = false;
    private requestAnimationFrameId: number | undefined;
    private resizeObserver: ResizeObserver | undefined;

    constructor(
        private getElement: () => Element | null | undefined,
        private onFrame: () => void
    ) {}

    // first onFrame is called on the next animation frame
    start() {
        if (!this.running) {
            this.running = true;
            this.requestAnimationFrameId = window.requestAnimationFrame(
                this.tick
            );
        }
    }

    stop() {
        this.running = false;
        if (this.requestAnimationFrameId != undefined) {
            window.cancelAnimationFrame(this.requestAnimationFrameId);
            this.requestAnimationFrameId = undefined;
        }
        this.stopWaiting();
    }

    // call when getElement would return a different element
    wake() {
        if (this.running && this.waiting) {
            this.stopWaiting();
            this.tick();
        }
    }

    private tick = () => {
        this.requestAnimationFrameId = undefined;

        const el = this.getElement();
        if (!el || el.getClientRects().length == 0) {
            this.waitUntilVisible(el);
            return;
        }

        this.onFrame();

        if (this.running) {
            this.requestAnimationFrameId = window.requestAnimationFrame(
                this.tick
            );
        }
    };

    private waitUntilVisible(el: Element | null | undefined) {
        this.stopWaiting();
        this.waiting = true;
        if (el) {
            this.resizeObserver = new ResizeObserver(() => {
                if (el.getClientRects().length > 0) {
                    this.wake();
                }
            });
            this.resizeObserver.observe(el);
        }
    }

    private stopWaiting() {
        this.waiting = false;
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
            this.resizeObserver = undefined;
        }
    }
}
