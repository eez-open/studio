import React from "react";
import { computed } from "mobx";
import { observer } from "mobx-react";
import { ProjectContext } from "project-editor/project/context";
import { ListNavigation } from "project-editor/components/ListNavigation";
import { TreeAdapter } from "project-editor/core/objectAdapter";
import { NavigationComponent } from "project-editor/project/NavigationComponent";
import { ActionFlowTabState } from "./ActionEditor";

////////////////////////////////////////////////////////////////////////////////

@observer
export class ActionsNavigation extends NavigationComponent {
    static contextType = ProjectContext;
    declare context: React.ContextType<typeof ProjectContext>;

    @computed
    get flowContainerDisplayItem() {
        if (!this.context.editorsStore.activeEditor) {
            return undefined;
        }
        let flowTabState = this.context.editorsStore.activeEditor
            .state as ActionFlowTabState;
        if (!flowTabState) {
            return undefined;
        }
        return flowTabState.widgetContainer;
    }

    @computed
    get treeAdapter() {
        if (!this.flowContainerDisplayItem) {
            return null;
        }
        return new TreeAdapter(
            this.flowContainerDisplayItem,
            undefined,
            undefined,
            true
        );
    }

    // interface IPanel implementation
    get selectedObject() {
        return this.selectedObjects[0];
    }
    get selectedObjects() {
        const selectedObjects =
            this.flowContainerDisplayItem &&
            this.flowContainerDisplayItem.selectedObjects;
        if (selectedObjects && selectedObjects.length > 0) {
            return selectedObjects;
        }

        if (this.context.editorsStore.activeEditor) {
            let flowTabState = this.context.editorsStore.activeEditor
                .state as ActionFlowTabState;
            if (flowTabState) {
                return [flowTabState.flow];
            }
        }

        return [];
    }
    cutSelection() {
        this.treeAdapter!.cutSelection();
    }
    copySelection() {
        this.treeAdapter!.copySelection();
    }
    pasteSelection() {
        this.treeAdapter!.pasteSelection();
    }
    deleteSelection() {
        this.treeAdapter!.deleteSelection();
    }
    onFocus = () => {
        this.context.navigationStore.setSelectedPanel(this);
    };

    render() {
        return (
            <div onFocus={this.onFocus} tabIndex={0} style={{ height: "100%" }}>
                <ListNavigation
                    id={this.props.id}
                    navigationObject={this.props.navigationObject}
                    selectedObject={
                        this.context.navigationStore.selectedActionObject
                    }
                    editable={!this.context.runtime}
                    onDoubleClickItem={this.props.onDoubleClickItem}
                />
            </div>
        );
    }
}
