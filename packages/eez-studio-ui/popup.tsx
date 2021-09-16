import bootstrap from "bootstrap";
import React from "react";
import ReactDOM from "react-dom";

import { theme } from "eez-studio-ui/theme";
import { ThemeProvider } from "eez-studio-ui/styled-components";

export function showPopup(targetElement: Element, popupElement: JSX.Element) {
    let content = document.createElement("div");
    content.tabIndex = 0;
    ReactDOM.render(
        <ThemeProvider theme={theme()}>{popupElement}</ThemeProvider>,
        content
    );

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
