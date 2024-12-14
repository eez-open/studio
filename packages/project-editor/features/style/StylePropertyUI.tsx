import React from "react";
import { observer } from "mobx-react";
import classNames from "classnames";

import { ITreeNode, Tree } from "eez-studio-ui/tree";

import {
    IEezObject,
    PropertyInfo,
    PropertyProps,
    PropertyType,
    getObjectPropertyDisplayName
} from "project-editor/core/object";
import { getCommonProperties, getNumModifications } from "project-editor/store";
import { ProjectEditor } from "project-editor/project-editor-interface";
import { ProjectContext } from "project-editor/project/context";
import { computed, makeObservable, runInAction } from "mobx";
import { PropertyGrid } from "project-editor/ui-components/PropertyGrid";
import { isPropertyInError } from "project-editor/ui-components/PropertyGrid/utils";

export const StylePropertyUI = observer(
    class StylePropertyUI extends React.Component<PropertyProps> {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        constructor(props: any) {
            super(props);

            makeObservable(this, {
                styleProperties: computed,
                selectedStyleProperty: computed
            });
        }

        get styleProperties() {
            return getCommonProperties(this.props.objects, true).filter(
                propertyInfo =>
                    propertyInfo.type == PropertyType.Object &&
                    propertyInfo.typeClass == ProjectEditor.StyleClass
            );
        }

        get selectedStyleProperty() {
            const styleProperty = this.styleProperties.find(
                styleProperty =>
                    styleProperty.name ==
                    this.context.uiStateStore.selectedStylePropertyName
            );

            if (styleProperty) {
                return styleProperty;
            }

            return this.styleProperties[0];
        }

        render() {
            if (!this.selectedStyleProperty) {
                return null;
            }
            return (
                <div className="EezStudio_StylesDefinition">
                    <div>
                        <StylesDefinitionTree
                            styleProperties={this.styleProperties}
                            selectedStylePropertyName={
                                this.selectedStyleProperty.name
                            }
                            {...this.props}
                        />
                    </div>
                    <div>
                        {this.selectedStyleProperty && (
                            <PropertyGrid
                                objects={this.props.objects.map(
                                    object =>
                                        (object as any)[
                                            this.selectedStyleProperty.name
                                        ]
                                )}
                            />
                        )}
                    </div>
                </div>
            );
        }
    }
);

export const StylesDefinitionTree = observer(
    class StylesDefinitionTree extends React.Component<
        {
            styleProperties: PropertyInfo[];
            selectedStylePropertyName: string;
        } & PropertyProps
    > {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        getStyleObjects(styleProperty: PropertyInfo): IEezObject[] {
            return this.props.objects.map(
                object => (object as any)[styleProperty.name]
            );
        }

        getNumModifications(styleProperty: PropertyInfo) {
            return getNumModifications({
                ...this.props,
                objects: this.getStyleObjects(styleProperty)
            });
        }

        isPropertyInError(styleProperty: PropertyInfo) {
            const objects = this.getStyleObjects(styleProperty);
            const properties = getCommonProperties(objects);

            return properties.find(propertyInfo =>
                isPropertyInError(objects[0], propertyInfo)
            );
        }

        get rootNode(): ITreeNode {
            return {
                id: "root",
                label: "Root",
                children:
                    this.props.styleProperties.map(styleProperty => {
                        const numModifications =
                            this.getNumModifications(styleProperty);

                        let label = getObjectPropertyDisplayName(
                            this.props.objects[0],
                            styleProperty
                        );

                        if (label.endsWith(" style")) {
                            label = label.substring(
                                0,
                                label.length - " style".length
                            );
                        }

                        return {
                            id: styleProperty.name,
                            label: (
                                <span
                                    className={classNames(
                                        "EezStudio_Style_PropertyLabel",
                                        {
                                            inError:
                                                this.isPropertyInError(
                                                    styleProperty
                                                )
                                        }
                                    )}
                                >
                                    {numModifications == 0
                                        ? label
                                        : `${label} (${numModifications})`}
                                </span>
                            ),
                            children: [],
                            selected:
                                this.props.selectedStylePropertyName ==
                                styleProperty.name,
                            expanded: true,
                            className: classNames("style-property-name", {
                                modified: numModifications > 0
                            })
                        };
                    }) ?? [],
                selected: false,
                expanded: true
            };
        }

        selectNode = (node: ITreeNode) => {
            runInAction(() => {
                this.context.uiStateStore.selectedStylePropertyName = node.id;
            });
        };

        render() {
            return (
                <Tree
                    showOnlyChildren={true}
                    rootNode={this.rootNode}
                    selectNode={this.selectNode}
                    collapsable={true}
                    rowPadding={5}
                ></Tree>
            );
        }
    }
);
