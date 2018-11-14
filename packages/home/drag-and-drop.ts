import { extensions } from "eez-studio-shared/extensions/extensions";

export function handleDragAndDrop() {
    function removeDragData(ev: DragEvent) {
        if (ev.dataTransfer) {
            if (ev.dataTransfer.items) {
                // Use DataTransferItemList interface to remove the drag data
                ev.dataTransfer.items.clear();
            } else {
                // Use DataTransfer interface to remove the drag data
                ev.dataTransfer.clearData();
            }
        }
    }

    $(document).on("dragover", $ev => {
        $ev.preventDefault();
        const ev = $ev.originalEvent as DragEvent;
        if (ev.dataTransfer) {
            ev.dataTransfer.dropEffect = "copy";
        }
    });

    $(document).on("drop", async $ev => {
        $ev.preventDefault();
        const ev = $ev.originalEvent as DragEvent;

        const dt = ev.dataTransfer;
        if (dt) {
            const files = dt.files;

            for (const file of files) {
                for (const extension of extensions) {
                    const handleDragAndDropFile = extension[1].handleDragAndDropFile;
                    if (handleDragAndDropFile && (await handleDragAndDropFile(file.path))) {
                        break;
                    }
                }
            }

            removeDragData(ev);
        }
    });
}
