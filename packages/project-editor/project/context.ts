import React from "react";

import type { ProjectStore } from "project-editor/store";

export const ProjectContext = React.createContext<ProjectStore>(
    undefined as any
);
