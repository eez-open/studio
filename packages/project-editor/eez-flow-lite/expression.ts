import { ProjectEditor } from "project-editor/project-editor-interface";

import type { Project } from "project-editor/project/project";
import {
    getArrayElementTypeFromType,
    getEnumTypeNameFromType,
    isEnumType,
    type ValueType
} from "project-editor/features/variable/value-type";
import type { Component } from "project-editor/flow/component";
import { Page } from "project-editor/features/page/page";
import { Action } from "project-editor/features/action/action";

import { expressionParser } from "project-editor/flow/expression/parser";
import {
    ExpressionNode,
    NonComputedPropertyExpressionNode
} from "project-editor/flow/expression/node";
import { checkArity } from "project-editor/flow/expression/type";
import {
    ExpressionEvalError,
    IExpressionContext
} from "project-editor/flow/expression";

import {
    binaryOperators,
    builtInConstants,
    builtInFunctions,
    logicalOperators,
    unaryOperators
} from "project-editor/flow/expression/operations";

export { IExpressionContext };

export function buildExpression(
    project: Project,
    component: Component | undefined,
    expression: string,
    targetType?: ValueType,
    resultType?: {
        valueType: ValueType;
    }
) {
    let rootNode = expressionParser.parse(expression);

    let flow = component ? ProjectEditor.getFlow(component) : undefined;

    findValueTypeInExpressionNode(project, component, rootNode, false);

    const buildExpressionNode = (node: ExpressionNode): string => {
        if (node.type == "Literal") {
            if (node.valueType == "float") {
                if (Number.isInteger(node.value)) {
                    return node.value + ".0f";    
                }
                return node.value + "f";
            }
            return JSON.stringify(node.value);
        }

        if (node.type == "Identifier") {
            if (flow) {
                const localVariable = flow.localVariables.find(
                    variable => variable.name == node.name
                );
                if (localVariable) {
                    if (flow instanceof Page) {
                        return `${flow.name}_page_local_vars.${node.name}`;
                    } else {
                        return node.name;
                    }
                } else {
                    if (flow instanceof Action) {
                        const userProperty = flow.userProperties.find(
                            prop => prop.name == node.name
                        );
                        if (userProperty) {
                            return node.name;
                        }
                    }
                }
            }

            const globalVariable = project.variables.globalVariables.find(
                variable => variable.name == node.name
            );
            if (globalVariable) {
                if (globalVariable.native) {
                    return `get_${node.name}()`;
                }
                return "global_vars." + node.name;
            }

            throw `identifier '${node.name}' is neither local or global variable`;
        }

        if (node.type == "CallExpression") {
            if (
                node.callee.type != "MemberExpression" ||
                node.callee.object.type != "Identifier" ||
                node.callee.property.type != "Identifier"
            ) {
                throw "Invalid call expression";
            }

            let functionName = `${node.callee.object.name}_${node.callee.property.name}`;

            let ctx;
            if (functionName == "String_format") {
                ctx = "&eezgui_ctx, ";
            } else {
                ctx = "";
            }

            return `${functionName}(${ctx}${node.arguments
                .map(arg => buildExpressionNode(arg))
                .join(", ")})`;
        }

        if (node.type == "UnaryExpression") {
            return `${node.operator}(${buildExpressionNode(node.argument)})`;
        }

        if (node.type == "BinaryExpression") {
            const isStringConcat = (n: ExpressionNode): boolean =>
                n.type == "BinaryExpression" &&
                n.operator == "+" &&
                ((n.left.valueType == "string" &&
                    n.right.valueType == "string") ||
                    ((n.left.valueType == "integer" || n.left.valueType == "float" || n.left.valueType == "double") &&
                        n.right.valueType == "string") ||
                    (n.left.valueType == "string" &&
                        (n.right.valueType == "integer" || n.right.valueType == "float" || n.right.valueType == "double")));

            if (isStringConcat(node)) {
                // Flatten concatenation chain into a single String_format call
                const collectParts = (n: ExpressionNode): ExpressionNode[] => {
                    if (isStringConcat(n)) {
                        const bin = n as ExpressionNode & {
                            left: ExpressionNode;
                            right: ExpressionNode;
                        };
                        return [
                            ...collectParts(bin.left),
                            ...collectParts(bin.right)
                        ];
                    }
                    return [n];
                };

                const isStringFormatCall = (n: ExpressionNode): boolean =>
                    n.type == "CallExpression" &&
                    n.callee.type == "MemberExpression" &&
                    n.callee.object.type == "Identifier" &&
                    n.callee.object.name == "String" &&
                    n.callee.property.type == "Identifier" &&
                    n.callee.property.name == "format";

                const parts = collectParts(node);
                let formatStr = "";
                const args: string[] = [];

                for (const part of parts) {
                    if (
                        part.type == "Literal" &&
                        typeof part.value == "string"
                    ) {
                        formatStr += (part.value as string).replace(/%/g, "%%");
                    } else if (isStringFormatCall(part)) {
                        const callNode = part as ExpressionNode & {
                            arguments: ExpressionNode[];
                        };
                        const fmtArg = callNode.arguments[0];
                        if (
                            fmtArg.type == "Literal" &&
                            typeof fmtArg.value == "string"
                        ) {
                            formatStr += fmtArg.value;
                            for (
                                let i = 1;
                                i < callNode.arguments.length;
                                i++
                            ) {
                                args.push(
                                    buildExpressionNode(callNode.arguments[i])
                                );
                            }
                        } else {
                            formatStr += "%s";
                            args.push(buildExpressionNode(part));
                        }
                    } else if (part.valueType == "integer") {
                        formatStr += "%d";
                        args.push(buildExpressionNode(part));
                    } else if (part.valueType == "float" || part.valueType == "double") {
                        formatStr += "%.4g";
                        args.push(buildExpressionNode(part));
                    } else {
                        formatStr += "%s";
                        args.push(buildExpressionNode(part));
                    }
                }

                if (args.length == 0) {
                    return JSON.stringify(formatStr.replace(/%%/g, "%"));
                }

                return `String_format(&eezgui_ctx, ${JSON.stringify(formatStr)}, ${args.join(", ")})`;
            }

            if (
                (node.operator == "==" || node.operator == "!=") &&
                node.left.valueType == "string" &&
                node.right.valueType == "string"
            ) {
                return `(strcmp(${buildExpressionNode(node.left)}, ${buildExpressionNode(node.right)}) ${node.operator == "==" ? "=" : "!"}= 0)`
            }

            return `(${buildExpressionNode(node.left)} ${node.operator} ${buildExpressionNode(node.right)})`;
        }

        if (node.type == "LogicalExpression") {
            return `(${buildExpressionNode(node.left)} ${node.operator} ${buildExpressionNode(node.right)})`;
        }

        if (node.type == "ConditionalExpression") {
            let consequent = buildExpressionNode(node.consequent);
            let alternate = buildExpressionNode(node.alternate);

            if (
                node.consequent.valueType == "string"
            ) {
                if (node.alternate.valueType == "integer") {
                    alternate = `String_format(&eezgui_ctx, "%d", ${alternate})`;
                } else if (node.alternate.valueType == "float" || node.alternate.valueType == "double") {
                    alternate = `String_format(&eezgui_ctx, "%.4g", ${alternate})`;
                }
            }

            if (
                node.alternate.valueType == "string"
            ) {
                if (node.consequent.valueType == "integer") {
                    consequent = `String_format(&eezgui_ctx, "%d", ${consequent})`;
                } else if (node.consequent.valueType == "float" || node.consequent.valueType == "double") {
                    consequent = `String_format(&eezgui_ctx, "%.4g", ${consequent})`;
                }
            }

            return `(${buildExpressionNode(node.test)} ? ${consequent} : ${alternate})`;
        }

        if (node.type == "MemberExpression") {
            if (
                node.object.type == "Identifier" &&
                node.property.type == "Identifier"
            ) {
                const enumType = project.variables.enumsMap.get(
                    node.object.name
                );
                if (enumType) {
                    const enumMember = enumType.membersMap.get(
                        node.property.name
                    );
                    if (!enumMember) {
                        throw `Member '${node.property.name}' does not exist in enum '${node.object.name}'`;
                    }
                    return `${enumType.name}_${enumMember.name}`;
                }
            }
        }

        return "";
    };

    let result = buildExpressionNode(rootNode);

    if (result.startsWith("(") && result.endsWith(")")) {
        result = result.substring(1, result.length - 1);
    }

    if (targetType == "string") {
        if (rootNode.valueType == "integer") {
            return `String_format(&eezgui_ctx, "%d", ${result})`;
        } else if (rootNode.valueType == "float" || rootNode.valueType == "double") {
            return `String_format(&eezgui_ctx, "%.4g", ${result})`;
        }
    }

    if (resultType) {
        resultType.valueType = rootNode.valueType;
    }

    return result;
}

