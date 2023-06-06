import {
    IExtensionDefinition,
    IActivityLogController,
    IExtensionHost
} from "eez-studio-shared/extensions/extension";

// late binding
import type * as SectionModule from "notebook/section";
import type * as ExportModule from "notebook/export";
import type * as ImportModule from "notebook/import";

// this is required so that store is defined for the main and renderer processes
import "notebook/store";

const notebookExtension: IExtensionDefinition = {
    preInstalled: true,
    extensionType: "built-in",

    homeSections: [
        {
            id: "notebooks",
            title: "Notebooks",
            icon: "material:library_books",
            category: "instrument" as const,
            renderContent: () => {
                const { renderContent } =
                    require("notebook/section") as typeof SectionModule;
                return renderContent();
            },
            selectItem: (itemId: string) => {
                const { selectItem } =
                    require("notebook/section") as typeof SectionModule;
                return selectItem(itemId);
            }
        }
    ],

    activityLogTools: [
        (controller: IActivityLogController) => {
            const { exportTool } =
                require("notebook/export") as typeof ExportModule;
            return exportTool(controller);
        }
    ],

    handleDragAndDropFile: (filePath: string, host: IExtensionHost) => {
        const { importNotebook } =
            require("notebook/import") as typeof ImportModule;
        return importNotebook(filePath);
    }
};

export default notebookExtension;
