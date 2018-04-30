import * as React from "react";
import { observable, action } from "mobx";
import { observer } from "mobx-react";
import { bind } from "bind-decorator";

import { humanize } from "shared/string";
import { Icon } from "shared/ui/icon";

import { validators } from "shared/model/validation";

import { showGenericDialog } from "shared/ui/generic-dialog";
import { CodeEditor } from "shared/ui/code-editor";

import {
    UndoManager,
    ProjectStore,
    getObjectFromPath,
    objectToString,
    getObjectPropertiesMetaData,
    getInheritedValue,
    getPropertyAsString,
    isArray,
    isValue,
    updateObject
} from "project-editor/core/store";

import { EezObject, PropertyMetaData } from "project-editor/core/metaData";
import { replaceObjectReference } from "project-editor/core/search";
import { generateGuid } from "project-editor/core/util";

const { Menu, MenuItem } = EEZStudio.electron.remote;

////////////////////////////////////////////////////////////////////////////////

interface PropertyProps {
    propertyMetaData: PropertyMetaData;
    object: EezObject;
    updateObject: (propertyValues: Object) => void;
}

////////////////////////////////////////////////////////////////////////////////

interface PropertyValueSourceInfo {
    source: "default" | "modified" | "inherited";
    inheritedFrom?: string;
}

@observer
class PropertyMenu extends React.Component<PropertyProps, {}> {
    get sourceInfo(): PropertyValueSourceInfo {
        if (this.props.propertyMetaData.inheritable) {
            let value = (this.props.object as any)[this.props.propertyMetaData.name];
            if (value === undefined) {
                let inheritedValue = getInheritedValue(
                    this.props.object,
                    this.props.propertyMetaData.name
                );
                if (inheritedValue) {
                    return {
                        source: "inherited",
                        inheritedFrom: inheritedValue.source
                    };
                }
            }
        }

        if ("defaultValue" in this.props.propertyMetaData) {
            let value = (this.props.object as any)[this.props.propertyMetaData.name];
            if (value !== this.props.propertyMetaData.defaultValue) {
                return {
                    source: "modified"
                };
            }
        }

        return {
            source: "default"
        };
    }

