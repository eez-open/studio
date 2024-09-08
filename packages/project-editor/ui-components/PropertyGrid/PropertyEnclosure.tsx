import React from "react";
import classNames from "classnames";
import { observer } from "mobx-react";

import { IEezObject, PropertyInfo } from "project-editor/core/object";

import { isHighlightedProperty, isPropertyInError } from "./utils";
import { PropertyMenu } from "./PropertyMenu";

export const PropertyEnclosure = observer(
    class PropertyEnclosure extends React.Component<{
        objects: IEezObject[];
        propertyInfo: PropertyInfo;
        highlightedPropertyName?: string;
        property: JSX.Element;
        isPropertyMenuSupported?: boolean;
        propertyMenuEnabled?: boolean;
        readOnly: boolean;
        updateObject: (propertyValues: Object) => void;
        style?: React.CSSProperties;
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

            if (propertyInfo.propertyGridFullRowComponent) {
                return property;
            }

            return (
                <tr className={className} style={this.props.style}>
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
);
