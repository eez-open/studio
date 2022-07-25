import React from "react";

import type { ProjectEditorStore } from "project-editor/store";

export const ProjectContext = React.createContext<ProjectEditorStore>(
    undefined as any
);
