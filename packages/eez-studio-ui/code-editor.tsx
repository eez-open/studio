import React from "react";
import classNames from "classnames";

import { guid } from "eez-studio-shared/guid";

import { PropertyEnclosure } from "eez-studio-ui/properties";

import { settingsController } from "home/settings";

////////////////////////////////////////////////////////////////////////////////

// Creating ace editor is slow, so do it one at the time

const createEditorQueue: (() => void)[] = [];
let processCreateEditorQueueTimeout: any;

function processCreateEditorQueue() {
    processCreateEditorQueueTimeout = undefined;

    const createEditor = createEditorQueue.shift();
    if (createEditor) {
        createEditor();
    }

    scheduleNextProcessCreateEditorQueue();
}

function scheduleNextProcessCreateEditorQueue() {
    if (createEditorQueue.length > 0 && !processCreateEditorQueueTimeout) {
        processCreateEditorQueueTimeout = setTimeout(processCreateEditorQueue);
    }
}

////////////////////////////////////////////////////////////////////////////////

interface AceEditor {
    getValue(): string;
}

async function createEditor(
    element: HTMLElement,
    value: string,
    readOnly: boolean,
    mode: string,
    lineNumber: number,
    columnNumber: number,
    minLines?: number,
    maxLines?: number
) {
    return new Promise<AceEditor | undefined>(resolve => {
        createEditorQueue.push(() => {
            if ($(element).parents("html").length == 0) {
                console.log("code editor element is detached");
                resolve(undefined);
                return;
            }

            const editor = ace.edit(element);

            //editor.$blockScrolling = Infinity;

            editor.getSession().setUseWorker(false);
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

            if (settingsController.isDarkTheme) {
                editor.setTheme("ace/theme/dracula");
            } else {
                editor.setTheme("ace/theme/github");
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
            editor.getSession().getUndoManager().reset();
            editor.selection.moveTo(lineNumber - 1, columnNumber - 1);

            resolve(editor);
        });

        scheduleNextProcessCreateEditorQueue();
    });
}

function resizeEditor(editor: any) {
    editor.resize();
}

function insertText(editor: any, text: string) {
    editor.insert(text);
}

function canUndo(editor: any) {
    return editor.getSession().getUndoManager().hasUndo();
}

function undo(editor: any) {
    editor.getSession().getUndoManager().undo();
}

function canRedo(editor: any) {
    return editor.getSession().getUndoManager().hasRedo();
}

function redo(editor: any) {
    editor.getSession().getUndoManager().redo();
}

function onEditorEvent(editor: any, eventName: string, handler: any) {
    editor.on(eventName, handler);
}

function offEditorEvent(editor: any, eventName: string, handler: any) {
    editor.off(eventName, handler);
}

function destroyEditor(editor: any) {
    editor.renderer.freeze();
    editor.destroy();
}

function openSearchbox(editor: any) {
    editor.execCommand("find");
}

////////////////////////////////////////////////////////////////////////////////

export type CodeEditorMode =
    | "c_cpp"
    | "javascript"
    | "json"
    | "scpi"
    | "python"
    | "css";

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

export class CodeEditor extends React.Component<CodeEditorProps> {
    elementRef = React.createRef<HTMLDivElement>();
    editor: AceEditor | undefined;

    resize = () => {
        if (this.editor) {
            resizeEditor(this.editor);
        }
    };

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

    openSearchbox() {
        openSearchbox(this.editor);
    }

    onChange = (event: any) => {
        if (this.editor) {
            this.props.onChange(this.editor.getValue());
        }
    };

    async createEditor(props: CodeEditorProps) {
        this.editor = await createEditor(
            this.elementRef.current!,
            props.value,
            props.readOnly || false,
            props.mode,
            props.lineNumber || 1,
            props.columnNumber || 1,
            props.minLines,
            props.maxLines
        );

        if (!this.editor) {
            return;
        }

        onEditorEvent(this.editor, "change", this.onChange);

        if (props.onFocus) {
            onEditorEvent(this.editor, "focus", props.onFocus);
        }

        if (props.onBlur) {
            onEditorEvent(this.editor, "blur", props.onBlur);
        }

        setTimeout(this.resize);
    }

    destroyEditor(props: CodeEditorProps) {
        if (this.editor) {
            offEditorEvent(this.editor, "change", this.onChange);

            if (props.onFocus) {
                offEditorEvent(this.editor, "focus", props.onFocus);
            }

            if (props.onBlur) {
                offEditorEvent(this.editor, "blur", props.onBlur);
            }

            destroyEditor(this.editor);
            this.editor = undefined;
        }
    }

    componentDidMount() {
        this.createEditor(this.props);

        window.addEventListener("resize", () => {
            setTimeout(() => this.resize(), 100);
        });
    }

    componentDidUpdate(prevProps: any) {
        if (
            !this.editor ||
            this.props.value !== this.editor.getValue() ||
            this.props.readOnly !== prevProps.readOnly ||
            this.props.mode !== prevProps.mode
        ) {
            this.destroyEditor(prevProps);
            this.createEditor(this.props);
        }
    }

    componentWillUnmount() {
        this.destroyEditor(this.props);

        window.removeEventListener("resize", this.resize);
    }

    render() {
        return (
            <div
                ref={this.elementRef}
                className={classNames(
                    "EezStudio_CodeEditor",
                    this.props.className
                )}
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
    errors?: string[];
    readOnly: boolean;
    lineNumber?: number;
    columnNumber?: number;
}

export class CodeEditorProperty extends React.Component<
    CodeEditorPropertyProps,
    {}
> {
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
                    height:
                        this.props.height !== undefined
                            ? this.props.height
                            : 200,
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
            <PropertyEnclosure errors={this.props.errors}>
                {content}
            </PropertyEnclosure>
        );
    }
}
