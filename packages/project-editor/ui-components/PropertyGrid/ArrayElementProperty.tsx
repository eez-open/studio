import React from "react";
import {
    computed,
    observable,
    action,
    makeObservable,
    runInAction
} from "mobx";
import { observer } from "mobx-react";
import classNames from "classnames";

import { Toolbar } from "eez-studio-ui/toolbar";
import { IconAction } from "eez-studio-ui/action";

import {
    IEezObject,
    PropertyInfo,
    PropertyProps,
    getParent,
    getId,
    isPropertyReadOnly,
    getObjectPropertyDisplayName,
    EezObject
} from "project-editor/core/object";
import {
    isValue,
    getClassInfo,
    addItem,
    deleteObject,
    insertObjectAfter,
    insertObjectBefore,
    createObject
} from "project-editor/store";

import { ProjectContext } from "project-editor/project/context";

import {
    isArrayElementPropertyVisible,
    isHighlightedProperty,
    isPropertyInError
} from "./utils";
import { PropertyName } from "./PropertyName";
import { Property } from "./Property";

const ArrayElementProperty = observer(
    class ArrayElementProperty extends React.Component<{
        propertyInfo: PropertyInfo;
        object: IEezObject;
        readOnly: boolean;
        vertical: boolean;
    }> {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        updateObject = (propertyValues: Object) => {
            let object = this.props.object;
            if (object) {
                if (isValue(object)) {
                    object = getParent(object);
                }
                this.context.updateObject(object, propertyValues);
            }
        };

        render() {
            const { object, propertyInfo, readOnly } = this.props;

            const className = classNames(propertyInfo.name, {
                inError: isPropertyInError(object, propertyInfo),
                highlighted: isHighlightedProperty(object, propertyInfo)
            });

            if (isArrayElementPropertyVisible(propertyInfo, object)) {
                return (
                    <>
                        {this.props.vertical && (
                            <td className={propertyInfo.name}>
                                {getObjectPropertyDisplayName(
                                    object,
                                    propertyInfo
                                )}
                            </td>
                        )}
                        <td className={className}>
                            <Property
                                propertyInfo={propertyInfo}
                                objects={[object]}
                                readOnly={
                                    readOnly ||
                                    isPropertyReadOnly(object, propertyInfo)
                                }
                                updateObject={this.updateObject}
                            />
                        </td>
                    </>
                );
            } else {
                console.log("not visible");
                return <td />;
            }
        }
    }
);

