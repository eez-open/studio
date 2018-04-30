import * as React from "react";
import { computed } from "mobx";
import { bind } from "bind-decorator";

import { humanize } from "shared/string";
import { _map } from "shared/algorithm";
import { UNITS } from "shared/units";

import { Rule, validators } from "shared/model/validation";

import { Dialog, showDialog } from "shared/ui/dialog";
import {
    PropertyList,
    PropertyEnclosure,
    BooleanProperty,
    TextInputProperty,
    SelectProperty
} from "shared/ui/properties";

////////////////////////////////////////////////////////////////////////////////

export interface FieldProperties {
    name: string;
    displayName?: string;
    type?: "integer" | "number" | "string" | "boolean" | "enum" | typeof FieldComponent;
    unit?: keyof typeof UNITS;
    enumItems?: string[];
    visible?: (values: any) => boolean;
    options?: any;
    validators?: Rule[];
    fullLine?: boolean;
}

export interface FieldComponentProps {
    fieldProperties: FieldProperties;
    values: any;
    fieldContext: any;
    onChange: (event: any) => void;
}

export class FieldComponent extends React.Component<FieldComponentProps, any> {}

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
    fields: FieldProperties[];
}

interface GenericDialogResult {
    values: any;
    context: any;
}

interface GenericDialogProps {
    dialogDefinition: DialogDefinition;
    values: any;
    onOk?: (result: GenericDialogResult) => void;
    onCancel: () => void;
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
        return (
            <Dialog
                title={this.props.dialogDefinition.title}
                onOk={this.props.onOk && this.onOk}
                onCancel={this.props.onCancel}
            >
                <PropertyList>
                    {this.props.dialogDefinition.fields
                        .filter(fieldProperties => {
                            return (
                                !fieldProperties.visible ||
                                fieldProperties.visible(this.state.values)
                            );
                        })
                        .map(fieldProperties => {
                            const name =
                                fieldProperties.displayName || humanize(fieldProperties.name);
                            const value = this.state.values[fieldProperties.name] || "";
                            const onChange = this.onChange.bind(this, fieldProperties);
                            const errors =
                                this.state.errorMessages &&
                                this.state.errorMessages[fieldProperties.name];

                            let FieldComponent;
                            let children: JSX.Element | JSX.Element[] | null = null;

                            if (
                                fieldProperties.type === "integer" ||
                                fieldProperties.type === "number" ||
                                fieldProperties.type === "string" ||
                                !fieldProperties.type ||
                                fieldProperties.unit
                            ) {
                                FieldComponent = TextInputProperty;
                            } else if (fieldProperties.type === "enum") {
                                FieldComponent = SelectProperty;
                                children = fieldProperties.enumItems!.map(enumItem => (
                                    <option key={enumItem} value={enumItem}>
                                        {humanize(enumItem)}
                                    </option>
                                ));
                            } else if (fieldProperties.type === "boolean") {
                                FieldComponent = BooleanProperty;
                            } else {
                                return (
                                    <PropertyEnclosure
                                        key={fieldProperties.name}
                                        advanced={false}
                                        errors={errors}
                                    >
                                        {!fieldProperties.fullLine && <td>{name}</td>}
                                        <td>
                                            {
                                                <fieldProperties.type
                                                    key={fieldProperties.name}
                                                    fieldProperties={fieldProperties}
                                                    values={this.state.values}
                                                    fieldContext={this.fieldContext}
                                                    onChange={this.onChange.bind(
                                                        this,
                                                        fieldProperties
                                                    )}
                                                />
                                            }
                                        </td>
                                    </PropertyEnclosure>
                                );
                            }

                            return (
                                <FieldComponent
                                    key={fieldProperties.name}
                                    name={name}
                                    value={value}
                                    onChange={onChange}
                                    errors={errors}
                                >
                                    {children}
                                </FieldComponent>
                            );
                        })}
                </PropertyList>
            </Dialog>
        );
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
                values={conf.values}
                onOk={conf.showOkButton === undefined || conf.showOkButton ? resolve : undefined}
                onCancel={reject}
            />
        );
    });
}
