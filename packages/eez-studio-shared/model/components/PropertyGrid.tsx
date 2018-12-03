import React from "react";
import { computed, observable, action, runInAction, autorun } from "mobx";
import { observer, disposeOnUnmount } from "mobx-react";
import { bind } from "bind-decorator";

import { guid } from "eez-studio-shared/guid";
import { humanize } from "eez-studio-shared/string";
import styled from "eez-studio-ui/styled-components";

import { validators, filterNumber } from "eez-studio-shared/model/validation";

import { showGenericDialog } from "eez-studio-ui/generic-dialog";
import { CodeEditor } from "eez-studio-ui/code-editor";

import {
    EezObject,
    PropertyInfo,
    PropertyType,
    getProperty,
    isArray,
    asArray,
    isValue,
    objectToString,
    getInheritedValue,
    getPropertyAsString
} from "eez-studio-shared/model/object";
import {
    UndoManager,
    DocumentStore,
    UIElementsFactory,
    IMenuItem
} from "eez-studio-shared/model/store";
import { replaceObjectReference } from "eez-studio-shared/model/search";

//import { ProjectStore } from "project-editor/core/store";

////////////////////////////////////////////////////////////////////////////////

interface PropertyProps {
    propertyInfo: PropertyInfo;
    object: EezObject;
    updateObject: (propertyValues: Object) => void;
}

////////////////////////////////////////////////////////////////////////////////

const PropertyMenuDiv = styled.div`
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

    &.modified > div {
        background-color: #666;
    }

    &.inherited > div {
        background-color: #00d;
    }
`;

interface PropertyValueSourceInfo {
    source: "default" | "modified" | "inherited";
    inheritedFrom?: string;
}

@observer
class PropertyMenu extends React.Component<PropertyProps, {}> {
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

