import { service } from "eez-studio-shared/service";

export default service("pdf-services/pdf-to-png", async (data: string) => {
    const pdfjsLib = require("../../libs/pdfjs/build/pdf.js");
    pdfjsLib.GlobalWorkerOptions.workerSrc =
        "../../libs/pdfjs/build/pdf.worker.js";

    var pdfDocument = await pdfjsLib.getDocument(data);

    var page = await pdfDocument.getPage(1);

    var viewport = page.getViewport(1.0);

    var canvas = document.createElement("canvas");
    canvas.height = (viewport.height * 640) / viewport.width;
    canvas.width = 640;

    var context = canvas.getContext("2d");

    var renderContext = {
        canvasContext: context,
        viewport: viewport
    };

    await page.render(renderContext);

    return canvas.toDataURL();
});