export function buildAssignableExpression(
    project: Project,
    component: Component | undefined,
    expression: string,
    targetType?: ValueType
): {
    name: string;
    type: ValueType;
    size: number;
    native: boolean;
} {
    let rootNode = expressionParser.parse(expression);

    let flow = component ? ProjectEditor.getFlow(component) : undefined;

    findValueTypeInExpressionNode(project, component, rootNode, false);

    const buildExpressionNode = (node: ExpressionNode) => {
        if (node.type == "Identifier") {
            if (flow) {
                const localVariable = flow.localVariables.find(
                    variable => variable.name == node.name
                );
                if (localVariable) {
                    return {
                        name:
                            flow instanceof Page
                                ? `${flow.name}_page_local_vars.${localVariable.name}`
                                : localVariable.name,
                        type: localVariable.type,
                        size: localVariable.size,
                        native: false
                    };
                } else {
                    if (flow instanceof Action) {
                        const userProperty = flow.userProperties.find(
                            prop => prop.name == node.name
                        );
                        if (userProperty) {
                            return {
                                name: userProperty.name,
                                type: userProperty.type,
                                size: 0,
                                native: false
                            };
                        }
                    }
                }
            }

            const globalVariable = project.variables.globalVariables.find(
                variable => variable.name == node.name
            );
            if (globalVariable) {
                return {
                    name: globalVariable.native
                        ? globalVariable.name
                        : `global_vars.${globalVariable.name}`,
                    type: globalVariable.type,
                    size: globalVariable.size,
                    native: globalVariable.native
                };
            }

            throw `identifier '${node.name}' is neither local or global variable`;
        }

        throw `invalid`;
    };

    const result = buildExpressionNode(rootNode);

    return result;
}

