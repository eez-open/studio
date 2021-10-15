import React from "react";
import { observable } from "mobx";
import { observer } from "mobx-react";
import { bind } from "bind-decorator";
import { Icon } from "eez-studio-ui/icon";
import {
    PropertyProps,
    getObjectPropertyDisplayName
} from "project-editor/core/object";
import { propertyCollapsedStore } from "./PropertyCollapsedStore";
import { isAnyPropertyModified } from "project-editor/core/store";

////////////////////////////////////////////////////////////////////////////////

@observer
export class PropertyName extends React.Component<PropertyProps> {
    @observable collapsed = true;

    @bind
    toggleCollapsed() {
        propertyCollapsedStore.toggleColapsed(
            this.props.objects[0],
            this.props.propertyInfo
        );
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
