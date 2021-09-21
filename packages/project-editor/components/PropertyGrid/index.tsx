import React from "react";
import { observer } from "mobx-react";
import { bind } from "bind-decorator";
import classNames from "classnames";

import {
    IEezObject,
    PropertyType,
    isValue,
    getCommonProperties,
    IPropertyGridGroupDefinition,
    getParent,
    getKey,
    getClassInfo,
    isAnyPropertyReadOnly
} from "project-editor/core/object";

import { isAnyObjectReadOnly } from "project-editor/project/project";

import { ProjectContext } from "project-editor/project/context";
import { scrollIntoViewIfNeeded } from "eez-studio-shared/dom";
import { Property } from "./Property";
import { PropertyName } from "./PropertyName";
import { propertyCollapsedStore } from "./PropertyCollapsedStore";
import { groupCollapsedStore } from "./GroupCollapsedStore";
import { PropertyEnclosure } from "./PropertyEnclosure";
import { GroupTitle } from "./GroupTitle";

////////////////////////////////////////////////////////////////////////////////

@observer
export class PropertyGrid extends React.Component<{
    objects: IEezObject[];
    className?: string;
    readOnly?: boolean;
}> {
    static contextType = ProjectContext;
    declare context: React.ContextType<typeof ProjectContext>;

    div: HTMLDivElement | null;
    lastObject: IEezObject | undefined;

    get objects() {
        return this.props.objects.filter(object => !!object);
    }

    ensureHighlightedVisible() {
        if (this.div) {
            const object =
                this.objects.length === 1 ? this.objects[0] : undefined;
            if (this.lastObject !== object) {
                const $highlighted = $(this.div).find(".highlighted");
                if ($highlighted[0]) {
                    scrollIntoViewIfNeeded($highlighted[0]);
                }
                this.lastObject = object;
            }
        }
    }

    componentDidMount() {
        this.ensureHighlightedVisible();
    }

    componentDidUpdate() {
        this.ensureHighlightedVisible();
    }

    @bind
    updateObject(propertyValues: Object) {
        const wasCombineCommands = this.context.undoManager.combineCommands;
        if (!wasCombineCommands) {
            this.context.undoManager.setCombineCommands(true);
        }

        this.objects.forEach(object => {
            if (isValue(object)) {
                object = getParent(object);
            }
            this.context.updateObject(object, propertyValues);
        });

        if (!wasCombineCommands) {
            this.context.undoManager.setCombineCommands(false);
        }
    }

    render() {
        let objects = this.objects;

        if (objects.length === 0) {
            return null;
        }

        const readOnly = this.props.readOnly || isAnyObjectReadOnly(objects);

        let highlightedPropertyName: string | undefined;
        if (objects.length === 1) {
            let object;
            if (isValue(objects[0])) {
                // if given object is actually a value, we show the parent properties with the value highlighted
                highlightedPropertyName = getKey(objects[0]);
                object = getParent(objects[0]);
            } else {
                object = objects[0];
            }
            objects = [object];
        }

        //let properties: JSX.Element[] = [];

        interface IGroupProperties {
            group: IPropertyGridGroupDefinition;
            properties: React.ReactNode[];
        }

        const groupPropertiesArray: IGroupProperties[] = [];

        let groupForPropertiesWithoutGroupSpecified:
            | IGroupProperties
            | undefined;

        const isPropertyMenuSupported = !objects.find(
            object => !getClassInfo(object).isPropertyMenuSupported
        );

        let properties = getCommonProperties(objects);

        for (let propertyInfo of properties) {
            const colSpan =
                propertyInfo.type === PropertyType.Boolean ||
                (propertyInfo.type === PropertyType.Any &&
                    !propertyInfo.propertyGridColumnComponent) ||
                (propertyInfo.propertyGridCollapsable &&
                    (!propertyCollapsedStore.isCollapsed(
                        objects[0],
                        propertyInfo
                    ) ||
                        !propertyInfo.propertyGridCollapsableDefaultPropertyName)) ||
                propertyInfo.type === PropertyType.Array;

            const propertyReadOnly = isAnyPropertyReadOnly(
                objects,
                propertyInfo
            );

            const propertyProps = {
                propertyInfo,
                objects,
                updateObject: this.updateObject,
                readOnly: readOnly || propertyReadOnly
            };

            let propertyMenuEnabled =
                !readOnly &&
                (propertyInfo.inheritable ||
                    (propertyInfo.propertyMenu &&
                        propertyInfo.propertyMenu(propertyProps).length > 0));

            let property;
            if (colSpan) {
                property = (
                    <td
                        className={classNames({
                            "embedded-property-cell":
                                propertyInfo.type === PropertyType.Object
                        })}
                        colSpan={propertyInfo.propertyGridCollapsable ? 3 : 2}
                        style={
                            propertyInfo.type === PropertyType.Array
                                ? {
                                      width: "100%"
                                  }
                                : undefined
                        }
                    >
                        <Property {...propertyProps} />
                    </td>
                );
            } else {
                property = (
                    <React.Fragment>
                        <td className="property-name">
                            <PropertyName {...propertyProps} />
                        </td>

                        <td>
                            <Property {...propertyProps} />
                        </td>
                    </React.Fragment>
                );
            }

            const propertyComponent = (
                <PropertyEnclosure
                    key={propertyInfo.name}
                    objects={objects}
                    propertyInfo={propertyInfo}
                    highlightedPropertyName={highlightedPropertyName}
                    property={property}
                    isPropertyMenuSupported={isPropertyMenuSupported}
                    propertyMenuEnabled={propertyMenuEnabled}
                    readOnly={propertyProps.readOnly}
                    updateObject={this.updateObject}
                />
            );

            const propertyGroup = propertyInfo.propertyGridGroup;
            if (propertyGroup) {
                let groupProperties = groupPropertiesArray.find(
                    groupProperties =>
                        groupProperties.group.id === propertyGroup.id
                );

                if (!groupProperties) {
                    groupProperties = {
                        group: propertyGroup,
                        properties: []
                    };
                    groupPropertiesArray.push(groupProperties);
                }

                groupProperties.properties.push(propertyComponent);
            } else {
                if (!groupForPropertiesWithoutGroupSpecified) {
                    groupForPropertiesWithoutGroupSpecified = {
                        group: {
                            id: "",
                            title: ""
                        },
                        properties: []
                    };
                    groupPropertiesArray.push(
                        groupForPropertiesWithoutGroupSpecified
                    );
                }
                groupForPropertiesWithoutGroupSpecified.properties.push(
                    propertyComponent
                );
            }
        }

        let maxPosition = 0;

        groupPropertiesArray.forEach(groupProperties => {
            if (
                groupProperties.group.position != undefined &&
                groupProperties.group.position > maxPosition
            ) {
                maxPosition = groupProperties.group.position;
            }
        });

        groupPropertiesArray.sort(
            (a: IGroupProperties, b: IGroupProperties) => {
                const aPosition =
                    a.group.position !== undefined
                        ? a.group.position
                        : maxPosition + 1;
                const bPosition =
                    b.group.position !== undefined
                        ? b.group.position
                        : maxPosition + 1;
                return aPosition - bPosition;
            }
        );

        const rows = groupPropertiesArray.map(groupProperties => {
            if (groupProperties.group.title) {
                return (
                    <React.Fragment key={groupProperties.group.id}>
                        <GroupTitle
                            group={groupProperties.group}
                            object={objects[0]}
                        />
                        {!groupCollapsedStore.isCollapsed(
                            groupProperties.group
                        ) && groupProperties.properties}
                    </React.Fragment>
                );
            } else {
                return (
                    <React.Fragment key={groupProperties.group.id}>
                        {groupProperties.properties}
                    </React.Fragment>
                );
            }
        });

        return (
            <div
                ref={(ref: any) => (this.div = ref)}
                className={classNames(
                    "EezStudio_PropertyGrid",
                    this.props.className
                )}
            >
                <table>
                    <tbody>{rows}</tbody>
                </table>
            </div>
        );
    }
}
