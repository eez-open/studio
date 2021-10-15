import React from "react";

import type { DocumentStoreClass } from "project-editor/core/store";

export const ProjectContext = React.createContext<DocumentStoreClass>(
    undefined as any
);
