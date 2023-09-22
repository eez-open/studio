import React from "react";

import { showDialog } from "eez-studio-ui/dialog";

import { getModel } from "./model";
import { DocumentationBrowser } from "./components/DocumentationBrowser";

////////////////////////////////////////////////////////////////////////////////

export function showDocumentationBrowser() {
    const model = getModel();

    if (!model.documentationBrowserClosed) {
        return;
    }

    const [modalDialog] = showDialog(<DocumentationBrowser />, {
        jsPanel: {
            id: "documentation-browser",
            title: "Components Documentation Browser",
            modeless: true,
            width: window.innerWidth - 100,
            height: window.innerHeight - 100
        }
    });

    model.documentationBrowserClosed = false;

    function onClosed(event: any) {
        if (event.panel === modalDialog) {
            model.documentationBrowserClosed = true;
            document.removeEventListener("jspanelclosed", onClosed, false);
        }
    }

    document.addEventListener("jspanelbeforeclose", onClosed, false);
}
