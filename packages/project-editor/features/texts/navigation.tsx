import React from "react";
import * as FlexLayout from "flexlayout-react";

import { ProjectContext } from "project-editor/project/context";
import { NavigationComponent } from "project-editor/project/NavigationComponent";
import { LayoutModels } from "project-editor/store";
import { ListNavigation } from "project-editor/components/ListNavigation";
import { observer } from "mobx-react";

export const TextsNavigation = observer(
    class TextsNavigation extends NavigationComponent {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        factory = (node: FlexLayout.TabNode) => {
            var component = node.getComponent();

            if (component === "resources") {
                return (
                    <ListNavigation
                        id="resources"
                        navigationObject={this.context.project.texts.resources}
                        selectedObject={
                            this.context.navigationStore
                                .selectedTextResourceObject
                        }
                    />
                );
            }

            if (component === "languages") {
                return (
                    <ListNavigation
                        id="languages"
                        navigationObject={this.context.project.texts.languages}
                        selectedObject={
                            this.context.navigationStore.selectedLanguageObject
                        }
                    />
                );
            }

            return null;
        };

        render() {
            return (
                <FlexLayout.Layout
                    model={this.context.layoutModels.texts}
                    factory={this.factory}
                    realtimeResize={true}
                    font={LayoutModels.FONT_SUB}
                />
            );
        }
    }
);
