import React from "react";
import { computed, makeObservable } from "mobx";
import { observer } from "mobx-react";
import { IEezObject, getParent } from "project-editor/core/object";
import { ListNavigation } from "project-editor/ui-components/ListNavigation";
import { ProjectContext } from "project-editor/project/context";
import { Font } from "./font";

////////////////////////////////////////////////////////////////////////////////

export const FontsTab = observer(
    class FontsTab extends React.Component {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        constructor(props: any) {
            super(props);

            makeObservable(this, {
                font: computed
            });
        }

        static getFont(object: IEezObject | undefined) {
            while (object) {
                if (object instanceof Font) {
                    return object;
                }
                object = getParent(object);
            }
            return undefined;
        }

        get font() {
            const navigationStore = this.context.navigationStore;

            if (navigationStore.selectedPanel) {
                const font = FontsTab.getFont(
                    navigationStore.selectedPanel.selectedObject
                );
                if (font) {
                    return font;
                }
            }

            const font = FontsTab.getFont(
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
                    id={"fonts"}
                    navigationObject={this.context.project.fonts}
                    selectedObject={
                        this.context.navigationStore.selectedFontObject
                    }
                />
            );
        }
    }
);
