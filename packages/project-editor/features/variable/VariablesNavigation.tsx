import React from "react";
import { computed, observable } from "mobx";
import { observer } from "mobx-react";
import * as FlexLayout from "flexlayout-react";

import { LayoutModel } from "project-editor/core/store";
import { ListNavigation } from "project-editor/components/ListNavigation";
import { ProjectContext } from "project-editor/project/context";
import { NavigationComponent } from "project-editor/project/NavigationComponent";
import { Page } from "project-editor/features/page/page";
import { Action } from "project-editor/features/action/action";
import { IEezObject } from "project-editor/core/object";

////////////////////////////////////////////////////////////////////////////////

@observer
export class ProjectVariablesNavigation extends NavigationComponent {
    static contextType = ProjectContext;
    declare context: React.ContextType<typeof ProjectContext>;

    get model() {
        return FlexLayout.Model.fromJson({
            global: LayoutModel.GLOBAL_OPTIONS,
            borders: [],
            layout: {
                type: "row",
                children: [
                    {
                        type: "tabset",
                        children: [
                            {
                                type: "tab",
                                enableClose: false,
                                name: "Local vars",
                                component: "locals"
                            },
                            {
                                type: "tab",
                                enableClose: false,
                                name: "Global vars",
                                component: "globals"
                            },
                            {
                                type: "tab",
                                enableClose: false,
                                name: "Structs",
                                component: "structs"
                            },
                            {
                                type: "tab",
                                enableClose: false,
                                name: "Enums",
                                component: "enums"
                            }
                        ]
                    }
                ]
            }
        });
    }

    factory = (node: FlexLayout.TabNode) => {
        var component = node.getComponent();

        if (component === "locals") {
            return <LocalVariables />;
        }

        if (component === "globals") {
            return (
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
            );
        }

        if (component === "structs") {
            return (
                <ListNavigation
                    id="structs"
                    navigationObject={this.context.project.variables.structures}
                    selectedObject={
                        this.context.navigationStore.selectedStructureObject
                    }
                />
            );
        }

        if (component === "enums") {
            return (
                <ListNavigation
                    id="enums"
                    navigationObject={this.context.project.variables.enums}
                    selectedObject={
                        this.context.navigationStore.selectedEnumObject
                    }
                />
            );
        }

        return null;
    };

    render() {
        return (
            <FlexLayout.Layout
                model={this.model}
                factory={this.factory}
                realtimeResize={true}
                font={LayoutModel.FONT_SUB}
            />
        );
    }
}

@observer
class LocalVariables extends React.Component {
    static contextType = ProjectContext;
    declare context: React.ContextType<typeof ProjectContext>;

    selectedObject = observable.box<IEezObject>();

    @computed get navigationObject() {
        const editor = this.context.editorsStore.activeEditor;
        if (editor) {
            const object = editor.object;
            if (
                object instanceof Page ||
                (object instanceof Action &&
                    object.implementationType == "flow")
            ) {
                return object.localVariables;
            }
        }

        return undefined;
    }

    render() {
        if (this.navigationObject) {
            return (
                <ListNavigation
                    id="local-variables"
                    navigationObject={this.navigationObject}
                    selectedObject={this.selectedObject}
                />
            );
        }

        return null;
    }
}
