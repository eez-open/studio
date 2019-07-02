import React from "react";
import { computed, observable, action, runInAction, autorun } from "mobx";
import { observer, disposeOnUnmount } from "mobx-react";
import { bind } from "bind-decorator";
import classNames from "classnames";

import { guid } from "eez-studio-shared/guid";
import { humanize, stringCompare } from "eez-studio-shared/string";
import { isDark } from "eez-studio-shared/color";

import { validators, filterNumber } from "eez-studio-shared/validation";
import { IPropertyGridGroupDefinition } from "project-editor/model/object";
import { NavigationStore } from "project-editor/model/store";
import { getEezStudioDataFromDragEvent } from "project-editor/model/clipboard";

import styled from "eez-studio-ui/styled-components";
import { showGenericDialog } from "eez-studio-ui/generic-dialog";
import { CodeEditor, CodeEditorMode } from "eez-studio-ui/code-editor";
import { Toolbar } from "eez-studio-ui/toolbar";
import { IconAction } from "eez-studio-ui/action";
import { Icon } from "eez-studio-ui/icon";

import {
    EezObject,
    EezArrayObject,
    PropertyInfo,
    PropertyType,
    isPropertyHidden,
    getProperty,
    isArray,
    asArray,
    isValue,
    objectToString,
    getInheritedValue,
    getPropertyAsString,
    isProperAncestor
} from "project-editor/model/object";
import {
    UndoManager,
    DocumentStore,
    UIElementsFactory,
    IMenuItem
} from "project-editor/model/store";
import { replaceObjectReference } from "project-editor/model/search";

import { getPageContext } from "project-editor/project/features/gui/page-editor/page-context";
import {
    getPropertyValueForAllResolutions,
    unsetResolutionDependablePropertyForCurrentResolution,
    unsetResolutionDependablePropertyForLowerResolutions
} from "project-editor/project/features/gui/page-editor/resolution-dependable-properties";

////////////////////////////////////////////////////////////////////////////////

export interface PropertyProps {
    propertyInfo: PropertyInfo;
    object: EezObject;
    updateObject: (propertyValues: Object) => void;
}

////////////////////////////////////////////////////////////////////////////////

interface PropertyValueSourceInfo {
    source: "default" | "modified" | "inherited";
    inheritedFrom?: EezObject;
}

@observer
class PropertyMenu extends React.Component<PropertyProps> {
    get sourceInfo(): PropertyValueSourceInfo {
        let value = (this.props.object as any)[this.props.propertyInfo.name];

        if (this.props.propertyInfo.inheritable) {
            if (value === undefined) {
                let inheritedValue = getInheritedValue(
                    this.props.object,
                    this.props.propertyInfo.name
                );
                if (inheritedValue) {
                    return {
                        source: "inherited",
                        inheritedFrom: inheritedValue.source
                    };
                }
            }
        }

        if (value !== undefined) {
            return {
                source: "modified"
            };
        }

        return {
            source: "default"
        };
    }

