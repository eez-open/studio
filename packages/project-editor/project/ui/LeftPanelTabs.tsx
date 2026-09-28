import React from "react";
import { observable } from "mobx";
import { observer } from "mobx-react";

import { t } from "eez-studio-shared/i18n";

import { ListNavigation } from "project-editor/ui-components/ListNavigation";
import { PageStructure } from "project-editor/features/page/PagesNavigation";
import { VariablesTab } from "project-editor/features/variable/VariablesNavigation";
import { StylesTab } from "project-editor/features/style/StylesNavigation";
import { FontsTab } from "project-editor/features/font/FontsNavigation";
import { BitmapsTab } from "project-editor/features/bitmap/BitmapsNavigation";
import { ThemesSideView } from "project-editor/features/style/theme";
import { LVGLGroupsTab } from "project-editor/lvgl/groups";
import { BreakpointsPanel } from "project-editor/flow/debugger/BreakpointsPanel";
import { ProjectContext } from "project-editor/project/context";

// Figma-style left panel: each primary tab stacks two sections, like
// Figma's Pages + Layers. The section header is a small title row, the
// content below fills the rest.

class Section extends React.Component<{
    title: string;
    height?: string;
    children: React.ReactNode;
}> {
    render() {
        return (
            <div
                className="EezStudio_LeftComposite_Section"
                style={
                    this.props.height
                        ? { flexBasis: this.props.height }
                        : undefined
                }
            >
                <div className="EezStudio_LeftComposite_Header">
                    {this.props.title}
                </div>
                <div className="EezStudio_LeftComposite_Body">
                    {this.props.children}
                </div>
            </div>
        );
    }
}

export const PagesWithStructureTab = observer(
    class PagesWithStructureTab extends React.Component {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        render() {
            return (
                <div className="EezStudio_LeftComposite">
                    <Section title={t("Pages")} height="34%">
                        <ListNavigation
                            id="pages"
                            navigationObject={this.context.project.userPages}
                            selectedObject={
                                this.context.navigationStore
                                    .selectedUserPageObject
                            }
                            editable={!this.context.runtime}
                        />
                    </Section>
                    <Section title={t("Widgets Structure")}>
                        <PageStructure />
                    </Section>
                </div>
            );
        }
    }
);

export const WidgetsWithStructureTab = observer(
    class WidgetsWithStructureTab extends React.Component {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        render() {
            return (
                <div className="EezStudio_LeftComposite">
                    <Section title={t("User Widgets")} height="34%">
                        <ListNavigation
                            id="widgets"
                            navigationObject={
                                this.context.project.userWidgets
                            }
                            selectedObject={
                                this.context.navigationStore
                                    .selectedUserWidgetObject
                            }
                            editable={!this.context.runtime}
                        />
                    </Section>
                    <Section title={t("Widgets Structure")}>
                        <PageStructure />
                    </Section>
                </div>
            );
        }
    }
);

export const VariablesWithActionsTab = observer(
    class VariablesWithActionsTab extends React.Component {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        render() {
            return (
                <div className="EezStudio_LeftComposite">
                    <Section title={t("Variables")} height="55%">
                        <VariablesTab />
                    </Section>
                    <Section title={t("User Actions")}>
                        <ListNavigation
                            id="actions"
                            navigationObject={this.context.project.actions}
                            selectedObject={
                                this.context.navigationStore
                                    .selectedActionObject
                            }
                            editable={!this.context.runtime}
                        />
                    </Section>
                </div>
            );
        }
    }
);

// All project resources in one view. Which resource kind is shown is
// selected with the sub-items in the activity bar (shared state).
export const resourcesState = observable({
    selected: "styles"
});

export const ResourcesTab = observer(
    class ResourcesTab extends React.Component {
        render() {
            switch (resourcesState.selected) {
                case "fonts":
                    return <FontsTab />;
                case "bitmaps":
                    return <BitmapsTab />;
                case "themes":
                    return <ThemesSideView />;
                case "lvgl-groups":
                    return <LVGLGroupsTab />;
                case "breakpoints":
                    return <BreakpointsPanel />;
                default:
                    return <StylesTab />;
            }
        }
    }
);
