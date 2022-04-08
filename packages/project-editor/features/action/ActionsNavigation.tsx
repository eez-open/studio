import React from "react";
import { observer } from "mobx-react";
import * as FlexLayout from "flexlayout-react";

import { ProjectContext } from "project-editor/project/context";
import { ListNavigation } from "project-editor/components/ListNavigation";
import { NavigationComponent } from "project-editor/project/NavigationComponent";
import { LocalVariables } from "../variable/VariablesNavigation";
import { LayoutModels } from "project-editor/store";

export const ActionsNavigation = observer(
    class ActionsNavigation extends NavigationComponent {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        factory = (node: FlexLayout.TabNode) => {
            var component = node.getComponent();

            if (component === "actions") {
                return (
                    <ListNavigation
                        id={this.props.id}
                        navigationObject={this.props.navigationObject}
                        selectedObject={
                            this.context.navigationStore.selectedActionObject
                        }
                        editable={!this.context.runtime}
                        onDoubleClickItem={this.props.onDoubleClickItem}
                    />
                );
            }

            if (component === "local-vars") {
                return <LocalVariables />;
            }

            return null;
        };

        render() {
            return (
                <FlexLayout.Layout
                    model={this.context.layoutModels.actions}
                    factory={this.factory}
                    realtimeResize={true}
                    font={LayoutModels.FONT_SUB}
                />
            );
        }
    }
);
