import React from "react";
import { computed, makeObservable } from "mobx";
import { observer } from "mobx-react";

import { ListNavigation } from "project-editor/ui-components/ListNavigation";
import {
    SubNavigation,
    SubNavigationItem
} from "project-editor/ui-components/SubNavigation";
import { ProjectContext } from "project-editor/project/context";
import { Page } from "project-editor/features/page/page";
import { Action } from "project-editor/features/action/action";
import { NavigationStore } from "project-editor/store/navigation";

////////////////////////////////////////////////////////////////////////////////

export const VariablesTab = observer(
    class VariablesTab extends React.Component {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        constructor(props: any) {
            super(props);

            makeObservable(this, {
                localVariables: computed
            });
        }

        get localVariables() {
            const editor = this.context.editorsStore.activeEditor;
            if (editor) {
                const object = editor.object;
                if (object instanceof Page || object instanceof Action) {
                    return object.localVariables;
                }
            }

            return undefined;
        }
        render() {
            const items: SubNavigationItem[] = [
                {
                    name: NavigationStore.VARIABLES_SUB_NAVIGATION_ITEM_GLOBAL,
                    component: (
                        <ListNavigation
                            id="global-variables"
                            navigationObject={
                                this.context.project.variables.globalVariables
                            }
                            selectedObject={
                                this.context.navigationStore
                                    .selectedGlobalVariableObject
                            }
                        />
                    ),
                    numItems:
                        this.context.project.variables.globalVariables.length
                }
            ];

            if (this.context.projectTypeTraits.hasFlowSupport) {
                if (this.localVariables) {
                    items.push({
                        name: NavigationStore.VARIABLES_SUB_NAVIGATION_ITEM_LOCAL,
                        component: (
                            <ListNavigation
                                id="local-variables"
                                navigationObject={this.localVariables}
                                selectedObject={
                                    this.context.navigationStore
                                        .selectedLocalVariable
                                }
                            />
                        ),
                        numItems: this.localVariables?.length ?? 0
                    });
                }

                items.push({
                    name: NavigationStore.VARIABLES_SUB_NAVIGATION_ITEM_STRUCTS,
                    component: (
                        <ListNavigation
                            id="structs"
                            navigationObject={
                                this.context.project.variables.structures
                            }
                            selectedObject={
                                this.context.navigationStore
                                    .selectedStructureObject
                            }
                        />
                    ),
                    numItems: this.context.project.variables.structures.length
                });
            }

            items.push({
                name: NavigationStore.VARIABLES_SUB_NAVIGATION_ITEM_ENUMS,
                component: (
                    <ListNavigation
                        id="enums"
                        navigationObject={this.context.project.variables.enums}
                        selectedObject={
                            this.context.navigationStore.selectedEnumObject
                        }
                    />
                ),
                numItems: this.context.project.variables.enums.length
            });

            return (
                <SubNavigation
                    id={NavigationStore.VARIABLES_SUB_NAVIGATION_ID}
                    items={items}
                />
            );
        }
    }
);
