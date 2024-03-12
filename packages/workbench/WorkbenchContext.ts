import React from "react";

import type { WorkbenchStore } from "workbench";

export const WorkbenchContext = React.createContext<WorkbenchStore>(
    undefined as any
);
