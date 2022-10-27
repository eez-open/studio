import fs from "fs";
import React from "react";
import { observable, action, runInAction, autorun, makeObservable } from "mobx";
import { observer } from "mobx-react";
import classNames from "classnames";
import { dialog } from "@electron/remote";

import { guid } from "eez-studio-shared/guid";
import { humanize } from "eez-studio-shared/string";
import { validators, filterNumber } from "eez-studio-shared/validation";

import { showGenericDialog } from "eez-studio-ui/generic-dialog";
import { Icon } from "eez-studio-ui/icon";

import {
    PropertyType,
    PropertyProps,
    getParent,
    PropertyInfo,
    IEezObject,
    getObjectPropertyDisplayName,
    isPropertyOptional,
    EnumItem
} from "project-editor/core/object";
import { info } from "project-editor/core/util";
import { replaceObjectReference } from "project-editor/core/search";

import { ConfigurationReferencesPropertyValue } from "project-editor/ui-components/ConfigurationReferencesPropertyValue";

import { ProjectContext } from "project-editor/project/context";
import { parseIdentifier } from "project-editor/flow/expression";
import {
    EXPR_MARK_END,
    EXPR_MARK_START
} from "project-editor/flow/expression/ExpressionBuilder";

import { getPropertyValue, getPropertyValueAsString } from "./utils";
import { CodeEditorProperty } from "./CodeEditorProperty";
import { ThemedColorInput } from "./ThemedColorInput";
import { ObjectReferenceInput } from "./ObjectReferenceInput";
import { ProjectEditor } from "project-editor/project-editor-interface";

////////////////////////////////////////////////////////////////////////////////

