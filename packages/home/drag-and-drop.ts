import { extensions } from "eez-studio-shared/extensions/extensions";

import { tabs } from "home/tabs-store";

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
        const ev = $ev.originalEvent as DragEvent;
        if (ev.dataTransfer) {
            if (ev.dataTransfer.files.length > 0) {
                $ev.preventDefault();
                ev.dataTransfer.dropEffect = "copy";
            } else {
                ev.dataTransfer.dropEffect = "none";
            }
        }
    });

    $(document).on("drop", async $ev => {
        const ev = $ev.originalEvent as DragEvent;
        const dt = ev.dataTransfer;
        if (dt && dt.files.length > 0) {
            $ev.preventDefault();

            const files = dt.files;

            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                for (const extension of extensions) {
                    const handleDragAndDropFile =
                        extension[1].handleDragAndDropFile;
                    if (
                        handleDragAndDropFile &&
                        (await handleDragAndDropFile(file.path, {
                            activeTab: tabs.activeTab!
                        }))
                    ) {
                        break;
                    }
                }
            }

            removeDragData(ev);
        }
    });
}
