import React from "react";
import { observer } from "mobx-react";
import { ProjectContext } from "project-editor/project/context";
import type { Page } from "./page";
import type { IFlowContext } from "project-editor/flow/flow-interfaces";

export const LVGLPage = observer(
    class LVGLPage extends React.Component<{
        page: Page;
        flowContext: IFlowContext;
    }> {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        render() {
            return "Hello LVGL!";
        }
    }
);
