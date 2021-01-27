import React from "react";
import { computed, observable, action, runInAction, autorun } from "mobx";
import { observer, disposeOnUnmount } from "mobx-react";
import { bind } from "bind-decorator";
import classNames from "classnames";

import { guid } from "eez-studio-shared/guid";
import { humanize, stringCompare } from "eez-studio-shared/string";
import { isDark } from "eez-studio-shared/color";
import { validators, filterNumber } from "eez-studio-shared/validation";

import styled from "eez-studio-ui/styled-components";
import { showGenericDialog } from "eez-studio-ui/generic-dialog";
import { CodeEditor, CodeEditorMode } from "eez-studio-ui/code-editor";
import { Toolbar } from "eez-studio-ui/toolbar";
import { IconAction } from "eez-studio-ui/action";
import { Icon } from "eez-studio-ui/icon";

import {
    NavigationStore,
    UndoManager,
    DocumentStore,
    OutputSectionsStore
} from "project-editor/core/store";
import { Section } from "project-editor/core/output";
import { getEezStudioDataFromDragEvent } from "project-editor/core/clipboard";
import {
    IEezObject,
    PropertyInfo,
    PropertyType,
    isPropertyHidden,
    getProperty,
    isValue,
    objectToString,
    getInheritedValue,
    getPropertyAsString,
    isProperAncestor,
    findPropertyByNameInClassInfo,
    PropertyProps,
    getCommonProperties,
    getPropertySourceInfo,
    isAnyPropertyModified,
    IPropertyGridGroupDefinition,
    getParent,
    getKey,
    getId,
    getClassInfo
} from "project-editor/core/object";

import { replaceObjectReference } from "project-editor/core/search";

import { getThemedColor } from "project-editor/features/gui/theme";

import { info } from "project-editor/core/util";

import { ConfigurationReferencesPropertyValue } from "project-editor/components/ConfigurationReferencesPropertyValue";

import { ProjectStore, isAnyObjectReadOnly, getNameProperty } from "project-editor/project/project";

const { Menu, MenuItem } = EEZStudio.electron.remote;

////////////////////////////////////////////////////////////////////////////////

export { PropertyProps } from "project-editor/core/object";

////////////////////////////////////////////////////////////////////////////////

function getPropertyName(propertyInfo: PropertyInfo) {
    return propertyInfo.displayName ?? humanize(propertyInfo.name);
}

function getPropertyValue(objects: IEezObject[], propertyInfo: PropertyInfo) {
    if (objects.length === 0) {
        return undefined;
    }

    function getObjectPropertyValue(object: IEezObject) {
        let value = (object as any)[propertyInfo.name];

        if (value === undefined && propertyInfo.inheritable) {
            let inheritedValue = getInheritedValue(object, propertyInfo.name);
            if (inheritedValue) {
                value = inheritedValue.value;
            }
        }

        if (value === undefined) {
            value = propertyInfo.defaultValue;
        }

        return value;
    }

    const result = {
        value: getObjectPropertyValue(objects[0])
    };

    for (let i = 1; i < objects.length; i++) {
        const value = getObjectPropertyValue(objects[i]);
        if (value !== result.value) {
            return undefined;
        }
    }

    return result;
}

function getPropertyValueAsString(objects: IEezObject[], propertyInfo: PropertyInfo) {
    if (objects.length === 0) {
        return undefined;
    }

    function getObjectPropertyValue(object: IEezObject) {
        let value = getPropertyAsString(object, propertyInfo);

        if (value === undefined && propertyInfo.inheritable) {
            let inheritedValue = getInheritedValue(object, propertyInfo.name);
            if (inheritedValue) {
                value = inheritedValue.value;
            }
        }

        if (value === undefined) {
            value = propertyInfo.defaultValue;
        }

        return value;
    }

    const result = {
        value: getObjectPropertyValue(objects[0])
    };

    for (let i = 1; i < objects.length; i++) {
        const value = getObjectPropertyValue(objects[i]);
        if (value !== result.value) {
            return undefined;
        }
    }

    return result;
}

////////////////////////////////////////////////////////////////////////////////

@observer
class PropertyMenu extends React.Component<PropertyProps> {
    get sourceInfo() {
        return getPropertySourceInfo(this.props);
    }

    @bind
    onClicked(event: React.MouseEvent) {
        let menuItems: Electron.MenuItem[] = [];

        if (this.props.propertyInfo.propertyMenu) {
            menuItems = this.props.propertyInfo.propertyMenu(this.props);
        } else {
            if (this.sourceInfo.source === "modified") {
                if (menuItems.length > 0) {
                    menuItems.push(
                        new MenuItem({
                            type: "separator"
                        })
                    );
                }

                menuItems.push(
                    new MenuItem({
                        label: "Reset",
                        click: () => {
                            this.props.updateObject({
                                [this.props.propertyInfo.name]: undefined
                            });
                        }
                    })
                );
            }
        }

        if (menuItems.length > 0) {
            const menu = new Menu();
            menuItems.forEach(menuItem => menu.append(menuItem));
            menu.popup({});
        }
    }