export function evalConstantExpression(project: Project, expression: string) {
    if (typeof expression == "string") {
        expression = expression.trim();
    }

    let value;
    let valueType: ValueType;
    if (expression == undefined) {
        value = undefined;
        valueType = "undefined";
    } else if (typeof expression == "number") {
        value = expression;
        valueType = "double";
    } else {
        let rootNode = expressionParser.parse(expression);
        findValueTypeInExpressionNode(project, undefined, rootNode, false);
        value = evalConstantExpressionNode(project, rootNode);
        valueType = rootNode.valueType;
    }

    return { value, valueType };
}

export function evalExpression(
    expressionContext: IExpressionContext,
    component: Component | undefined,
    expression: string
) {
    if (typeof expression == "string") {
        expression = expression.trim();
    }

    let value;

    if (expression == undefined) {
        value = undefined;
    } else if (typeof expression == "number") {
        value = expression;
    } else {
        let rootNode;
        try {
            rootNode = expressionParser.parse(expression);
        } catch (err) {
            throw `Expression error: ${err}`;
        }

        findValueTypeInExpressionNode(
            expressionContext.projectStore.project,
            component,
            rootNode,
            false
        );

        value = evalExpressionWithContext(expressionContext, rootNode);
    }

    return value;
}

type AssignableValueType =
    | "null"
    | "local-variable"
    | "global-variable"
    | "flow-value";

