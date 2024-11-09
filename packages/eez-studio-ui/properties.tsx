import React from "react";
import { computed, makeObservable } from "mobx";
import { observer } from "mobx-react";
import classNames from "classnames";
import { dialog } from "@electron/remote";

import { formatBytes } from "eez-studio-shared/formatBytes";
import { guid } from "eez-studio-shared/guid";
import { capitalize } from "eez-studio-shared/string";

import { ListContainer, List, IListNode } from "eez-studio-ui/list";

export const PropertyEnclosure = observer(
    class PropertyEnclosure extends React.Component<
        {
            children?: React.ReactNode;
            errors?: string[];
            style?: React.CSSProperties;
            className?: string;
            title?: string;
        },
        {}
    > {
        render() {
            let className = classNames(this.props.className);

            let result = (
                <tr
                    key="property"
                    className={className}
                    style={this.props.style}
                >
                    {this.props.children}
                </tr>
            );

            if (!this.props.errors) {
                return result;
            }

            return [
                result,
                <tr key="error">
                    <td />
                    <td>
                        {this.props.errors.map(error => (
                            <div className="text-danger" key={error}>
                                {error}
                            </div>
                        ))}
                    </td>
                </tr>
            ];
        }
    }
);

export const StaticProperty = observer(
    class StaticProperty extends React.Component<{
        name: string;
        value: string;
        className?: string;
    }> {
        render() {
            const value =
                (this.props.value && this.props.value.toString()) || "";
            return (
                <PropertyEnclosure>
                    <td className="PropertyName">{this.props.name}</td>
                    <td
                        className={classNames(
                            "StaticPropertyValue",
                            this.props.className
                        )}
                        title={value}
                    >
                        {value}
                    </td>
                </PropertyEnclosure>
            );
        }
    }
);

export const BytesProperty = observer(
    class BytesProperty extends React.Component<
        {
            name: string;
            value: number;
        },
        {}
    > {
        render() {
            return (
                <PropertyEnclosure>
                    <td className="PropertyName">{this.props.name}</td>
                    <td className="StaticPropertyValue">
                        {formatBytes(this.props.value)}
                    </td>
                </PropertyEnclosure>
            );
        }
    }
);

