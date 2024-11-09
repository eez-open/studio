import React from "react";
import { observable, action, runInAction, makeObservable } from "mobx";
import { observer } from "mobx-react";

import { getParent, PropertyProps } from "project-editor/core/object";

import { ProjectContext } from "project-editor/project/context";

import { validators } from "eez-studio-shared/validation";
import { validators as validatorsRenderer } from "eez-studio-shared/validation-renderer";

import { isPropertyOptional } from "project-editor/core/object";
import { replaceObjectReference } from "project-editor/core/search";
import { Icon } from "eez-studio-ui/icon";

////////////////////////////////////////////////////////////////////////////////

export const UniqueValueInput = observer(
    class UniqueValueInput extends React.Component<
        PropertyProps & { value: any; changeValue: (newValue: any) => void }
    > {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        oldValue: any;
        _value: string | undefined;
        error: string | undefined = undefined;

        constructor(props: any) {
            super(props);

            makeObservable(this, {
                _value: observable,
                error: observable
            });
        }

        componentDidUpdate(prevProps: PropertyProps) {
            if (
                !arrayCompareShallow(prevProps.objects, this.props.objects) ||
                prevProps.propertyInfo != this.props.propertyInfo ||
                this.oldValue != this.props.value
            ) {
                this.resetChange();
            }
        }

        onChange = action((event: React.ChangeEvent<HTMLInputElement>) => {
            this.oldValue = this.props.value;
            this._value = event.target.value.toString();
            this.error = undefined;
        });

        onKeyDown = (event: React.KeyboardEvent) => {
            if (event.key === "Enter") {
                this.commitChange();
            } else if (event.key == "Escape") {
                this.discardChange();
            }
        };

        onOK = () => {
            this.commitChange();
        };

        onCancel = () => {
            this.discardChange();
        };

        onBlur = (event: React.FocusEvent) => {};

        resetChange() {
            runInAction(() => {
                this._value = undefined;
                this.error = undefined;
            });
        }

        discardChange() {
            this.resetChange();
        }

        commitChange = async () => {
            if (this._value == undefined) {
                return;
            }

            let newValue = this._value.trim();

            const valueValidators = [];

            const propertyInfoUnique = (this.props.propertyInfo.unique ||
                this.props.propertyInfo.uniqueIdentifier)!;
            if (typeof propertyInfoUnique === "boolean") {
                valueValidators.push(
                    validators.unique(
                        this.props.objects[0],
                        getParent(this.props.objects[0])
                    )
                );
            } else {
                valueValidators.push(
                    propertyInfoUnique(
                        this.props.objects[0],
                        getParent(this.props.objects[0]),
                        this.props.propertyInfo
                    )
                );
            }

            if (
                !isPropertyOptional(
                    this.props.objects[0],
                    this.props.propertyInfo
                )
            ) {
                valueValidators.push(validators.required);
            }

            if (this.props.propertyInfo.uniqueIdentifier) {
                valueValidators.push(validatorsRenderer.identifierValidator);
            }

            for (const valueValidator of valueValidators) {
                const error = await valueValidator(
                    {
                        [this.props.propertyInfo.name]: newValue
                    },
                    this.props.propertyInfo.name
                );

                if (error) {
                    runInAction(() => {
                        this.error = error;
                    });
                    return;
                }
            }

            let oldValue = this.props.value;

            if (newValue != oldValue) {
                if (newValue.length == 0) {
                    runInAction(() => {
                        this.props.changeValue(undefined);
                    });
                } else {
                    this.context.undoManager.setCombineCommands(true);

                    runInAction(() => {
                        replaceObjectReference(this.props.objects[0], newValue);
                        this.props.changeValue(newValue);
                    });

                    this.context.undoManager.setCombineCommands(false);
                }
            }

            this.resetChange();
        };

        render() {
            return (
                <>
                    <div className="input-group">
                        <input
                            type="text"
                            className="form-control"
                            value={
                                this._value != undefined
                                    ? this._value
                                    : this.props.value || ""
                            }
                            onChange={this.onChange}
                            onKeyDown={this.onKeyDown}
                            onBlur={this.onBlur}
                            readOnly={this.props.objects.length > 1}
                        />
                        {this._value != undefined && (
                            <>
                                <button
                                    className="btn btn-secondary"
                                    type="button"
                                    onClick={this.onOK}
                                    title={"Commit Change (ENTER)"}
                                >
                                    <Icon icon="material:check" size={16} />
                                </button>
                                <button
                                    className="btn btn-secondary"
                                    type="button"
                                    onClick={this.onCancel}
                                    title={"Discard Change (ESC)"}
                                >
                                    <Icon icon="material:close" size={16} />
                                </button>
                            </>
                        )}
                    </div>
                    {this.error && (
                        <div className="form-text error">{this.error}</div>
                    )}
                </>
            );
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
