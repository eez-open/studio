import type { Project } from "project-editor/project/project";
import { isV3OrNewerProject } from "project-editor/project/project-type-traits";

// The page editor of EEZ-GUI v3 flow projects draws the pages with the
// framework WASM (see eez-gui-editor-page.tsx). The pages of other EEZ-GUI
// projects (v1, v2, without flow support) are not drawn.
export function isEezGuiEditorWasmProject(project: Project) {
    const traits = project.projectTypeTraits;
    return (
        traits.isFirmware &&
        !traits.isEezGuiLite &&
        !traits.isLVGL &&
        traits.hasFlowSupport &&
        isV3OrNewerProject(project)
    );
}
