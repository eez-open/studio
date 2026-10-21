import React from "react";
import {
    computed,
    observable,
    action,
    makeObservable,
    runInAction,
    reaction,
    autorun
} from "mobx";
import { observer } from "mobx-react";
import classNames from "classnames";
import { map } from "lodash-es";

import { humanize, stringCompare } from "eez-studio-shared/string";

import { ITreeNode, Tree } from "eez-studio-ui/tree";

import {
    getProperty,
    IEezObject,
    IOnSelectParams,
    PropertyInfo
} from "project-editor/core/object";
import { ProjectContext } from "project-editor/project/context";
import {
    getProjectStore,
    ProjectStore
} from "project-editor/store";
import { Dialog, showDialog } from "eez-studio-ui/dialog";
import {
    binaryOperators,
    builtInConstants,
    builtInFunctions,
    logicalOperators,
    unaryOperators
} from "./operations";
import {
    getArrayElementTypeFromType,
    getStructureFromType,
    isArrayType,
    isStructType,
    isObjectType,
    getObjectVariableTypeFromType,
    getSystemEnums,
    getTypeShortName
} from "project-editor/features/variable/value-type";
import { ProjectEditor } from "project-editor/project-editor-interface";
import {
    FLOW_ITERATOR_INDEXES_VARIABLE,
    FLOW_ITERATOR_INDEX_VARIABLE
} from "project-editor/features/variable/defs";
import { parseIdentifier } from "project-editor/flow/expression";
import {
    FONT_TAG_REGEX,
    supportsFontTags
} from "project-editor/flow/expression/helper";
import { findFont } from "project-editor/project/assets";
import type { Font } from "project-editor/features/font/font";
import type { Widget } from "project-editor/flow/component";
import {
    drawGlyph,
    setBackColor,
    setColor,
    setProject
} from "project-editor/flow/editor/eez-gui-draw";
import { IObjectVariableValueFieldDescription } from "eez-studio-types";

import type { InstrumentObject } from "instrument/instrument-object";
import type * as InstrumentObjectModule from "instrument/instrument-object";
import type * as CommandsBrowserModule from "instrument/window/terminal/commands-browser";

import { TerminalState } from "instrument/window/terminal/terminalState";
import { SearchInput } from "eez-studio-ui/search-input";

////////////////////////////////////////////////////////////////////////////////

export const EXPR_MARK_START = "/*";
export const EXPR_MARK_END = "*/";

////////////////////////////////////////////////////////////////////////////////

export async function expressionBuilder(
    object: IEezObject,
    propertyInfo: PropertyInfo,
    opts: {
        assignableExpression: boolean;
        title: string;
    },
    params?: IOnSelectParams
) {
    let disposed = false;

    return new Promise<{
        [propertyName: string]: string;
    }>((resolve, reject) => {
        const onDispose = () => {
            if (!disposed) {
                if (modalDialog) {
                    root.unmount();
                    modalDialog.close();
                }
                disposed = true;
            }
        };

        const onOk = (value: any) => {
            resolve(value);
            onDispose();
        };

        const [modalDialog, _, root] = showDialog(
            <ProjectContext.Provider value={getProjectStore(object)}>
                <SelectItemDialog
                    object={object}
                    propertyInfo={propertyInfo}
                    assignableExpression={opts.assignableExpression}
                    params={params}
                    onOk={onOk}
                    onCancel={onDispose}
                />
            </ProjectContext.Provider>,
            {
                jsPanel: Object.assign({ width: 1024, height: 600 }, opts, {
                    id: "expression-builder",
                    onclosed: onDispose
                })
            }
        );
    });
}

////////////////////////////////////////////////////////////////////////////////

class ExpressionBuilderState extends TerminalState {
    activeTab: "scpi" | "expression" = "scpi";
    _instrumentId: string | undefined;
    expressionSearchText: string = "";

    reactionDispose: any;
    autorunDispose: any;

    constructor(
        public projectStore: ProjectStore,
        public props: {
            object: IEezObject;
            propertyInfo: PropertyInfo;
        },
        instrument: InstrumentObject | undefined
    ) {
        super(instrument);

        this.activeTab =
            (window.localStorage.getItem(
                "expression-builder/activeTab"
            ) as any) == "scpi"
                ? "scpi"
                : "expression";

        makeObservable(this, {
            activeTab: observable,
            _instrumentId: observable,
            expressionSearchText: observable,
            instrumentId: computed
        });

        this.reactionDispose = reaction(
            () => this.activeTab,
            value => {
                localStorage.setItem("expression-builder/activeTab", value);
            }
        );

        this.autorunDispose = autorun(() => {
            let instrument: InstrumentObject | undefined;

            if (this.instrumentId) {
                const { instruments } =
                    require("instrument/instrument-object") as typeof InstrumentObjectModule;
                instrument = instruments.get(this.instrumentId);
            } else {
                instrument = undefined;
            }

            runInAction(() => {
                this.instrument = instrument;
            });
        });
    }