class AssignableValue {
    constructor(
        private type: AssignableValueType,
        public valueType: ValueType,
        public name?: any,
        public object?: any
    ) {}

    isLocalVariable() {
        return this.type == "local-variable";
    }

    isGlobalVariable() {
        return this.type == "global-variable";
    }

    isFlowValue() {
        return this.type == "flow-value";
    }

    getValue(expressionContext: IExpressionContext) {
        if (this.isLocalVariable() || this.isGlobalVariable()) {
            return expressionContext.dataContext.get(this.name);
        } else if (this.isFlowValue()) {
            return this.object[this.name];
        } else {
            return null;
        }
    }
}

export function evalAssignableExpression(
    expressionContext: IExpressionContext,
    component: Component,
    expression: string
) {
    let assignableValue: AssignableValue | undefined;

    if (typeof expression == "string") {
        let rootNode;
        try {
            rootNode = expressionParser.parse(expression);
        } catch (err) {
            throw `Expression error: ${err}`;
        }

        findValueTypeInExpressionNode(
            ProjectEditor.getProject(component),
            component,
            rootNode,
            false
        );

        assignableValue = evalAssignableExpressionWithContext(
            expressionContext,
            component,
            rootNode
        );
    }

    if (!assignableValue) {
        return new AssignableValue("null", "null");
    }

    return assignableValue;
}

////////////////////////////////////////////////////////////////////////////////

function evalConstantExpressionNode(
    project: Project,
    rootNode: ExpressionNode
) {
    function evalNode(node: ExpressionNode): any {
        if (node.type == "Literal") {
            return node.value;
        }

        if (node.type == "Identifier") {
            throw `Not a constant`;
        }

        if (node.type == "BinaryExpression") {
            let operator = binaryOperators[node.operator];
            if (!operator) {
                operator = logicalOperators[node.operator];
                if (!operator) {
                    throw `Unknown binary operator '${node.operator}'`;
                }
            }

            return operator.eval(
                undefined,
                evalNode(node.left),
                evalNode(node.right)
            );
        }

        if (node.type == "LogicalExpression") {
            const operator = logicalOperators[node.operator];
            if (!operator) {
                throw `Unknown logical operator: ${node.operator}`;
            }

            return operator.eval(
                undefined,
                evalNode(node.left),
                evalNode(node.right)
            );
        }

        if (node.type == "UnaryExpression") {
            const operator = unaryOperators[node.operator];
            if (!operator) {
                throw `Unknown unary operator: ${node.operator}`;
            }

            return operator.eval(undefined, evalNode(node.argument));
        }

        if (node.type == "ConditionalExpression") {
            return evalNode(node.test)
                ? evalNode(node.consequent)
                : evalNode(node.alternate);
        }

        if (node.type == "CallExpression") {
            if (
                node.callee.type != "MemberExpression" ||
                node.callee.object.type != "Identifier" ||
                node.callee.property.type != "Identifier"
            ) {
                throw "Invalid call expression";
            }

            let functionName = `${node.callee.object.name}.${node.callee.property.name}`;

            const builtInFunction = builtInFunctions[functionName];
            if (builtInFunction == undefined) {
                throw `Unknown function '${functionName}'`;
            }

            if (
                builtInFunction.enabled &&
                !builtInFunction.enabled(project._store)
            ) {
                throw `Function '${functionName}' not supported`;
            }

            checkArity(functionName, node);

            return builtInFunction.eval(
                undefined,
                ...node.arguments.map(evalNode)
            );
        }

        if (node.type == "MemberExpression") {
            if (
                node.object.type == "Identifier" &&
                node.property.type == "Identifier"
            ) {
                const enumDef = project.variables.enumsMap.get(
                    node.object.name
                );
                if (enumDef) {
                    const enumMember = enumDef.membersMap.get(
                        node.property.name
                    );
                    if (!enumMember) {
                        throw `Member '${node.property.name}' does not exist in enum '${node.object.name}'`;
                    }
                    return enumMember.value;
                }

                const builtInConstantName = `${node.object.name}.${node.property.name}`;
                const buildInConstantValue = builtInConstants(project._store)[
                    builtInConstantName
                ];
                if (buildInConstantValue != undefined) {
                    return buildInConstantValue.value(project._store);
                }

                throw `Unknown constant '${builtInConstantName}'`;
            }

            throw "constant MemberExpression currently not supported";
        }

        if (node.type == "ArrayExpression") {
            return node.elements.map(element => evalNode(element));
        }

        if (node.type == "ObjectExpression") {
            const object: any = {};

            for (const property of node.properties) {
                if (property.key.type == "Identifier") {
                    object[property.key.name] = evalNode(property.value);
                } else {
                    throw `invalid field node "${property.key.type}"`;
                }
            }

            return object;
        }

        throw `Unknown expression node "${node.type}"`;
    }

    return evalNode(rootNode);
}

