import React from "react";
import classNames from "classnames";

import { IEezObject, PropertyInfo } from "project-editor/core/object";

import { isHighlightedProperty, isPropertyInError } from "./utils";
import { PropertyMenu } from "./PropertyMenu";

export class PropertyEnclosure extends React.Component<{
    objects: IEezObject[];
    propertyInfo: PropertyInfo;
    highlightedPropertyName?: string;
    property: JSX.Element;
    isPropertyMenuSupported?: boolean;
    propertyMenuEnabled?: boolean;
    readOnly: boolean;
    updateObject: (propertyValues: Object) => void;
}> {
    render() {
        const {
            objects,
            propertyInfo,
            highlightedPropertyName,
            property,
            isPropertyMenuSupported,
            propertyMenuEnabled,
            readOnly,
            updateObject
        } = this.props;

        const className = classNames({
            inError:
                objects.length === 1 &&
                isPropertyInError(objects[0], propertyInfo),
            highlighted:
                propertyInfo.name == highlightedPropertyName ||
                isHighlightedProperty(objects[0], propertyInfo)
        });

        return (
            <tr className={className}>
                {property}
                {isPropertyMenuSupported &&
                    !propertyInfo.propertyGridCollapsable && (
                        <td>
                            {propertyMenuEnabled && (
                                <PropertyMenu
                                    propertyInfo={propertyInfo}
                                    objects={objects}
                                    updateObject={updateObject}
                                    readOnly={readOnly}
                                />
                            )}
                        </td>
                    )}
            </tr>
        );
    }
}