    unmount() {
        if (this.reactionDispose) {
            this.reactionDispose();
            this.reactionDispose = undefined;
        }

        if (this.autorunDispose) {
            this.autorunDispose();
            this.autorunDispose = undefined;
        }
    }

    get instrumentId(): string | undefined {
        let instrumentId = this._instrumentId;

        if (!instrumentId) {
            if (this.props.propertyInfo.getInstrumentId) {
                instrumentId = this.props.propertyInfo.getInstrumentId(
                    this.props.object
                );
            }
        }

        if (!instrumentId) {
            instrumentId =
                this.projectStore.uiStateStore.expressionBuilderInstrumentId;
        }

        if (!instrumentId) {
            const { instruments } =
                require("instrument/instrument-object") as typeof InstrumentObjectModule;

            const instrumentsArray = [...instruments.values()];
            if (instrumentsArray.length > 0) {
                instrumentId = [...instruments.values()][0].id;
            }
        }

        return instrumentId;
    }
}

////////////////////////////////////////////////////////////////////////////////

const VariableLabel = observer(
    ({ name, type }: { name: string; type: string }) => (
        <>
            <span className="name">{name}</span>
            <span className="type">{type}</span>
        </>
    )
);

////////////////////////////////////////////////////////////////////////////////

const GlyphCanvas = observer(({ font, encoding }: { font: Font; encoding: number }) => {
    const canvasRef = React.useRef<HTMLCanvasElement>(null);

    const glyph = font.glyphsMap.get(encoding);
    const width = Math.max(
        1,
        glyph ? Math.max(glyph.dx || 0, glyph.x + glyph.width) : 1
    );
    const height = Math.max(1, font.height);

    React.useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
        if (!canvas || !ctx) {
            return;
        }
        setProject(ProjectEditor.getProject(font));
        setColor("#000000");
        setBackColor("#ffffff");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        drawGlyph(ctx, 0, 0, encoding, font);
    });

    return <canvas ref={canvasRef} width={width} height={height} />;
});

const GlyphsPanel = observer(
    ({
        font,
        onInsert
    }: {
        font: Font;
        onInsert: (encoding: number) => void;
    }) => {
        const encodings = font.glyphs
            .map(glyph => glyph.encoding)
            .sort((a, b) => a - b);

        return (
            <div className="EezStudio_ExpressionBuilder_Glyphs">
                <div className="EezStudio_ExpressionBuilder_GlyphsTitle">
                    Font: {font.name}
                </div>
                <div className="EezStudio_ExpressionBuilder_GlyphsList">
                    {encodings.map(encoding => (
                        <div
                            key={encoding}
                            className="EezStudio_ExpressionBuilder_Glyph"
                            title={`U+${encoding
                                .toString(16)
                                .toUpperCase()
                                .padStart(4, "0")} (${encoding})`}
                            onDoubleClick={() => onInsert(encoding)}
                        >
                            <GlyphCanvas font={font} encoding={encoding} />
                        </div>
                    ))}
                </div>
            </div>
        );
    }
);

////////////////////////////////////////////////////////////////////////////////

