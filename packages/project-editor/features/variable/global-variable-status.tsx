import React from "react";
import { observable, runInAction, makeObservable } from "mobx";
import { observer } from "mobx-react";
import classNames from "classnames";

import { humanize } from "eez-studio-shared/string";

import { Icon } from "eez-studio-ui/icon";

import { PropertyProps } from "project-editor/core/object";

import { ProjectContext } from "project-editor/project/context";

import type { IVariable } from "project-editor/flow/flow-interfaces";

import {
    getObjectVariableTypeFromType,
    IObjectVariableValue,
    getObjectType,
    isObjectType
} from "project-editor/features/variable/value-type";

import type { Variable } from "project-editor/features/variable/variable";
import { Loader } from "eez-studio-ui/loader";
import { Button } from "eez-studio-ui/button";
import { CodeEditor } from "eez-studio-ui/code-editor";

////////////////////////////////////////////////////////////////////////////////

export const RenderVariableStatusPropertyUI = observer(
    class RenderVariableStatusPropertyUI extends React.Component<PropertyProps> {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        objectVariableValue: IObjectVariableValue | undefined;

        constructor(props: PropertyProps) {
            super(props);

            makeObservable(this, {
                objectVariableValue: observable
            });
        }

        async updateObjectVariableValue() {
            const variable = this.props.objects[0] as Variable;

            const value =
                this.context.runtimeSettings.getVariableValue(variable);

            runInAction(() => (this.objectVariableValue = value));
        }

        componentDidMount() {
            this.updateObjectVariableValue();
        }

        componentDidUpdate(prevProps: PropertyProps) {
            if (this.props.objects[0] != prevProps.objects[0]) {
                this.updateObjectVariableValue();
            }
        }

        render() {
            const variable = this.props.objects[0] as Variable;

            if (isObjectType(variable.type)) {
                const objectVariableType = getObjectVariableTypeFromType(
                    this.context,
                    variable.type
                );
                if (!objectVariableType) {
                    return null;
                }

                const objectVariableValue = this.objectVariableValue;

                return (
                    <RenderVariableStatus
                        key={variable.fullName}
                        variable={variable}
                        value={objectVariableValue}
                        onClick={async () => {
                            const constructorParams =
                                await objectVariableType.editConstructorParams!(
                                    variable,
                                    objectVariableValue?.constructorParams,
                                    false
                                );
                            if (constructorParams !== undefined) {
                                this.context.runtimeSettings.setVariableValue(
                                    variable,
                                    constructorParams
                                );
                                this.updateObjectVariableValue();
                            }
                        }}
                        onClear={async () => {
                            this.context.runtimeSettings.setVariableValue(
                                variable,
                                undefined
                            );
                            this.updateObjectVariableValue();
                        }}
                    />
                );
            } else {
                const value =
                    this.context.runtimeSettings.getVariableValue(variable);
                return value != undefined ? (
                    <div>
                        <div
                            style={{
                                marginTop: 10
                            }}
                        >
                            Stored value:
                        </div>
                        <CodeEditor
                            mode="json"
                            value={JSON.stringify(value, undefined, 2)}
                            onChange={() => {}}
                            minLines={2}
                            maxLines={20}
                            readOnly={true}
                            style={{
                                marginTop: 5,
                                marginBottom: 10,
                                border: "1px solid #aaa"
                            }}
                        ></CodeEditor>
                        <Button
                            color="secondary"
                            size="small"
                            onClick={() => {
                                this.context.runtimeSettings.setVariableValue(
                                    variable,
                                    undefined
                                );
                            }}
                        >
                            Clear Stored Value
                        </Button>
                    </div>
                ) : null;
            }
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

export const RenderVariableStatus = observer(
    ({
        variable,
        value,
        onClick,
        onClear
    }: {
        variable: IVariable;
        value?: IObjectVariableValue;
        onClick: () => void;
        onClear?: () => void;
    }) => {
        const image = value?.status?.image;
        const color = value?.status?.color;
        const error = value?.status?.error != undefined;
        const title = value?.status?.error;

        let label;
        let hint;
        if (onClear) {
            if (value?.constructorParams != null) {
                label = value.status.label;
            } else {
                hint = `Select ${getObjectType(variable.type)}`;
            }
        } else {
            label =
                value?.status.label ||
                variable.description ||
                humanize(variable.fullName);
        }

        const clickable = !onClear && variable.persistent;

        const element = (
            <div
                className={classNames("EezStudio_CustomVariableStatus", {
                    "form-control": onClear,
                    clickable
                })}
                onClick={clickable ? onClick : undefined}
                title={title}
            >
                {image &&
                    (typeof image == "string" ? (
                        <img
                            src={
                                image.trim().startsWith("<svg")
                                    ? "data:image/svg+xml;charset=utf-8," +
                                      image.trim()
                                    : image
                            }
                            draggable={false}
                        />
                    ) : (
                        image
                    ))}
                {color &&
                    (color == "loader" ? (
                        <Loader size={20} />
                    ) : (
                        <span
                            className="status"
                            style={{
                                backgroundColor: color
                            }}
                        />
                    ))}
                <span className="label">{label}</span>
                <span className="hint">{hint}</span>
                {error && (
                    <Icon className="text-danger" icon="material:error" />
                )}
            </div>
        );

        if (!onClear) {
            return element;
        }

        return (
            <div className="input-group">
                {element}
                <button
                    className="btn btn-secondary"
                    type="button"
                    onClick={onClick}
                >
                    &hellip;
                </button>
                <button
                    className="btn btn-secondary"
                    type="button"
                    onClick={onClear}
                    disabled={!value}
                >
                    {"\u2715"}
                </button>
            </div>
        );
    }
);