////////////////////////////////////////////////////////////////////////////////

function findValueTypeInExpressionNode(
    project: Project,
    component: Component | undefined,
    node: ExpressionNode,
    assignable: boolean
) {
    if (node.type == "Literal") {
        if (typeof node.value === "boolean") {
            node.valueType = "boolean";
        } else if (typeof node.value === "number") {
            if (
                Number.isInteger(node.value) &&
                (!node.location ||
                    (node.location.source as string)
                        .substring(
                            node.location.start.offset,
                            node.location.end.offset
                        )
                        .indexOf(".") == -1)
            ) {
                node.valueType = "integer";
            } else {
                node.valueType = "float";
            }
        } else if (typeof node.value === "string") {
            node.valueType = "string";
        } else if (node.value === "null") {
            node.valueType = "null";
        } else {
            node.valueType = "undefined";
        }
    } else if (node.type == "Identifier") {
        if (component) {
            const flow = ProjectEditor.getFlow(component);
            if (flow) {
                let localVariable = flow.userPropertiesAndLocalVariables.find(
                    localVariable => localVariable.name == node.name
                );
                if (localVariable) {
                    node.valueType = getType(project, localVariable.type);
                    node.identifierType = "local-variable";
                    return;
                }
            }
        }

        let globalVariable = project.allGlobalVariables.find(
            globalVariable => globalVariable.fullName == node.name
        );
        if (globalVariable) {
            node.valueType = getType(project, globalVariable.type);
            node.identifierType = "global-variable";
            return;
        }

        let enumDef = project.variables.enumsMap.get(node.name);
        if (enumDef) {
            node.valueType = `enum:${node.name}` as ValueType;
            node.identifierType = "enum";
            return;
        }

        let importIndex = project.importAsList.findIndex(
            importPrefix => importPrefix == node.name
        );
        if (importIndex != -1) {
            node.valueType = `importedProject`;
            node.identifierType = "imported-project";
            return;
        }

        node.valueType = "any";
        node.identifierType = "unknown";
        return;
    } else if (node.type == "BinaryExpression") {
        let operator = binaryOperators[node.operator];
        if (!operator) {
            operator = logicalOperators[node.operator];
            if (!operator) {
                throw `Unknown binary operator '${node.operator}'`;
            }
        }
        findValueTypeInExpressionNode(
            project,
            component,
            node.left,
            assignable
        );
        findValueTypeInExpressionNode(
            project,
            component,
            node.right,
            assignable
        );
        node.valueType = operator.getValueType(
            node.left.valueType,
            node.right.valueType
        );
    } else if (node.type == "LogicalExpression") {
        const operator = logicalOperators[node.operator];
        if (!operator) {
            throw `Unknown logical operator '${node.operator}'`;
        }
        findValueTypeInExpressionNode(
            project,
            component,
            node.left,
            assignable
        );
        findValueTypeInExpressionNode(
            project,
            component,
            node.right,
            assignable
        );
        node.valueType = operator.getValueType(
            node.left.valueType,
            node.right.valueType
        );
    } else if (node.type == "UnaryExpression") {
        const operator = unaryOperators[node.operator];
        if (!operator) {
            throw `Unknown unary operator '${node.operator}'`;
        }
        findValueTypeInExpressionNode(
            project,
            component,
            node.argument,
            assignable
        );
        node.valueType = operator.getValueType(node.argument.valueType);
    } else if (node.type == "ConditionalExpression") {
        findValueTypeInExpressionNode(
            project,
            component,
            node.test,
            assignable
        );
        findValueTypeInExpressionNode(
            project,
            component,
            node.consequent,
            assignable
        );
        findValueTypeInExpressionNode(
            project,
            component,
            node.alternate,
            assignable
        );
        // if (node.consequent.valueType != node.alternate.valueType) {
        //     throw "different types in conditional";
        // }
        node.valueType = node.consequent.valueType;
    } else if (node.type == "CallExpression") {
        if (
            node.callee.type != "MemberExpression" ||
            node.callee.object.type != "Identifier" ||
            node.callee.property.type != "Identifier"
        ) {
            throw "Invalid call expression";
        }

        let functionName = `${node.callee.object.name}.${node.callee.property.name}`;

        const builtInFunction = builtInFunctions[functionName];
        if (builtInFunction == undefined) {
            throw `Unknown function '${functionName}'`;
        }

        if (
            builtInFunction.enabled &&
            !builtInFunction.enabled(project._store)
        ) {
            throw `Function '${functionName}' not supported`;
        }

        checkArity(functionName, node);

        node.arguments.forEach(argument =>
            findValueTypeInExpressionNode(
                project,
                component,
                argument,
                assignable
            )
        );

        node.valueType = builtInFunction.getValueType(
            ...node.arguments.map(node => node.valueType)
        );
    } else if (node.type == "MemberExpression") {
        findValueTypeInExpressionNode(
            project,
            component,
            node.object,
            assignable
        );
        findValueTypeInExpressionNode(
            project,
            component,
            node.property,
            assignable
        );

        if (node.object.valueType == "importedProject") {
            node.valueType = "any";
            if (
                node.object.type == "Identifier" &&
                node.property.type == "Identifier"
            ) {
                const importAs = node.object.name;
                const variableName = node.property.name;

                const importDirective = project.settings.general.imports.find(
                    importDirective => importDirective.importAs == importAs
                );
                if (importDirective && importDirective.project) {
                    const globalVariable =
                        importDirective.project.variables.globalVariables.find(
                            globalVariable =>
                                globalVariable.name == variableName
                        );
                    if (globalVariable) {
                        node.valueType = globalVariable.type;
                        node.property.identifierType = "global-variable";
                    }
                }
            }
        } else if (isEnumType(node.object.valueType)) {
            const enumName = getEnumTypeNameFromType(node.object.valueType)!;
            const enumDef = project.variables.enumsMap.get(enumName)!;
            if (node.property.type != "Identifier") {
                throw `Invalid enum field type: '${node.property.type}'`;
            }
            const enumMember = enumDef.membersMap.get(node.property.name);
            if (!enumMember) {
                throw `Enum member '${node.property.name}' not found in enum '${enumName}'`;
            }
            node.valueType = node.object.valueType;
            node.property.valueType = node.object.valueType;
            node.property.identifierType = "enum-member";
        } else {
            if (node.computed) {
                if (node.object.valueType == "any") {
                    node.valueType = "any";
                } else {
                    const valueType = getArrayElementTypeFromType(
                        node.object.valueType
                    );
                    if (!valueType) {
                        throw `Array type expected but found '${node.object.valueType}'`;
                    }
                    node.valueType = valueType;
                }
            } else {
                if (node.property.type != "Identifier") {
                    throw `Invalid field type: '${node.property.type}'`;
                }

                if (node.object.type == "Identifier") {
                    if (node.object.valueType === "any") {
                        node.valueType = "any";
                        return;
                    }

                    const enumDef = project.variables.enumsMap.get(
                        node.object.name
                    );
                    if (enumDef) {
                        const enumMember = enumDef.membersMap.get(
                            node.property.name
                        );
                        if (enumMember) {
                            node.valueType = "integer";
                            node.property.identifierType = "enum-member";
                            return;
                        }
                    } else {
                        const builtInConstantName = `${node.object.name}.${node.property.name}`;
                        const buildInConstantValue = builtInConstants(
                            project._store
                        )[builtInConstantName];
                        if (buildInConstantValue != undefined) {
                            node.valueType = buildInConstantValue.valueType;
                            node.object.identifierType =
                                "builtin-constant-namespace";
                            node.property.identifierType =
                                "builtin-constant-member";
                            return;
                        }
                    }
                }

                const type = project._store.typesStore.getFieldType(
                    node.object.valueType,
                    node.property.name
                );
                if (!type) {
                    throw `Member access ".${node.property.name}" is not allowed`;
                }

                node.valueType = type;
                node.property.identifierType = "member";
            }
        }
    } else if (node.type == "ArrayExpression") {
        node.elements.forEach(element =>
            findValueTypeInExpressionNode(
                project,
                component,
                element,
                assignable
            )
        );
        node.valueType = `array:${
            node.elements.length > 0 ? node.elements[0].valueType : "any"
        }` as ValueType;
    } else if (node.type == "ObjectExpression") {
        node.properties.forEach(property =>
            findValueTypeInExpressionNode(
                project,
                component,
                property.value,
                assignable
            )
        );
        node.valueType = "struct:any";
    } else {
        throw `Unknown expression node "${node.type}"`;
    }
}