const ArrayElementProperties = observer(
    class ArrayElementProperties extends React.Component<{
        object: IEezObject;
        readOnly: boolean;
        className?: string;
        selected: boolean;
        selectObject: (object: IEezObject, toggleEnabled: boolean) => void;
        vertical: boolean;
    }> {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        render() {
            return (
                <tr
                    className={classNames({ selected: this.props.selected })}
                    onClick={event => {
                        if (
                            event.nativeEvent.target instanceof
                                HTMLTableCellElement ||
                            event.nativeEvent.target instanceof
                                HTMLTableRowElement
                        ) {
                            this.props.selectObject(this.props.object, true);
                        } else {
                            this.props.selectObject(this.props.object, false);
                        }
                    }}
                >
                    {this.props.vertical ? (
                        <td className="inner-table">
                            <table>
                                <tbody>
                                    {getClassInfo(
                                        this.props.object
                                    ).properties.map(propertyInfo => (
                                        <tr key={propertyInfo.name}>
                                            <ArrayElementProperty
                                                propertyInfo={propertyInfo}
                                                object={this.props.object}
                                                readOnly={this.props.readOnly}
                                                vertical={this.props.vertical}
                                            />
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </td>
                    ) : (
                        getClassInfo(this.props.object).properties.map(
                            propertyInfo => (
                                <ArrayElementProperty
                                    key={propertyInfo.name}
                                    propertyInfo={propertyInfo}
                                    object={this.props.object}
                                    readOnly={this.props.readOnly}
                                    vertical={this.props.vertical}
                                />
                            )
                        )
                    )}
                </tr>
            );
        }
    }
);

export const ArrayProperty = observer(
    class ArrayProperty extends React.Component<PropertyProps> {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        constructor(props: PropertyProps) {
            super(props);

            makeObservable(this, {
                value: computed,
                selectedObject: observable
            });
        }

        get value() {
            return (this.props.objects[0] as any)[
                this.props.propertyInfo.name
            ] as EezObject[] | undefined;
        }

        selectedObject: EezObject | undefined;

        selectObject = action((object: EezObject, toggleEnabled: boolean) => {
            if (this.selectedObject != object) {
                this.selectedObject = object;
            } else if (toggleEnabled) {
                this.selectedObject = undefined;
            }
        });

        onAdd = (event: any) => {
            event.preventDefault();

            this.context.undoManager.setCombineCommands(true);

            let value = this.value;
            if (value === undefined) {
                this.context.updateObject(this.props.objects[0], {
                    [this.props.propertyInfo.name]: []
                });

                value = (this.props.objects[0] as any)[
                    this.props.propertyInfo.name
                ] as EezObject[];
            }

            const typeClass = this.props.propertyInfo.typeClass!;

            if (typeClass.classInfo.newItem) {
                addItem(value);
            } else {
                if (!typeClass.classInfo.defaultValue) {
                    console.error(
                        `Class "${typeClass.name}" is missing defaultValue`
                    );
                } else {
                    const object = createObject(
                        this.context,
                        typeClass.classInfo.defaultValue,
                        typeClass
                    );

                    this.context.addObject(value, object);

                    this.context.undoManager.setCombineCommands(false);
                }
            }
        };

        onDelete = (event: any) => {
            event.preventDefault();

            if (this.selectedObject) {
                this.context.deleteObject(this.selectedObject);
                runInAction(() => {
                    this.selectedObject = undefined;
                });
            }
        };

        onMoveUp = action((event: any) => {
            event.preventDefault();

            if (this.value && this.selectedObject) {
                const selectedObjectIndex = this.value.indexOf(
                    this.selectedObject
                );
                if (selectedObjectIndex > 0) {
                    this.context.undoManager.setCombineCommands(true);

                    const objectBefore = this.value[selectedObjectIndex - 1];

                    deleteObject(this.selectedObject);
                    this.selectedObject = insertObjectBefore(
                        objectBefore,
                        this.selectedObject
                    );

                    this.context.undoManager.setCombineCommands(false);
                }
            }
        });

        onMoveDown = action((event: any) => {
            event.preventDefault();

            if (this.value && this.selectedObject) {
                const selectedObjectIndex = this.value.indexOf(
                    this.selectedObject
                );
                if (selectedObjectIndex < this.value.length - 1) {
                    this.context.undoManager.setCombineCommands(true);

                    const objectAfter = this.value[selectedObjectIndex + 1];

                    deleteObject(this.selectedObject);
                    this.selectedObject = insertObjectAfter(
                        objectAfter,
                        this.selectedObject
                    );

                    this.context.undoManager.setCombineCommands(false);
                }
            }
        });

        render() {
            const { objects, propertyInfo } = this.props;

            const array = this.value ?? [];

            const toolbar = (
                <div className="d-flex justify-content-between EezStudio_ArrayPropertyToolbar">
                    <PropertyName {...this.props} />
                    <Toolbar>
                        <IconAction
                            icon="material:add"
                            iconSize={16}
                            onClick={this.onAdd}
                            title="Add item"
                        />
                        <IconAction
                            icon="material:delete"
                            iconSize={16}
                            onClick={this.onDelete}
                            title="Delete item"
                            enabled={this.selectedObject != undefined}
                        />
                        <IconAction
                            icon={
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="icon icon-tabler icon-tabler-arrow-up"
                                    width="24"
                                    height="24"
                                    viewBox="0 0 24 24"
                                    strokeWidth="2"
                                    stroke="currentColor"
                                    fill="none"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                >
                                    <path
                                        stroke="none"
                                        d="M0 0h24v24H0z"
                                        fill="none"
                                    ></path>
                                    <line x1="12" y1="5" x2="12" y2="19"></line>
                                    <line x1="18" y1="11" x2="12" y2="5"></line>
                                    <line x1="6" y1="11" x2="12" y2="5"></line>
                                </svg>
                            }
                            iconSize={16}
                            onClick={this.onMoveUp}
                            title="Move up"
                            enabled={
                                array.length > 1 &&
                                this.selectedObject != undefined &&
                                array.indexOf(this.selectedObject) > 0
                            }
                        />
                        <IconAction
                            icon={
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="icon icon-tabler icon-tabler-arrow-down"
                                    width="24"
                                    height="24"
                                    viewBox="0 0 24 24"
                                    strokeWidth="2"
                                    stroke="currentColor"
                                    fill="none"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                >
                                    <path
                                        stroke="none"
                                        d="M0 0h24v24H0z"
                                        fill="none"
                                    ></path>
                                    <line x1="12" y1="5" x2="12" y2="19"></line>
                                    <line
                                        x1="18"
                                        y1="13"
                                        x2="12"
                                        y2="19"
                                    ></line>
                                    <line x1="6" y1="13" x2="12" y2="19"></line>
                                </svg>
                            }
                            iconSize={16}
                            onClick={this.onMoveDown}
                            title="Move down"
                            enabled={
                                array.length > 1 &&
                                this.selectedObject != undefined &&
                                array.indexOf(this.selectedObject) <
                                    array.length - 1
                            }
                        />
                    </Toolbar>
                </div>
            );

            const typeClass = propertyInfo.typeClass!;

            const properties = typeClass.classInfo.properties.filter(
                propertyInfo => isArrayElementPropertyVisible(propertyInfo)
            );
            let tableContent;

            let vertical =
                propertyInfo.arrayItemOrientation &&
                propertyInfo.arrayItemOrientation == "vertical"
                    ? true
                    : false;

            if (vertical) {
                tableContent = (
                    <React.Fragment>
                        <tbody>
                            {array.map(object => (
                                <ArrayElementProperties
                                    key={getId(object)}
                                    object={object}
                                    readOnly={this.props.readOnly}
                                    selected={object == this.selectedObject}
                                    selectObject={this.selectObject}
                                    vertical={vertical}
                                />
                            ))}
                        </tbody>
                    </React.Fragment>
                );
            } else {
                tableContent = (
                    <React.Fragment>
                        <thead>
                            <tr>
                                {properties.map(propertyInfo => (
                                    <th
                                        key={propertyInfo.name}
                                        className={propertyInfo.name}
                                        style={{
                                            width: `${100 / properties.length}%`
                                        }}
                                    >
                                        {getObjectPropertyDisplayName(
                                            objects[0],
                                            propertyInfo
                                        )}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {array.map(object => (
                                <ArrayElementProperties
                                    key={getId(object)}
                                    object={object}
                                    readOnly={this.props.readOnly}
                                    selected={object == this.selectedObject}
                                    selectObject={this.selectObject}
                                    vertical={vertical}
                                />
                            ))}
                        </tbody>
                    </React.Fragment>
                );
            }

            const table = typeClass.classInfo.propertyGridTableComponent ? (
                <typeClass.classInfo.propertyGridTableComponent>
                    {tableContent}
                </typeClass.classInfo.propertyGridTableComponent>
            ) : (
                <table>{tableContent}</table>
            );

            return (
                <div
                    className={classNames(
                        "shadow-sm rounded EezStudio_ArrayProperty",
                        { "vertical-orientation": vertical }
                    )}
                >
                    {toolbar}
                    {array.length > 0 && table}
                </div>
            );
        }
    }
);
