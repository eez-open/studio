import React from "react";
import { observable, runInAction, makeObservable } from "mobx";
import { observer } from "mobx-react";
import classNames from "classnames";

import { humanize } from "eez-studio-shared/string";
import { _difference } from "eez-studio-shared/algorithm";

import { Icon } from "eez-studio-ui/icon";

import { PropertyProps } from "project-editor/core/object";

import { ProjectContext } from "project-editor/project/context";

import type { IVariable } from "project-editor/flow/flow-interfaces";

import {
    getObjectVariableTypeFromType,
    IObjectVariableValue,
    getObjectType
} from "project-editor/features/variable/value-type";

import type { Variable } from "project-editor/features/variable/variable";

////////////////////////////////////////////////////////////////////////////////

export const GlobalVariableStatuses = observer(
    class GlobalVariableStatuses extends React.Component {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        render() {
            let globalVariablesStatus: React.ReactNode[] = [];

            for (const variable of this.context.project.allGlobalVariables) {
                const objectVariableType = getObjectVariableTypeFromType(
                    variable.type
                );
                if (objectVariableType) {
                    const objectVariableValue:
                        | IObjectVariableValue
                        | undefined = this.context.dataContext.get(
                        variable.name
                    );

                    globalVariablesStatus.push(
                        <RenderVariableStatus
                            key={variable.name}
                            variable={variable}
                            value={objectVariableValue}
                            onClick={async () => {
                                if (objectVariableType.editConstructorParams) {
                                    const constructorParams =
                                        await objectVariableType.editConstructorParams(
                                            variable,
                                            objectVariableValue?.constructorParams
                                        );
                                    if (constructorParams !== undefined) {
                                        this.context.runtime!.setObjectVariableValue(
                                            variable.name,
                                            objectVariableType.createValue(
                                                constructorParams,
                                                true
                                            )
                                        );
                                    }
                                }
                            }}
                        />
                    );
                }
            }

            return (
                <div
                    className="EezStudio_FlowRuntimeControls"
                    style={{ width: 0, justifyContent: "flex-end" }}
                >
                    {globalVariablesStatus}
                </div>
            );
        }
    }
);

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

            const objectVariableType = getObjectVariableTypeFromType(
                variable.type
            );
            if (!objectVariableType) {
                return null;
            }

            const objectVariableValue = this.objectVariableValue;

            return (
                <RenderVariableStatus
                    key={variable.name}
                    variable={variable}
                    value={objectVariableValue}
                    onClick={async () => {
                        const constructorParams =
                            await objectVariableType.editConstructorParams!(
                                variable,
                                objectVariableValue?.constructorParams
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
            label = variable.description || humanize(variable.name);
        }

        const element = (
            <div
                className={classNames("EezStudio_CustomVariableStatus", {
                    "form-control": onClear
                })}
                onClick={!onClear ? onClick : undefined}
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
                {color && (
                    <span
                        className="status"
                        style={{
                            backgroundColor: color
                        }}
                    />
                )}
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
            <div className="input-group mb-3">
                {element}
                <button
                    className="btn btn-outline-secondary"
                    type="button"
                    onClick={onClick}
                >
                    &hellip;
                </button>
                <button
                    className="btn btn-outline-secondary"
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
