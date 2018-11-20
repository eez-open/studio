import React from "react";
import { observable, action } from "mobx";
import { observer } from "mobx-react";
import { bind } from "bind-decorator";

import { guid } from "eez-studio-shared/util";
import { humanize } from "eez-studio-shared/string";
import { Icon } from "eez-studio-ui/icon";
import styled from "eez-studio-ui/styled-components";

import { validators } from "eez-studio-shared/model/validation";

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
} from "project-editor/core/object";
import { UndoManager, ProjectStore } from "project-editor/core/store";
import { replaceObjectReference } from "project-editor/core/search";

const { Menu, MenuItem } = EEZStudio.electron.remote;

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
    onClicked() {
        let menuItems: Electron.MenuItem[] = [];

        if (this.sourceInfo.source === "modified") {
            menuItems.push(
                new MenuItem({
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
            const menu = new Menu();
            menuItems.forEach(menuItem => menu.append(menuItem));
            menu.popup({});
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

const ConfigurationReferencesPropertyValueDiv = styled.div`
    border: 1px solid #ced4da;
    border-radius: 0.25rem;
    padding: 0.375rem 0.75rem;
`;

const ConfigurationReferencesPropertyValueConfigurationsDiv = styled.div`
    padding-left: 1.25rem;
`;

export class ConfigurationReferencesPropertyValue extends React.Component<
    {
        value: string[] | undefined;
        onChange: (value: string[] | undefined) => void;
    },
    {}
> {
    render() {
        return (
            <ConfigurationReferencesPropertyValueDiv className="EezStudio_ProjectEditor_PropertyGrid">
                <div className="form-check">
                    <label>
                        <input
                            className="form-check-input"
                            type="radio"
                            value="all"
                            checked={!this.props.value}
                            onChange={() => this.props.onChange(undefined)}
                        />
                        All build configurations
                    </label>
                </div>
                <div className="form-check">
                    <label>
                        <input
                            className="form-check-input"
                            type="radio"
                            value="selected"
                            checked={!!this.props.value}
                            onChange={() => this.props.onChange([])}
                        />
                        Selected build configurations
                    </label>
                </div>
                {this.props.value && (
                    <ConfigurationReferencesPropertyValueConfigurationsDiv>
                        {ProjectStore.project.settings.build.configurations._array.map(
                            configuration => {
                                return (
                                    <div key={configuration.name} className="checkbox">
                                        <label>
                                            <input
                                                ref="input"
                                                type="checkbox"
                                                checked={
                                                    this.props.value!.indexOf(
                                                        configuration.name
                                                    ) !== -1
                                                }
                                                onChange={event => {
                                                    let value = this.props.value!.slice();
                                                    if (event.target.checked) {
                                                        value.push(configuration.name);
                                                    } else {
                                                        value.splice(
                                                            value.indexOf(configuration.name),
                                                            1
                                                        );
                                                    }
                                                    this.props.onChange(value);
                                                }}
                                            />
                                            {" " + configuration.name}
                                        </label>
                                    </div>
                                );
                            }
                        )}
                    </ConfigurationReferencesPropertyValueConfigurationsDiv>
                )}
            </ConfigurationReferencesPropertyValueDiv>
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
class Property extends React.Component<PropertyProps, {}> {
    refs: {
        [key: string]: Element;
        textarea: HTMLDivElement;
        input: HTMLInputElement;
        select: HTMLSelectElement;
    };

    get value() {
        let value = (this.props.object as any)[this.props.propertyInfo.name];

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

    static getValue(props: PropertyProps) {}

    @bind
    onSelect() {
        if (this.props.propertyInfo.onSelect) {
            this.props.propertyInfo
                .onSelect(this.props.object)
                .then(propertyValues => {
                    this.props.updateObject(propertyValues);
                })
                .catch(error => console.error(error));
        }
    }

    changeValue(newValue: any) {
        if (this.props.propertyInfo.readOnlyInPropertyGrid) {
            return;
        }

        this.setState({
            value: newValue != undefined ? newValue : ""
        });

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
    onClear() {
        this.changeValue(undefined);
    }

    @bind
    onSelectImageFile() {
        EEZStudio.electron.remote.dialog.showOpenDialog(
            {
                properties: ["openFile"],
                filters: [
                    { name: "Image files", extensions: ["png", "jpg", "jpeg"] },
                    { name: "All Files", extensions: ["*"] }
                ]
            },
            filePaths => {
                if (filePaths[0]) {
                    this.changeValue(ProjectStore.getFilePathRelativeToProjectPath(filePaths[0]));
                }
            }
        );
    }

    @bind
    onSelectFolder() {
        EEZStudio.electron.remote.dialog.showOpenDialog(
            {
                properties: ["openDirectory"]
            },
            filePaths => {
                if (filePaths[0]) {
                    this.changeValue(ProjectStore.getFolderPathRelativeToProjectPath(filePaths[0]));
                }
            }
        );
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
                            validators.unique(this.props.object, this.props.object._parent)
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
        } else if (propertyInfo.type === PropertyType.Image) {
            return (
                <div>
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
                                onClick={this.onSelectImageFile}
                            >
                                &hellip;
                            </button>
                        </div>
                    </div>
                    {this.value && (
                        <img
                            src={ProjectStore.getAbsoluteFilePath(this.value)}
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
        } else if (propertyInfo.type === PropertyType.RelativeFolder) {
            let clearButton: JSX.Element | undefined;

            if (this.value !== undefined) {
                clearButton = (
                    <button className="btn btn-secondary" type="button" onClick={this.onClear}>
                        <Icon icon="material:close" size={14} />
                    </button>
                );
            }

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
                        {clearButton}
                        <button
                            className="btn btn-secondary"
                            type="button"
                            onClick={this.onSelectFolder}
                        >
                            &hellip;
                        </button>
                    </div>
                </div>
            );
        } else if (propertyInfo.type === PropertyType.ObjectReference) {
            let objects: EezObject[] = [];

            if (propertyInfo.referencedObjectCollectionPath) {
                objects = asArray(
                    ProjectStore.getObjectFromPath(propertyInfo.referencedObjectCollectionPath)
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

            if (this.value && !objects.find(object => getProperty(object, "name") == this.value)) {
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
        } else if (propertyInfo.type === PropertyType.ConfigurationReference) {
            return (
                <ConfigurationReferencesPropertyValue
                    value={this.value}
                    onChange={value => this.changeValue(value)}
                />
            );
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
                    type="number"
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
            ProjectStore.updateObject(object, propertyValues);
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
