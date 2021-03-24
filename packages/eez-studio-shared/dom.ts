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