const SelectItemDialog = observer(
    class SelectItemDialog extends React.Component<{
        object: IEezObject;
        propertyInfo: PropertyInfo;
        assignableExpression: boolean;
        params?: IOnSelectParams;
        onOk: (value: any) => void;
        onCancel: () => void;
    }> {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        ref = React.createRef<HTMLDivElement>();

        textarea: HTMLTextAreaElement;
        value: string;
        selection: string | undefined;
        cursorPosition: number = 0;
        skipInitialSelectEvent = false;

        expressionBuilderState: ExpressionBuilderState;

        autorunDispose: any;

        constructor(props: any) {
            super(props);

            this.expressionBuilderState = new ExpressionBuilderState(
                getProjectStore(this.props.object),
                this.props,
                undefined
            );

            this.value =
                getProperty(
                    this.props.object,
                    this.props.propertyInfo.name
                )?.toString() || "";

            makeObservable(this, {
                value: observable,
                selection: observable,
                cursorPosition: observable,
                glyphsFont: computed,
                component: computed,
                flow: computed,
                componentInputs: computed,
                localVariables: computed,
                globalVariables: computed,
                rootNodeVariables: computed,
                rootNodeSystemVariables: computed,
                rootNodeOperations: computed,
                rootNodeFunctions: computed,
                rootNodeTextResources: computed
            });

            autorun(() => {
                this.updateCommand();
            });
        }

        updateCommand() {
            if (this.expressionBuilderState) {
                const start = this.textarea?.selectionStart ?? 0;
                const end = this.textarea?.selectionEnd ?? start;

                let line = getLine(this.value, start, end) ?? "";
                this.expressionBuilderState.command = line;
            }
        }

        componentDidMount() {
            let textInputSelection = this.props.params?.textInputSelection;

            // select font in the glyphs column depending on the cursor
            // position in the edited text
            runInAction(() => {
                this.cursorPosition = Math.min(
                    textInputSelection?.start ?? 0,
                    this.value.length
                );
            });

            if (
                !textInputSelection ||
                (textInputSelection.start == this.value.length &&
                    textInputSelection.end == this.value.length &&
                    textInputSelection.direction == "forward")
            ) {
                textInputSelection = {
                    start: 0,
                    end: this.value.length,
                    direction: "forward"
                };
            }

            const textareaHeight = window.localStorage.getItem(
                "project-editor/expression-builder/textarea/height"
            );
            if (textareaHeight) {
                this.textarea.style.height = textareaHeight;
            }

            this.textarea.focus();

            this.skipInitialSelectEvent = true;
            setTimeout(() => (this.skipInitialSelectEvent = false), 100);
            this.textarea.setSelectionRange(
                textInputSelection.start,
                textInputSelection.end,
                textInputSelection.direction === null
                    ? undefined
                    : textInputSelection.direction
            );

            this.autorunDispose = autorun(() => {
                if (this.expressionBuilderState.searchText) {
                    const i = this.expressionBuilderState.selectedNodeIndex;

                    if (this.ref.current) {
                        const listItemElement = this.ref.current.querySelector(
                            `.EezStudio_ExpressionBuilder_CommandsBrowser .EezStudio_List .EezStudio_ListItem:nth-child(${
                                i + 1
                            })`
                        );
                        if (listItemElement) {
                            listItemElement.scrollIntoView({
                                behavior: "auto",
                                block: "nearest"
                            });
                        }
                    }
                }
            });
        }

        componentWillUnmount() {
            window.localStorage.setItem(
                "project-editor/expression-builder/textarea/height",
                this.textarea.style.height
            );

            this.expressionBuilderState.unmount();

            this.autorunDispose();
        }

        onOkEnabled = () => {
            return true;
        };

        onOk = () => {
            this.props.onOk({
                [this.props.propertyInfo.name]: this.value
            });

            return true;
        };

        onDoubleClick = action(() => {
            if (!this.selection) {
                return;
            }

            const start = this.textarea.selectionStart ?? 0;
            const end = this.textarea.selectionEnd ?? start;

            let textToInsert = this.selection;

            if (
                this.props.propertyInfo.flowProperty == "scpi-template-literal"
            ) {
                if (!isInsideExpression(this.value, start, end)) {
                    textToInsert = `{${textToInsert}}`;
                }
            }

            this.value =
                this.value.substring(0, start) +
                textToInsert +
                this.value.substring(end);

            let newStart: number | undefined;
            let newEnd: number | undefined;

            for (let i = start + 1; i < this.value.length; i++) {
                if (!newStart) {
                    if (this.value[i - 1] == "/" && this.value[i] == "*") {
                        i++;
                        newStart = i;
                    }
                } else {
                    if (
                        this.value[i] == "*" &&
                        i < this.value.length - 1 &&
                        this.value[i + 1] == "/"
                    ) {
                        i++;
                        newEnd = i;
                        break;
                    }
                }
            }

            if (newStart != undefined && newEnd != undefined) {
                setTimeout(() => {
                    this.textarea.focus();
                    this.textarea.setSelectionRange(
                        newStart!,
                        newEnd!,
                        "forward"
                    );
                });
            }
        });

        get component() {
            return ProjectEditor.getComponent(this.props.object);
        }

        get flow() {
            return ProjectEditor.getFlow(this.component);
        }

        // Font whose glyphs are listed in the glyphs column: font from the
        // <font name="..."> tag that encloses the cursor, otherwise the style
        // font of the widget. Only for text properties of widgets that
        // support font tags.
        get glyphsFont(): Font | undefined {
            const component = this.component;
            if (
                !component ||
                !supportsFontTags(component) ||
                (this.props.propertyInfo.name != "text" &&
                    this.props.propertyInfo.name != "data")
            ) {
                return undefined;
            }

            let fontName: string | undefined;
            for (const match of this.value
                .substring(0, this.cursorPosition)
                .matchAll(FONT_TAG_REGEX)) {
                fontName = match[1] ?? match[2];
            }

            if (fontName != undefined) {
                const font = findFont(this.context.project, fontName);
                if (font) {
                    return font;
                }
            }

            return (component as Widget).style?.fontObject;
        }

        insertGlyph = action((encoding: number) => {
            const start = this.textarea.selectionStart ?? 0;
            const end = this.textarea.selectionEnd ?? start;
            const hex = encoding.toString(16).toUpperCase();
            const char =
                encoding <= 0xffff
                    ? `\\u${hex.padStart(4, "0")}`
                    : `\\u{${hex}}`;

            this.value =
                this.value.substring(0, start) +
                char +
                this.value.substring(end);

            const newPosition = start + char.length;
            this.cursorPosition = newPosition;

            setTimeout(() => {
                this.textarea.focus();
                this.textarea.setSelectionRange(
                    newPosition,
                    newPosition,
                    "forward"
                );
            });
        });

        get componentInputs() {
            return this.component.inputs.filter(
                componentInput => !componentInput.name.startsWith("@")
            );
        }

        get userProperties() {
            const vars = [...this.flow.userProperties];
            vars.sort((a, b) => stringCompare(a.name, b.name));
            return vars;
        }

        get localVariables() {
            const vars = [...this.flow.localVariables];
            vars.sort((a, b) => stringCompare(a.name, b.name));
            return vars;
        }

        get globalVariables() {
            const vars = [
                ...this.context.project.allVisibleGlobalVariables.slice()
            ];
            vars.sort((a, b) => stringCompare(a.fullName, b.fullName));
            return vars;
        }

        getTypeChildren(
            type: string,
            prefix: string,
            set?: Set<string>
        ): ITreeNode<string>[] {
            if (set) {
                if (set.has(type)) {
                    return [];
                }
            } else {
                set = new Set<string>();
            }
            set.add(type);

            if (isArrayType(type)) {
                return this.getTypeChildren(
                    getArrayElementTypeFromType(type)!,
                    `${prefix}[]`,
                    set
                );
            } else if (isStructType(type)) {
                const structure = getStructureFromType(
                    this.context.project,
                    type
                );
                if (structure) {
                    return structure.fields.map(field => {
                        const data = `${prefix}.${field.name}`;
                        return {
                            id: field.name,
                            label: (
                                <VariableLabel
                                    name={
                                        (prefix.endsWith("[]") ? "[]" : "") +
                                        "." +
                                        field.name
                                    }
                                    type={field.type}
                                />
                            ),
                            children: this.getTypeChildren(
                                field.type,
                                `${prefix}.${field.name}`,
                                set
                            ),
                            selected: this.selection == data,
                            expanded: true,
                            data: data
                        };
                    });
                }
            } else if (isObjectType(type)) {
                const objectVariableType = getObjectVariableTypeFromType(
                    this.context,
                    type
                );
                if (objectVariableType) {
                    function getFields(
                        fieldDescriptions: IObjectVariableValueFieldDescription[],
                        prefix: string
                    ): ITreeNode<string>[] {
                        return fieldDescriptions.map(field => {
                            const data = `${prefix}.${field.name}`;
                            return {
                                id: field.name,
                                label:
                                    typeof field.valueType == "string" ? (
                                        <VariableLabel
                                            name={
                                                (prefix.endsWith("[]")
                                                    ? "[]"
                                                    : "") +
                                                "." +
                                                field.name
                                            }
                                            type={field.valueType}
                                        />
                                    ) : (
                                        `.${field.name}`
                                    ),
                                children:
                                    typeof field.valueType == "string"
                                        ? []
                                        : getFields(
                                              field.valueType,
                                              `${prefix}.${field.name}`
                                          ),
                                selected: selection == data,
                                expanded: true,
                                data: data
                            };
                        });
                    }
                    const selection = this.selection;
                    return getFields(
                        objectVariableType.valueFieldDescriptions,
                        prefix
                    );
                }
            }

            return [];
        }

        getUnaryOperators<
            T extends {
                [operator: string]: {
                    name: string;
                };
            }
        >(operators: T) {
            return map(operators, (operator, operatorSign) => {
                const data = `${operatorSign}${EXPR_MARK_START}expr${EXPR_MARK_END}`;
                return {
                    id: operator.name,
                    label: (
                        <>
                            <span>{humanize(operator.name)}</span>
                            <span className="EezStudio_ExpressionBuilder_OperatorSign">
                                {operatorSign}
                            </span>
                        </>
                    ),
                    children: [],
                    selected: this.selection == data,
                    expanded: false,
                    data
                };
            });
        }

        getBinaryOperators<
            T extends {
                [operator: string]: {
                    name: string;
                };
            }
        >(operators: T) {
            return map(operators, (operator, operatorSign) => {
                const data = `${EXPR_MARK_START}expr${EXPR_MARK_END} ${operatorSign} ${EXPR_MARK_START}expr${EXPR_MARK_END}`;
                return {
                    id: operator.name,
                    label: (
                        <>
                            <span>{humanize(operator.name)}</span>
                            <span className="EezStudio_ExpressionBuilder_OperatorSign">
                                {operatorSign}
                            </span>
                        </>
                    ),
                    children: [],
                    selected: this.selection == data,
                    expanded: false,
                    data
                };
            });
        }

        searchTreeNode(treeNode: ITreeNode) {
            const searchText = this.expressionBuilderState.expressionSearchText
                .trim()
                .toLowerCase();

            if (!searchText) {
                return treeNode;
            }

            const walk = (node: ITreeNode) => {
                node.children.forEach(walk);

                node.children = node.children.filter(child => {
                    if (child.children.length > 0) {
                        return true;
                    }

                    const text =
                        child.label && typeof child.label == "string"
                            ? child.label
                            : child.id;

                    return text.toLowerCase().indexOf(searchText) != -1;
                });
            };

            walk(treeNode);

            return treeNode;
        }

        get rootNodeVariables(): {
            nonEmpty: boolean;
            node: ITreeNode<string>;
        } {
            const children: ITreeNode<string>[] = [];

            if (
                !this.props.assignableExpression &&
                this.componentInputs.length
            ) {
                children.push({
                    id: "component-inputs",
                    label: "Component inputs",
                    children: this.componentInputs.map(componentInput => ({
                        id: componentInput.name,
                        label: (
                            <VariableLabel
                                name={componentInput.name}
                                type={componentInput.type}
                            />
                        ),
                        children: this.getTypeChildren(
                            componentInput.type,
                            componentInput.name
                        ),
                        selected: this.selection == componentInput.name,
                        expanded: true,
                        data: componentInput.name
                    })),
                    selected: false,
                    expanded: true
                });
            }

            if (this.userProperties.length) {
                children.push({
                    id: "user-properties",
                    label: "User properties",
                    children: this.userProperties.map(userProperty => ({
                        id: userProperty.name,
                        label: (
                            <VariableLabel
                                name={userProperty.name}
                                type={userProperty.type}
                            />
                        ),
                        children: this.getTypeChildren(
                            userProperty.type,
                            userProperty.name
                        ),
                        selected: this.selection == userProperty.name,
                        expanded: true,
                        data: userProperty.name
                    })),
                    selected: false,
                    expanded: true
                });
            }

            if (this.localVariables.length) {
                children.push({
                    id: "local-variables",
                    label: "Local variables",
                    children: this.localVariables.map(localVariable => ({
                        id: localVariable.name,
                        label: (
                            <VariableLabel
                                name={localVariable.name}
                                type={localVariable.type}
                            />
                        ),
                        children: this.getTypeChildren(
                            localVariable.type,
                            localVariable.name
                        ),
                        selected: this.selection == localVariable.name,
                        expanded: true,
                        data: localVariable.name
                    })),
                    selected: false,
                    expanded: true
                });
            }

            if (this.globalVariables.length) {
                children.push({
                    id: "global-variables",
                    label: "Global variables",
                    children: this.globalVariables.map(globalVariable => ({
                        id: globalVariable.fullName,
                        label: (
                            <VariableLabel
                                name={globalVariable.fullName}
                                type={globalVariable.type}
                            />
                        ),
                        children: this.getTypeChildren(
                            globalVariable.type,
                            globalVariable.fullName
                        ),
                        selected: this.selection == globalVariable.fullName,
                        expanded: true,
                        data: globalVariable.fullName
                    })),
                    selected: false,
                    expanded: true
                });
            }

            return observable({
                nonEmpty: children.length > 0,
                node: this.searchTreeNode({
                    id: "all",
                    label: "All",
                    children,
                    selected: false,
                    expanded: true
                })
            });
        }

        get rootNodeSystemVariables(): {
            nonEmpty: boolean;
            node: ITreeNode<string>;
        } {
            const children: ITreeNode<string>[] = [];

            if (!this.props.assignableExpression) {
                children.push({
                    id: "system-variables",
                    label: "System variables",
                    children: [
                        {
                            id: FLOW_ITERATOR_INDEX_VARIABLE,
                            label: FLOW_ITERATOR_INDEX_VARIABLE,
                            children: [],
                            selected:
                                this.selection == FLOW_ITERATOR_INDEX_VARIABLE,
                            expanded: false,
                            data: FLOW_ITERATOR_INDEX_VARIABLE
                        },
                        {
                            id: FLOW_ITERATOR_INDEXES_VARIABLE,
                            label: FLOW_ITERATOR_INDEXES_VARIABLE,
                            children: [],
                            selected:
                                this.selection ==
                                FLOW_ITERATOR_INDEXES_VARIABLE,
                            expanded: false,
                            data: FLOW_ITERATOR_INDEXES_VARIABLE
                        }
                    ],
                    selected: false,
                    expanded: true
                });

                const enumTypes = [
                    ...this.context.project.variables.enums,
                    ...getSystemEnums(this.context),
                    ...this.context.importedEnums.values()
                ];

                if (enumTypes.length) {
                    children.push({
                        id: "enumerations",
                        label: "Enumerations",
                        children: enumTypes.map(enumeration => ({
                            id: enumeration.name,
                            label: enumeration.name,
                            children: enumeration.members.map(member => {
                                const data = `${getTypeShortName(
                                    enumeration.name
                                )}.${member.name}`;
                                return {
                                    id: member.name,
                                    label: member.name,
                                    children: [],
                                    selected: this.selection == member.name,
                                    expanded: false,
                                    data
                                };
                            }),
                            selected: false,
                            expanded: false,
                            data: undefined
                        })),
                        selected: false,
                        expanded: true
                    });
                }

                children.push({
                    id: "built-in-constants",
                    label: "Built-in Constants",
                    children: map(
                        builtInConstants(this.context),
                        (constant, constantName) => ({
                            id: constantName,
                            label: constant.label
                                ? constant.label(constantName)
                                : constantName,
                            children: [],
                            selected: this.selection == constantName,
                            expanded: false,
                            data: constantName
                        })
                    ),
                    selected: false,
                    expanded: true
                });
            }

            return observable({
                nonEmpty: children.length > 0,
                node: this.searchTreeNode({
                    id: "all",
                    label: "All",
                    children,
                    selected: false,
                    expanded: true
                })
            });
        }

        get rootNodeOperations(): {
            nonEmpty: boolean;
            node: ITreeNode<string>;
        } {
            const children: ITreeNode<string>[] = [];

            if (!this.props.assignableExpression) {
                children.push({
                    id: "binary-operators",
                    label: "Binary operators",
                    children: this.getBinaryOperators(binaryOperators),
                    selected: false,
                    expanded: true
                });

                children.push({
                    id: "logical-operators",
                    label: "Logical operators",
                    children: this.getBinaryOperators(logicalOperators),
                    selected: false,
                    expanded: true
                });

                const conditionalOperatorData = `${EXPR_MARK_START}condition${EXPR_MARK_END} ? ${EXPR_MARK_START}exprIfTrue${EXPR_MARK_END} : ${EXPR_MARK_START}exprIfFalse${EXPR_MARK_END}`;
                children.push({
                    id: "conditional-operator",
                    label: (
                        <>
                            <span>Conditional operator</span>
                            <span className="EezStudio_ExpressionBuilder_OperatorSign">
                                A ? B : C
                            </span>
                        </>
                    ),
                    children: [],
                    selected: this.selection == conditionalOperatorData,
                    expanded: false,
                    data: conditionalOperatorData
                });

                children.push({
                    id: "unary-operators",
                    label: "Unary operators",
                    children: this.getUnaryOperators(unaryOperators),
                    selected: false,
                    expanded: true
                });
            }

            return observable({
                nonEmpty: children.length > 0,
                node: this.searchTreeNode({
                    id: "all",
                    label: "All",
                    children,
                    selected: false,
                    expanded: true
                })
            });
        }

        get rootNodeFunctions(): {
            nonEmpty: boolean;
            node: ITreeNode<string>;
        } {
            const children: ITreeNode<string>[] = [];

            if (!this.props.assignableExpression) {
                children.push({
                    id: "built-in-functions",
                    label: "Built-in Functions",
                    children: Object.keys(builtInFunctions)
                        .filter(functionName => {
                            const func = builtInFunctions[functionName];
                            if (func.enabled == undefined) {
                                return true;
                            }
                            return func.enabled(this.context);
                        })
                        .map(functionName => {
                            const func = builtInFunctions[functionName];
                            const data = `${functionName}(${func.args
                                .map(
                                    arg =>
                                        `${EXPR_MARK_START}${arg}${EXPR_MARK_END}`
                                )
                                .join(", ")})`;
                            return {
                                id: functionName,
                                label: functionName,
                                children: [],
                                selected: this.selection == data,
                                expanded: false,
                                data
                            };
                        }),
                    selected: false,
                    expanded: true
                });
            }

            return observable({
                nonEmpty: children.length > 0,
                node: this.searchTreeNode({
                    id: "all",
                    label: "All",
                    children,
                    selected: false,
                    expanded: true
                })
            });
        }

        get rootNodeTextResources(): {
            nonEmpty: boolean;
            node: ITreeNode<string>;
        } {
            const children: ITreeNode<string>[] = [];

            if (!this.props.assignableExpression) {
                if (this.context.project.texts) {
                    children.push({
                        id: "text-resources",
                        label: "Text resources",
                        children: map(
                            this.context.project.texts.resources,
                            text => {
                                const data = `T"${text.resourceID}"`;
                                return {
                                    id: text.resourceID,
                                    label: text.resourceID,
                                    children: [],
                                    selected: this.selection == data,
                                    expanded: false,
                                    data
                                };
                            }
                        ),
                        selected: false,
                        expanded: true
                    });
                }
            }

            return observable({
                nonEmpty: children.length > 0,
                node: this.searchTreeNode({
                    id: "all",
                    label: "All",
                    children,
                    selected: false,
                    expanded: true
                })
            });
        }

        selectNode = action((node?: ITreeNode<string>) => {
            this.selection = node && node.data;
        });

        onSelectionChange = (
            event: React.SyntheticEvent<
                HTMLTextAreaElement | HTMLInputElement,
                Event
            >
        ) => {
            this.updateCommand();

            const start = event.currentTarget.selectionStart ?? 0;
            const end = event.currentTarget.selectionEnd ?? start;
            const value = event.currentTarget.value;

            // the first select event is caused by the initial setSelectionRange
            // call in componentDidMount, cursorPosition is already set then
            if (this.skipInitialSelectEvent) {
                this.skipInitialSelectEvent = false;
            } else {
                runInAction(() => {
                    this.cursorPosition = start;
                });
            }

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

        set command(value: string) {
            runInAction(() => {
                const start = this.textarea.selectionStart ?? 0;
                const end = this.textarea.selectionEnd ?? start;

                let newStart = start;
                let newEnd = end;

                if (start == end) {
                    let pos = start;
                    if (isEndOfLine(this.value, pos)) {
                        this.value =
                            this.value.substring(0, pos) +
                            "\n" +
                            value +
                            this.value.substring(pos);

                        newStart = pos + 1 + value.length;
                        newEnd = newStart;
                    } else {
                        pos = getStartOfLine(this.value, pos);
                        this.value =
                            this.value.substring(0, pos) +
                            value +
                            "\n" +
                            this.value.substring(pos);

                        newStart = pos + value.length;
                        newEnd = newStart;
                    }
                } else {
                    this.value =
                        this.value.substring(0, start) +
                        value +
                        this.value.substring(end);
                    newEnd = start + value.length;
                }

                setTimeout(() => {
                    this.textarea.focus();
                    this.textarea.setSelectionRange(
                        newStart,
                        newEnd,
                        "forward"
                    );
                });
            });
        }

        render() {
            let tabs;
            let activeTab;

            if (
                this.props.propertyInfo.flowProperty == "scpi-template-literal"
            ) {
                activeTab = this.expressionBuilderState.activeTab;

                let instrumentsSelector;

                if (this.expressionBuilderState.activeTab == "scpi") {
                    const { instruments } =
                        require("instrument/instrument-object") as typeof InstrumentObjectModule;

                    instrumentsSelector = (
                        <div>
                            <span>Instrument</span>
                            <select
                                className="form-select"
                                value={this.expressionBuilderState.instrumentId}
                                onChange={action(event => {
                                    this.expressionBuilderState._instrumentId =
                                        event.target.value;
                                    this.context.uiStateStore.expressionBuilderInstrumentId =
                                        this.expressionBuilderState._instrumentId;
                                })}
                            >
                                {[...instruments.values()].map(instrument => (
                                    <option
                                        value={instrument.id}
                                        key={instrument.id}
                                    >
                                        {instrument.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    );
                }

                tabs = (
                    <div className="EezStudio_ExpressionBuilder_NavContainer">
                        <ul className="nav nav-pills">
                            <li className="nav-item">
                                <a
                                    className={classNames("nav-link", {
                                        active: activeTab == "scpi"
                                    })}
                                    aria-current="page"
                                    href="#"
                                    onClick={action(
                                        () =>
                                            (this.expressionBuilderState.activeTab =
                                                "scpi")
                                    )}
                                >
                                    SCPI
                                </a>
                            </li>
                            <li className="nav-item">
                                <a
                                    className={classNames("nav-link", {
                                        active: activeTab == "expression"
                                    })}
                                    href="#"
                                    onClick={action(
                                        () =>
                                            (this.expressionBuilderState.activeTab =
                                                "expression")
                                    )}
                                >
                                    Expression
                                </a>
                            </li>
                        </ul>
                        {instrumentsSelector}
                    </div>
                );
            } else {
                activeTab = "expression";
            }

            const { CommandsBrowser } =
                require("instrument/window/terminal/commands-browser") as typeof CommandsBrowserModule;

            return (
                <Dialog
                    modal={false}
                    okButtonText="Ok"
                    okEnabled={this.onOkEnabled}
                    onOk={this.onOk}
                    onCancel={this.props.onCancel}
                >
                    <div
                        ref={this.ref}
                        className="EezStudio_ExpressionBuilder"
                        onKeyDown={e => {
                            if (e.key == "F3") {
                                if (e.shiftKey) {
                                    this.expressionBuilderState.selectPreviousNode();
                                } else {
                                    this.expressionBuilderState.selectNextNode();
                                }
                            }
                        }}
                    >
                        <textarea
                            ref={(ref: any) => (this.textarea = ref)}
                            className="form-control pre"
                            value={this.value}
                            onChange={action(event => {
                                this.value = event.target.value;
                            })}
                            onSelect={this.onSelectionChange}
                        />
                        {tabs}
                        <div
                            className="EezStudio_ExpressionBuilder_Expression"
                            style={{
                                display:
                                    activeTab == "expression" ? "flex" : "none"
                            }}
                        >
                            <SearchInput
                                searchText={
                                    this.expressionBuilderState
                                        .expressionSearchText
                                }
                                onClear={action(() => {
                                    this.expressionBuilderState.expressionSearchText =
                                        "";
                                })}
                                onChange={action(event => {
                                    this.expressionBuilderState.expressionSearchText =
                                        $(event.target).val() as string;
                                })}
                            />
                            <div className="EezStudio_ExpressionBuilder_Panels">
                                {this.rootNodeVariables.nonEmpty && (
                                    <Tree
                                        showOnlyChildren={true}
                                        rootNode={this.rootNodeVariables.node}
                                        selectNode={this.selectNode}
                                        onDoubleClick={this.onDoubleClick}
                                    />
                                )}
                                {this.rootNodeSystemVariables.nonEmpty && (
                                    <Tree
                                        showOnlyChildren={true}
                                        rootNode={
                                            this.rootNodeSystemVariables.node
                                        }
                                        selectNode={this.selectNode}
                                        onDoubleClick={this.onDoubleClick}
                                    />
                                )}
                                {this.rootNodeOperations.nonEmpty && (
                                    <Tree
                                        showOnlyChildren={true}
                                        rootNode={this.rootNodeOperations.node}
                                        selectNode={this.selectNode}
                                        onDoubleClick={this.onDoubleClick}
                                    />
                                )}
                                {this.rootNodeFunctions.nonEmpty && (
                                    <Tree
                                        showOnlyChildren={true}
                                        rootNode={this.rootNodeFunctions.node}
                                        selectNode={this.selectNode}
                                        onDoubleClick={this.onDoubleClick}
                                    />
                                )}
                                {this.rootNodeTextResources.nonEmpty && (
                                    <Tree
                                        showOnlyChildren={true}
                                        rootNode={
                                            this.rootNodeTextResources.node
                                        }
                                        selectNode={this.selectNode}
                                        onDoubleClick={this.onDoubleClick}
                                    />
                                )}
                                {this.glyphsFont && (
                                    <GlyphsPanel
                                        font={this.glyphsFont}
                                        onInsert={this.insertGlyph}
                                    />
                                )}
                            </div>
                        </div>
                        {this.expressionBuilderState.instrument && (
                            <CommandsBrowser
                                appStore={this.expressionBuilderState.instrument.getEditor()}
                                host={this}
                                terminalState={this.expressionBuilderState}
                                className="EezStudio_ExpressionBuilder_CommandsBrowser"
                                style={{
                                    display:
                                        activeTab == "scpi" ? "flex" : "none",
                                    overflow: "hidden"
                                }}
                                persistId="project-editor/expression-builder/commands-browser/splitter1"
                            />
                        )}
                    </div>
                </Dialog>
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

function isEndOfLine(str: string, pos: number) {
    return pos == str.length || str[pos] == "\n";
}

function getStartOfLine(str: string, pos: number) {
    if (str[pos] == "\n") {
        pos--;
    }

    for (let i = pos; i >= 0; i--) {
        if (str[i] == "\n") {
            return i + 1;
        }
    }
    return 0;
}

function getLine(str: string, start: number, end: number) {
    let lineStart = getStartOfLine(str, start);
    let lineEnd = str.indexOf("\n", end);
    if (lineEnd == -1) {
        lineEnd = str.length;
    }

    const line = str.substring(lineStart, lineEnd);

    if (line.indexOf("\n") != -1) {
        return undefined;
    }

    return line;
}

function isInsideExpression(str: string, start: number, end: number) {
    if (start == 0) {
        return false;
    }

    for (let i = start - 1; i >= 0; i--) {
        if (str[i] == "{") {
            break;
        }

        if (str[i] == "}") {
            return false;
        }
    }

    for (let i = end; i < str.length; i++) {
        if (str[i] == "}") {
            return true;
        }

        if (str[i] == "{") {
            break;
        }
    }

    return false;
}
