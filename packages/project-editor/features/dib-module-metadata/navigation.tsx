import React from "react";
import { observer } from "mobx-react";

import { ProjectContext } from "project-editor/project/context";
import { EditorComponent } from "project-editor/project/ui/EditorComponent";
import { IPanel } from "project-editor/store";
import { PropertyGrid } from "project-editor/ui-components/PropertyGrid";

export const DibModuleMetadataEditor = observer(
    class DibModuleMetadataEditor
        extends EditorComponent
        implements IPanel
    {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        divRef = React.createRef<HTMLDivElement>();

        componentDidMount() {
            if (this.divRef.current) {
                this.divRef.current.focus();
            }

            this.context.navigationStore.mountPanel(this);
        }

        componentWillUnmount() {
            this.context.navigationStore.unmountPanel(this);
        }

        // interface IPanel implementation
        get selectedObject() {
            return undefined;
        }
        onFocus = () => {
            this.context.navigationStore.setSelectedPanel(this);
        };

        render() {
            return (
                <div
                    ref={this.divRef}
                    className="EezStudio_DibModuleMetadata_Container"
                    onFocus={this.onFocus}
                    tabIndex={0}
                    style={{ overflow: "auto", height: "100%", padding: 10 }}
                >
                    <PropertyGrid
                        objects={[this.context.project.dibModuleMetadata]}
                    />
                </div>
            );
        }
    }
);
