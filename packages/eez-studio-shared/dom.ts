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
        const elementClassName = element.getAttribute && element.getAttribute("class");
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

let scrollbarWidth: number | undefined;

export function getScrollbarWidth() {
    if (scrollbarWidth === undefined) {
        var outer = document.createElement("div");
        outer.style.visibility = "hidden";
        outer.style.width = "100px";
        outer.style.msOverflowStyle = "scrollbar"; // needed for WinJS apps

        document.body.appendChild(outer);

        var widthNoScroll = outer.offsetWidth;
        // force scrollbars
        outer.style.overflow = "scroll";

        // add innerdiv
        var inner = document.createElement("div");
        inner.style.width = "100%";
        outer.appendChild(inner);

        var widthWithScroll = inner.offsetWidth;

        // remove divs
        outer.parentNode!.removeChild(outer);

        scrollbarWidth = widthNoScroll - widthWithScroll;
    }

    return scrollbarWidth;
}
