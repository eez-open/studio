import type { Project } from "project-editor/project/project";

// The page editor of EEZ-GUI flow projects draws the pages with the framework
// WASM (see eez-gui-editor-page.tsx). The pages of the EEZ-GUI projects without
// flow support are not drawn.
export function isEezGuiEditorWasmProject(project: Project) {
    const traits = project.projectTypeTraits;
    return (
        traits.isFirmware &&
        !traits.isEezGuiLite &&
        !traits.isLVGL &&
        traits.hasFlowSupport
    );
}
