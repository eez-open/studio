import { extensions } from "shared/extensions/extensions";

export function handleDragAndDrop() {
    function removeDragData(ev: DragEvent) {
        if (ev.dataTransfer.items) {
            // Use DataTransferItemList interface to remove the drag data
            ev.dataTransfer.items.clear();
        } else {
            // Use DataTransfer interface to remove the drag data
            ev.dataTransfer.clearData();
        }
    }

    $(document).on("dragover", $ev => {
        $ev.preventDefault();
        const ev = $ev.originalEvent as DragEvent;
        ev.dataTransfer.dropEffect = "copy";
    });

    $(document).on("drop", async $ev => {
        $ev.preventDefault();
        const ev = $ev.originalEvent as DragEvent;

        var dt = ev.dataTransfer;
        var files = dt.files;

        for (let file of files) {
            for (let extension of extensions) {
                const handleDragAndDropFile = extension[1].handleDragAndDropFile;
                if (handleDragAndDropFile && (await handleDragAndDropFile(file.path))) {
                    break;
                }
            }
        }

        removeDragData(ev);
    });
}
