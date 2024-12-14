import React from "react";
import classNames from "classnames";
import { observer } from "mobx-react";

import { IEezObject, PropertyInfo } from "project-editor/core/object";

import { isHighlightedProperty, isPropertyInError } from "./utils";

export const PropertyEnclosure = observer(
    class PropertyEnclosure extends React.Component<{
        objects: IEezObject[];
        propertyInfo: PropertyInfo;
        highlightedPropertyName?: string;
        property: JSX.Element;
        style?: React.CSSProperties;
    }> {
        render() {
            const { objects, propertyInfo, highlightedPropertyName, property } =
                this.props;

            const className = classNames("EezStudio_PropertyGrid_Property", {
                inError:
                    objects.length === 1 &&
                    isPropertyInError(objects[0], propertyInfo),
                highlighted:
                    propertyInfo.name == highlightedPropertyName ||
                    isHighlightedProperty(objects[0], propertyInfo)
            });

            if (propertyInfo.propertyGridFullRowComponent) {
                return property;
            }

            return (
                <div className={className} style={this.props.style}>
                    {property}
                </div>
            );
        }
    }
);