export const InputProperty = observer(
    class InputProperty extends React.Component<
        {
            id?: string;
            name?: string;
            value: any;
            suggestions?: string[];
            inputGroupButton?: React.ReactNode;
            title?: string;
            onChange: (value: any) => void;
            type: string;
            errors?: string[];
            min?: number;
            max?: number;
            formText?: string;
        },
        {}
    > {
        render() {
            let id = this.props.id || guid();

            let input = (
                <input
                    id={id}
                    className={
                        this.props.type == "range"
                            ? "form-range"
                            : "form-control"
                    }
                    type={this.props.type}
                    value={this.props.value}
                    title={this.props.title}
                    onChange={event => this.props.onChange(event.target.value)}
                    min={this.props.min}
                    max={this.props.max}
                />
            );

            const suggestions =
                this.props.suggestions && this.props.suggestions.length
                    ? this.props.suggestions
                    : undefined;

            if (suggestions || this.props.inputGroupButton) {
                input = (
                    <div className="input-group">
                        {input}
                        {suggestions && (
                            <>
                                <button
                                    className="btn btn-secondary dropdown-toggle"
                                    type="button"
                                    data-bs-toggle="dropdown"
                                />
                                <div className="dropdown-menu dropdown-menu-end">
                                    {suggestions.map((suggestion, i) => (
                                        <button
                                            key={i}
                                            className="dropdown-item"
                                            type="button"
                                            onClick={() =>
                                                this.props.onChange(suggestion)
                                            }
                                        >
                                            {suggestion}
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}
                        {this.props.inputGroupButton}
                    </div>
                );
            }

            if (this.props.formText) {
                input = (
                    <>
                        {input}
                        <div className="form-text">{this.props.formText}</div>
                    </>
                );
            }

            let content;
            if (this.props.name) {
                content = [
                    <td key="name">
                        <label
                            className="PropertyName col-form-label"
                            htmlFor={id}
                            title={this.props.title}
                        >
                            {this.props.name}
                        </label>
                    </td>,

                    <td key="value">{input}</td>
                ];
            } else {
                content = <td colSpan={2}>{input}</td>;
            }

            return (
                <PropertyEnclosure
                    errors={this.props.errors}
                    title={this.props.title}
                >
                    {content}
                </PropertyEnclosure>
            );
        }
    }
);

export const TextInputProperty = observer(
    class TextInputProperty extends React.Component<
        {
            id?: string;
            name?: string;
            value: string;
            suggestions?: string[];
            inputGroupButton?: React.ReactNode;
            title?: string;
            onChange: (value: string) => void;
            errors?: string[];
        },
        {}
    > {
        render() {
            return <InputProperty {...this.props} type="text" />;
        }
    }
);

export const PasswordInputProperty = observer(
    class PasswordInputProperty extends React.Component<
        {
            id?: string;
            name?: string;
            value: string;
            suggestions?: string[];
            title?: string;
            onChange: (value: string) => void;
            errors?: string[];
        },
        {}
    > {
        render() {
            return <InputProperty {...this.props} type="password" />;
        }
    }
);

export const MultilineTextInputProperty = observer(
    class MultilineTextInputProperty extends React.Component<
        {
            id?: string;
            name?: string;
            value: any;
            onChange: (value: any) => void;
            errors?: string[];
            rows: number;
            readOnly?: boolean;
        },
        {}
    > {
        render() {
            let id = this.props.id || guid();

            let input = (
                <textarea
                    id={id}
                    className="form-control"
                    rows={this.props.rows}
                    value={this.props.value}
                    onChange={event => this.props.onChange(event.target.value)}
                    readOnly={this.props.readOnly}
                />
            );

            let content;
            if (this.props.name) {
                content = [
                    <td key="name" style={{ verticalAlign: "baseline" }}>
                        <label
                            className="PropertyName col-form-label"
                            htmlFor={id}
                        >
                            {this.props.name}
                        </label>
                    </td>,

                    <td key="value">{input}</td>
                ];
            } else {
                content = <td colSpan={2}>{input}</td>;
            }

            return (
                <PropertyEnclosure errors={this.props.errors}>
                    {content}
                </PropertyEnclosure>
            );
        }
    }
);

export const NumberInputProperty = observer(
    class NumberInputProperty extends React.Component<
        {
            id?: string;
            name?: string;
            value: number;
            onChange: (value: number) => void;
            errors?: string[];
            min?: number;
            max?: number;
            formText?: string;
        },
        {}
    > {
        render() {
            return (
                <InputProperty
                    {...this.props}
                    type="number"
                    onChange={value => this.props.onChange(parseInt(value))}
                    formText={this.props.formText}
                />
            );
        }
    }
);

export const RichTextProperty = observer(
    class RichTextProperty extends React.Component<
        {
            name: string;
            value?: string;
            onChange: (value: string) => void;
        },
        {}
    > {
        constructor(props: any) {
            super(props);
        }

        div: HTMLDivElement | null = null;

        quill: any;

        componentDidMount() {
            let Quill = (window as any).Quill;
            if (!Quill && (window as any).require) {
                Quill = (window as any).require("quill");
            }

            this.quill = new Quill(this.div, {
                theme: "snow"
            });

            if (this.props.value) {
                try {
                    this.quill.setContents({
                        ops: JSON.parse(this.props.value)
                    } as any);
                } catch (err) {
                    console.error(err);
                }
            }

            this.quill.on("text-change", () => {
                this.props.onChange(
                    JSON.stringify(this.quill.getContents().ops)
                );
            });
        }

        render() {
            return (
                <PropertyEnclosure>
                    <td colSpan={2}>
                        <div
                            ref={(ref: any) => (this.div = ref)}
                            className="EezStudio_RichTextProperty"
                        />
                    </td>
                </PropertyEnclosure>
            );
        }
    }
);

export const StaticRichTextProperty = observer(
    class StaticRichTextProperty extends React.Component<
        {
            name?: string;
            value: string;
        },
        {}
    > {
        constructor(props: any) {
            super(props);
        }

        div: HTMLDivElement | null = null;

        quill: any;

        componentDidMount() {
            let Quill = (window as any).Quill;
            if (!Quill && (window as any).require) {
                Quill = (window as any).require("quill");
            }

            this.quill = new Quill(this.div, {
                modules: {
                    toolbar: false
                },
                theme: "snow"
            });

            this.setContents(this.props.value);

            this.quill.enable(false);
        }

        componentDidUpdate(prevProps: any) {
            if (this.props != prevProps) {
                this.setContents(this.props.value);
            }
        }

        setContents(value: string) {
            try {
                this.quill.setContents({
                    ops: JSON.parse(value)
                } as any);
            } catch (err) {
                console.error(err);
            }
        }

        render() {
            return (
                <PropertyEnclosure>
                    <td colSpan={2}>
                        <div
                            ref={(ref: any) => (this.div = ref)}
                            className="EezStudio_StaticRichTextProperty"
                        />
                    </td>
                </PropertyEnclosure>
            );
        }
    }
);

export const SelectProperty = observer(
    class SelectProperty extends React.Component<{
        children?: React.ReactNode;
        id?: string;
        name: string;
        value: string;
        onChange: (value: string) => void;
        inputGroupButton?: React.ReactNode;
        selectStyle?: React.CSSProperties;
        errors?: string[];
        comboBox?: boolean;
    }> {
        render() {
            let id = this.props.id || guid();

            let className = classNames({
                "input-group": this.props.inputGroupButton !== undefined
            });

            return (
                <PropertyEnclosure errors={this.props.errors}>
                    <td>
                        <label
                            className="PropertyName col-form-label"
                            htmlFor={id}
                        >
                            {this.props.name}
                        </label>
                    </td>

                    <td>
                        <div className={className}>
                            {this.props.comboBox ? (
                                <>
                                    <input
                                        type="text"
                                        className="form-control"
                                        value={this.props.value}
                                        onChange={event =>
                                            this.props.onChange(
                                                event.target.value
                                            )
                                        }
                                        list={id}
                                    />
                                    <datalist
                                        id={id}
                                        style={this.props.selectStyle}
                                    >
                                        {this.props.children}
                                    </datalist>
                                </>
                            ) : (
                                <select
                                    id={id}
                                    className="form-select"
                                    value={this.props.value}
                                    onChange={event =>
                                        this.props.onChange(event.target.value)
                                    }
                                    style={this.props.selectStyle}
                                >
                                    {this.props.children}
                                </select>
                            )}
                            {this.props.inputGroupButton}
                        </div>
                    </td>
                </PropertyEnclosure>
            );
        }
    }
);

export const SelectFromListProperty = observer(
    class SelectFromListProperty extends React.Component<
        {
            id?: string;
            name?: string;
            nodes: IListNode[];
            renderNode?: (node: IListNode) => JSX.Element;
            onChange: (value: IListNode) => void;
            errors?: string[];
        },
        {}
    > {
        render() {
            let id = this.props.id || guid();

            return (
                <PropertyEnclosure errors={this.props.errors}>
                    <td colSpan={2}>
                        {this.props.name && (
                            <label
                                className="PropertyName col-form-label"
                                htmlFor={id}
                            >
                                {this.props.name}
                            </label>
                        )}

                        <ListContainer
                            tabIndex={0}
                            minHeight={240}
                            maxHeight={400}
                            maxWidth={466}
                        >
                            <List
                                nodes={this.props.nodes}
                                renderNode={this.props.renderNode}
                                selectNode={this.props.onChange}
                            />
                        </ListContainer>
                    </td>
                </PropertyEnclosure>
            );
        }
    }
);

export const BooleanProperty = observer(
    class BooleanProperty extends React.Component<
        {
            name: string;
            value: boolean;
            onChange: (value: boolean) => void;
            style?: React.CSSProperties;
            checkboxStyleSwitch?: boolean;
        },
        {}
    > {
        render() {
            if (this.props.checkboxStyleSwitch) {
                return (
                    <PropertyEnclosure style={this.props.style}>
                        <td>{this.props.name}</td>
                        <td>
                            <div
                                className="form-check form-switch"
                                style={{
                                    minHeight: "auto",
                                    marginBottom: 0
                                }}
                            >
                                <input
                                    type="checkbox"
                                    className="form-check-input"
                                    checked={this.props.value}
                                    onChange={event =>
                                        this.props.onChange(
                                            event.target.checked
                                        )
                                    }
                                />
                            </div>
                        </td>
                    </PropertyEnclosure>
                );
            } else {
                return (
                    <PropertyEnclosure style={this.props.style}>
                        <td colSpan={2}>
                            <div className="form-check">
                                <label className="form-check-label">
                                    <input
                                        type="checkbox"
                                        className="form-check-input"
                                        checked={this.props.value}
                                        onChange={event =>
                                            this.props.onChange(
                                                event.target.checked
                                            )
                                        }
                                        role="switch"
                                    />
                                    {this.props.name}
                                </label>
                            </div>
                        </td>
                    </PropertyEnclosure>
                );
            }
        }
    }
);

export const KeybindingProperty = observer(
    class KeybindingProperty extends React.Component<
        {
            id?: string;
            name?: string;
            value: string;
            onChange: (value: string) => void;
            errors?: string[];
        },
        {}
    > {
        constructor(props: any) {
            super(props);

            makeObservable(this, {
                keybinding: computed
            });
        }

        onKeyDown = (event: any) => {
            if (
                event.nativeEvent.key === "Escape" ||
                event.nativeEvent.key === "Enter" ||
                event.nativeEvent.key === "Tab"
            ) {
                return;
            }

            event.preventDefault();

            var keybinding = [];

            if (event.nativeEvent.ctrlKey) {
                keybinding.push("ctrl");
            }

            if (event.nativeEvent.shiftKey) {
                keybinding.push("shift");
            }

            if (event.nativeEvent.altKey) {
                keybinding.push("alt");
            }

            if (event.nativeEvent.metaKey) {
                keybinding.push("meta");
            }

            let key = event.nativeEvent.key;
            if (
                key !== "Control" &&
                key !== "Shift" &&
                key !== "Alt" &&
                key !== "Meta"
            ) {
                if (key === " ") {
                    key = "space";
                }

                keybinding.push(key.toLowerCase());
            } else {
                keybinding.push("");
            }

            this.props.onChange(keybinding.join("+"));
        };

        get keybinding() {
            return (
                (this.props.value &&
                    this.props.value
                        .split("+")
                        .map(x => capitalize(x))
                        .join(" + ")) ||
                ""
            );
        }

        onDeleteKeybinding = (event: any) => {
            event.preventDefault();
            event.stopPropagation();
            this.props.onChange("");
        };

        render() {
            let id = this.props.id || guid();

            let input = (
                <input
                    id={id}
                    className="form-control"
                    type="text"
                    value={this.keybinding}
                    onKeyDown={this.onKeyDown}
                    onChange={event => this.props.onChange(event.target.value)}
                />
            );

            if (this.props.value) {
                input = (
                    <div className="input-group">
                        {input}
                        <button
                            className="btn btn-secondary"
                            title="Clear"
                            onClick={this.onDeleteKeybinding}
                        >
                            &times;
                        </button>
                    </div>
                );
            }

            let content;
            if (this.props.name) {
                content = [
                    <td key="name">
                        <label
                            className="PropertyName col-form-label"
                            htmlFor={id}
                        >
                            {this.props.name}
                        </label>
                    </td>,
                    <td key="value">{input}</td>
                ];
            } else {
                content = <td colSpan={2}>{input}</td>;
            }

            return (
                <PropertyEnclosure errors={this.props.errors}>
                    {content}
                </PropertyEnclosure>
            );
        }
    }
);

export const ColorInputProperty = observer(
    class ColorInputProperty extends React.Component<
        {
            id?: string;
            name?: string;
            value: string;
            onChange: (value: string) => void;
            errors?: string[];
        },
        {}
    > {
        render() {
            return <InputProperty {...this.props} type="color" />;
        }
    }
);

export const PropertyList = observer(
    class PropertyList extends React.Component<{
        children?: React.ReactNode;
        className?: string;
    }> {
        render() {
            let className = classNames(
                "EezStudio_PropertyList",
                this.props.className
            );

            return (
                <table className={className}>
                    <tbody>{this.props.children}</tbody>
                </table>
            );
        }
    }
);

export class Checkbox extends React.Component<
    {
        children?: React.ReactNode;
        checked: boolean;
        onChange: (checked: boolean) => void;
    },
    {}
> {
    render() {
        const id = guid();
        return (
            <div className="form-check">
                <input
                    type="checkbox"
                    className="form-check-input"
                    id={id}
                    checked={this.props.checked}
                    onChange={event => {
                        this.props.onChange(event.target.checked);
                    }}
                />
                <label className="form-check-label" htmlFor={id}>
                    {this.props.children}
                </label>
            </div>
        );
    }
}

export class Radio extends React.Component<
    {
        children?: React.ReactNode;
        checked: boolean;
        onChange: () => void;
    },
    {}
> {
    render() {
        const id = guid();
        return (
            <div className="form-check">
                <input
                    type="radio"
                    id={id}
                    className="form-check-input"
                    checked={this.props.checked}
                    onChange={event => {
                        this.props.onChange();
                    }}
                />
                <label className="form-check-label" htmlFor={id}>
                    {this.props.children}
                </label>
            </div>
        );
    }
}

export const RangeProperty = observer(
    class RangeProperty extends React.Component<
        {
            id?: string;
            name?: string;
            value: number;
            onChange: (value: number) => void;
            errors?: string[];
            min?: number;
            max?: number;
        },
        {}
    > {
        render() {
            return (
                <InputProperty
                    {...this.props}
                    type="range"
                    onChange={value => this.props.onChange(parseInt(value))}
                />
            );
        }
    }
);

export const ButtonProperty = observer(
    class ButtonProperty extends React.Component<
        {
            name?: string;
            onChange: (value: number) => void;
            className?: string;
            disabled?: boolean;
        },
        {}
    > {
        render() {
            return (
                <tr>
                    <td />
                    <td>
                        <button
                            className={classNames("btn", this.props.className)}
                            onClick={value => this.props.onChange(1)}
                            disabled={this.props.disabled}
                        >
                            {this.props.name}
                        </button>
                    </td>
                </tr>
            );
        }
    }
);

export class AbsoluteFileInputProperty extends React.Component<
    {
        name?: string;
        value: string;
        onChange: (value: string) => void;
    },
    {}
> {
    onSelect = async () => {
        const result = await dialog.showOpenDialog({
            properties: ["openFile"],
            filters: [{ name: "All Files", extensions: ["*"] }]
        });

        if (result.filePaths && result.filePaths[0]) {
            this.props.onChange(result.filePaths[0]);
        }
    };

    render() {
        return (
            <InputProperty
                name={this.props.name}
                value={this.props.value}
                onChange={this.props.onChange}
                type="text"
                inputGroupButton={
                    <button
                        className="btn btn-secondary"
                        type="button"
                        onClick={this.onSelect}
                    >
                        &hellip;
                    </button>
                }
            />
        );
    }
}
