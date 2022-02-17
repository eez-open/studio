import React from "react";
import { observable, makeObservable } from "mobx";
import { observer } from "mobx-react";

import { Icon } from "eez-studio-ui/icon";

import {
    PropertyProps,
    getObjectPropertyDisplayName
} from "project-editor/core/object";
import { isAnyPropertyModified } from "project-editor/core/store";

import { propertyCollapsedStore } from "./PropertyCollapsedStore";

////////////////////////////////////////////////////////////////////////////////

export const PropertyName = observer(
    class PropertyName extends React.Component<PropertyProps> {
        collapsed = true;

        toggleCollapsed = () => {
            propertyCollapsedStore.toggleColapsed(
                this.props.objects[0],
                this.props.propertyInfo
            );
        };

        constructor(props: PropertyProps) {
            super(props);

            makeObservable(this, {
                collapsed: observable
            });
        }

        render() {
            const { objects, propertyInfo } = this.props;

            if (propertyInfo.propertyGridCollapsable) {
                const enabled =
                    !propertyInfo.propertyGridCollapsableEnabled ||
                    propertyInfo.propertyGridCollapsableEnabled(objects[0]);
                const collapsed = propertyCollapsedStore.isCollapsed(
                    objects[0],
                    propertyInfo
                );

                return (
                    <div className="collapsable" onClick={this.toggleCollapsed}>
                        {enabled && (
                            <Icon
                                icon={
                                    collapsed
                                        ? "material:keyboard_arrow_right"
                                        : "material:keyboard_arrow_down"
                                }
                                size={18}
                                className="triangle"
                            />
                        )}
                        {getObjectPropertyDisplayName(objects[0], propertyInfo)}
                        {isAnyPropertyModified({
                            ...this.props,
                            objects: objects.map(
                                object => (object as any)[propertyInfo.name]
                            )
                        }) && " ●"}
                    </div>
                );
            } else {
                return getObjectPropertyDisplayName(objects[0], propertyInfo);
            }
        }
    }
);
