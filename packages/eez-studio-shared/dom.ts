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
