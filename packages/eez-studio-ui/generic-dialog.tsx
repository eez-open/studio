import React from "react";
import ReactDOM from "react-dom";
import { computed } from "mobx";
import { observer } from "mobx-react";
import { bind } from "bind-decorator";

import { humanize } from "eez-studio-shared/string";
import { _map } from "eez-studio-shared/algorithm";
import { UNITS } from "eez-studio-shared/units";
import { guid } from "eez-studio-shared/guid";

import { Rule, validators } from "eez-studio-shared/validation";

import { Dialog, showDialog, IDialogOptions } from "eez-studio-ui/dialog";
import {
    PropertyList,
    PropertyEnclosure,
    BooleanProperty,
    TextInputProperty,
    SelectProperty,
    Radio,
    RangeProperty
} from "eez-studio-ui/properties";
import styled from "eez-studio-ui/styled-components";

////////////////////////////////////////////////////////////////////////////////

interface IEnumItem {
    id: string;
    label: string;
    image?: string;
}

export type EnumItems = (number | string | IEnumItem)[];

export interface IFieldProperties {
    name: string;
    displayName?: string;
    type?:
        | "integer"
        | "number"
        | "string"
        | "boolean"
        | "enum"
        | "radio"
        | "range"
        | typeof FieldComponent;
    unit?: keyof typeof UNITS;
    enumItems?: EnumItems | (() => EnumItems);
    defaultValue?: number | string | boolean;
    visible?: (values: any) => boolean;
    options?: any;
    validators?: Rule[];
    fullLine?: boolean;
    enclosureClassName?: string;
    minValue?: number;
    maxValue?: number;
}

export interface IFieldComponentProps {
    dialogContext: any;
    fieldProperties: IFieldProperties;
    values: any;
    fieldContext: any;
    onChange: (event: any) => void;
    onOk: () => void;
}

export class FieldComponent extends React.Component<IFieldComponentProps, any> {}

////////////////////////////////////////////////////////////////////////////////

@observer
export class TableField extends FieldComponent {
    render() {
        let data = this.props.values[this.props.fieldProperties.name];

        let rows = _map(data, (value, key: any) => {
            return (
                <tr key={key}>
                    <td dangerouslySetInnerHTML={{ __html: key }} />
                    <td>{value}</td>
                </tr>
            );
        });

        let table = (
            <table className="table">
                <tbody>{rows}</tbody>
            </table>
        );

        return <div>{table}</div>;
    }
}

////////////////////////////////////////////////////////////////////////////////

@observer
export class RadioGroupProperty extends React.Component<
    {
        id?: string;
        name: string;
        errors?: string[];
    },
    {}
> {
    render() {
        let id = this.props.id || guid();

        return (
            <PropertyEnclosure errors={this.props.errors}>
                <td>
                    <label className="PropertyName col-form-label" htmlFor={id}>
                        {this.props.name}
                    </label>
                </td>

                <td>
                    <div id={id}>{this.props.children}</div>
                </td>
            </PropertyEnclosure>
        );
    }
}

const Card = styled.div`
    margin-left: 20px;
`;

////////////////////////////////////////////////////////////////////////////////

interface DialogDefinition {
    id?: string;
    title?: string;
    size?: "small" | "medium" | "large";
    fields: IFieldProperties[];
    error?: string;
}

interface GenericDialogResult {
    values: any;
    context: any;
}

interface GenericDialogProps {
    dialogDefinition: DialogDefinition;
    dialogContext: any;
    values: any;
    embedded?: boolean;
    modal?: boolean;
    opts?: IDialogOptions;
    okButtonText?: string;
    cancelButtonText?: string;
    okDisabled?: (result: GenericDialogResult) => boolean;
    onOk?: (result: GenericDialogResult) => void;
    onCancel?: () => void;
    onValueChange?: (name: string, value: string) => void;
}

interface GenericDialogState {
    values: any;
    errorMessages?: any;
}

@observer
export class GenericDialog extends React.Component<GenericDialogProps, GenericDialogState> {
    fieldContext: any = {};

    constructor(props: GenericDialogProps) {
        super(props);

        const values: any = {};

        this.props.dialogDefinition.fields.forEach(fieldProperties => {
            if (fieldProperties.unit !== undefined) {
                values[fieldProperties.name] = UNITS[fieldProperties.unit].formatValue(
                    this.props.values[fieldProperties.name]
                );
            } else {
                values[fieldProperties.name] = this.props.values[fieldProperties.name];
            }
        });

        this.state = {
            values,
            errorMessages: undefined
        };
    }

