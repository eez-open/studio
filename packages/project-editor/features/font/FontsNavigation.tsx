import React from "react";
import { computed } from "mobx";
import { observer } from "mobx-react";
import { IEezObject, getParent } from "project-editor/core/object";
import { ListNavigation } from "project-editor/components/ListNavigation";
import { ProjectContext } from "project-editor/project/context";
import { NavigationComponent } from "project-editor/project/NavigationComponent";
import { Font } from "./font";

////////////////////////////////////////////////////////////////////////////////

@observer
export class FontsNavigation extends NavigationComponent {
    static contextType = ProjectContext;
    declare context: React.ContextType<typeof ProjectContext>;

    static getFont(object: IEezObject | undefined) {
        while (object) {
            if (object instanceof Font) {
                return object;
            }
            object = getParent(object);
        }
        return undefined;
    }

    @computed
    get font() {
        const navigationStore = this.context.navigationStore;

        if (navigationStore.selectedPanel) {
            const font = FontsNavigation.getFont(
                navigationStore.selectedPanel.selectedObject
            );
            if (font) {
                return font;
            }
        }

        const font = FontsNavigation.getFont(
            navigationStore.selectedFontObject.get()
        );
        if (font) {
            return font;
        }

        return undefined;
    }

    render() {
        return (
            <ListNavigation
                id={this.props.id}
                navigationObject={this.props.navigationObject}
                selectedObject={this.context.navigationStore.selectedFontObject}
            />
        );
    }
}
