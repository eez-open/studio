import React from "react";
import { observer } from "mobx-react";
import classNames from "classnames";

import { scrollIntoViewIfNeeded } from "eez-studio-shared/dom";

import { Icon } from "eez-studio-ui/icon";

import {
    IEezObject,
    PropertyType,
    getParent,
    getKey,
    isAnyPropertyReadOnly,
    PropertyInfo,
    IPropertyGridGroupDefinition
} from "project-editor/core/object";
import {
    isValue,
    getCommonProperties,
    getClassInfo
} from "project-editor/store";

import { isAnyObjectReadOnly } from "project-editor/project/project";
import { ProjectContext } from "project-editor/project/context";
import { ProjectEditor } from "project-editor/project-editor-interface";

import { Property } from "./Property";
import { PropertyName } from "./PropertyName";
import { propertyCollapsedStore } from "./PropertyCollapsedStore";
import { groupCollapsedStore } from "./GroupCollapsedStore";
import { PropertyEnclosure } from "./PropertyEnclosure";
import { getPropertyGroups } from "./groups";
import { PropertyMenu } from "./PropertyMenu";

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

            if (
                this.objects.length == 1 &&
                (propertyValues as any).lvglVersion != undefined
            ) {
                const project = ProjectEditor.getProject(this.objects[0]);
                ProjectEditor.migrateLvglVersion(
                    project,
                    (propertyValues as any).lvglVersion
                );
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

        renderProperty(
            objects: IEezObject[],
            propertyInfo: PropertyInfo,
            readOnly: boolean,
            isPropertyMenuSupported: boolean,
            highlightedPropertyName: string | undefined
        ) {
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
                propertyInfo.propertyGridRowComponent ||
                propertyInfo.propertyGridFullRowComponent ||
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

            let propertyMenuEnabled;

            if (
                !readOnly &&
                (propertyInfo.inheritable ||
                    (propertyInfo.propertyMenu &&
                        propertyInfo.propertyMenu(propertyProps).length > 0))
            ) {
                propertyMenuEnabled = true;
            } else {
                propertyMenuEnabled = false;
            }

            let propertyMenu = isPropertyMenuSupported &&
                !propertyInfo.propertyGridCollapsable &&
                propertyMenuEnabled && (
                    <PropertyMenu
                        propertyInfo={propertyInfo}
                        objects={objects}
                        updateObject={this.updateObject}
                        readOnly={readOnly}
                    />
                );

            let property;
            if (colSpan) {
                if (propertyInfo.propertyGridFullRowComponent) {
                    property = (
                        <>
                            <Property {...propertyProps} />
                            {propertyMenu}
                        </>
                    );
                } else {
                    property = (
                        <>
                            <div
                                className={classNames({
                                    "embedded-property-cell":
                                        propertyInfo.type ===
                                        PropertyType.Object
                                })}
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
                            </div>
                            {propertyMenu}
                        </>
                    );
                }
            } else {
                property = (
                    <>
                        <PropertyName {...propertyProps} />
                        <div
                            style={{
                                display: "flex",
                                width: "100%",
                                alignItems: "center"
                            }}
                        >
                            <Property {...propertyProps} />
                            {propertyMenu}
                        </div>
                    </>
                );
            }

            return (
                <PropertyEnclosure
                    key={propertyInfo.name}
                    objects={objects}
                    propertyInfo={propertyInfo}
                    highlightedPropertyName={highlightedPropertyName}
                    property={property}
                />
            );
        }

        render() {
            let objects = this.objects;

            if (objects.length === 0) {
                return (
                    <div
                        className="EezStudio_PropertyGrid_NothingSelected"
                        onContextMenu={e => e.preventDefault()}
                    ></div>
                );
            }

            //
            const readOnly =
                this.props.readOnly || isAnyObjectReadOnly(objects);

            //
            const isPropertyMenuSupported = !objects.find(
                object => !getClassInfo(object).isPropertyMenuSupported
            );

            //
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

            let properties = getCommonProperties(objects);

            const groupPropertiesArray = getPropertyGroups(
                objects[0],
                properties
            );

            let withGroups = false;

            const rows = groupPropertiesArray.map(groupProperties => {
                if (groupProperties.group.title) {
                    withGroups = true;
                    return (
                        <PropertiesGroup
                            group={groupProperties.group}
                            object={objects[0]}
                            key={groupProperties.group.id}
                        >
                            {!groupCollapsedStore.isCollapsed(
                                groupProperties.group
                            ) &&
                                groupProperties.properties.map(property =>
                                    this.renderProperty(
                                        objects,
                                        property,
                                        readOnly,
                                        isPropertyMenuSupported,
                                        highlightedPropertyName
                                    )
                                )}
                        </PropertiesGroup>
                    );
                } else {
                    return (
                        <React.Fragment key={groupProperties.group.id}>
                            {groupProperties.properties.map(property =>
                                this.renderProperty(
                                    objects,
                                    property,
                                    readOnly,
                                    isPropertyMenuSupported,
                                    highlightedPropertyName
                                )
                            )}
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
                    style={!withGroups ? { padding: 5 } : undefined}
                >
                    {rows}
                </div>
            );
        }
    }
);

const PropertiesGroup = observer(
    class PropertiesGroup extends React.Component<{
        group: IPropertyGridGroupDefinition;
        object: IEezObject;
        children: React.ReactNode;
    }> {
        toggleCollapsed = () => {
            groupCollapsedStore.toggleColapsed(this.props.group);
        };

        render() {
            const { group } = this.props;

            const collapsed = groupCollapsedStore.isCollapsed(group);

            return (
                <div
                    className={classNames("EezStudio_PropertyGrid_Group", {
                        collapsed
                    })}
                >
                    <div
                        className={"EezStudio_PropertyGrid_Group_Header"}
                        onClick={this.toggleCollapsed}
                    >
                        <Icon
                            icon={
                                collapsed
                                    ? "material:keyboard_arrow_right"
                                    : "material:keyboard_arrow_down"
                            }
                            size={18}
                            className="triangle"
                        />
                        {group.title}
                    </div>
                    <div className="EezStudio_PropertyGrid_Group_Body">
                        {this.props.children}
                    </div>
                </div>
            );
        }
    }
);
