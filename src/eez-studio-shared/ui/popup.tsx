import * as React from "react";
import * as ReactDOM from "react-dom";

import { theme } from "eez-studio-shared/ui/theme";
import { ThemeProvider } from "eez-studio-shared/ui/styled-components";

export function showPopup(targetElement: Element, popupElement: JSX.Element) {
    let content = document.createElement("div");
    content.tabIndex = 0;
    ReactDOM.render(<ThemeProvider theme={theme}>{popupElement}</ThemeProvider>, content);

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