    @computed
    get values() {
        var values: any = {};
        this.props.dialogDefinition.fields.forEach(fieldProperties => {
            if (fieldProperties.type === "integer") {
                values[fieldProperties.name] = parseInt(this.state.values[fieldProperties.name]);
            } else if (fieldProperties.type === "number") {
                values[fieldProperties.name] = parseFloat(this.state.values[fieldProperties.name]);
            } else if (fieldProperties.type === "enum") {
                let enumItems;
                if (typeof fieldProperties.enumItems === "function") {
                    enumItems = fieldProperties.enumItems();
                } else {
                    enumItems = fieldProperties.enumItems!;
                }

                let enumItem;
                const value = this.state.values[fieldProperties.name];
                if (value) {
                    const id = value.toString();
                    enumItem = enumItems.find(enumItem => {
                        const enumItemId =
                            typeof enumItem === "string" || typeof enumItem === "number"
                                ? enumItem
                                : enumItem.id;
                        return enumItemId.toString() === id;
                    })!;
                } else {
                    enumItem = enumItems[0];
                }

                if (enumItem !== undefined) {
                    if (typeof enumItem === "string" || typeof enumItem === "number") {
                        values[fieldProperties.name] = enumItem;
                    } else {
                        values[fieldProperties.name] = enumItem.id;
                    }
                } else {
                    values[fieldProperties.name] = undefined;
                }
            } else if (fieldProperties.unit !== undefined) {
                values[fieldProperties.name] = UNITS[fieldProperties.unit].parseValue(
                    this.state.values[fieldProperties.name]
                );
            } else {
                values[fieldProperties.name] = this.state.values[fieldProperties.name];
            }
        });
        return values;
    }

    get modal() {
        if (this.props.modal !== undefined) {
            return this.props.modal;
        }

        if (this.props.opts) {
            return !this.props.opts.jsPanel;
        }

        return true;
    }

    onChange(fieldProperties: any, value: any) {
        this.state.values[fieldProperties.name] = value;

        if (this.state.errorMessages) {
            // revalidate
            this.setState({
                values: this.state.values,
                errorMessages: this.validate()
            });
        } else {
            if (this.props.embedded) {
                if (this.props.onValueChange) {
                    this.props.onValueChange(fieldProperties.name, value);
                }
            }
        }

        this.forceUpdate();
    }

    validate() {
        let errorMessages: any;

        this.props.dialogDefinition.fields
            .filter(fieldProperties => {
                return !fieldProperties.visible || fieldProperties.visible(this.values);
            })
            .forEach(fieldProperties => {
                let fieldValidators: Rule[] = [];

                if (fieldProperties.type === "integer") {
                    fieldValidators = fieldValidators.concat([validators.integer]);
                }

                if (fieldProperties.unit) {
                    fieldValidators = fieldValidators.concat([
                        validators.unit(fieldProperties.unit)
                    ]);
                }

                if (fieldProperties.validators) {
                    fieldValidators = fieldValidators.concat(fieldProperties.validators);
                }

                fieldValidators.forEach(validator => {
                    let message = validator(this.state.values, fieldProperties.name);
                    if (message) {
                        if (!errorMessages) {
                            errorMessages = {};
                        }
                        if (errorMessages[fieldProperties.name]) {
                            errorMessages[fieldProperties.name].push(message);
                        } else {
                            errorMessages[fieldProperties.name] = [message];
                        }
                    }
                });
            });

        return errorMessages;
    }

    @bind
    onOk() {
        let errorMessages = this.validate();

        if (!errorMessages) {
            this.props.onOk!({
                values: this.values,
                context: this.fieldContext
            });
            return true;
        }

        this.setState({
            values: this.state.values,
            errorMessages: errorMessages
        });

        return false;
    }

