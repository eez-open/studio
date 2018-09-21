console.log("tata");

EEZStudio.electron.ipcRenderer.on(
    "pdf-to-png",
    (
        event: Electron.Event,
        params: {
            taskId: string;
            data: any;
        }
    ) => {
        const pdfjsLib = require("../../libs/pdfjs/build/pdf.js");
        pdfjsLib.GlobalWorkerOptions.workerSrc = "../../libs/pdfjs/build/pdf.worker.js";

        var loadingTask = pdfjsLib.getDocument({ data: params.data });
        loadingTask.promise
            .then((pdfDocument: any) => {
                pdfDocument
                    .getPage(1)
                    .then((page: any) => {
                        console.log("page", page);

                        var viewport = page.getViewport(1.0);
                        var canvas = document.getElementById("canvas") as HTMLCanvasElement;
                        canvas.height = viewport.height;
                        canvas.width = viewport.width;
                        var context = canvas.getContext("2d");
                        var renderContext = {
                            canvasContext: context,
                            viewport: viewport
                        };
                        page.render(renderContext)
                            .then(() => {
                                console.log("done", canvas.toDataURL());
                                EEZStudio.electron.ipcRenderer.send("pdf-to-png-done", {
                                    taskId: params.taskId,
                                    result: canvas.toDataURL()
                                });
                            })
                            .catch((error: any) => {
                                EEZStudio.electron.ipcRenderer.send("pdf-to-png-done", {
                                    taskId: params.taskId,
                                    error
                                });
                            });
                    })
                    .catch((error: any) => {
                        EEZStudio.electron.ipcRenderer.send("pdf-to-png-done", {
                            taskId: params.taskId,
                            error
                        });
                    });
            })
            .catch((error: any) => {
                EEZStudio.electron.ipcRenderer.send("pdf-to-png-done", {
                    taskId: params.taskId,
                    error
                });
            });
    }
);