function getType(project: Project, valueType: ValueType): ValueType {
    if (valueType == "any") {
        return project._store.typesStore.createOpenType();
    }

    if (valueType == "array:any") {
        return `array:${project._store.typesStore.createOpenType()}`;
    }

    return valueType;
}

////////////////////////////////////////////////////////////////////////////////

function evalExpressionWithContext(
    expressionContext: IExpressionContext,
    rootNode: ExpressionNode
) {
    function evalNode(node: ExpressionNode): any {
        if (node.type == "Literal") {
            return node.value;
        }

        if (node.type == "Identifier") {
            if (expressionContext.dataContext.has(node.name)) {
                return expressionContext.dataContext.get(node.name);
            }

            throw `Unknown identifier "${node.name}"`;
        }

        if (node.type == "BinaryExpression") {
            let operator = binaryOperators[node.operator];
            if (!operator) {
                operator = logicalOperators[node.operator];
                if (!operator) {
                    throw `Unknown binary operator '${node.operator}'`;
                }
            }

            return operator.eval(
                expressionContext,
                evalNode(node.left),
                evalNode(node.right)
            );
        }

        if (node.type == "LogicalExpression") {
            const operator = logicalOperators[node.operator];
            if (!operator) {
                throw `Unknown logical operator: ${node.operator}`;
            }

            return operator.eval(
                expressionContext,
                evalNode(node.left),
                evalNode(node.right)
            );
        }

        if (node.type == "UnaryExpression") {
            const operator = unaryOperators[node.operator];
            if (!operator) {
                throw `Unknown unary operator: ${node.operator}`;
            }

            return operator.eval(expressionContext, evalNode(node.argument));
        }

        if (node.type == "ConditionalExpression") {
            return evalNode(node.test)
                ? evalNode(node.consequent)
                : evalNode(node.alternate);
        }

        if (node.type == "CallExpression") {
            if (
                node.callee.type != "MemberExpression" ||
                node.callee.object.type != "Identifier" ||
                node.callee.property.type != "Identifier"
            ) {
                throw "Invalid call expression";
            }

            let functionName = `${node.callee.object.name}.${node.callee.property.name}`;

            const builtInFunction = builtInFunctions[functionName];
            if (builtInFunction == undefined) {
                throw `Unknown function '${functionName}'`;
            }

            if (
                builtInFunction.enabled &&
                !builtInFunction.enabled(expressionContext.projectStore)
            ) {
                throw `Function '${functionName}' not supported`;
            }

            checkArity(functionName, node);

            return builtInFunction.eval(
                expressionContext,
                ...node.arguments.map(evalNode)
            );
        }

        if (node.type == "MemberExpression") {
            if (
                node.object.type == "Identifier" &&
                node.property.type == "Identifier"
            ) {
                const enumDef =
                    expressionContext.projectStore.project.variables.enumsMap.get(
                        node.object.name
                    );
                if (enumDef) {
                    const enumMember = enumDef.membersMap.get(
                        node.property.name
                    );
                    if (!enumMember) {
                        throw `Member '${node.property.name}' does not exist in enum '${node.object.name}'`;
                    }
                    return enumMember.value;
                }

                const builtInConstantName = `${node.object.name}.${node.property.name}`;
                const buildInConstantValue = builtInConstants(
                    expressionContext.projectStore
                )[builtInConstantName];
                if (buildInConstantValue != undefined) {
                    return buildInConstantValue.value(
                        expressionContext.projectStore
                    );
                }
            }

            const object = evalNode(node.object);

            if (object == undefined) {
                return undefined;
            }

            const property = node.computed
                ? evalNode(node.property)
                : (node.property as NonComputedPropertyExpressionNode).name;

            if (property == undefined) {
                throw new ExpressionEvalError(
                    `${getNodeDescription(node.property)} is undefined`
                );
            }

            return object[property];
        }

        if (node.type == "ArrayExpression") {
            return node.elements.map(element => evalNode(element));
        }

        if (node.type == "ObjectExpression") {
            const object: any = {};

            for (const property of node.properties) {
                if (property.key.type == "Identifier") {
                    object[property.key.name] = evalNode(property.value);
                } else {
                    throw `invalid field node "${property.key.type}"`;
                }
            }

            return object;
        }

        throw `Unknown expression node "${node.type}"`;
    }

    return evalNode(rootNode);
}

