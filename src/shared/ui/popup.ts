import * as ReactDOM from "react-dom";

export function showPopup(targetElement: Element, popupElement: JSX.Element) {
    let content = document.createElement("div");
    content.tabIndex = 0;
    ReactDOM.render(popupElement, content);

    $(targetElement)
        .popover({
            content,
            html: true,
            placement: "top",
            trigger: "manual"
        })
        .popover("show");

    const onPointerDown = (event: MouseEvent) => {
        if (!$.contains(content, event.target as any)) {
            dispose();
        }
    };

    window.addEventListener("pointerdown", onPointerDown, true);

    const dispose = () => {
        $(targetElement).popover("dispose");
        window.removeEventListener("pointerdown", onPointerDown, true);
    };

    return {
        dispose
    };
}
