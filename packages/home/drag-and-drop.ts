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
            } else if (!ev.defaultPrevented) {
                // only refuse drags that no drop target accepted, otherwise
                // forcing dropEffect to "none" here would suppress the drop
                // event of the accepting target (flexlayout-react tab docking
                // uses native HTML5 drag and drop since version 0.8)
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
                        (await handleDragAndDropFile(file.webkitRelativePath, {
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