////////////////////////////////////////////////////////////////////////////////

function evalAssignableExpressionWithContext(
    expressionContext: IExpressionContext,
    component: Component,
    rootNode: ExpressionNode
) {
    function evalNode(node: ExpressionNode): AssignableValue {
        if (node.type == "Literal") {
            return node.value;
        }

        if (node.type == "Identifier") {
            const flow = ProjectEditor.getFlow(component);
            let localVariable = flow.userPropertiesAndLocalVariables.find(
                localVariable => localVariable.name == node.name
            );
            if (localVariable) {
                return new AssignableValue(
                    "local-variable",
                    localVariable.type,
                    localVariable.name
                );
            }

            let globalVariable =
                expressionContext.projectStore.project.allGlobalVariables.find(
                    globalVariable => globalVariable.fullName == node.name
                );
            if (globalVariable) {
                node.valueType = globalVariable.type as ValueType;
                return new AssignableValue(
                    "global-variable",
                    globalVariable.type,
                    globalVariable.fullName
                );
            }

            return new AssignableValue("null", "null");
        }

        if (node.type == "ConditionalExpression") {
            return evalNode(node.test)
                ? evalNode(node.consequent)
                : evalNode(node.alternate);
        }

        if (node.type == "MemberExpression") {
            const object = evalNode(node.object);
            if (object != undefined) {
                let property;

                if (node.computed) {
                    property = evalExpressionWithContext(
                        expressionContext,
                        node.property
                    );
                } else {
                    property = (
                        node.property as NonComputedPropertyExpressionNode
                    ).name;
                }
                if (property != undefined) {
                    return new AssignableValue(
                        "flow-value",
                        node.valueType,
                        property,
                        object.getValue(expressionContext)
                    );
                }
            }

            return new AssignableValue("null", "null");
        }

        throw `Unknown expression node "${node.type}"`;
    }

    return evalNode(rootNode);
}

function getNodeDescription(node: ExpressionNode) {
    if (node.type == "Identifier") {
        return node.name;
    }
    return node.type;
}
