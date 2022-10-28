import React from "react";
import { observer } from "mobx-react";
import classNames from "classnames";

import { scrollIntoViewIfNeeded } from "eez-studio-shared/dom";

import {
    IEezObject,
    PropertyType,
    IPropertyGridGroupDefinition,
    getParent,
    getKey,
    isAnyPropertyReadOnly
} from "project-editor/core/object";
import {
    isValue,
    getCommonProperties,
    getClassInfo
} from "project-editor/store";

import { isAnyObjectReadOnly } from "project-editor/project/project";

import { ProjectContext } from "project-editor/project/context";

import { Property } from "./Property";
import { PropertyName } from "./PropertyName";
import { propertyCollapsedStore } from "./PropertyCollapsedStore";
import { groupCollapsedStore } from "./GroupCollapsedStore";
import { PropertyEnclosure } from "./PropertyEnclosure";
import { GroupTitle } from "./GroupTitle";
import { ProjectEditor } from "project-editor/project-editor-interface";

////////////////////////////////////////////////////////////////////////////////

export const PropertyGrid = observer(
    class PropertyGrid extends React.Component<{
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

        updateObject = (propertyValues: Object) => {
            const wasCombineCommands = this.context.undoManager.combineCommands;
            if (!wasCombineCommands) {
                this.context.undoManager.setCombineCommands(true);
            }

            if (
                this.objects.length == 1 &&
                (propertyValues as any).projectVersion != undefined
            ) {
                const project = ProjectEditor.getProject(this.objects[0]);
                if (project.settings.general == this.objects[0]) {
                    ProjectEditor.migrateProjectVersion(
                        project,
                        (propertyValues as any).projectVersion
                    );
                }
            }

            if (
                this.objects.length == 1 &&
                ((propertyValues as any).projectType != undefined ||
                    (propertyValues as any).flowSupport != undefined)
            ) {
                const project = ProjectEditor.getProject(this.objects[0]);
                if (project.settings.general == this.objects[0]) {
                    ProjectEditor.migrateProjectType(
                        project,
                        (propertyValues as any).projectType,
                        (propertyValues as any).flowSupport
                    );
                }
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
        };

        render() {
            let objects = this.objects;

            if (objects.length === 0) {
                return null;
            }

            const readOnly =
                this.props.readOnly || isAnyObjectReadOnly(objects);

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
                    (propertyInfo.type === PropertyType.Boolean &&
                        !propertyInfo.checkboxStyleSwitch) ||
                    (propertyInfo.type === PropertyType.Any &&
                        !propertyInfo.propertyGridColumnComponent) ||
                    (propertyInfo.propertyGridCollapsable &&
                        (!propertyCollapsedStore.isCollapsed(
                            objects[0],
                            propertyInfo
                        ) ||
                            !propertyInfo.propertyGridCollapsableDefaultPropertyName)) ||
                    propertyInfo.type === PropertyType.Array ||
                    propertyInfo.propertyGridRowComponent;

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

                let propertyMenuEnabled;

                if (
                    !readOnly &&
                    (propertyInfo.inheritable ||
                        (propertyInfo.propertyMenu &&
                            propertyInfo.propertyMenu(propertyProps).length >
                                0))
                ) {
                    propertyMenuEnabled = true;
                } else {
                    propertyMenuEnabled = false;
                }

                let property;
                if (colSpan) {
                    property = (
                        <td
                            className={classNames({
                                "embedded-property-cell":
                                    propertyInfo.type === PropertyType.Object
                            })}
                            colSpan={
                                propertyInfo.propertyGridCollapsable ? 3 : 2
                            }
                            style={
                                propertyInfo.type === PropertyType.Array ||
                                propertyInfo.type === PropertyType.Any
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

                const propertyGroup = propertyInfo.propertyGridGroup;

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
                        style={{
                            visibility:
                                propertyGroup &&
                                groupCollapsedStore.isCollapsed(propertyGroup)
                                    ? "collapse"
                                    : "visible"
                        }}
                    />
                );

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
                if (groupProperties.group.position != undefined) {
                    let position;
                    if (typeof groupProperties.group.position == "number") {
                        position = groupProperties.group.position;
                    } else {
                        position = groupProperties.group.position(objects[0]);
                    }
                    if (position > maxPosition) {
                        maxPosition = position;
                    }
                }
            });

            groupPropertiesArray.sort(
                (a: IGroupProperties, b: IGroupProperties) => {
                    const aPosition =
                        a.group.position !== undefined
                            ? typeof a.group.position == "number"
                                ? a.group.position
                                : a.group.position(objects[0])
                            : maxPosition + 1;

                    const bPosition =
                        b.group.position !== undefined
                            ? typeof b.group.position == "number"
                                ? b.group.position
                                : b.group.position(objects[0])
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
                            {groupProperties.properties}
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
);