        if ("defaultValue" in this.props.propertyInfo) {
            if (value !== this.props.propertyInfo.defaultValue) {
                return {
                    source: "modified"
                };
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

        if (this.sourceInfo.source === "modified") {
            menuItems.push(
                UIElementsFactory.createMenuItem({
                    label: "Reset",
                    click: () => {
                        this.props.updateObject({
                            [this.props.propertyInfo.name]: this.props.propertyInfo.defaultValue
                        });
                    }
                })
            );
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
            title += " from " + this.sourceInfo.inheritedFrom;
        }

        return (
            <PropertyMenuDiv
                className={this.sourceInfo.source}
                title={title}
                onClick={this.onClicked}
            >
                <div />
            </PropertyMenuDiv>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

@observer
class CodeEditorProperty extends React.Component<PropertyProps, {}> {
    @observable
    value: string = this.getValue();
    editor: CodeEditor;

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
        return (
            <CodeEditor
                ref={ref => (this.editor = ref!)}
                value={this.value}
                onChange={this.onChange}
                onFocus={this.onFocus}
                onBlur={this.onBlur}
                className="form-control"
                mode="json"
                style={{ height: 320 }}
            />
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

@observer
class Property extends React.Component<PropertyProps> {
    refs: {
        [key: string]: Element;
        textarea: HTMLDivElement;
        input: HTMLInputElement;
        select: HTMLSelectElement;
    };

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
        if (this.refs.textarea) {
            this.refs.textarea.style.overflow = "hidden";
            this.refs.textarea.style.height = "0";
            setTimeout(() => {
                this.refs.textarea.style.height = this.refs.textarea.scrollHeight + "px";
            });
        }
    }

    @action
    componentWillReceiveProps(props: PropertyProps) {
        this._value = (props.object as any)[props.propertyInfo.name];
    }

    componentDidMount() {
        let el = this.refs.input || this.refs.textarea || this.refs.select;
        if (el) {
            $(el).on("focus", () => {
                UndoManager.setCombineCommands(true);
            });

            $(el).on("blur", () => {
                UndoManager.setCombineCommands(false);
            });
        }

        setTimeout(this.resizeTextArea);
    }

    componentDidUpdate() {
        setTimeout(this.resizeTextArea);
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

    @action
    changeValue(newValue: any) {
        if (this.props.propertyInfo.readOnlyInPropertyGrid) {
            return;
        }

        this._value = newValue;

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
            this.changeValue(enumItem!.id);
        } else {
            this.changeValue(target.type === "checkbox" ? target.checked : target.value);
        }
    }

    @bind
    onEditUnique() {
        showGenericDialog({
            dialogDefinition: {
                title: "Edit Property",
                fields: [
                    {
                        name: this.props.propertyInfo.name,
                        type: "string",
                        validators: [
                            validators.required,
                            validators.unique(
                                this.props.object,
                                asArray(this.props.object._parent!)
                            )
                        ]
                    }
                ]
            },
            values: this.props.object
        })
            .then(result => {
                let oldValue = this.value;
                let newValue = result.values[this.props.propertyInfo.name];
                if (newValue != oldValue) {
                    UndoManager.setCombineCommands(true);
                    replaceObjectReference(this.props.object, newValue);
                    this.changeValue(newValue);
                    UndoManager.setCombineCommands(false);
                }
            })
            .catch(error => console.error(error));
    }

    @bind
    onGenerateGuid() {
        this.changeValue(guid());
    }

    render() {
        const propertyInfo = this.props.propertyInfo;

        if (propertyInfo.readOnlyInPropertyGrid) {
            return <input type="text" className="form-control" value={this.value} readOnly />;
        }

        if (propertyInfo.type === PropertyType.String && propertyInfo.unique) {
            return (
                <div className="input-group">
                    <input
                        ref="input"
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
                    ref="textarea"
                    className="form-control"
                    value={this.value}
                    onChange={this.onChange}
                    style={{ resize: "none" }}
                />
            );
        } else if (propertyInfo.type === PropertyType.JSON) {
            return <CodeEditorProperty {...this.props} />;
        } else if (propertyInfo.type === PropertyType.Object) {
            let value = getPropertyAsString(this.props.object, propertyInfo);
            if (propertyInfo.onSelect) {
                return (
                    <div className="input-group" title={value}>
                        <input
                            ref="input"
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
                return <input type="text" className="form-control" value={value} readOnly />;
            }
        } else if (propertyInfo.type === PropertyType.Enum) {
            let options: JSX.Element[];

            if (propertyInfo.enumItems) {
                options = propertyInfo.enumItems.map(enumItem => {
                    const id = enumItem.id.toString();
                    return (
                        <option key={id} value={id}>
                            {humanize(id)}
                        </option>
                    );
                });
            } else {
                options = [];
            }

            options.unshift(<option key="__empty" value="" />);

            return (
                <select
                    ref="select"
                    className="form-control"
                    value={this.value}
                    onChange={this.onChange}
                >
                    {options}
                </select>
            );
        } else if (propertyInfo.type === PropertyType.ObjectReference) {
            if (propertyInfo.onSelect) {
                return (
                    <div className="input-group" title={this.value}>
                        <input
                            ref="input"
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

                let options = objects.map(object => {
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
                        ref="select"
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
                        ref="input"
                        type="checkbox"
                        checked={this.value}
                        onChange={this.onChange}
                    />
                    {" " + (propertyInfo.displayName || humanize(propertyInfo.name))}
                </label>
            );
        } else if (propertyInfo.type === PropertyType.GUID) {
            return (
                <div className="input-group">
                    <input
                        ref="input"
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
                    ref="input"
                    type="text"
                    className="form-control"
                    value={this.value}
                    onChange={this.onChange}
                />
            );
        } else if (propertyInfo.type === PropertyType.Number) {
            return (
                <input
                    ref="input"
                    type="text"
                    className="form-control"
                    value={this.value}
                    onChange={this.onChange}
                />
            );
        } else if (propertyInfo.type === PropertyType.Color) {
            return (
                <input
                    ref="input"
                    type="color"
                    className="form-control"
                    value={this.value}
                    onChange={this.onChange}
                />
            );
        } else {
            return UIElementsFactory.renderProperty(propertyInfo, this.value, value =>
                this.changeValue(value)
            );
        }
        return null;
    }
}

////////////////////////////////////////////////////////////////////////////////

const PropertyGridDiv = styled.div`
    padding: 5px;
    overflow-x: hidden;
    overflow-y: auto;

    & > table {
        width: 100%;

        tr.marked {
            background-color: #ffccd4;
        }

        td {
            padding: 5px;
            vertical-align: middle;
        }

        td:first-child {
            width: 25%;
            max-width: 150px;
            vertical-align: baseline;
            transform: translateY(8px);
        }

        td:nth-child(2) {
            width: 75%;
        }

        td > input[type="checkbox"] {
            height: 20px;
            margin-top: 7px;
        }
    }
`;

interface PropertyGridProps {
    object: EezObject;
    className?: string;
}

@observer
export class PropertyGrid extends React.Component<PropertyGridProps, {}> {
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

        let markedPropertyName: string | undefined;

        let object;
        if (isValue(this.props.object)) {
            markedPropertyName = this.props.object._key;
            object = this.props.object._parent as EezObject;
        } else {
            object = this.props.object;
        }

        let properties: JSX.Element[] = [];

        for (let propertyInfo of object._classInfo.properties) {
            if (!isArray(object) && !propertyInfo.hideInPropertyGrid) {
                const colSpan = propertyInfo.type === PropertyType.Boolean;

                let property;
                if (colSpan) {
                    property = (
                        <td colSpan={2}>
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
                            <td>{propertyInfo.displayName || humanize(propertyInfo.name)}</td>
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

                properties.push(
                    <tr
                        className={propertyInfo.name == markedPropertyName ? "marked" : ""}
                        key={propertyInfo.name}
                    >
                        {property}
                        <td>
                            {!propertyInfo.readOnlyInPropertyGrid && (
                                <PropertyMenu
                                    propertyInfo={propertyInfo}
                                    object={object}
                                    updateObject={this.updateObject}
                                />
                            )}
                        </td>
                    </tr>
                );
            }
        }

        return (
            <PropertyGridDiv className={this.props.className}>
                <table>
                    <tbody>
                        <tr>
                            <td colSpan={2} />
                        </tr>
                        {properties}
                    </tbody>
                </table>
            </PropertyGridDiv>
        );
    }
}
