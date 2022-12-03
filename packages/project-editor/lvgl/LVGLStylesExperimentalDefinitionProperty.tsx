import React from "react";
import { observer } from "mobx-react";

import { IEezObject, PropertyProps } from "project-editor/core/object";
import { ProjectContext } from "project-editor/project/context";

import { BootstrapButton } from "project-editor/ui-components/BootstrapButton";
import { Dialog, showDialog } from "eez-studio-ui/dialog";
import { getProjectEditorStore } from "project-editor/store";
import {
    LVGLPropertyInfo,
    lvglProperties,
    LVGLPropertiesGroup
} from "project-editor/lvgl/style-catalog";
import { SearchInput } from "eez-studio-ui/search-input";
import { makeObservable, observable } from "mobx";
import { IListNode, List, ListContainer, ListItem } from "eez-studio-ui/list";

////////////////////////////////////////////////////////////////////////////////

export const LVGLStylesExperimentalDefinitionProperty = observer(
    class LVGLStylesExperimentalDefinitionProperty extends React.Component<PropertyProps> {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        showProperties = () => {
            selectLVGLStyleProperty(this.props.objects[0]);
        };

        render() {
            return (
                <BootstrapButton
                    color="primary"
                    size="small"
                    onClick={this.showProperties}
                >
                    Show Properties
                </BootstrapButton>
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

async function selectLVGLStyleProperty(object: IEezObject) {
    let disposed = false;

    return new Promise<LVGLPropertyInfo>((resolve, reject) => {
        const onDispose = () => {
            if (!disposed) {
                if (modalDialog) {
                    modalDialog.close();
                }
                disposed = true;
            }
        };

        const onOk = (value: LVGLPropertyInfo) => {
            resolve(value);
            onDispose();
        };

        const [modalDialog] = showDialog(
            <ProjectContext.Provider value={getProjectEditorStore(object)}>
                <LVGLStylePropertiesDialog onOk={onOk} onCancel={onDispose} />
            </ProjectContext.Provider>,
            {
                jsPanel: {
                    title: "Select LVGL style property",
                    width: 600,
                    height: 800
                }
            }
        );
    });
}

////////////////////////////////////////////////////////////////////////////////

const LVGLStylePropertiesDialog = observer(
    class LVGLStylePropertiesDialog extends React.Component<{
        onOk: (value: LVGLPropertyInfo) => void;
        onCancel: () => void;
    }> {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        searchText: string = "";

        constructor(props: any) {
            super(props);

            makeObservable(this, {
                searchText: observable
            });
        }

        get nodes() {
            const nodes: IListNode<LVGLPropertiesGroup | LVGLPropertyInfo>[] =
                [];

            lvglProperties.forEach(propertyGroup => {
                nodes.push({
                    id: propertyGroup.groupName,
                    label: `${propertyGroup.groupName}: ${propertyGroup.groupDescription}`,
                    data: propertyGroup,
                    selected: false
                });

                propertyGroup.properties.forEach(property => {
                    nodes.push({
                        id: property.name,
                        label: `${property.displayName}: ${property.lvglStyleProp.description}`,
                        data: property,
                        selected: false
                    });
                });
            });

            return nodes;
        }

        onSearchChange = (event: any) => {
            this.searchText = ($(event.target).val() as string).trim();
        };

        onOkEnabled = () => {
            return true;
        };

        onOk = () => {
            this.props.onCancel();
            return true;
        };

        onDoubleClick = () => {
            this.onOk();
        };

        render() {
            return (
                <Dialog
                    modal={false}
                    okButtonText="Ok"
                    okEnabled={this.onOkEnabled}
                    onOk={this.onOk}
                    onCancel={this.props.onCancel}
                >
                    <div className="EezStudio_LVGLStylePropertiesDialog">
                        <SearchInput
                            searchText={this.searchText}
                            onChange={this.onSearchChange}
                            onKeyDown={this.onSearchChange}
                        />
                        <ListContainer tabIndex={0}>
                            <List
                                nodes={this.nodes}
                                renderNode={(
                                    node: IListNode<
                                        LVGLPropertiesGroup | LVGLPropertyInfo
                                    >
                                ) => {
                                    return <ListItem label={node.label} />;
                                }}
                                selectNode={(
                                    node: IListNode<
                                        LVGLPropertiesGroup | LVGLPropertyInfo
                                    >
                                ) => {}}
                            ></List>
                        </ListContainer>
                    </div>
                </Dialog>
            );
        }
    }
);