export const Property = observer(
    class Property extends React.Component<PropertyProps> {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        textarea: HTMLDivElement;
        input: HTMLInputElement;
        select: HTMLSelectElement;

        _value: any = undefined;

        changeDocumentDisposer: any;

        resizeTextArea = () => {
            if (this.textarea) {
                this.textarea.style.height = "0";
                this.textarea.style.height = this.textarea.scrollHeight + "px";
            }
        };

        constructor(props: PropertyProps) {
            super(props);

            makeObservable(this, {
                _value: observable,
                componentDidUpdate: action,
                changeValue: action.bound
            });
        }

        updateChangeDocumentObserver() {
            if (this.changeDocumentDisposer) {
                this.changeDocumentDisposer();
            }

            this.changeDocumentDisposer = autorun(() => {
                if (this.context.project) {
                    const getPropertyValueResult = getPropertyValue(
                        this.props.objects,
                        this.props.propertyInfo
                    );
                    runInAction(() => {
                        this._value = getPropertyValueResult
                            ? getPropertyValueResult.value
                            : undefined;
                    });
                }
            });
        }

        componentDidUpdate(prevProps: PropertyProps) {
            if (
                !arrayCompareShallow(prevProps.objects, this.props.objects) ||
                prevProps.propertyInfo != this.props.propertyInfo
            ) {
                this.updateChangeDocumentObserver();
            }

            this.resizeTextArea();
        }

        componentDidMount() {
            this.updateChangeDocumentObserver();

            let el = this.input || this.textarea || this.select;
            if (el) {
                $(el).on("focus", () => {
                    this.context.undoManager.setCombineCommands(true);
                });

                $(el).on("blur", () => {
                    this.context.undoManager.setCombineCommands(false);
                });
            }

            this.resizeTextArea();
        }

        componentWillUnmount() {
            this.changeDocumentDisposer();
        }

        onSelect = (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
            if (this.props.propertyInfo.onSelect) {
                let params;

                if (
                    this.props.propertyInfo.type == PropertyType.String ||
                    this.props.propertyInfo.type ==
                        PropertyType.MultilineText ||
                    this.props.propertyInfo.type == PropertyType.ObjectReference
                ) {
                    const input = $(event.target)
                        .parent()
                        .parent()
                        .find("input,textarea")[0] as HTMLInputElement;
                    if (input) {
                        params = {
                            textInputSelection: {
                                start: input.selectionStart,
                                end: input.selectionEnd,
                                direction: input.selectionDirection
                            }
                        };
                    }
                }

                this.props.propertyInfo
                    .onSelect(
                        this.props.objects[0],
                        this.props.propertyInfo,
                        params
                    )
                    .then(propertyValues => {
                        this.props.updateObject(propertyValues);
                    })
                    .catch(error => console.error(error));
            }
        };

        changeValue(newValue: any) {
            if (this.props.readOnly) {
                return;
            }

            runInAction(() => {
                this._value = newValue;
            });

            if (this.props.propertyInfo.type === PropertyType.Number) {
                if (
                    newValue.trim() === "" &&
                    isPropertyOptional(
                        this.props.objects[0],
                        this.props.propertyInfo
                    )
                ) {
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

        onChange = (event: any) => {
            const target = event.target;
            if (
                this.props.propertyInfo.type ===
                PropertyType.ConfigurationReference
            ) {
                if (target.value === "all") {
                    this.changeValue(undefined);
                } else {
                    this.changeValue([]);
                }
            } else if (this.props.propertyInfo.type === PropertyType.Enum) {
                const id = target.value.toString();
                const enumItem = getEnumItems(
                    this.props.objects,
                    this.props.propertyInfo
                )!.find(enumItem => enumItem.id.toString() === id);
                this.changeValue(enumItem && enumItem!.id);
            } else {
                this.changeValue(
                    target.type === "checkbox" ? target.checked : target.value
                );
            }
        };

        onSelectionChange = (
            event: React.SyntheticEvent<
                HTMLTextAreaElement | HTMLInputElement,
                Event
            >
        ) => {
            const start = event.currentTarget.selectionStart;
            const end = event.currentTarget.selectionEnd;
            if (!(typeof start == "number") || !(typeof end == "number")) {
                return;
            }

            const value = event.currentTarget.value;

            let expressionStart: number | undefined;
            for (let i = start; i >= 0; i--) {
                if (
                    value[i] == EXPR_MARK_START[0] &&
                    value[i + 1] == EXPR_MARK_START[1]
                ) {
                    expressionStart = i;
                    break;
                }
            }

            if (expressionStart === undefined) {
                return;
            }

            let expressionEnd: number | undefined;
            for (let i = end; i < value.length; i++) {
                if (
                    value[i] == EXPR_MARK_END[1] &&
                    value[i - 1] == EXPR_MARK_END[0]
                ) {
                    expressionEnd = i + 1;
                    break;
                }
            }

            if (expressionEnd === undefined) {
                return;
            }

            const identifier = value.substring(
                expressionStart + 2,
                expressionEnd - 2
            );

            if (identifier.length == 0) {
                return;
            }

            let isIdentifier = false;
            try {
                isIdentifier = parseIdentifier(identifier);
            } catch (err) {
                return;
            }

            if (!isIdentifier) {
                return;
            }

            event.currentTarget.setSelectionRange(
                expressionStart,
                expressionEnd,
                event.currentTarget.selectionDirection ?? undefined
            );
        };

        onEditUnique = () => {
            showGenericDialog({
                dialogDefinition: {
                    fields: [
                        {
                            name: this.props.propertyInfo.name,
                            type: "string",
                            validators: [
                                typeof this.props.propertyInfo.unique ===
                                "boolean"
                                    ? validators.unique(
                                          this.props.objects[0],
                                          getParent(this.props.objects[0])
                                      )
                                    : this.props.propertyInfo.unique!(
                                          this.props.objects[0],
                                          getParent(this.props.objects[0]),
                                          this.props.propertyInfo
                                      )
                            ].concat(
                                isPropertyOptional(
                                    this.props.objects[0],
                                    this.props.propertyInfo
                                )
                                    ? []
                                    : [validators.required]
                            )
                        }
                    ]
                },
                values: this.props.objects[0]
            })
                .then(result => {
                    let oldValue = this._value;
                    let newValue =
                        result.values[this.props.propertyInfo.name].trim();
                    if (newValue.length === 0) {
                        newValue = undefined;
                    }
                    if (newValue != oldValue) {
                        this.context.undoManager.setCombineCommands(true);

                        runInAction(() => {
                            replaceObjectReference(
                                this.props.objects[0],
                                newValue
                            );
                            this.changeValue(newValue);
                        });

                        this.context.undoManager.setCombineCommands(false);
                    }
                })
                .catch(error => {
                    if (error !== undefined) {
                        console.error(error);
                    }
                });
        };

        onGenerateGuid = () => {
            this.changeValue(guid());
        };

        onKeyDown = (event: React.KeyboardEvent) => {
            if (event.keyCode === 13) {
                if (this.props.propertyInfo.type === PropertyType.Number) {
                    try {
                        var mexp = require("math-expression-evaluator");
                        const newValue = mexp.eval(this._value);
                        if (
                            newValue !== undefined &&
                            newValue !== this._value
                        ) {
                            this.props.updateObject({
                                [this.props.propertyInfo.name]: newValue
                            });
                        }
                    } catch (err) {
                        console.error(err);
                    }
                }
            }
        };

        render() {
            const { propertyInfo, readOnly } = this.props;

            // if (readOnly && propertyInfo.type != PropertyType.CSS) {
            //     const getPropertyValueAsStringResult = getPropertyValueAsString(
            //         this.props.objects,
            //         propertyInfo
            //     );
            //     let value =
            //         (getPropertyValueAsStringResult !== undefined
            //             ? getPropertyValueAsStringResult.value
            //             : undefined) || "";
            //     return (
            //         <input
            //             type="text"
            //             className="form-control"
            //             value={value}
            //             readOnly
            //         />
            //     );
            // }

            let isOnSelectAvailable;
            if (propertyInfo.onSelect) {
                if (propertyInfo.isOnSelectAvailable) {
                    isOnSelectAvailable = propertyInfo.isOnSelectAvailable(
                        this.props.objects[0]
                    );
                } else {
                    isOnSelectAvailable = true;
                }
            } else {
                isOnSelectAvailable = false;
            }

            if (propertyInfo.propertyGridRowComponent) {
                return (
                    <propertyInfo.propertyGridRowComponent {...this.props} />
                );
            } else if (propertyInfo.propertyGridColumnComponent) {
                return (
                    <propertyInfo.propertyGridColumnComponent {...this.props} />
                );
            } else if (
                propertyInfo.type === PropertyType.String &&
                propertyInfo.unique
            ) {
                return (
                    <div className="input-group">
                        <input
                            ref={(ref: any) => (this.input = ref)}
                            type="text"
                            className="form-control"
                            value={this._value || ""}
                            readOnly
                        />
                        <button
                            className="btn btn-secondary"
                            type="button"
                            onClick={this.onEditUnique}
                        >
                            &hellip;
                        </button>
                    </div>
                );
            } else if (propertyInfo.type === PropertyType.MultilineText) {
                if (!readOnly && isOnSelectAvailable) {
                    return (
                        <div className="input-group" title={this._value || ""}>
                            <textarea
                                ref={(ref: any) => (this.textarea = ref)}
                                className={classNames("form-control", {
                                    pre: propertyInfo.monospaceFont
                                })}
                                value={this._value || ""}
                                onChange={this.onChange}
                                onSelect={this.onSelectionChange}
                                style={{ resize: "none", overflowY: "hidden" }}
                                readOnly={propertyInfo.computed}
                                spellCheck={
                                    propertyInfo.disableSpellcheck
                                        ? false
                                        : true
                                }
                            />
                            <button
                                className="btn btn-secondary"
                                type="button"
                                onClick={this.onSelect}
                                title={this.props.propertyInfo.onSelectTitle}
                            >
                                &hellip;
                            </button>
                        </div>
                    );
                } else {
                    return (
                        <textarea
                            ref={(ref: any) => (this.textarea = ref)}
                            className={classNames("form-control", {
                                pre: propertyInfo.monospaceFont
                            })}
                            value={this._value || ""}
                            onChange={this.onChange}
                            style={{ resize: "none", overflowY: "hidden" }}
                            readOnly={readOnly || propertyInfo.computed}
                            spellCheck={
                                propertyInfo.disableSpellcheck ? false : true
                            }
                        />
                    );
                }
            } else if (propertyInfo.type === PropertyType.JSON) {
                return (
                    <CodeEditorProperty
                        {...this.props}
                        mode="json"
                        showLabel={false}
                    />
                );
            } else if (propertyInfo.type === PropertyType.JavaScript) {
                return (
                    <CodeEditorProperty
                        {...this.props}
                        mode="javascript"
                        showLabel={false}
                    />
                );
            } else if (propertyInfo.type === PropertyType.CSS) {
                return (
                    <CodeEditorProperty
                        {...this.props}
                        mode="css"
                        showLabel={false}
                        readOnly={readOnly || !!propertyInfo.computed}
                    />
                );
            } else if (propertyInfo.type === PropertyType.Python) {
                return (
                    <CodeEditorProperty
                        {...this.props}
                        mode="python"
                        showLabel={false}
                    />
                );
            } else if (propertyInfo.type === PropertyType.CPP) {
                return (
                    <CodeEditorProperty
                        {...this.props}
                        mode="c_cpp"
                        showLabel={false}
                    />
                );
            } else if (
                propertyInfo.type === PropertyType.Object ||
                (propertyInfo.type === PropertyType.Array &&
                    isOnSelectAvailable)
            ) {
                if (isOnSelectAvailable) {
                    const getPropertyValueAsStringResult =
                        getPropertyValueAsString(
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
                                <button
                                    className="btn btn-secondary"
                                    type="button"
                                    title={
                                        this.props.propertyInfo.onSelectTitle
                                    }
                                    onClick={this.onSelect}
                                >
                                    &hellip;
                                </button>
                            )}
                        </div>
                    );
                } else {
                    return (
                        <ProjectEditor.EmbeddedPropertyGrid {...this.props} />
                    );
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

                    let enumItems: EnumItem[];

                    if (propertyInfo.enumItems) {
                        enumItems = getEnumItems(
                            this.props.objects,
                            propertyInfo
                        );
                    } else {
                        enumItems = [];
                    }

                    options = enumItems.map(enumItem => {
                        const id = enumItem.id.toString();
                        return (
                            <option key={id} value={id}>
                                {enumItem.label || humanize(id)}
                            </option>
                        );
                    });

                    const value = this._value !== undefined ? this._value : "";

                    if (
                        !propertyInfo.enumDisallowUndefined ||
                        enumItems.map(enumItem => enumItem.id).indexOf(value) ==
                            -1
                    ) {
                        options.unshift(<option key="__empty" value="" />);
                    }

                    return (
                        <select
                            ref={(ref: any) => (this.select = ref)}
                            className="form-select"
                            value={value}
                            onChange={this.onChange}
                        >
                            {options}
                        </select>
                    );
                }
            } else if (propertyInfo.type === PropertyType.ObjectReference) {
                if (readOnly) {
                    return (
                        <textarea
                            ref={(ref: any) => (this.textarea = ref)}
                            className={classNames("form-control", {
                                pre: propertyInfo.monospaceFont
                            })}
                            value={this._value || ""}
                            onChange={this.onChange}
                            style={{ resize: "none", overflowY: "hidden" }}
                            readOnly={readOnly || propertyInfo.computed}
                            spellCheck={
                                propertyInfo.disableSpellcheck ? false : true
                            }
                        />
                    );
                } else {
                    if (isOnSelectAvailable) {
                        return (
                            <div
                                className="input-group"
                                title={this._value || ""}
                            >
                                <textarea
                                    ref={(ref: any) => (this.textarea = ref)}
                                    className={classNames("form-control", {
                                        pre: propertyInfo.monospaceFont
                                    })}
                                    value={this._value || ""}
                                    onChange={this.onChange}
                                    onSelect={this.onSelectionChange}
                                    style={{
                                        resize: "none",
                                        overflowY: "hidden"
                                    }}
                                    readOnly={propertyInfo.computed}
                                    spellCheck={
                                        propertyInfo.disableSpellcheck
                                            ? false
                                            : true
                                    }
                                />
                                <button
                                    className="btn btn-secondary"
                                    type="button"
                                    onClick={this.onSelect}
                                    title={
                                        this.props.propertyInfo.onSelectTitle
                                    }
                                >
                                    &hellip;
                                </button>
                            </div>
                        );
                    } else {
                        return (
                            <ObjectReferenceInput
                                propertyInfo={propertyInfo}
                                value={this._value || ""}
                                onChange={this.changeValue}
                                readOnly={readOnly}
                            />
                        );
                    }
                }
            } else if (propertyInfo.type === PropertyType.Boolean) {
                if (propertyInfo.checkboxStyleSwitch) {
                    return (
                        <div className="form-check form-switch">
                            <input
                                ref={(ref: any) => (this.input = ref)}
                                className="form-check-input"
                                type="checkbox"
                                role="switch"
                                checked={this._value || false}
                                onChange={this.onChange}
                                readOnly={readOnly}
                                disabled={readOnly}
                            />
                        </div>
                    );
                } else {
                    return (
                        <label className="EezStudio_PropertyGrid_Checkbox">
                            <input
                                ref={(ref: any) => (this.input = ref)}
                                type="checkbox"
                                checked={this._value || false}
                                onChange={this.onChange}
                                readOnly={readOnly}
                            />
                            <span>
                                {" " +
                                    getObjectPropertyDisplayName(
                                        this.props.objects[0],
                                        propertyInfo
                                    )}
                            </span>
                        </label>
                    );
                }
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
                            <button
                                className="btn btn-secondary"
                                type="button"
                                title="Generate GUID"
                                onClick={this.onGenerateGuid}
                            >
                                +
                            </button>
                        )}
                    </div>
                );
            } else if (propertyInfo.type === PropertyType.String) {
                if (!readOnly && isOnSelectAvailable) {
                    return (
                        <div className="input-group" title={this._value || ""}>
                            <input
                                ref={(ref: any) => (this.input = ref)}
                                type="text"
                                className="form-control"
                                value={this._value || ""}
                                onChange={this.onChange}
                                onSelect={this.onSelectionChange}
                                onKeyDown={this.onKeyDown}
                                readOnly={propertyInfo.computed}
                            />
                            <button
                                className="btn btn-secondary"
                                type="button"
                                onClick={this.onSelect}
                                title={this.props.propertyInfo.onSelectTitle}
                            >
                                &hellip;
                            </button>
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
                return <ProjectEditor.ArrayProperty {...this.props} />;
            } else if (
                propertyInfo.type === PropertyType.ConfigurationReference
            ) {
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
                            <>
                                {clearButton}
                                <button
                                    className="btn btn-secondary"
                                    type="button"
                                    onClick={async () => {
                                        if (this.context.filePath) {
                                            const result =
                                                await dialog.showOpenDialog({
                                                    properties: [
                                                        "openDirectory"
                                                    ]
                                                });

                                            const filePaths = result.filePaths;
                                            if (filePaths && filePaths[0]) {
                                                this.changeValue(
                                                    this.context.getFolderPathRelativeToProjectPath(
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
                            </>
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
                            <>
                                {clearButton}
                                <button
                                    className="btn btn-secondary"
                                    type="button"
                                    onClick={async () => {
                                        if (this.context.filePath) {
                                            const result =
                                                await dialog.showOpenDialog({
                                                    properties: ["openFile"],
                                                    filters:
                                                        propertyInfo.fileFilters
                                                });

                                            const filePaths = result.filePaths;
                                            if (filePaths && filePaths[0]) {
                                                this.changeValue(
                                                    this.context.getFolderPathRelativeToProjectPath(
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
                            </>
                        )}
                    </div>
                );
            } else if (propertyInfo.type === PropertyType.Image) {
                const imageValue = this._value || "";
                const embeddedImage = imageValue.startsWith("data:image");
                return (
                    <div>
                        <div className="input-group">
                            <input
                                type="text"
                                className="form-control"
                                value={
                                    embeddedImage
                                        ? "<embedded image>"
                                        : imageValue
                                }
                                readOnly
                            />
                            {!readOnly && (
                                <button
                                    className="btn btn-secondary"
                                    type="button"
                                    onClick={async () => {
                                        const result =
                                            await dialog.showOpenDialog({
                                                properties: ["openFile"],
                                                filters: [
                                                    {
                                                        name: "Image files",
                                                        extensions: [
                                                            "png",
                                                            "jpg",
                                                            "jpeg"
                                                        ]
                                                    },
                                                    {
                                                        name: "All Files",
                                                        extensions: ["*"]
                                                    }
                                                ],
                                                defaultPath:
                                                    propertyInfo.defaultImagesPath
                                                        ? propertyInfo.defaultImagesPath(
                                                              this.context
                                                          )
                                                        : undefined
                                            });
                                        const filePaths = result.filePaths;
                                        if (filePaths && filePaths[0]) {
                                            if (embeddedImage) {
                                                fs.readFile(
                                                    this.context.getAbsoluteFilePath(
                                                        filePaths[0]
                                                    ),
                                                    "base64",
                                                    (err: any, data: any) => {
                                                        if (!err) {
                                                            this.changeValue(
                                                                "data:image/png;base64," +
                                                                    data
                                                            );
                                                        }
                                                    }
                                                );
                                            } else {
                                                this.changeValue(
                                                    this.context.getFilePathRelativeToProjectPath(
                                                        filePaths[0]
                                                    )
                                                );
                                            }
                                        }
                                    }}
                                >
                                    &hellip;
                                </button>
                            )}
                        </div>
                        {this._value && (
                            <img
                                src={
                                    this._value &&
                                    this._value.startsWith("data:image/")
                                        ? this._value
                                        : this.context.getAbsoluteFilePath(
                                              this._value || ""
                                          )
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
);

function arrayCompareShallow(arr1: any, arr2: any) {
    if (!arr1 && !arr2) {
        return true;
    }

    if ((!arr1 && arr2) || (arr1 && !arr2) || arr1.length != arr2.length) {
        return false;
    }

    for (let i = 0; i < arr1.length; i++) {
        if (arr1[i] != arr2[i]) {
            return false;
        }
    }

    return true;
}

function getEnumItems(objects: IEezObject[], propertyInfo: PropertyInfo) {
    if (!propertyInfo.enumItems) {
        return [];
    }

    if (Array.isArray(propertyInfo.enumItems)) {
        return propertyInfo.enumItems;
    }

    const enumItems = propertyInfo.enumItems;

    const enumItemsArray = objects.map(object => enumItems(object));

    const result = [];

    for (let enumItems1 of enumItemsArray) {
        for (let enumItem1 of enumItems1) {
            let foundInAll = true;

            for (let enumItems2 of enumItemsArray) {
                let found = false;
                for (let enumItem2 of enumItems2) {
                    if (enumItem1.id == enumItem2.id) {
                        found = true;
                        break;
                    }
                }

                if (!found) {
                    foundInAll = false;
                    break;
                }
            }

            if (foundInAll) {
                let found = false;
                for (let enumItem2 of result) {
                    if (enumItem1.id == enumItem2.id) {
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    result.push(enumItem1);
                }
            }
        }
    }

    return result;
}
