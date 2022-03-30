import bootstrap from "bootstrap";
import { createRoot } from "react-dom/client";

export function showPopup(targetElement: Element, popupElement: JSX.Element) {
    let content = document.createElement("div");
    content.tabIndex = 0;
    const root = createRoot(content);
    root.render(popupElement);

    const popup = new bootstrap.Popover(targetElement, {
        content,
        html: true,
        placement: "top",
        trigger: "manual"
    });
    popup.show();

    const onPointerDown = (event: MouseEvent) => {
        if (!$.contains(content, event.target as any)) {
            dispose();
        }
    };

    window.addEventListener("pointerdown", onPointerDown, true);

    const dispose = () => {
        popup.dispose();
        window.removeEventListener("pointerdown", onPointerDown, true);
    };

    return {
        dispose
    };
}
