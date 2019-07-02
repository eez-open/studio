import React from "react";
import { computed } from "mobx";
import { bind } from "bind-decorator";

import { humanize } from "eez-studio-shared/string";
import { _map } from "eez-studio-shared/algorithm";
import { UNITS } from "eez-studio-shared/units";

import { Rule, validators } from "eez-studio-shared/model/validation";

import { Dialog, showDialog } from "eez-studio-ui/dialog";
import {
    PropertyList,
    PropertyEnclosure,
    BooleanProperty,
    TextInputProperty,
    SelectProperty,
    RangeProperty
} from "eez-studio-ui/properties";

////////////////////////////////////////////////////////////////////////////////

interface IEnumItem {
    id: string;
    label: string;
}

export type EnumItems = (number | string | IEnumItem)[];

export interface IFieldProperties {
    name: string;
    displayName?: string;
    type?: "integer" | "number" | "string" | "boolean" | "enum" | "range" | typeof FieldComponent;
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
}

export class FieldComponent extends React.Component<IFieldComponentProps, any> {}

////////////////////////////////////////////////////////////////////////////////

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

interface DialogDefinition {
    id?: string;
    title?: string;
    size?: "small" | "medium" | "large";
    fields: IFieldProperties[];
}

interface GenericDialogResult {
    values: any;
    context: any;
}

interface GenericDialogProps {
    dialogDefinition: DialogDefinition;
    dialogContext: any;
    values: any;
    modal: boolean;
    onOk?: (result: GenericDialogResult) => void;
    onCancel?: () => void;
    onValueChange?: (name: string, value: string) => void;
}

interface GenericDialogState {
    values: any;
    errorMessages?: any;
}

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

    onChange(fieldProperties: any, value: any) {
        this.state.values[fieldProperties.name] = value;

        if (this.state.errorMessages) {
            // revalidate
            this.setState({
                values: this.state.values,
                errorMessages: this.validate()
            });
        } else {
            if (!this.props.modal) {
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
        const properties = (
            <PropertyList>
                {this.props.dialogDefinition.fields
                    .filter(fieldProperties => {
                        return (
                            !fieldProperties.visible || fieldProperties.visible(this.state.values)
                        );
                    })
                    .map(fieldProperties => {
                        const name = fieldProperties.displayName || humanize(fieldProperties.name);
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
                                    advanced={false}
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

        if (this.props.modal) {
            return (
                <Dialog
                    title={this.props.dialogDefinition.title}
                    size={this.props.dialogDefinition.size}
                    onOk={this.props.onOk && this.onOk}
                    onCancel={this.props.onCancel}
                >
                    {properties}
                </Dialog>
            );
        } else {
            return properties;
        }
    }
}

////////////////////////////////////////////////////////////////////////////////

export function showGenericDialog(conf: {
    dialogDefinition: DialogDefinition;
    values: any;
    showOkButton?: boolean;
}) {
    return new Promise<GenericDialogResult>((resolve, reject) => {
        showDialog(
            <GenericDialog
                dialogDefinition={conf.dialogDefinition}
                dialogContext={undefined}
                values={conf.values}
                modal={true}
                onOk={conf.showOkButton === undefined || conf.showOkButton ? resolve : undefined}
                onCancel={reject}
            />
        );
    });
}
