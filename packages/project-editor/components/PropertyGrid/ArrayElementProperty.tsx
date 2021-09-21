import React from "react";
import { computed, observable, action } from "mobx";
import { observer } from "mobx-react";
import { bind } from "bind-decorator";
import classNames from "classnames";
import { Toolbar } from "eez-studio-ui/toolbar";
import { IconAction } from "eez-studio-ui/action";
import {
    IEezObject,
    PropertyInfo,
    isValue,
    PropertyProps,
    getParent,
    getId,
    getClassInfo,
    isPropertyReadOnly,
    getObjectPropertyDisplayName
} from "project-editor/core/object";
import { addItem } from "project-editor/core/store";
import { ProjectContext } from "project-editor/project/context";
import {
    deleteObject,
    insertObjectAfter,
    insertObjectBefore
} from "project-editor/core/commands";
import {
    isArrayElementPropertyVisible,
    isHighlightedProperty,
    isPropertyInError
} from "./utils";
import { PropertyName } from "./PropertyName";
import { Property } from "./Property";

@observer
class ArrayElementProperty extends React.Component<{
    propertyInfo: PropertyInfo;
    object: IEezObject;
    readOnly: boolean;
}> {
    static contextType = ProjectContext;
    declare context: React.ContextType<typeof ProjectContext>;

    @bind
    updateObject(propertyValues: Object) {
        let object = this.props.object;
        if (object) {
            if (isValue(object)) {
                object = getParent(object);
            }
            this.context.updateObject(object, propertyValues);
        }
    }

    render() {
        const { propertyInfo } = this.props;

        const className = classNames(propertyInfo.name, {
            inError: isPropertyInError(
                this.props.object,
                this.props.propertyInfo
            ),
            highlighted: isHighlightedProperty(
                this.props.object,
                this.props.propertyInfo
            )
        });

        if (isArrayElementPropertyVisible(propertyInfo, this.props.object)) {
            return (
                <td key={propertyInfo.name} className={className}>
                    <Property
                        propertyInfo={propertyInfo}
                        objects={[this.props.object]}
                        readOnly={
                            this.props.readOnly ||
                            isPropertyReadOnly(this.props.object, propertyInfo)
                        }
                        updateObject={this.updateObject}
                    />
                </td>
            );
        } else {
            return null;
        }
    }
}

@observer
class ArrayElementProperties extends React.Component<{
    object: IEezObject;
    readOnly: boolean;
    className?: string;
    selected: boolean;
    selectObject: (object: IEezObject) => void;
}> {
    static contextType = ProjectContext;
    declare context: React.ContextType<typeof ProjectContext>;

    render() {
        return (
            <tr
                className={classNames({ selected: this.props.selected })}
                onClick={() => this.props.selectObject(this.props.object)}
            >
                {getClassInfo(this.props.object).properties.map(
                    propertyInfo => (
                        <ArrayElementProperty
                            key={propertyInfo.name}
                            propertyInfo={propertyInfo}
                            object={this.props.object}
                            readOnly={this.props.readOnly}
                        />
                    )
                )}
            </tr>
        );
    }
}

@observer
export class ArrayProperty extends React.Component<PropertyProps> {
    static contextType = ProjectContext;
    declare context: React.ContextType<typeof ProjectContext>;

    @computed
    get value() {
        return (this.props.objects[0] as any)[this.props.propertyInfo.name] as
            | IEezObject[]
            | undefined;
    }

    @observable selectedObject: IEezObject | undefined;

    selectObject = action((object: IEezObject) => {
        this.selectedObject = object;
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
            ] as IEezObject[];
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
                this.context.addObject(value, typeClass.classInfo.defaultValue);
                this.context.undoManager.setCombineCommands(false);
            }
        }
    };

    onDelete = (event: any) => {
        event.preventDefault();

        if (this.selectedObject) {
            this.context.deleteObject(this.selectedObject);
        }
    };

    onMoveUp = action((event: any) => {
        event.preventDefault();

        if (this.value && this.selectedObject) {
            const selectedObjectIndex = this.value.indexOf(this.selectedObject);
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
            const selectedObjectIndex = this.value.indexOf(this.selectedObject);
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
                                <line x1="18" y1="13" x2="12" y2="19"></line>
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

        const properties = typeClass.classInfo.properties.filter(propertyInfo =>
            isArrayElementPropertyVisible(propertyInfo)
        );
        const tableContent = (
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
                        />
                    ))}
                </tbody>
            </React.Fragment>
        );

        const table = typeClass.classInfo.propertyGridTableComponent ? (
            <typeClass.classInfo.propertyGridTableComponent>
                {tableContent}
            </typeClass.classInfo.propertyGridTableComponent>
        ) : (
            <table>{tableContent}</table>
        );

        return (
            <div className="shadow-sm rounded EezStudio_ArrayProperty">
                {toolbar}
                {array.length > 0 && table}
            </div>
        );
    }
}