    render() {
        let fields = (
            <PropertyList>
                {this.props.dialogDefinition.fields
                    .filter(fieldProperties => {
                        return (
                            !fieldProperties.visible || fieldProperties.visible(this.state.values)
                        );
                    })
                    .map(fieldProperties => {
                        const name =
                            fieldProperties.displayName != undefined
                                ? fieldProperties.displayName
                                : humanize(fieldProperties.name);
                        const value = this.state.values[fieldProperties.name] || "";
                        const onChange = this.onChange.bind(this, fieldProperties);
                        const errors =
                            this.state.errorMessages &&
                            this.state.errorMessages[fieldProperties.name];

                        let Field: any;
                        let children: JSX.Element | JSX.Element[] | null = null;

                        let min;
                        let max;

                        if (
                            fieldProperties.type === "integer" ||
                            fieldProperties.type === "number" ||
                            fieldProperties.type === "string" ||
                            !fieldProperties.type ||
                            fieldProperties.unit
                        ) {
                            Field = TextInputProperty;
                        } else if (fieldProperties.type === "radio") {
                            Field = RadioGroupProperty;

                            let enumItems;
                            if (typeof fieldProperties.enumItems === "function") {
                                enumItems = fieldProperties.enumItems();
                            } else {
                                enumItems = fieldProperties.enumItems!;
                            }

                            children = enumItems.map(enumItem => {
                                const id =
                                    typeof enumItem === "string" || typeof enumItem === "number"
                                        ? enumItem.toString()
                                        : enumItem.id;
                                return (
                                    <Radio
                                        key={id}
                                        checked={id === value}
                                        onChange={() => onChange(id)}
                                    >
                                        {typeof enumItem === "string" ||
                                        typeof enumItem === "number"
                                            ? humanize(enumItem)
                                            : enumItem.label}
                                    </Radio>
                                );
                            });

                            const selectedEnumItem = enumItems.find(enumItem => {
                                if (typeof enumItem === "string" || typeof enumItem === "number") {
                                    return false;
                                }
                                return enumItem.image && enumItem.id === value;
                            });

                            if (selectedEnumItem) {
                                const image = (selectedEnumItem as IEnumItem).image;
                                children = (
                                    <div style={{ display: "flex", flexDirection: "row" }}>
                                        <div>{children}</div>
                                        <Card>
                                            <img src={image} />
                                        </Card>
                                    </div>
                                );
                            }
                        } else if (fieldProperties.type === "enum") {
                            Field = SelectProperty;

                            let enumItems;
                            if (typeof fieldProperties.enumItems === "function") {
                                enumItems = fieldProperties.enumItems();
                            } else {
                                enumItems = fieldProperties.enumItems!;
                            }

                            children = enumItems.map(enumItem => {
                                const id =
                                    typeof enumItem === "string" || typeof enumItem === "number"
                                        ? enumItem.toString()
                                        : enumItem.id;
                                return (
                                    <option key={id} value={id}>
                                        {typeof enumItem === "string" ||
                                        typeof enumItem === "number"
                                            ? humanize(enumItem)
                                            : enumItem.label}
                                    </option>
                                );
                            });
                        } else if (fieldProperties.type === "boolean") {
                            Field = BooleanProperty;
                        } else if (fieldProperties.type === "range") {
                            min = fieldProperties.minValue || 0;
                            max = fieldProperties.maxValue || 100;
                            Field = RangeProperty;
                        } else {
                            return (
                                <PropertyEnclosure
                                    key={fieldProperties.name}
                                    errors={errors}
                                    className={fieldProperties.enclosureClassName}
                                >
                                    {!fieldProperties.fullLine && <td>{name}</td>}
                                    <td>
                                        {
                                            <fieldProperties.type
                                                key={fieldProperties.name}
                                                dialogContext={this.props.dialogContext}
                                                fieldProperties={fieldProperties}
                                                values={this.state.values}
                                                fieldContext={this.fieldContext}
                                                onChange={this.onChange.bind(this, fieldProperties)}
                                                onOk={this.onOk}
                                            />
                                        }
                                    </td>
                                </PropertyEnclosure>
                            );
                        }

                        return (
                            <Field
                                key={fieldProperties.name}
                                name={name}
                                value={value}
                                onChange={onChange}
                                errors={errors}
                                min={min}
                                max={max}
                            >
                                {children}
                            </Field>
                        );
                    })}
            </PropertyList>
        );

        if (this.props.opts) {
            if (this.props.opts.fieldsEnclosureDiv) {
                fields = (
                    <this.props.opts.fieldsEnclosureDiv>
                        {fields}
                    </this.props.opts.fieldsEnclosureDiv>
                );
            }

            if (this.props.opts.jsPanel) {
                fields = <div style={{ padding: 10, width: "100%" }}>{fields}</div>;
            }
        }

        if (!this.props.embedded) {
            return (
                <Dialog
                    modal={this.modal}
                    title={this.props.dialogDefinition.title}
                    size={this.props.dialogDefinition.size}
                    okButtonText={this.props.okButtonText}
                    cancelButtonText={this.props.cancelButtonText}
                    okDisabled={() =>
                        this.props.okDisabled
                            ? this.props.okDisabled({
                                  values: this.values,
                                  context: this.fieldContext
                              })
                            : false
                    }
                    onOk={this.props.onOk && this.onOk}
                    onCancel={this.props.onCancel}
                >
                    {this.props.dialogDefinition.error && (
                        <div className="alert alert-danger">
                            {this.props.dialogDefinition.error}
                        </div>
                    )}
                    {fields}
                </Dialog>
            );
        } else {
            return fields;
        }
    }
}

////////////////////////////////////////////////////////////////////////////////

export function showGenericDialog(conf: {
    dialogDefinition: DialogDefinition;
    values: any;
    okButtonText?: string;
    okDisabled?: (result: GenericDialogResult) => boolean;
    showOkButton?: boolean;
    opts?: IDialogOptions;
}) {
    return new Promise<GenericDialogResult>((resolve, reject) => {
        const [modalDialog, element] = showDialog(
            <GenericDialog
                dialogDefinition={conf.dialogDefinition}
                dialogContext={undefined}
                values={conf.values}
                opts={conf.opts}
                okButtonText={conf.okButtonText}
                okDisabled={conf.okDisabled}
                onOk={
                    conf.showOkButton === undefined || conf.showOkButton
                        ? values => {
                              if (modalDialog) {
                                  ReactDOM.unmountComponentAtNode(element);
                                  modalDialog.close();
                              }
                              resolve(values);
                          }
                        : undefined
                }
                onCancel={() => {
                    if (modalDialog) {
                        ReactDOM.unmountComponentAtNode(element);
                        modalDialog.close();
                    }
                    reject();
                }}
            />,
            conf.opts
        );
    });
}
