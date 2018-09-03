import { IExtensionDefinition, IActivityLogController } from "shared/extensions/extension";

// late binding
import * as SectionModule from "notebook/section";
import * as ExportModule from "notebook/export";
import * as ImportModule from "notebook/import";

// this is required so that store is defined for the main and renderer processes
import "notebook/store";

const notebookExtension: IExtensionDefinition = {
    preInstalled: true,

    homeSections: [
        {
            id: "notebooks",
            title: "Notebooks",
            icon: "material:library_books",
            render: () => {
                const {
                    renderNotebooksHomeSection
                } = require("notebook/section") as typeof SectionModule;
                return renderNotebooksHomeSection();
            }
        }
    ],

    activityLogTools: [
        {
            id: "activity-viewer/export",
            title: "Export selected history items as notebook",
            icon: "material:library_add",
            isEnabled: (controller: IActivityLogController) => controller.selection.length > 0,
            handler: (controller: IActivityLogController) => {
                const {
                    exportActivityLogItems
                } = require("notebook/export") as typeof ExportModule;
                exportActivityLogItems(controller.selection);
            }
        }
    ],

    handleDragAndDropFile: (filePath: string) => {
        const { importNotebook } = require("notebook/import") as typeof ImportModule;
        return importNotebook(filePath);
    }
};

export default notebookExtension;