    render() {
        if (this.props.readOnly) {
            return null;
        }

        let title = humanize(this.sourceInfo.source);
        if (this.sourceInfo.inheritedFrom) {
            title += " from " + objectToString(this.sourceInfo.inheritedFrom);
        }

        return (
            <div
                className={classNames("property-menu", this.sourceInfo.source)}
                title={title}
                onClick={this.onClicked}
            >
                <div />
            </div>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

@observer
class CodeEditorProperty extends React.Component<
    PropertyProps & { mode: CodeEditorMode; showLabel?: boolean }
> {
    @observable value: string = this.getValue();

    editor: CodeEditor;

    @disposeOnUnmount updateValue = autorun(() => {
        const value = this.getValue();
        runInAction(() => {
            this.value = value;
        });
    });

    getValue(props?: PropertyProps) {
        props = props || this.props;

        let value;

        let getPropertyValueResult = getPropertyValue(props.objects, props.propertyInfo);
        if (getPropertyValueResult !== undefined) {
            value = getPropertyValueResult.value;
            if (value === undefined) {
                value = props.propertyInfo.defaultValue;
            }
        } else {
            value = undefined;
        }

        return value !== undefined ? value : "";
    }

    @action
    UNSAFE_componentWillReceiveProps(props: PropertyProps) {
        this.value = this.getValue(props);
    }

    @action.bound
    onChange(value: string) {
        this.value = value;
    }

    @bind
    onFocus() {
        this.editor.resize();
    }

    @bind
    onBlur() {
        if (this.getValue() !== this.value) {
            this.props.updateObject({
                [this.props.propertyInfo.name]: this.value
            });
        }
    }

    render() {
        const { propertyInfo, showLabel, readOnly } = this.props;
        return (
            <React.Fragment>
                {(showLabel == undefined || showLabel) && (
                    <div>{getPropertyName(propertyInfo)}</div>
                )}
                <CodeEditor
                    ref={(ref: any) => (this.editor = ref)}
                    value={this.value}
                    onChange={this.onChange}
                    onFocus={this.onFocus}
                    onBlur={this.onBlur}
                    className="form-control"
                    mode={this.props.mode}
                    minLines={2}
                    maxLines={50}
                    readOnly={readOnly}
                />
            </React.Fragment>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

@observer
class ThemedColorInput extends React.Component<{
    value: any;
    onChange: (newValue: any) => void;
    readOnly: boolean;
}> {
    @bind
    onDragOver(event: React.DragEvent) {
        event.preventDefault();
    }

    @bind
    onDrop(event: React.DragEvent) {
        event.preventDefault();
        var data = getEezStudioDataFromDragEvent(event);
        if (data && data.objectClassName === "Color" && data.object) {
            this.props.onChange(getProperty(data.object, "name"));
        }
    }

    @bind
    async onChange(event: React.ChangeEvent<HTMLInputElement>) {
        const color = event.target.value;
        // const color16bits = to16bitsColor(color);
        // if (!compareColors(color, color16bits)) {
        //     await info(
        //         "Selected color is using more then 16 bits (i.e. 5-6-5 RGB color scheme).",
        //         "It will be saved as is but it will be truncated to 16 bits before displaying and building."
        //     );
        // }
        this.props.onChange(color);
    }

    render() {
        const { value, readOnly } = this.props;

        const color = getThemedColor(value);

        return (
            <label
                className="form-control"
                style={{
                    color: isDark(color) ? "#fff" : undefined,
                    backgroundColor: color,
                    textAlign: "center",
                    cursor: "pointer",
                    overflow: "hidden"
                }}
                onDrop={this.onDrop}
                onDragOver={this.onDragOver}
            >
                <input
                    type="color"
                    hidden
                    value={value}
                    onChange={this.onChange}
                    readOnly={readOnly}
                />
                {value}
            </label>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

function isArrayElementPropertyVisible(propertyInfo: PropertyInfo, object?: IEezObject) {
    if (object) {
        return !isPropertyHidden(object, propertyInfo);
    }

    if (
        propertyInfo.hideInPropertyGrid === undefined ||
        typeof propertyInfo.hideInPropertyGrid !== "boolean" ||
        !propertyInfo.hideInPropertyGrid
    ) {
        return true;
    }

    return false;
}

function isHighlightedProperty(object: IEezObject, propertyInfo: PropertyInfo) {
    const selectedObject =
        NavigationStore.selectedPanel && NavigationStore.selectedPanel.selectedObject;
    return !!(
        selectedObject &&
        ((getParent(selectedObject) === object && getKey(selectedObject) === propertyInfo.name) ||
            isProperAncestor(getParent(selectedObject), getProperty(object, propertyInfo.name)))
    );
}

function isPropertyInError(object: IEezObject, propertyInfo: PropertyInfo) {
    return !!OutputSectionsStore.getSection(Section.CHECKS).messages.find(
        message =>
            message.object &&
            getParent(message.object) === object &&
            getKey(message.object) === propertyInfo.name
    );
}

@observer
class ArrayElementProperty extends React.Component<{
    propertyInfo: PropertyInfo;
    object: IEezObject;
    readOnly: boolean;
}> {
    @bind
    updateObject(propertyValues: Object) {
        let object = this.props.object;
        if (object) {
            if (isValue(object)) {
                object = getParent(object);
            }
            DocumentStore.updateObject(object, propertyValues);
        }
    }

    render() {
        const { propertyInfo } = this.props;

        const className = classNames(propertyInfo.name, {
            inError: isPropertyInError(this.props.object, this.props.propertyInfo),
            highlighted: isHighlightedProperty(this.props.object, this.props.propertyInfo)
        });

        if (isArrayElementPropertyVisible(propertyInfo, this.props.object)) {
            return (
                <td key={propertyInfo.name} className={className}>
                    <Property
                        propertyInfo={propertyInfo}
                        objects={[this.props.object]}
                        readOnly={this.props.readOnly}
                        updateObject={this.updateObject}
                    />
                </td>
            );
        } else {
            return <td key={propertyInfo.name} />;
        }
    }
}

@observer
class ArrayElementProperties extends React.Component<{
    object: IEezObject;
    readOnly: boolean;
    className?: string;
}> {
    @bind
    onRemove(event: any) {
        event.preventDefault();
        DocumentStore.deleteObject(this.props.object);
    }

    render() {
        return (
            <tr>
                {getClassInfo(this.props.object).properties.map(propertyInfo => (
                    <ArrayElementProperty
                        key={propertyInfo.name}
                        propertyInfo={propertyInfo}
                        object={this.props.object}
                        readOnly={this.props.readOnly}
                    />
                ))}
                <td>
                    <Toolbar>
                        <IconAction
                            icon="material:delete"
                            title="Remove parameter"
                            onClick={this.onRemove}
                        />
                    </Toolbar>
                </td>
            </tr>
        );
    }
}

@observer
class ArrayProperty extends React.Component<PropertyProps> {
    @computed
    get value() {
        return (this.props.objects[0] as any)[this.props.propertyInfo.name] as
            | IEezObject[]
            | undefined;
    }

    @bind
    onAdd(event: any) {
        event.preventDefault();

        UndoManager.setCombineCommands(true);

        let value = this.value;
        if (value === undefined) {
            DocumentStore.updateObject(this.props.objects[0], {
                [this.props.propertyInfo.name]: []
            });

            value = (this.props.objects[0] as any)[this.props.propertyInfo.name] as IEezObject[];
        }

        const typeClass = this.props.propertyInfo.typeClass!;

        if (!typeClass.classInfo.defaultValue) {
            console.error(`Class "${typeClass.name}" is missing defaultValue`);
        } else {
            DocumentStore.addObject(value, typeClass.classInfo.defaultValue);
            UndoManager.setCombineCommands(false);
        }
    }

    render() {
        const { propertyInfo } = this.props;

        const addButton = (
            <button className="btn btn-primary" onClick={this.onAdd}>
                Add
            </button>
        );

        if (!this.value || this.value.length === 0) {
            return addButton;
        }

        const typeClass = propertyInfo.typeClass!;

        const tableContent = (
            <React.Fragment>
                <thead>
                    <tr>
                        {typeClass.classInfo.properties
                            .filter(propertyInfo => isArrayElementPropertyVisible(propertyInfo))
                            .map(propertyInfo => (
                                <th key={propertyInfo.name} className={propertyInfo.name}>
                                    {getPropertyName(propertyInfo)}
                                </th>
                            ))}
                    </tr>
                </thead>
                <tbody>
                    {this.value &&
                        this.value.map(object => (
                            <ArrayElementProperties
                                key={getId(object)}
                                object={object}
                                readOnly={this.props.readOnly}
                            />
                        ))}
                </tbody>
            </React.Fragment>
        );

        return (
            <div className="array-property">
                {typeClass.classInfo.propertyGridTableComponent ? (
                    <typeClass.classInfo.propertyGridTableComponent>
                        {tableContent}
                    </typeClass.classInfo.propertyGridTableComponent>
                ) : (
                    <table>{tableContent}</table>
                )}
                {addButton}
            </div>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

class PropertyCollapsedStore {
    @observable map: {
        [key: string]: boolean;
    } = {};

    constructor() {
        const savedState = localStorage.getItem("PropertyCollapsedStore");
        if (savedState) {
            this.map = JSON.parse(savedState);
        }
    }

    getKey(propertyInfo: PropertyInfo) {
        return propertyInfo.name;
    }

    isCollapsed(propertyInfo: PropertyInfo) {
        const enabled =
            !propertyInfo.propertyGridCollapsableEnabled ||
            propertyInfo.propertyGridCollapsableEnabled();

        if (!enabled) {
            return true;
        }

        const collapsed = this.map[this.getKey(propertyInfo)];
        if (collapsed !== undefined) {
            return collapsed;
        }
        return !(propertyInfo.name === "style");
    }

    @action
    toggleColapsed(propertyInfo: PropertyInfo) {
        this.map[this.getKey(propertyInfo)] = !this.isCollapsed(propertyInfo);
        localStorage.setItem("PropertyCollapsedStore", JSON.stringify(this.map));
    }
}

const propertyCollapsedStore = new PropertyCollapsedStore();

@observer
class EmbeddedPropertyGrid extends React.Component<PropertyProps> {
    @observable collapsed = true;

    @bind
    toggleCollapsed() {
        propertyCollapsedStore.toggleColapsed(this.props.propertyInfo);
    }

    @bind
    updateObject(propertyValues: Object) {
        UndoManager.setCombineCommands(true);
        this.props.objects.forEach(object => {
            object = (object as any)[this.props.propertyInfo.name];
            DocumentStore.updateObject(object, propertyValues);
        });
        UndoManager.setCombineCommands(false);
    }

    render() {
        const { propertyInfo } = this.props;

        if (!propertyInfo.propertyGridCollapsable) {
            return (
                <PropertyGrid
                    objects={this.props.objects.map(object => (object as any)[propertyInfo.name])}
                />
            );
        }

        const collapsed = propertyCollapsedStore.isCollapsed(this.props.propertyInfo);
        if (collapsed) {
            if (propertyInfo.propertyGridCollapsableDefaultPropertyName) {
                const defaultPropertyInfo = findPropertyByNameInClassInfo(
                    propertyInfo.typeClass!.classInfo,
                    propertyInfo.propertyGridCollapsableDefaultPropertyName
                )!;
                return (
                    <Property
                        propertyInfo={defaultPropertyInfo}
                        objects={this.props.objects.map(
                            object => (object as any)[propertyInfo.name]
                        )}
                        updateObject={this.updateObject}
                        readOnly={this.props.readOnly}
                    />
                );
            } else {
                return (
                    <div className="embedded-property-grid collapsable collapsed">
                        <div onClick={this.toggleCollapsed}>
                            <Icon
                                icon={
                                    collapsed
                                        ? "material:keyboard_arrow_right"
                                        : "material:keyboard_arrow_down"
                                }
                                size={18}
                                className="triangle"
                            />
                            {getPropertyName(propertyInfo)}
                        </div>
                    </div>
                );
            }
        }

        return (
            <div className="embedded-property-grid collapsable">
                <div onClick={this.toggleCollapsed}>
                    <Icon icon="material:keyboard_arrow_down" size={18} className="triangle" />
                    {getPropertyName(propertyInfo)}
                </div>
                <PropertyGrid
                    objects={this.props.objects.map(object => (object as any)[propertyInfo.name])}
                />
            </div>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

@observer
class PropertyName extends React.Component<PropertyProps> {
    @observable collapsed = true;

    @bind
    toggleCollapsed() {
        propertyCollapsedStore.toggleColapsed(this.props.propertyInfo);
    }

    render() {
        const { propertyInfo } = this.props;

        if (propertyInfo.propertyGridCollapsable) {
            const enabled =
                !propertyInfo.propertyGridCollapsableEnabled ||
                propertyInfo.propertyGridCollapsableEnabled();
            const collapsed = propertyCollapsedStore.isCollapsed(this.props.propertyInfo);

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
                    {getPropertyName(propertyInfo)}
                    {isAnyPropertyModified({
                        ...this.props,
                        objects: this.props.objects.map(
                            object => (object as any)[propertyInfo.name]
                        )
                    }) && " ●"}
                </div>
            );
        } else {
            return getPropertyName(propertyInfo);
        }
    }
}

////////////////////////////////////////////////////////////////////////////////

@observer
class Property extends React.Component<PropertyProps> {
    textarea: HTMLDivElement;
    input: HTMLInputElement;
    select: HTMLSelectElement;

    @observable _value: any = undefined;

    @disposeOnUnmount
    changeDocumentDisposer = autorun(() => {
        if (ProjectStore.project) {
            const getPropertyValueResult = getPropertyValue(
                this.props.objects,
                this.props.propertyInfo
            );
            runInAction(() => {
                this._value = getPropertyValueResult ? getPropertyValueResult.value : undefined;
            });
        }
    });

    @bind
    resizeTextArea() {
        setTimeout(() => {
            if (this.textarea) {
                this.textarea.style.overflow = "hidden";
                this.textarea.style.height = "0";
                this.textarea.style.height = this.textarea.scrollHeight + "px";
            }
        }, 0);
    }

    @action
    UNSAFE_componentWillReceiveProps(props: PropertyProps) {
        const getPropertyValueResult = getPropertyValue(
            this.props.objects,
            this.props.propertyInfo
        );
        this._value = getPropertyValueResult ? getPropertyValueResult.value : undefined;
    }

    componentDidMount() {
        let el = this.input || this.textarea || this.select;
        if (el) {
            $(el).on("focus", () => {
                UndoManager.setCombineCommands(true);
            });

            $(el).on("blur", () => {
                UndoManager.setCombineCommands(false);
            });
        }

        this.resizeTextArea();
    }

    componentDidUpdate() {
        this.resizeTextArea();
    }

    @bind
    onSelect(event: React.MouseEvent<HTMLButtonElement, MouseEvent>) {
        if (this.props.propertyInfo.onSelect) {
            let params;

            if (this.props.propertyInfo.type == PropertyType.String) {
                const input = $(event.target)
                    .parent()
                    .parent()
                    .find("input")[0] as HTMLInputElement;
                if (input) {
                    params = {
                        textInputSelection: {
                            start: input.selectionStart,
                            end: input.selectionEnd
                        }
                    };
                }
            }

            this.props.propertyInfo
                .onSelect(this.props.objects[0], this.props.propertyInfo, params)
                .then(propertyValues => {
                    this.props.updateObject(propertyValues);
                })
                .catch(error => console.error(error));
        }
    }

    @action.bound
    changeValue(newValue: any) {
        if (this.props.readOnly) {
            return;
        }

        if (this.props.propertyInfo.readOnlyInPropertyGrid) {
            return;
        }

        this._value = newValue;

        if (this.props.propertyInfo.type === PropertyType.Number) {
            if (newValue.trim() === "" && this.props.propertyInfo.isOptional) {
                newValue = undefined;
            } else {
                newValue = filterNumber(newValue);
                if (isNaN(newValue)) {
                    return;
                }
            }
        }

        this.props.updateObject({
            [this.props.propertyInfo.name]: newValue
        });
    }

    @bind
    onChange(event: any) {
        const target = event.target;
        if (this.props.propertyInfo.type === PropertyType.ConfigurationReference) {
            if (target.value === "all") {
                this.changeValue(undefined);
            } else {
                this.changeValue([]);
            }
        } else if (this.props.propertyInfo.type === PropertyType.Enum) {
            const id = target.value.toString();
            const enumItem = this.props.propertyInfo.enumItems!.find(
                enumItem => enumItem.id.toString() === id
            );
            this.changeValue(enumItem && enumItem!.id);
        } else {
            this.changeValue(target.type === "checkbox" ? target.checked : target.value);
        }
    }

    @bind
    onEditUnique() {
        showGenericDialog({
            dialogDefinition: {
                fields: [
                    {
                        name: this.props.propertyInfo.name,
                        type: "string",
                        validators: [
                            validators.unique(
                                this.props.objects[0],
                                getParent(this.props.objects[0])
                            )
                        ].concat(this.props.propertyInfo.isOptional ? [] : [validators.required])
                    }
                ]
            },
            values: this.props.objects[0]
        })
            .then(result => {
                let oldValue = this._value;
                let newValue = result.values[this.props.propertyInfo.name].trim();
                if (newValue.length === 0) {
                    newValue = undefined;
                }
                if (newValue != oldValue) {
                    UndoManager.setCombineCommands(true);

                    runInAction(() => {
                        replaceObjectReference(this.props.objects[0], newValue);
                        this.changeValue(newValue);
                    });

                    UndoManager.setCombineCommands(false);
                }
            })
            .catch(error => {
                if (error !== undefined) {
                    console.error(error);
                }
            });
    }

    @bind
    onGenerateGuid() {
        this.changeValue(guid());
    }

    @bind
    onKeyDown(event: React.KeyboardEvent) {
        if (event.keyCode === 13) {
            if (this.props.propertyInfo.type === PropertyType.Number) {
                try {
                    var mexp = require("math-expression-evaluator");
                    const newValue = mexp.eval(this._value);
                    if (newValue !== undefined && newValue !== this._value) {
                        this.props.updateObject({
                            [this.props.propertyInfo.name]: newValue
                        });
                    }
                } catch (err) {
                    console.error(err);
                }
            }
        }
    }

    render() {
        const { propertyInfo, readOnly } = this.props;

        if (propertyInfo.readOnlyInPropertyGrid) {
            const getPropertyValueAsStringResult = getPropertyValueAsString(
                this.props.objects,
                propertyInfo
            );
            let value =
                (getPropertyValueAsStringResult !== undefined
                    ? getPropertyValueAsStringResult.value
                    : undefined) || "";
            return <input type="text" className="form-control" value={value} readOnly />;
        }

        if (propertyInfo.propertyGridComponent) {
            return <propertyInfo.propertyGridComponent {...this.props} />;
        } else if (propertyInfo.type === PropertyType.String && propertyInfo.unique) {
            return (
                <div className="input-group">
                    <input
                        ref={(ref: any) => (this.input = ref)}
                        type="text"
                        className="form-control"
                        value={this._value || ""}
                        readOnly
                    />
                    {!readOnly && (
                        <div className="input-group-append">
                            <button
                                className="btn btn-secondary"
                                type="button"
                                onClick={this.onEditUnique}
                            >
                                &hellip;
                            </button>
                        </div>
                    )}
                </div>
            );
        } else if (propertyInfo.type === PropertyType.MultilineText) {
            return (
                <textarea
                    ref={(ref: any) => (this.textarea = ref)}
                    className="form-control"
                    value={this._value || ""}
                    onChange={this.onChange}
                    style={{ resize: "none" }}
                    readOnly={readOnly}
                />
            );
        } else if (propertyInfo.type === PropertyType.JSON) {
            return <CodeEditorProperty {...this.props} mode="json" showLabel={false} />;
        } else if (propertyInfo.type === PropertyType.Cpp) {
            return <CodeEditorProperty {...this.props} mode="c_cpp" showLabel={false} />;
        } else if (
            propertyInfo.type === PropertyType.Object ||
            (propertyInfo.type === PropertyType.Array && this.props.propertyInfo.onSelect)
        ) {
            if (this.props.propertyInfo.onSelect) {
                const getPropertyValueAsStringResult = getPropertyValueAsString(
                    this.props.objects,
                    propertyInfo
                );
                let value =
                    (getPropertyValueAsStringResult !== undefined
                        ? getPropertyValueAsStringResult.value
                        : undefined) || "";
                return (
                    <div className="input-group" title={value}>
                        <input
                            ref={(ref: any) => (this.input = ref)}
                            type="text"
                            className="form-control"
                            value={value}
                            readOnly
                        />
                        {!readOnly && (
                            <div className="input-group-append">
                                <button
                                    className="btn btn-secondary"
                                    type="button"
                                    title={this.props.propertyInfo.onSelectTitle}
                                    onClick={this.onSelect}
                                >
                                    &hellip;
                                </button>
                            </div>
                        )}
                    </div>
                );
            } else {
                return <EmbeddedPropertyGrid {...this.props} />;
            }
        } else if (propertyInfo.type === PropertyType.Enum) {
            if (readOnly) {
                return (
                    <input
                        ref={(ref: any) => (this.input = ref)}
                        type="text"
                        className="form-control"
                        value={this._value || ""}
                        readOnly
                    />
                );
            } else {
                let options: JSX.Element[];

                if (propertyInfo.enumItems) {
                    options = propertyInfo.enumItems.map(enumItem => {
                        const id = enumItem.id.toString();
                        return (
                            <option key={id} value={id}>
                                {enumItem.label || humanize(id)}
                            </option>
                        );
                    });
                } else {
                    options = [];
                }

                options.unshift(<option key="__empty" value="" />);

                return (
                    <select
                        ref={(ref: any) => (this.select = ref)}
                        className="form-control"
                        value={this._value !== undefined ? this._value : ""}
                        onChange={this.onChange}
                    >
                        {options}
                    </select>
                );
            }
        } else if (propertyInfo.type === PropertyType.ObjectReference) {
            if (readOnly) {
                return (
                    <input
                        ref={(ref: any) => (this.input = ref)}
                        type="text"
                        className="form-control"
                        value={this._value || ""}
                        readOnly
                    />
                );
            } else {
                if (this.props.propertyInfo.onSelect) {
                    return (
                        <div className="input-group" title={this._value || ""}>
                            <input
                                ref={(ref: any) => (this.input = ref)}
                                type="text"
                                className="form-control"
                                value={this._value || ""}
                                onChange={this.onChange}
                                readOnly={propertyInfo.computed}
                            />
                            <div className="input-group-append">
                                <button
                                    className="btn btn-secondary"
                                    type="button"
                                    onClick={this.onSelect}
                                    title={this.props.propertyInfo.onSelectTitle}
                                >
                                    &hellip;
                                </button>
                            </div>
                        </div>
                    );
                } else {
                    let objects: IEezObject[] = ProjectStore.project.getAllObjectsOfType(
                        propertyInfo.referencedObjectCollectionPath!
                    );

                    let options = objects
                        .slice()
                        .sort((a, b) => stringCompare(getNameProperty(a), getNameProperty(b)))
                        .map(object => {
                            let name = getNameProperty(object);
                            return (
                                <option key={name} value={name}>
                                    {name}
                                </option>
                            );
                        });

                    options.unshift(<option key="__empty" value="" />);

                    if (
                        this._value &&
                        !objects.find(object => getProperty(object, "name") == this._value)
                    ) {
                        if (typeof this._value == "object") {
                            options.unshift(
                                <option key="__not_found" value={getProperty(this._value, "name")}>
                                    {objectToString(this._value)}
                                </option>
                            );
                        } else {
                            options.unshift(
                                <option key="__not_found" value={this._value}>
                                    {this._value}
                                </option>
                            );
                        }
                    }

                    return (
                        <select
                            ref={(ref: any) => (this.select = ref)}
                            className="form-control"
                            value={this._value || ""}
                            onChange={this.onChange}
                        >
                            {options}
                        </select>
                    );
                }
            }
        } else if (propertyInfo.type === PropertyType.Boolean) {
            return (
                <label>
                    <input
                        ref={(ref: any) => (this.input = ref)}
                        type="checkbox"
                        checked={this._value || false}
                        onChange={this.onChange}
                        readOnly={readOnly}
                    />
                    <span>{" " + getPropertyName(propertyInfo)}</span>
                </label>
            );
        } else if (propertyInfo.type === PropertyType.GUID) {
            return (
                <div className="input-group">
                    <input
                        ref={(ref: any) => (this.input = ref)}
                        type="text"
                        className="form-control"
                        value={this._value || ""}
                        onChange={this.onChange}
                        readOnly={readOnly}
                    />
                    {!readOnly && (
                        <div className="input-group-append">
                            <button
                                className="btn btn-secondary"
                                type="button"
                                title="Generate GUID"
                                onClick={this.onGenerateGuid}
                            >
                                +
                            </button>
                        </div>
                    )}
                </div>
            );
        } else if (propertyInfo.type === PropertyType.String) {
            if (!readOnly && this.props.propertyInfo.onSelect) {
                return (
                    <div className="input-group" title={this._value || ""}>
                        <input
                            ref={(ref: any) => (this.input = ref)}
                            type="text"
                            className="form-control"
                            value={this._value || ""}
                            onChange={this.onChange}
                            onKeyDown={this.onKeyDown}
                            readOnly={propertyInfo.computed}
                        />
                        <div className="input-group-append">
                            <button
                                className="btn btn-secondary"
                                type="button"
                                onClick={this.onSelect}
                                title={this.props.propertyInfo.onSelectTitle}
                            >
                                &hellip;
                            </button>
                        </div>
                    </div>
                );
            } else {
                return (
                    <input
                        ref={(ref: any) => (this.input = ref)}
                        type="text"
                        className="form-control"
                        value={this._value || ""}
                        onChange={this.onChange}
                        onKeyDown={this.onKeyDown}
                        readOnly={readOnly || propertyInfo.computed}
                    />
                );
            }
        } else if (propertyInfo.type === PropertyType.Number) {
            return (
                <input
                    ref={(ref: any) => (this.input = ref)}
                    type="text"
                    className="form-control"
                    value={this._value != undefined ? this._value : ""}
                    onChange={this.onChange}
                    onKeyDown={this.onKeyDown}
                    readOnly={readOnly}
                />
            );
        } else if (propertyInfo.type === PropertyType.Color) {
            return (
                <input
                    ref={(ref: any) => (this.input = ref)}
                    type="color"
                    className="form-control"
                    value={this._value || ""}
                    onChange={this.onChange}
                    readOnly={readOnly}
                />
            );
        } else if (propertyInfo.type === PropertyType.ThemedColor) {
            return (
                <ThemedColorInput
                    value={this._value || ""}
                    onChange={this.changeValue}
                    readOnly={readOnly}
                />
            );
        } else if (propertyInfo.type === PropertyType.Array) {
            return <ArrayProperty {...this.props} />;
        } else if (propertyInfo.type === PropertyType.ConfigurationReference) {
            return (
                <ConfigurationReferencesPropertyValue
                    value={this._value || ""}
                    onChange={this.changeValue}
                    readOnly={readOnly}
                />
            );
        } else if (propertyInfo.type === PropertyType.RelativeFolder) {
            let clearButton: JSX.Element | undefined;

            if (this._value !== undefined && !readOnly) {
                clearButton = (
                    <button
                        className="btn btn-secondary"
                        type="button"
                        onClick={() => this.changeValue(undefined)}
                    >
                        <Icon icon="material:close" size={14} />
                    </button>
                );
            }

            return (
                <div className="input-group">
                    <input
                        type="text"
                        className="form-control"
                        value={this._value || ""}
                        readOnly
                    />
                    {!readOnly && (
                        <div className="input-group-append">
                            {clearButton}
                            <button
                                className="btn btn-secondary"
                                type="button"
                                onClick={async () => {
                                    if (ProjectStore.filePath) {
                                        const result = await EEZStudio.electron.remote.dialog.showOpenDialog(
                                            {
                                                properties: ["openDirectory"]
                                            }
                                        );

                                        const filePaths = result.filePaths;
                                        if (filePaths && filePaths[0]) {
                                            this.changeValue(
                                                ProjectStore.getFolderPathRelativeToProjectPath(
                                                    filePaths[0]
                                                )
                                            );
                                        }
                                    } else {
                                        info(
                                            "Project not saved.",
                                            "To be able to select folder you need to save the project first."
                                        );
                                    }
                                }}
                            >
                                &hellip;
                            </button>
                        </div>
                    )}
                </div>
            );
        } else if (propertyInfo.type === PropertyType.RelativeFile) {
            let clearButton: JSX.Element | undefined;

            if (this._value !== undefined && !readOnly) {
                clearButton = (
                    <button
                        className="btn btn-secondary"
                        type="button"
                        onClick={() => this.changeValue(undefined)}
                    >
                        <Icon icon="material:close" size={14} />
                    </button>
                );
            }

            return (
                <div className="input-group">
                    <input
                        type="text"
                        className="form-control"
                        value={this._value || ""}
                        readOnly
                    />
                    {!readOnly && (
                        <div className="input-group-append">
                            {clearButton}
                            <button
                                className="btn btn-secondary"
                                type="button"
                                onClick={async () => {
                                    if (ProjectStore.filePath) {
                                        const result = await EEZStudio.electron.remote.dialog.showOpenDialog(
                                            {
                                                properties: ["openFile"],
                                                filters: propertyInfo.fileFilters
                                            }
                                        );

                                        const filePaths = result.filePaths;
                                        if (filePaths && filePaths[0]) {
                                            this.changeValue(
                                                ProjectStore.getFolderPathRelativeToProjectPath(
                                                    filePaths[0]
                                                )
                                            );
                                        }
                                    } else {
                                        info(
                                            "Project not saved.",
                                            "To be able to select file you need to save the project first."
                                        );
                                    }
                                }}
                            >
                                &hellip;
                            </button>
                        </div>
                    )}
                </div>
            );
        } else if (propertyInfo.type === PropertyType.Image) {
            return (
                <div>
                    <div className="input-group">
                        <input
                            type="text"
                            className="form-control"
                            value={
                                propertyInfo.embeddedImage ? "<embedded image>" : this._value || ""
                            }
                            readOnly
                        />
                        {!readOnly && (
                            <div className="input-group-append">
                                <button
                                    className="btn btn-secondary"
                                    type="button"
                                    onClick={async () => {
                                        const result = await EEZStudio.electron.remote.dialog.showOpenDialog(
                                            {
                                                properties: ["openFile"],
                                                filters: [
                                                    {
                                                        name: "Image files",
                                                        extensions: ["png", "jpg", "jpeg"]
                                                    },
                                                    { name: "All Files", extensions: ["*"] }
                                                ]
                                            }
                                        );
                                        const filePaths = result.filePaths;
                                        if (filePaths && filePaths[0]) {
                                            if (propertyInfo.embeddedImage) {
                                                const fs = EEZStudio.electron.remote.require("fs");
                                                fs.readFile(
                                                    ProjectStore.getAbsoluteFilePath(filePaths[0]),
                                                    "base64",
                                                    (err: any, data: any) => {
                                                        if (!err) {
                                                            this.changeValue(
                                                                "data:image/png;base64," + data
                                                            );
                                                        }
                                                    }
                                                );
                                            } else {
                                                this.changeValue(
                                                    ProjectStore.getFilePathRelativeToProjectPath(
                                                        filePaths[0]
                                                    )
                                                );
                                            }
                                        }
                                    }}
                                >
                                    &hellip;
                                </button>
                            </div>
                        )}
                    </div>
                    {this._value && !propertyInfo.embeddedImage && (
                        <img
                            src={
                                this._value && this._value.startsWith("data:image/")
                                    ? this._value
                                    : ProjectStore.getAbsoluteFilePath(this._value || "")
                            }
                            style={{
                                display: "block",
                                maxWidth: "100%",
                                margin: "auto",
                                paddingTop: "5px"
                            }}
                        />
                    )}
                </div>
            );
        }
        return null;
    }
}

////////////////////////////////////////////////////////////////////////////////

class GroupMenu extends React.Component<{
    group: IPropertyGridGroupDefinition;
    object: IEezObject;
}> {
    @bind onClick(event: MouseEvent) {
        const { group, object } = this.props;
        const groupMenu = group.menu!(object)!;

        const menu = new Menu();

        groupMenu.forEach(groupMenuItem => menu.append(new MenuItem(groupMenuItem)));

        menu.popup({});
    }

    render() {
        return <IconAction icon="material:menu" title="" onClick={this.onClick} />;
    }
}

class GroupCollapsedStore {
    @observable map: {
        [key: string]: boolean;
    } = {};

    constructor() {
        const savedState = localStorage.getItem("GroupCollapsedStore");
        if (savedState) {
            this.map = JSON.parse(savedState);
        }
    }

    isCollapsed(group: IPropertyGridGroupDefinition) {
        const collapsed = this.map[group.id];
        if (collapsed !== undefined) {
            return collapsed;
        }
        return false;
    }

    @action
    toggleColapsed(group: IPropertyGridGroupDefinition) {
        this.map[group.id] = !this.isCollapsed(group);
        localStorage.setItem("GroupCollapsedStore", JSON.stringify(this.map));
    }
}

const groupCollapsedStore = new GroupCollapsedStore();

@observer
class GroupTitle extends React.Component<{
    group: IPropertyGridGroupDefinition;
    object: IEezObject;
}> {
    @bind
    toggleCollapsed() {
        groupCollapsedStore.toggleColapsed(this.props.group);
    }

    render() {
        const { group, object } = this.props;

        const collapsed = groupCollapsedStore.isCollapsed(group);

        return (
            <tr>
                <td colSpan={3} className="group-cell">
                    <div
                        className={classNames("group-container", {
                            collapsed
                        })}
                        onClick={this.toggleCollapsed}
                    >
                        <div className="group-title">
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
                        {group.menu && group.menu(object) && (
                            <GroupMenu group={group} object={object} />
                        )}
                    </div>
                </td>
            </tr>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

const PropertyGridDiv = styled.div`
    flex-grow: 1;
    padding: 10px 10px 10px 5px;
    overflow: auto;

    & > table {
        width: 100%;

        & > tbody {
            & > tr {
                &.inError {
                    background-color: #ffcccc;
                }

                &.highlighted {
                    background-color: #ff6666;
                }

                & > td {
                    vertical-align: middle;
                    padding-top: 3px;
                    padding-bottom: 3px;
                }

                & > td:first-child {
                    padding-left: 20px;
                    padding-right: 10px;
                }

                & > td.property-name {
                    white-space: nowrap;
                    vertical-align: baseline;
                    transform: translateY(7px);

                    & > .collapsable {
                        transform: translateX(-10px);
                        cursor: pointer;
                        &:hover {
                            background-color: #eee;
                        }
                    }
                }

                & > td:nth-child(2) {
                    width: 100%;
                }

                & > td.group-cell {
                    padding-left: 0;
                    padding-bottom: 5px;
                    & > div.group-container {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        & > div.group-title {
                            font-size: 90%;
                            text-transform: uppercase;
                            font-weight: bold;
                        }

                        cursor: pointer;
                        &:hover {
                            background-color: #eee;
                        }
                    }
                }

                & > td.embedded-property-cell {
                    padding-left: 10px;
                }
            }
        }
    }

    .property-menu {
        padding: 6px;
        width: 20px;
        height: 20px;

        &:hover {
            background-color: #eee;
        }

        & > div {
            width: 8px;
            height: 8px;
            border: 1px solid #666;
        }

        &.default > div {
            background-color: #fff;
        }

        &.inherited > div {
            background-color: #fff;
        }

        &.modified > div {
            background-color: #333;
        }
    }

    .array-property {
        border: 1px solid ${props => props.theme.borderColor};
        padding: 5px;

        & > table {
            width: 100%;
            margin-bottom: 10px;

            & > thead > tr > th {
                padding-right: 10px;
                font-weight: 500;
                white-space: nowrap;
                padding-bottom: 5px;
            }

            & > tbody {
                & > tr {
                    & > td {
                        padding: 4px;
                    }
                    & > td.inError {
                        background-color: #ffaaaa;
                    }
                    & > td.highlighted {
                        background-color: #ff6666;
                    }
                }
            }
        }
    }

    .embedded-property-grid {
        transform: translateY(7px);
        border: 1px solid ${props => props.theme.borderColor};
        &.collapsable {
            border: none;
            & > div:first-child {
                cursor: pointer;
                &:hover {
                    background-color: #eee;
                }
            }
            &.collapsed > div:nth-child(2) {
                display: none;
            }
            & > div:nth-child(2) {
                padding: 0;
            }
        }
    }
`;

interface PropertyGridProps {
    objects: IEezObject[];
    className?: string;
}

@observer
export class PropertyGrid extends React.Component<PropertyGridProps> {
    div: HTMLDivElement | null;
    lastObject: IEezObject | undefined;

    @computed
    get objects() {
        return this.props.objects.filter(object => !!object);
    }

    ensureHighlightedVisible() {
        if (this.div) {
            const object = this.objects.length === 1 ? this.objects[0] : undefined;
            if (this.lastObject !== object) {
                const $highlighted = $(this.div).find(".highlighted");
                if ($highlighted[0]) {
                    ($highlighted[0] as any).scrollIntoViewIfNeeded();
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
        UndoManager.setCombineCommands(true);

        this.objects.forEach(object => {
            if (isValue(object)) {
                object = getParent(object);
            }
            DocumentStore.updateObject(object, propertyValues);
        });

        UndoManager.setCombineCommands(false);
    }

    render() {
        let objects = this.objects;

        if (objects.length === 0) {
            return null;
        }

        const readOnly = isAnyObjectReadOnly(objects);

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

        let groupForPropertiesWithoutGroupSpecified: IGroupProperties | undefined;

        const isPropertyMenuSupported = !objects.find(
            object => !getClassInfo(object).isPropertyMenuSupported
        );

        let properties = getCommonProperties(objects);

        for (let propertyInfo of properties) {
            const colSpan =
                propertyInfo.type === PropertyType.Boolean ||
                propertyInfo.type === PropertyType.Any ||
                (propertyInfo.propertyGridCollapsable &&
                    (!propertyCollapsedStore.isCollapsed(propertyInfo) ||
                        !propertyInfo.propertyGridCollapsableDefaultPropertyName));

            const propertyProps = {
                propertyInfo,
                objects,
                updateObject: this.updateObject,
                readOnly
            };

            let propertyMenuEnabled =
                !propertyInfo.readOnlyInPropertyGrid &&
                !readOnly &&
                (propertyInfo.inheritable ||
                    (propertyInfo.propertyMenu &&
                        propertyInfo.propertyMenu(propertyProps).length > 0));

            let property;
            if (colSpan) {
                property = (
                    <td
                        className={classNames({
                            "embedded-property-cell": propertyInfo.type === PropertyType.Object
                        })}
                        colSpan={propertyInfo.propertyGridCollapsable ? 3 : 2}
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

            const className = classNames({
                inError: objects.length === 1 && isPropertyInError(objects[0], propertyInfo),
                highlighted:
                    propertyInfo.name == highlightedPropertyName ||
                    isHighlightedProperty(objects[0], propertyInfo)
            });

            const propertyComponent = (
                <tr className={className} key={propertyInfo.name}>
                    {property}
                    {isPropertyMenuSupported && !propertyInfo.propertyGridCollapsable && (
                        <td>
                            {propertyMenuEnabled && (
                                <PropertyMenu
                                    propertyInfo={propertyInfo}
                                    objects={objects}
                                    updateObject={this.updateObject}
                                    readOnly={readOnly}
                                />
                            )}
                        </td>
                    )}
                </tr>
            );

            const propertyGroup = propertyInfo.propertyGridGroup;
            if (propertyGroup) {
                let groupProperties = groupPropertiesArray.find(
                    groupProperties => groupProperties.group.id === propertyGroup.id
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
                    groupPropertiesArray.push(groupForPropertiesWithoutGroupSpecified);
                }
                groupForPropertiesWithoutGroupSpecified.properties.push(propertyComponent);
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

        groupPropertiesArray.sort((a: IGroupProperties, b: IGroupProperties) => {
            const aPosition = a.group.position !== undefined ? a.group.position : maxPosition + 1;
            const bPosition = b.group.position !== undefined ? b.group.position : maxPosition + 1;
            return aPosition - bPosition;
        });

        const rows = groupPropertiesArray.map(groupProperties => {
            if (groupProperties.group.title) {
                return (
                    <React.Fragment key={groupProperties.group.id}>
                        <GroupTitle group={groupProperties.group} object={objects[0]} />
                        {!groupCollapsedStore.isCollapsed(groupProperties.group) &&
                            groupProperties.properties}
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
            <PropertyGridDiv ref={(ref: any) => (this.div = ref)} className={this.props.className}>
                <table>
                    <tbody>{rows}</tbody>
                </table>
            </PropertyGridDiv>
        );
    }
}