    @bind
    onClicked() {
        let menuItems: Electron.MenuItem[] = [];

        if (this.sourceInfo.source == "modified") {
            menuItems.push(
                new MenuItem({
                    label: "Reset",
                    click: () => {
                        this.props.updateObject({
                            [this.props.propertyMetaData.name]: undefined
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
        let className = `EezStudio_ProjectEditor_property-menu ${this.sourceInfo.source}`;

        let title = humanize(this.sourceInfo.source);
        if (this.sourceInfo.inheritedFrom) {
            title += " from " + this.sourceInfo.inheritedFrom;
        }

        return (
            <div className={className} title={title} onClick={this.onClicked}>
                <div />
            </div>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

export class ConfigurationReferencesPropertyValue extends React.Component<
    {
        value: string[] | undefined;
        onChange: (value: string[] | undefined) => void;
    },
    {}
> {
    render() {
        return (
            <div className="EezStudio_ProjectEditor_PropertyGrid_ConfigurationReferencesPropertyValue">
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
                    <div className="EezStudio_ProjectEditor_PropertyGrid_ConfigurationReferencesPropertyValue_Configurations">
                        {ProjectStore.projectProperties.settings.build.configurations.map(
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
                    </div>
                )}
            </div>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

@observer
class CodeEditorProperty extends React.Component<PropertyProps, {}> {
    @observable value: string = this.getValue();
    editor: CodeEditor;

    getValue(props?: PropertyProps) {
        props = props || this.props;

        let value = (props.object as any)[props.propertyMetaData.name];

        if (value === undefined && props.propertyMetaData.inheritable) {
            let inheritedValue = getInheritedValue(props.object, props.propertyMetaData.name);
            if (inheritedValue) {
                value = inheritedValue.value;
            }
        }

        if (value === undefined) {
            value = props.propertyMetaData.defaultValue;
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
                [this.props.propertyMetaData.name]: this.value
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
        let value = (this.props.object as any)[this.props.propertyMetaData.name];

        if (value === undefined && this.props.propertyMetaData.inheritable) {
            let inheritedValue = getInheritedValue(
                this.props.object,
                this.props.propertyMetaData.name
            );
            if (inheritedValue) {
                value = inheritedValue.value;
            }
        }

        if (value === undefined) {
            value = this.props.propertyMetaData.defaultValue;
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
        if (this.props.propertyMetaData.onSelect) {
            this.props.propertyMetaData
                .onSelect(this.props.object)
                .then(propertyValues => {
                    this.props.updateObject(propertyValues);
                })
                .catch(error => console.error(error));
        }
    }

    changeValue(newValue: any) {
        this.setState({
            value: newValue != undefined ? newValue : ""
        });

        this.props.updateObject({
            [this.props.propertyMetaData.name]: newValue
        });
    }

    @bind
    onChange(event: any) {
        const target = event.target;
        if (this.props.propertyMetaData.type === "configuration-references") {
            if (target.value === "all") {
                this.changeValue(undefined);
            } else {
                this.changeValue([]);
            }
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
                        name: this.props.propertyMetaData.name,
                        type: "string",
                        validators: [
                            validators.required,
                            validators.unique(this.props.object, this.props.object.getParent())
                        ]
                    }
                ]
            },
            values: this.props.object
        })
            .then(result => {
                let oldValue = this.value;
                let newValue = result.values[this.props.propertyMetaData.name];
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
        this.changeValue(generateGuid());
    }

    render() {
        if (this.props.propertyMetaData.type == "string" && this.props.propertyMetaData.unique) {
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
        } else if (this.props.propertyMetaData.type == "multiline-text") {
            return (
                <textarea
                    ref="textarea"
                    className="form-control"
                    value={this.value}
                    onChange={this.onChange}
                    style={{ resize: "none" }}
                />
            );
        } else if (this.props.propertyMetaData.type == "json") {
            return <CodeEditorProperty {...this.props} />;
        } else if (this.props.propertyMetaData.type == "object") {
            let value = getPropertyAsString(this.props.object, this.props.propertyMetaData);
            if (this.props.propertyMetaData.onSelect) {
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
        } else if (this.props.propertyMetaData.type == "enum") {
            let options: JSX.Element[];

            if (this.props.propertyMetaData.enumItems) {
                options = this.props.propertyMetaData.enumItems.map(enumItem => {
                    return (
                        <option key={enumItem.id} value={enumItem.id}>
                            {humanize(enumItem.id)}
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
        } else if (this.props.propertyMetaData.type == "image") {
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
        } else if (this.props.propertyMetaData.type == "project-relative-folder") {
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
        } else if (this.props.propertyMetaData.type == "object-reference") {
            let objects: EezObject[] = [];

            if (this.props.propertyMetaData.referencedObjectCollectionPath) {
                objects = getObjectFromPath(
                    this.props.propertyMetaData.referencedObjectCollectionPath
                ) as any;
                if (!objects) {
                    objects = [];
                }
            }

            let options = objects.map(object => {
                return (
                    <option key={object.$eez.id} value={object["name"]}>
                        {objectToString(object)}
                    </option>
                );
            });

            options.unshift(<option key="__empty" value="" />);

            if (this.value && !objects.find(object => object["name"] == this.value)) {
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
        } else if (this.props.propertyMetaData.type == "configuration-references") {
            return (
                <ConfigurationReferencesPropertyValue
                    value={this.value}
                    onChange={value => this.changeValue(value)}
                />
            );
        } else if (this.props.propertyMetaData.type == "boolean") {
            return (
                <input ref="input" type="checkbox" checked={this.value} onChange={this.onChange} />
            );
        } else if (this.props.propertyMetaData.type == "guid") {
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
        } else {
            return (
                <input
                    ref="input"
                    type={this.props.propertyMetaData.type}
                    className="form-control"
                    value={this.value}
                    onChange={this.onChange}
                />
            );
        }
    }
}

////////////////////////////////////////////////////////////////////////////////

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
                object = object.getParent() as EezObject;
            }
            updateObject(object, propertyValues);
        }
    }

    render() {
        if (!this.props.object) {
            return null;
        }

        let markedPropertyName: string | undefined;

        let object;
        if (isValue(this.props.object)) {
            markedPropertyName = this.props.object.getKey();
            object = this.props.object.getParent() as EezObject;
        } else {
            object = this.props.object;
        }

        let properties: JSX.Element[] = [];

        for (let propertyMetaData of getObjectPropertiesMetaData(object)) {
            if (!isArray(object) && !propertyMetaData.hideInPropertyGrid) {
                properties.push(
                    <tr
                        className={propertyMetaData.name == markedPropertyName ? "marked" : ""}
                        key={propertyMetaData.name}
                    >
                        <td>{propertyMetaData.displayName || humanize(propertyMetaData.name)}</td>
                        <td>
                            <Property
                                propertyMetaData={propertyMetaData}
                                object={object}
                                updateObject={this.updateObject}
                            />
                        </td>
                        <td>
                            <PropertyMenu
                                propertyMetaData={propertyMetaData}
                                object={object}
                                updateObject={this.updateObject}
                            />
                        </td>
                    </tr>
                );
            }
        }

        let className = "EezStudio_ProjectEditor_PropertyGrid";
        if (this.props.className) {
            className += " " + this.props.className;
        }

        return (
            <div className={className}>
                <table>
                    <tbody>
                        <tr>
                            <td colSpan={2} />
                        </tr>
                        {properties}
                    </tbody>
                </table>
            </div>
        );
    }
}
