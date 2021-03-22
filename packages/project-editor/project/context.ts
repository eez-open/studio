import React from "react";

import { DocumentStoreClass } from "project-editor/core/store";

export const ProjectContext = React.createContext<DocumentStoreClass>(
    undefined as any
);