    @bind
    onClicked(event: React.MouseEvent) {
        let menuItems: IMenuItem[] = [];

        if (this.props.propertyInfo.resolutionDependable) {
            const allValues = getPropertyValueForAllResolutions(
                this.props.object,
                this.props.propertyInfo.name
            );

            for (let i = 0; i < getPageContext().allResolutions.length; ++i) {
                const value = i < allValues.length ? allValues[i] : null;
                menuItems.push(
                    UIElementsFactory.createMenuItem({
                        label: `${getPageContext().allResolutions[i].shortName}: ${
                            value != null ? value : "undefined"
                        }`,
                        checked: getPageContext().resolution === i
                    })
                );
            }

            if (getPageContext().resolution > 0 && allValues[getPageContext().resolution] != null) {
                menuItems.push(
                    UIElementsFactory.createMenuItem({
                        label: "Unset",
                        click: () => {
                            unsetResolutionDependablePropertyForCurrentResolution(
                                this.props.object,
                                this.props.propertyInfo.name
                            );
                        }
                    })
                );
            }

            if (
                getPageContext().resolution < getPageContext().allResolutions.length - 1 &&
                allValues.slice(getPageContext().resolution + 1).find((value: any) => value != null)
            ) {
                menuItems.push(
                    UIElementsFactory.createMenuItem({
                        label: "Unset for lower resolutions",
                        click: () => {
                            unsetResolutionDependablePropertyForLowerResolutions(
                                this.props.object,
                                this.props.propertyInfo.name
                            );
                        }
                    })
                );
            }
        } else {
            if (this.sourceInfo.source === "modified") {
                if (menuItems.length > 0) {
                    menuItems.push(
                        UIElementsFactory.createMenuItem({
                            type: "separator"
                        })
                    );
                }

                menuItems.push(
                    UIElementsFactory.createMenuItem({
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
            const menu = UIElementsFactory.createMenu();
            menuItems.forEach(menuItem => menu.append(menuItem));
            menu.popup(
                {},
                {
                    left: event.clientX,
                    top: event.clientY
                }
            );
        }
    }

    render() {
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
class CodeEditorProperty extends React.Component<PropertyProps & { mode: CodeEditorMode }> {
    @observable
    value: string = this.getValue();

    editor: CodeEditor;

    @disposeOnUnmount updateValue = autorun(() => {
        const value = this.getValue();
        runInAction(() => {
            this.value = value;
        });
    });

    getValue(props?: PropertyProps) {
        props = props || this.props;

        let value = (props.object as any)[props.propertyInfo.name];

        if (value === undefined && props.propertyInfo.inheritable) {
            let inheritedValue = getInheritedValue(props.object, props.propertyInfo.name);
            if (inheritedValue) {
                value = inheritedValue.value;
            }
        }

        if (value === undefined) {
            value = props.propertyInfo.defaultValue;
        }

        return value !== undefined ? value : "";
    }

    @action
    componentWillReceiveProps(props: PropertyProps) {
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
        const { propertyInfo } = this.props;
        return (
            <React.Fragment>
                <div>{propertyInfo.displayName || humanize(propertyInfo.name)}</div>
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
}> {
    onDragOver = (event: React.DragEvent) => {
        event.preventDefault();
    };

    onDrop = (event: React.DragEvent) => {
        event.preventDefault();
        var data = getEezStudioDataFromDragEvent(event);
        if (data && data.objectClassName === "Color" && data.object) {
            this.props.onChange(getProperty(data.object, "name"));
        }
    };

    onChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        this.props.onChange(event.target.value);
    };

    render() {
        const { value } = this.props;

        const color = getPageContext().getThemedColor(value);

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
                <input type="color" hidden value={value} onChange={this.onChange} />
                {value}
            </label>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

function isArrayElementPropertyVisible(propertyInfo: PropertyInfo, object?: EezObject) {
    if (object) {
        return !isPropertyHidden(object, propertyInfo);
    }

    if (
        propertyInfo.hideInPropertyGrid === undefined ||
        (typeof propertyInfo.hideInPropertyGrid !== "boolean" || !propertyInfo.hideInPropertyGrid)
    ) {
        return true;
    }

    return false;
}

function isHighlightedProperty(propertyInfo: PropertyInfo, object: EezObject) {
    const selectedObject =
        NavigationStore.selectedPanel && NavigationStore.selectedPanel.selectedObject;
    return !!(
        selectedObject &&
        ((selectedObject._parent === object && selectedObject._key === propertyInfo.name) ||
            isProperAncestor(selectedObject._parent!, getProperty(object, propertyInfo.name)))
    );
}

@observer
class ArrayElementProperty extends React.Component<{
    propertyInfo: PropertyInfo;
    object: EezObject;
}> {
    @bind
    updateObject(propertyValues: Object) {
        let object = this.props.object;
        if (object) {
            if (isValue(object)) {
                object = object._parent as EezObject;
            }
            DocumentStore.updateObject(object, propertyValues);
        }
    }

    render() {
        const { propertyInfo } = this.props;

        const className = classNames(propertyInfo.name, {
            highlighted: isHighlightedProperty(this.props.propertyInfo, this.props.object)
        });

        if (isArrayElementPropertyVisible(propertyInfo, this.props.object)) {
            return (
                <td key={propertyInfo.name} className={className}>
                    <Property
                        propertyInfo={propertyInfo}
                        object={this.props.object}
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
class ArrayElementProperties extends React.Component<PropertyGridProps> {
    @bind
    onRemove(event: any) {
        event.preventDefault();
        DocumentStore.deleteObject(this.props.object!);
    }

    render() {
        if (!this.props.object) {
            return null;
        }

        return (
            <tr>
                {this.props.object._classInfo.properties.map(propertyInfo => (
                    <ArrayElementProperty
                        key={propertyInfo.name}
                        propertyInfo={propertyInfo}
                        object={this.props.object!}
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
        return (this.props.object as any)[this.props.propertyInfo.name] as
            | EezArrayObject<EezObject>
            | undefined;
    }

    @bind
    onAdd(event: any) {
        event.preventDefault();

        UndoManager.setCombineCommands(true);

        let value = this.value;
        if (value === undefined) {
            DocumentStore.updateObject(this.props.object, {
                [this.props.propertyInfo.name]: []
            });

            value = (this.props.object as any)[this.props.propertyInfo.name] as EezArrayObject<
                EezObject
            >;
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

        if (!this.value || this.value._array.length === 0) {
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
                                    {propertyInfo.displayName || humanize(propertyInfo.name)}
                                </th>
                            ))}
                    </tr>
                </thead>
                <tbody>
                    {this.value &&
                        this.value._array.map(object => (
                            <ArrayElementProperties key={object._id} object={object} />
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

    // constructor() {
    //     const savedState = localStorage.getItem("PropertyCollapsedStore");
    //     if (savedState) {
    //         this.map = JSON.parse(savedState);
    //     }
    // }

    getKey({ propertyInfo }: PropertyProps) {
        return propertyInfo.name;
    }

    isCollapsed(props: PropertyProps) {
        const collapsed = this.map[this.getKey(props)];
        if (collapsed !== undefined) {
            return collapsed;
        }
        return !(props.propertyInfo.name === "style");
    }

    @action
    toggleColapsed(props: PropertyProps) {
        this.map[this.getKey(props)] = !this.isCollapsed(props);
        //localStorage.setItem("PropertyCollapsedStore", JSON.stringify(this.map));
    }
}

const propertyCollapsedStore = new PropertyCollapsedStore();

@observer
class EmbeddedPropertyGrid extends React.Component<PropertyProps> {
    @observable collapsed = true;

    @bind
    toggleCollapsed() {
        propertyCollapsedStore.toggleColapsed(this.props);
    }

    render() {
        const { propertyInfo, object } = this.props;

        const collapsed = propertyCollapsedStore.isCollapsed(this.props);

        return (
            <div
                className={classNames("embedded-property-grid", {
                    collapsable: propertyInfo.propertyGridCollapsable,
                    collapsed
                })}
            >
                {propertyInfo.propertyGridCollapsable && (
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
                        {propertyInfo.displayName || humanize(propertyInfo.name)}
                    </div>
                )}
                <PropertyGrid object={(object as any)[propertyInfo.name]} />
            </div>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

@observer
class Property extends React.Component<PropertyProps> {
    textarea: HTMLDivElement;
    input: HTMLInputElement;
    select: HTMLSelectElement;

    @observable
    _value: any = undefined;

    @disposeOnUnmount
    changeDocumentDisposer = autorun(() => {
        const value = (this.props.object as any)[this.props.propertyInfo.name];
        runInAction(() => {
            this._value = value;
        });
    });

    @computed
    get value() {
        let value = this._value;

        if (value === undefined && this.props.propertyInfo.inheritable) {
            let inheritedValue = getInheritedValue(this.props.object, this.props.propertyInfo.name);
            if (inheritedValue) {
                value = inheritedValue.value;
            }
        }

        if (value === undefined) {
            value = this.props.propertyInfo.defaultValue;
        }

        return value !== undefined ? value : "";
    }

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
    componentWillReceiveProps(props: PropertyProps) {
        this._value = (props.object as any)[props.propertyInfo.name];
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
    onSelect() {
        if (this.props.propertyInfo.onSelect) {
            this.props.propertyInfo
                .onSelect(this.props.object, this.props.propertyInfo)
                .then(propertyValues => {
                    this.props.updateObject(propertyValues);
                })
                .catch(error => console.error(error));
        }
    }

    @action.bound
    changeValue(newValue: any) {
        if (this.props.propertyInfo.readOnlyInPropertyGrid) {
            return;
        }

        this._value = newValue;

        const pageContext = getPageContext();
        if (pageContext.onChangeValueInPropertyGrid) {
            if (pageContext.onChangeValueInPropertyGrid(newValue, this.props)) {
                return;
            }
        }

        if (this.props.propertyInfo.type === PropertyType.Number) {
            newValue = filterNumber(newValue);
            if (isNaN(newValue)) {
                return;
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
                                this.props.object,
                                asArray(this.props.object._parent!)
                            )
                        ].concat(this.props.propertyInfo.isOptional ? [] : [validators.required])
                    }
                ]
            },
            values: this.props.object
        })
            .then(result => {
                let oldValue = this.value;
                let newValue = result.values[this.props.propertyInfo.name].trim();
                if (newValue.length === 0) {
                    newValue = undefined;
                }
                if (newValue != oldValue) {
                    UndoManager.setCombineCommands(true);
                    replaceObjectReference(this.props.object, newValue);
                    this.changeValue(newValue);
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
        const pageContext = getPageContext();
        if (pageContext.onKeyDownInPropertyGrid) {
            pageContext.onKeyDownInPropertyGrid(this._value, event, this.props);
        }
    }

    render() {
        const propertyInfo = this.props.propertyInfo;

        if (propertyInfo.readOnlyInPropertyGrid) {
            let value = getPropertyAsString(this.props.object, propertyInfo);
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
                        value={this.value}
                        readOnly
                    />
                    <div className="input-group-append">
                        <button
                            className="btn btn-secondary"
                            type="button"
                            onClick={this.onEditUnique}
                        >
                            &hellip;
                        </button>
                    </div>
                </div>
            );
        } else if (propertyInfo.type === PropertyType.MultilineText) {
            return (
                <textarea
                    ref={(ref: any) => (this.textarea = ref)}
                    className="form-control"
                    value={this.value}
                    onChange={this.onChange}
                    style={{ resize: "none" }}
                />
            );
        } else if (propertyInfo.type === PropertyType.JSON) {
            return <CodeEditorProperty {...this.props} mode="json" />;
        } else if (propertyInfo.type === PropertyType.JavaScript) {
            return <CodeEditorProperty {...this.props} mode="javascript" />;
        } else if (propertyInfo.type === PropertyType.CSS) {
            return <CodeEditorProperty {...this.props} mode="css" />;
        } else if (
            propertyInfo.type === PropertyType.Object ||
            (propertyInfo.type === PropertyType.Array && this.props.propertyInfo.onSelect)
        ) {
            let value = getPropertyAsString(this.props.object, propertyInfo);
            if (this.props.propertyInfo.onSelect) {
                return (
                    <div className="input-group" title={value}>
                        <input
                            ref={(ref: any) => (this.input = ref)}
                            type="text"
                            className="form-control"
                            value={value}
                            readOnly
                        />
                        <div className="input-group-append">
                            <button
                                className="btn btn-secondary"
                                type="button"
                                onClick={this.onSelect}
                            >
                                &hellip;
                            </button>
                        </div>
                    </div>
                );
            } else {
                return <EmbeddedPropertyGrid {...this.props} />;
            }
        } else if (propertyInfo.type === PropertyType.Enum) {
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
                    value={this.value}
                    onChange={this.onChange}
                >
                    {options}
                </select>
            );
        } else if (propertyInfo.type === PropertyType.ObjectReference) {
            if (this.props.propertyInfo.onSelect) {
                return (
                    <div className="input-group" title={this.value}>
                        <input
                            ref={(ref: any) => (this.input = ref)}
                            type="text"
                            className="form-control"
                            value={this.value}
                            readOnly
                        />
                        <div className="input-group-append">
                            <button
                                className="btn btn-secondary"
                                type="button"
                                onClick={this.onSelect}
                            >
                                &hellip;
                            </button>
                        </div>
                    </div>
                );
            } else {
                let objects: EezObject[] = [];

                if (propertyInfo.referencedObjectCollectionPath) {
                    objects = asArray(
                        DocumentStore.getObjectFromPath(propertyInfo.referencedObjectCollectionPath)
                    );
                    if (!objects) {
                        objects = [];
                    }
                }

                let options = objects
                    .slice()
                    .sort((a, b) => stringCompare(a._label, b._label))
                    .map(object => {
                        return (
                            <option key={object._id} value={getProperty(object, "name")}>
                                {objectToString(object)}
                            </option>
                        );
                    });

                options.unshift(<option key="__empty" value="" />);

                if (
                    this.value &&
                    !objects.find(object => getProperty(object, "name") == this.value)
                ) {
                    options.unshift(
                        <option key="__not_found" value={this.value}>
                            {this.value}
                        </option>
                    );
                }

                return (
                    <select
                        ref={(ref: any) => (this.select = ref)}
                        className="form-control"
                        value={this.value}
                        onChange={this.onChange}
                    >
                        {options}
                    </select>
                );
            }
        } else if (propertyInfo.type === PropertyType.Boolean) {
            return (
                <label>
                    <input
                        ref={(ref: any) => (this.input = ref)}
                        type="checkbox"
                        checked={this.value}
                        onChange={this.onChange}
                    />
                    <span>{" " + (propertyInfo.displayName || humanize(propertyInfo.name))}</span>
                </label>
            );
        } else if (propertyInfo.type === PropertyType.GUID) {
            return (
                <div className="input-group">
                    <input
                        ref={(ref: any) => (this.input = ref)}
                        type="text"
                        className="form-control"
                        value={this.value}
                        onChange={this.onChange}
                    />
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
                </div>
            );
        } else if (propertyInfo.type === PropertyType.String) {
            return (
                <input
                    ref={(ref: any) => (this.input = ref)}
                    type="text"
                    className="form-control"
                    value={this.value}
                    onChange={this.onChange}
                    onKeyDown={this.onKeyDown}
                />
            );
        } else if (propertyInfo.type === PropertyType.Number) {
            return (
                <input
                    ref={(ref: any) => (this.input = ref)}
                    type="text"
                    className="form-control"
                    value={this.value}
                    onChange={this.onChange}
                    onKeyDown={this.onKeyDown}
                />
            );
        } else if (propertyInfo.type === PropertyType.Color) {
            return (
                <input
                    ref={(ref: any) => (this.input = ref)}
                    type="color"
                    className="form-control"
                    value={this.value}
                    onChange={this.onChange}
                />
            );
        } else if (propertyInfo.type === PropertyType.ThemedColor) {
            return <ThemedColorInput value={this.value} onChange={this.changeValue} />;
        } else if (propertyInfo.type === PropertyType.Array) {
            return <ArrayProperty {...this.props} />;
        } else {
            return UIElementsFactory.renderProperty(propertyInfo, this.value, value =>
                this.changeValue(value)
            );
        }
        return null;
    }
}

////////////////////////////////////////////////////////////////////////////////

class GroupMenu extends React.Component<{
    group: IPropertyGridGroupDefinition;
    object: EezObject;
}> {
    @bind onClick(event: MouseEvent) {
        const { group, object } = this.props;
        const groupMenu = group.menu!(object)!;

        const menu = UIElementsFactory.createMenu();

        groupMenu.forEach(groupMenuItem =>
            menu.append(UIElementsFactory.createMenuItem(groupMenuItem))
        );

        menu.popup(
            {},
            {
                left: event.clientX,
                top: event.clientY
            }
        );
    }

    render() {
        return <IconAction icon="material:menu" title="" onClick={this.onClick} />;
    }
}

class GroupTitle extends React.Component<{
    group: IPropertyGridGroupDefinition;
    object: EezObject;
}> {
    render() {
        const { group, object } = this.props;
        return (
            <tr>
                <td colSpan={3} className="group-cell">
                    <div className="group-container">
                        <div className="group-title">{group.title}</div>
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

class GroupBorder extends React.Component {
    render() {
        return (
            <tr>
                <td className="group-border" colSpan={3}>
                    <div />
                </td>
            </tr>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

const PropertyGridDiv = styled.div`
    flex-grow: 1;
    padding: 10px;
    overflow: auto;

    & > table {
        width: 100%;

        & > tbody {
            & > tr {
                padding-bottom: 5px;

                &.highlighted {
                    border: 2px solid #ffccd4;
                }

                & > td {
                    vertical-align: middle;
                    padding-bottom: 5px;
                }

                & > td.property-name {
                    white-space: nowrap;
                    vertical-align: baseline;
                    padding-right: 10px;
                    transform: translateY(7px);
                }

                & > td:nth-child(2) {
                    width: 100%;
                }

                & > td.group-border {
                    padding-top: 10px;
                    padding-bottom: 10px;
                    & > div {
                        border-bottom: 1px solid ${props => props.theme.darkBorderColor};
                    }
                }

                & > td.group-cell {
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
                    }
                }

                & > td.embedded-property-grid-cell {
                    transform: translateY(0);
                    padding-right: 0;
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
                        padding: 2px;
                    }
                    & > td.highlighted {
                        border: 2px solid #ffccd4;
                    }
                }
            }
        }
    }

    .embedded-property-grid {
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
    object?: EezObject;
    className?: string;
}

@observer
export class PropertyGrid extends React.Component<PropertyGridProps> {
    div: HTMLDivElement | null;
    lastObject: EezObject | undefined;

    ensureHighlightedVisible() {
        if (this.div) {
            if (this.lastObject !== this.props.object) {
                const $highlighted = $(this.div).find(".highlighted");
                if ($highlighted[0]) {
                    ($highlighted[0] as any).scrollIntoViewIfNeeded();
                }
                this.lastObject = this.props.object;
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
        let object = this.props.object;
        if (object) {
            if (isValue(object)) {
                object = object._parent as EezObject;
            }
            DocumentStore.updateObject(object, propertyValues);
        }
    }

    render() {
        if (!this.props.object) {
            return null;
        }

        let highlightedPropertyName: string | undefined;
        let object;
        if (isValue(this.props.object)) {
            // if given object is actually a value, we show the parent properties with the value higlighted
            highlightedPropertyName = this.props.object._key;
            object = this.props.object._parent as EezObject;
        } else {
            object = this.props.object;
        }

        //let properties: JSX.Element[] = [];

        interface IGroupProperties {
            group: IPropertyGridGroupDefinition;
            properties: React.ReactNode[];
        }

        const groupPropertiesArray: IGroupProperties[] = [];

        let groupForPropertiesWithoutGroupSpecified: IGroupProperties | undefined;

        const isPropertyMenuSupported = object._classInfo.isPropertyMenuSupported;

        for (let propertyInfo of object._classInfo.properties) {
            if (!isArray(object) && !isPropertyHidden(object, propertyInfo)) {
                const colSpan =
                    propertyInfo.type === PropertyType.Boolean ||
                    propertyInfo.type === PropertyType.Any ||
                    propertyInfo.type === PropertyType.JavaScript ||
                    propertyInfo.type === PropertyType.JSON ||
                    propertyInfo.type === PropertyType.CSS ||
                    propertyInfo.propertyGridCollapsable;

                let propertyMenuEnabled =
                    !propertyInfo.readOnlyInPropertyGrid &&
                    (propertyInfo.inheritable ||
                        (propertyInfo.resolutionDependable &&
                            getPageContext().allResolutions.length > 0));

                let property;
                if (colSpan) {
                    property = (
                        <td colSpan={propertyInfo.propertyGridCollapsable ? 3 : 2}>
                            <Property
                                propertyInfo={propertyInfo}
                                object={object}
                                updateObject={this.updateObject}
                            />
                        </td>
                    );
                } else {
                    property = (
                        <React.Fragment>
                            <td className="property-name">
                                {propertyInfo.displayName || humanize(propertyInfo.name)}
                            </td>
                            <td>
                                <Property
                                    propertyInfo={propertyInfo}
                                    object={object}
                                    updateObject={this.updateObject}
                                />
                            </td>
                        </React.Fragment>
                    );
                }

                const className = classNames({
                    highlighted:
                        propertyInfo.name == highlightedPropertyName ||
                        isHighlightedProperty(propertyInfo, object)
                });

                const propertyComponent = (
                    <tr className={className} key={propertyInfo.name}>
                        {property}
                        {isPropertyMenuSupported && !propertyInfo.propertyGridCollapsable && (
                            <td>
                                {propertyMenuEnabled && (
                                    <PropertyMenu
                                        propertyInfo={propertyInfo}
                                        object={object}
                                        updateObject={this.updateObject}
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
                        <GroupTitle group={groupProperties.group} object={this.props.object!} />
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

        for (let i = 1; i < rows.length; i += 2) {
            rows.splice(i, 0, <GroupBorder key={`border${i}`} />);
        }

        return (
            <PropertyGridDiv ref={(ref: any) => (this.div = ref)} className={this.props.className}>
                <table>
                    <tbody>{rows}</tbody>
                </table>
            </PropertyGridDiv>
        );
    }
}
