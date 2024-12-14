import React from "react";
import { observable, makeObservable } from "mobx";
import { observer } from "mobx-react";

import { Icon } from "eez-studio-ui/icon";

import {
    findPropertyByNameInClassInfo,
    PropertyProps,
    getObjectPropertyDisplayName
} from "project-editor/core/object";

import { ProjectContext } from "project-editor/project/context";

import { Property } from "./Property";
import { PropertyGrid } from "./index";
import { propertyCollapsedStore } from "./PropertyCollapsedStore";
import { getNumModifications } from "project-editor/store";
import classNames from "classnames";

export const EmbeddedPropertyGrid = observer(
    class EmbeddedPropertyGrid extends React.Component<PropertyProps> {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        collapsed = true;

        toggleCollapsed = () => {
            propertyCollapsedStore.toggleColapsed(
                this.props.objects[0],
                this.props.propertyInfo
            );
        };

        updateObject = (propertyValues: Object) => {
            this.context.undoManager.setCombineCommands(true);
            this.props.objects.forEach(object => {
                object = (object as any)[this.props.propertyInfo.name];
                this.context.updateObject(object, propertyValues);
            });
            this.context.undoManager.setCombineCommands(false);
        };

        constructor(props: PropertyProps) {
            super(props);

            makeObservable(this, {
                collapsed: observable
            });
        }

        render() {
            const { objects, propertyInfo } = this.props;

            if (!propertyInfo.propertyGridCollapsable) {
                return (
                    <div className="EezStudio_EmbeddedNonCollapsablePropertyGrid">
                        <PropertyGrid
                            objects={this.props.objects.map(
                                object => (object as any)[propertyInfo.name]
                            )}
                        />
                    </div>
                );
            }

            const collapsed = propertyCollapsedStore.isCollapsed(
                this.props.objects[0],
                this.props.propertyInfo
            );
            if (collapsed) {
                if (propertyInfo.propertyGridCollapsableDefaultPropertyName) {
                    const defaultPropertyInfo = findPropertyByNameInClassInfo(
                        propertyInfo.typeClass!.classInfo,
                        propertyInfo.propertyGridCollapsableDefaultPropertyName
                    )!;
                    return (
                        <Property
                            propertyInfo={defaultPropertyInfo}
                            objects={this.props.objects.map(
                                object => (object as any)[propertyInfo.name]
                            )}
                            updateObject={this.updateObject}
                            readOnly={this.props.readOnly}
                        />
                    );
                } else {
                    return (
                        <div className="collapsable collapsed EezStudio_EmbeddedPropertyGrid">
                            <div onClick={this.toggleCollapsed}>
                                <Icon
                                    icon={
                                        collapsed
                                            ? "material:keyboard_arrow_right"
                                            : "material:keyboard_arrow_down"
                                    }
                                    size={18}
                                    className="triangle"
                                />
                                {getObjectPropertyDisplayName(
                                    objects[0],
                                    propertyInfo
                                )}
                            </div>
                        </div>
                    );
                }
            }

            const numModifications = getNumModifications({
                ...this.props,
                objects: objects.map(
                    object => (object as any)[propertyInfo.name]
                )
            });

            return (
                <div className="collapsable">
                    <div
                        className="collapsable-property-name"
                        onClick={this.toggleCollapsed}
                    >
                        <div
                            className={classNames({
                                "fw-bold": numModifications > 0
                            })}
                        >
                            <Icon
                                icon="material:keyboard_arrow_down"
                                size={18}
                                className="triangle"
                            />
                            {getObjectPropertyDisplayName(
                                objects[0],
                                propertyInfo
                            )}
                            {numModifications > 0 && ` (${numModifications})`}
                        </div>
                    </div>
                    <PropertyGrid
                        objects={this.props.objects.map(
                            object => (object as any)[propertyInfo.name]
                        )}
                    />
                </div>
            );
        }
    }
);
