import React from "react";
import { bind } from "bind-decorator";

import { guid } from "eez-studio-shared/guid";

import styled from "eez-studio-ui/styled-components";
import { PropertyEnclosure } from "eez-studio-ui/properties";

////////////////////////////////////////////////////////////////////////////////

import { addScript } from "eez-studio-shared/dom";

function createEditor(
    element: HTMLElement,
    value: string,
    readOnly: boolean,
    mode: string,
    lineNumber: number,
    columnNumber: number,
    minLines?: number,
    maxLines?: number
) {
    return new Promise(resolve => {
        function aceReady() {
            const editor = ace.edit(element);

            editor.getSession().setMode("ace/mode/" + mode);
            editor.setShowPrintMargin(false);

            if (minLines !== undefined) {
                editor.setOptions({
                    minLines
                });
            }

            if (maxLines !== undefined) {
                editor.setOptions({
                    maxLines
                });
            }

            editor.setReadOnly(readOnly);
            if (readOnly) {
                editor.renderer.$cursorLayer.element.style.opacity = 0;
                editor.container.style.opacity = 0.6;
            } else {
                editor.renderer.$cursorLayer.element.style.opacity = 1;
                editor.container.style.opacity = 1;
            }
            editor.setValue(value || "");
            editor
                .getSession()
                .getUndoManager()
                .reset();
            editor.selection.moveTo(lineNumber - 1, columnNumber - 1);

            resolve(editor);
        }

        if ((window as any).ace) {
            aceReady();
        } else {
            addScript("../../libs/brace-0.8.0/index.min.js").then(() => {
                Promise.all([
                    addScript("../../libs/brace-0.8.0/mode/c_cpp.min.js"),
                    addScript("../../libs/brace-0.8.0/mode/css.js"),
                    addScript("../../libs/brace-0.8.0/mode/json.min.js"),
                    addScript("../../libs/brace-0.8.0/mode/javascript.js"),
                    addScript("../../libs/brace-0.8.0/mode/scpi.js"),
                    addScript("../../libs/brace-0.8.0/theme/github.js")
                ]).then(aceReady);
            });
        }
    });
}

function resizeEditor(editor: any) {
    editor.resize();
}

function insertText(editor: any, text: string) {
    editor.insert(text);
}

function canUndo(editor: any) {
    return editor
        .getSession()
        .getUndoManager()
        .hasUndo();
}

function undo(editor: any) {
    editor
        .getSession()
        .getUndoManager()
        .undo();
}

function canRedo(editor: any) {
    return editor
        .getSession()
        .getUndoManager()
        .hasRedo();
}

function redo(editor: any) {
    editor
        .getSession()
        .getUndoManager()
        .redo();
}

function onEditorEvent(editor: any, eventName: string, handler: any) {
    editor.on(eventName, handler);
}

function destroyEditor(editor: any) {
    editor.destroy();
}

////////////////////////////////////////////////////////////////////////////////

const CodeEditorDiv = styled.div`
    flex-grow: 1;
`;

export type CodeEditorMode = "c_cpp" | "javascript" | "json" | "scpi" | "css";

interface CodeEditorProps {
    mode: CodeEditorMode;
    value: string;
    onChange: (value: string) => void;
    onFocus?: (event: any) => void;
    onBlur?: (event: any) => void;
    className?: string;
    style?: React.CSSProperties;
    tabIndex?: number;
    readOnly?: boolean;
    lineNumber?: number;
    columnNumber?: number;
    minLines?: number;
    maxLines?: number;
}

export class CodeEditor extends React.Component<CodeEditorProps, {}> {
    element: HTMLElement;
    editor: any;
    promise: Promise<any> = new Promise(resolve => resolve());

    resize() {
        if (this.editor) {
            resizeEditor(this.editor);
        }
    }

    insertText(text: string) {
        if (this.editor) {
            insertText(this.editor, text);
        }
    }

    get canUndo() {
        return canUndo(this.editor);
    }

    undo() {
        undo(this.editor);
    }

    get canRedo() {
        return canRedo(this.editor);
    }

    redo() {
        redo(this.editor);
    }

    @bind
    onChange(event: any) {
        this.props.onChange(this.editor.getValue());
    }

    componentDidMount() {
        this.promise = this.promise.then(() =>
            createEditor(
                this.element,
                this.props.value,
                this.props.readOnly || false,
                this.props.mode,
                this.props.lineNumber || 1,
                this.props.columnNumber || 1,
                this.props.minLines,
                this.props.maxLines
            ).then((editor: any) => {
                this.editor = editor;

                onEditorEvent(this.editor, "change", this.onChange);

                if (this.props.onFocus) {
                    onEditorEvent(this.editor, "focus", this.props.onFocus);
                }

                if (this.props.onBlur) {
                    onEditorEvent(this.editor, "blur", this.props.onBlur);
                }

                setTimeout(() => {
                    if (this.editor) {
                        resizeEditor(this.editor);
                    }
                }, 0);
            })
        );
    }

    componentWillUnmount() {
        this.promise = this.promise.then(() => {
            destroyEditor(this.editor);
            this.editor = undefined;
        });
    }

    shouldComponentUpdate(nextProps: CodeEditorProps) {
        return (
            !this.editor ||
            nextProps.value !== this.editor.getValue() ||
            nextProps.readOnly !== this.props.readOnly ||
            nextProps.mode !== this.props.mode
        );
    }

    componentWillUpdate(nextProps: any, nextState: any) {
        this.componentWillUnmount();
    }

    componentDidUpdate(prevProps: any, prevState: any) {
        this.componentDidMount();
    }

    render() {
        return (
            <CodeEditorDiv
                ref={(ref: any) => (this.element = ref!)}
                className={this.props.className}
                style={this.props.style}
                tabIndex={this.props.tabIndex}
            />
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

interface CodeEditorPropertyProps {
    id?: string;
    name?: string;
    mode: CodeEditorMode;
    value: string;
    onChange: (value: string) => void;
    onBlur?: () => void;
    height?: number;
    advanced?: boolean;
    errors?: string[];
    readOnly: boolean;
    lineNumber?: number;
    columnNumber?: number;
}

export class CodeEditorProperty extends React.Component<CodeEditorPropertyProps, {}> {
    render() {
        let id = this.props.id || guid();

        let input = (
            <CodeEditor
                mode={this.props.mode}
                value={this.props.value}
                onChange={this.props.onChange}
                onBlur={this.props.onBlur}
                readOnly={this.props.readOnly}
                style={{
                    height: this.props.height !== undefined ? this.props.height : 200,
                    padding: 0
                }}
                className="form-control"
                tabIndex={0}
                lineNumber={this.props.lineNumber}
                columnNumber={this.props.columnNumber}
            />
        );

        let content;
        if (this.props.name) {
            content = [
                <td key="name" style={{ verticalAlign: "baseline" }}>
                    <label className="PropertyName col-form-label" htmlFor={id}>
                        {this.props.name}
                    </label>
                </td>,

                <td key="value">{input}</td>
            ];
        } else {
            content = <td colSpan={2}>{input}</td>;
        }

        return (
            <PropertyEnclosure advanced={this.props.advanced || false} errors={this.props.errors}>
                {content}
            </PropertyEnclosure>
        );
    }
}
