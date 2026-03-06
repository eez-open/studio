import {
    getEnumFromType,
    ValueType
} from "project-editor/features/variable/value-type";
import { Build, NamingConvention, getName } from "project-editor/build/helper";
import { Page } from "project-editor/features/page/page";
import { ActionComponent, Component } from "project-editor/flow/component";

import {
    CallActionActionComponent,
    DelayActionComponent,
    IsTrueActionComponent,
    LabelOutActionComponent,
    LogActionComponent,
    LoopActionComponent,
    SetColorThemeActionComponent,
    SetVariableActionComponent,
    ShowPageActionComponent,
    StartActionComponent,
    SwitchActionComponent,
    WatchVariableActionComponent
} from "project-editor/flow/components/actions";
import type { Project } from "project-editor/project/project";
import { Flow } from "project-editor/flow/flow";
import { Action } from "project-editor/features/action/action";

import {
    buildExpression,
    buildAssignableExpression,
    evalConstantExpression
} from "project-editor/eez-flow-lite/expression";

interface Delay {
    delayComponent: DelayActionComponent;
    varName: string;
    flowCode: string;
}

interface Watch {
    varName: string;
}

export class BuildEezFlowLite {
    delays: Delay[] = [];
    watches: Watch[] = [];

    constructor(public project: Project) {}

    buildGlobalVariablesDecl(build: Build) {
        const flowGlobalVariables =
            this.project.variables.globalVariables.filter(
                variable => !variable.native
            );

        if (flowGlobalVariables.length > 0) {
            build.blockStart("typedef struct {");
            for (const variable of flowGlobalVariables) {
                build.line(
                    `${this.getVarDecl(variable.name, variable.type, "global-variable", variable.size)};`
                );
            }
            build.blockEnd("} global_vars_t;");
            build.line("");
            build.line("extern global_vars_t global_vars;");
            build.line("");
        }

        const nativeGlobalVariables =
            this.project.variables.globalVariables.filter(
                variable => variable.native
            );

        for (const variable of nativeGlobalVariables) {
            build.line(
                `${this.getVarDecl(variable.name, variable.type, "native-global-variable", 0)}get_${variable.name}(void);`
            );
            build.line(
                `void set_${variable.name}(${this.getVarDecl(variable.name, variable.type, "native-global-variable", 0)}value);`
            );
            build.line("");
        }
    }

    buildGlobalVariablesDef(build: Build) {
        const flowGlobalVariables =
            this.project.variables.globalVariables.filter(
                variable => !variable.native
            );

        if (flowGlobalVariables.length > 0) {
            build.blockStart("global_vars_t global_vars = {");
            for (const variable of flowGlobalVariables) {
                build.line(
                    `.${variable.name} = ${this.buildExpression(undefined, variable.defaultValue)},`
                );
            }
            build.blockEnd("};");
            build.line("");
        }
    }

    buildLocalVariablesDef(build: Build, page: Page) {
        if (page.localVariables.length > 0) {
            build.line("");
            build.blockStart(`static struct {`);
            for (const variable of page.localVariables) {
                build.line(
                    `${this.getVarDecl(variable.name, variable.type, "local-variable", variable.size)};`
                );
            }
            build.unindent();
            build.line(`} ${page.name}_page_local_vars = {`);
            build.indent();
            for (const variable of page.localVariables) {
                build.line(
                    `.${variable.name} = ${this.buildExpression(
                        undefined,
                        variable.defaultValue
                    )},`
                );
            }
            build.blockEnd("};");
        }
    }

    buildUserActionsDecl(build: Build) {
        const nativeUserActions = this.project.actions.filter(
            action => action.implementationType == "native"
        );

        if (nativeUserActions.length > 0) {
            build.line("// User actions");
            for (const action of nativeUserActions) {
                const args = action.userProperties.map(prop => `${this.getVarDecl(prop.name, prop.type, "native-action-parameter", 0)}`).join(", ");
                build.line(
                    `void ${action.name}(${args ? args : "void"});`
                );
            }
            build.line("");
        }
    }

    buildUserActionsDef(build: Build) {
        const flowUserActions = this.project.actions.filter(
            action => action.implementationType == "flow"
        );

        if (flowUserActions.length > 0) {
            build.line("// User actions");
            for (const action of flowUserActions) {
                const args = action.userProperties.map(prop => `${this.getVarDecl(prop.name, prop.type, "action-parameter", 0)}`).join(", ");
                build.line(
                    `static void ${action.name}(${args ? args : "void"});`
                );
            }
            build.line("");

            for (const action of flowUserActions) {
                build.line(`// Action ${action.name}`);
                const args = action.userProperties.map(prop => `${this.getVarDecl(prop.name, prop.type, "action-parameter", 0)}`).join(", ")
                build.blockStart(
                    `static void ${action.name}(${args ? args : "void"}) {`
                );

                if (action.localVariables.length > 0) {
                    for (const variable of action.localVariables) {
                        build.line(
                            `${this.getVarDecl(variable.name, variable.type, "local-variable", variable.size)} = ${this.buildExpression(undefined, variable.defaultValue)};`
                        );
                    }
                    build.line("");
                }

                for (const component of action.components) {
                    if (component instanceof StartActionComponent) {
                        const connectionLines = action.connectionLines.filter(
                            connectionLine =>
                                connectionLine.sourceComponent == component
                        );

                        for (const connectionLine of connectionLines) {
                            this.genFlowCode(
                                build,
                                connectionLine.targetComponent,
                                action
                            );
                        }
                    }
                }

                build.blockEnd("}");
                build.line("");
            }
        }
    }

    buildUserActionCall(build: Build, action: Action) {
        build.line(`// Call action ${action.name}`);
        build.line(`${action.name}();`);
    }

    buildExpression(
        component: Component | undefined,
        expression: string,
        targetType?: ValueType
    ) {
        return buildExpression(this.project, component, expression, targetType);
    }

    buildAssignableExpression(
        component: Component | undefined,
        expression: string,
        targetType?: ValueType
    ) {
        return buildAssignableExpression(
            this.project,
            component,
            expression,
            targetType
        );
    }

    genFlowCode(build: Build, component: Component, flow: Flow) {
        const components = new Set();

        const genFlowCode = (component: Component) => {
            if (
                components.has(component) &&
                !(component instanceof DelayActionComponent)
            ) {
                // loop detected
                return;
            }

            components.add(component);

            if (component instanceof ActionComponent && component.description) {
                build.line(`// ${component.description}`);
            }

            if (component instanceof SetVariableActionComponent) {
                for (const entry of component.entries) {
                    const variable = this.buildAssignableExpression(
                        component,
                        entry.variable
                    );

                    const value = this.buildExpression(component, entry.value);

                    if (variable.native) {
                        build.line(`${"set_" + variable.name}(${value});`);
                    } else {
                        if (variable.type == "string") {
                            build.line(
                                `strncpy(${variable.name}, ${value}, ${variable.size});`
                            );
                            build.line(
                                `${variable.name}[${variable.size} - 1]  = 0;`
                            );
                        } else {
                            build.line(`${variable.name} = ${value};`);
                        }
                    }
                }
            } else if (component instanceof IsTrueActionComponent) {
                const connectionLineTrue = flow.connectionLines.filter(
                    connectionLine =>
                        connectionLine.sourceComponent == component &&
                        connectionLine.output == "True"
                );
                const connectionLineFalse = flow.connectionLines.filter(
                    connectionLine =>
                        connectionLine.sourceComponent == component &&
                        connectionLine.output == "False"
                );

                build.blockStart(
                    `if (${this.buildExpression(component, component.value)}) {`
                );
                if (connectionLineTrue.length > 0) {
                    for (const connectionLine of connectionLineTrue) {
                        this.genFlowCode(build, connectionLine.targetComponent, flow);
                    }
                } else {
                    build.line("// pass");
                }
                if (connectionLineFalse.length > 0) {
                    build.unindent();
                    build.line("} else {");
                    build.indent();
                    for (const connectionLine of connectionLineFalse) {
                        this.genFlowCode(build, connectionLine.targetComponent, flow);
                    }
                }
                build.blockEnd("}");
            } else if (component instanceof SwitchActionComponent) {
                for (
                    let test_index = 0;
                    test_index < component.tests.length;
                    test_index++
                ) {
                    const test = component.tests[test_index];

                    if (test_index == 0) {
                        build.blockStart(
                            `if (${this.buildExpression(component, test.condition)}) {`
                        );
                    } else {
                        build.unindent();
                        build.line(
                            `} else if (${this.buildExpression(component, test.condition)}) {`
                        );
                        build.indent();
                    }

                    const connectionLines = flow.connectionLines.filter(
                        connectionLine =>
                            connectionLine.sourceComponent == component &&
                            connectionLine.output == test.outputName
                    );

                    for (const connectionLine of connectionLines) {
                        this.genFlowCode(build, connectionLine.targetComponent, flow);
                    }

                    if (test_index == component.tests.length - 1) {
                        build.blockEnd("}");
                    }
                }
            } else if (component instanceof LoopActionComponent) {
                const variable = this.buildExpression(
                    component,
                    component.variable
                );
                const from = this.buildExpression(component, component.from);
                const to = this.buildExpression(component, component.to);

                try {
                    let step = evalConstantExpression(
                        this.project,
                        component.step
                    ).value;
                    if (step > 0) {
                        if (step == 1) {
                            build.blockStart(
                                `for (${variable} = ${from}; ${variable} <= ${to}; ${variable}++) {`
                            );
                        } else {
                            build.blockStart(
                                `for (${variable} = ${from}; ${variable} <= ${to}; ${variable} += ${step}) {`
                            );
                        }
                    } else {
                        step = -step;
                        if (step == 1) {
                            build.blockStart(
                                `for (${variable} = ${from}; ${variable} >= ${to}; ${variable}--) {`
                            );
                        } else {
                            build.blockStart(
                                `for (${variable} = ${from}; ${variable} >= ${to}; ${variable} -= ${step}) {`
                            );
                        }
                    }
                } catch (err) {
                    const step = this.buildExpression(
                        component,
                        component.step
                    );
                    build.blockStart(
                        `for (${variable} = ${from}; ${step} > 0 ? ${variable} <= ${to} : ${variable} >= ${to}; ${variable} += ${step}) {`
                    );
                }

                const connectionLinesSeqout = flow.connectionLines.filter(
                    connectionLine =>
                        connectionLine.sourceComponent == component &&
                        connectionLine.output == "@seqout"
                );
                if (connectionLinesSeqout.length > 0) {
                    for (const connectionLine of connectionLinesSeqout) {
                        genFlowCode(connectionLine.targetComponent);
                    }
                }

                build.blockEnd("}");

                const connectionLinesDone = flow.connectionLines.filter(
                    connectionLine =>
                        connectionLine.sourceComponent == component &&
                        connectionLine.output == "done"
                );

                if (connectionLinesDone.length > 0) {
                    for (const connectionLine of connectionLinesDone) {
                        genFlowCode(connectionLine.targetComponent);
                    }
                }

                return;
            } else if (component instanceof DelayActionComponent) {
                const connectionLines = flow.connectionLines.filter(
                    connectionLine =>
                        connectionLine.sourceComponent == component
                );
                if (connectionLines.length > 0) {
                    let delay = this.delays.find(
                        delay => delay.delayComponent == component
                    );

                    if (!delay) {
                        delay = this.addDelay(component, "");

                        const flowCodeBuild = new Build();
                        flowCodeBuild.startBuild();
                        flowCodeBuild.indent();
                        flowCodeBuild.indent();
                        for (const connectionLine of connectionLines) {
                            this.genFlowCode(
                                flowCodeBuild,
                                connectionLine.targetComponent,
                                flow
                            );
                        }
                        flowCodeBuild.unindent();
                        flowCodeBuild.unindent();

                        delay.flowCode = flowCodeBuild.result;
                    }

                    build.line(`${delay.varName}.ticking = true;`);
                    build.line(
                        `${delay.varName}.tick_time = System_getTick() + ${this.buildExpression(component, component.milliseconds)};`
                    );
                }
                return;
            } else if (component instanceof LogActionComponent) {
                build.line(
                    `EEZGUI_LOG(EEZGUI_LOG_INFO, ${this.buildExpression(component, component.value, "string")});`
                );
            } else if (component instanceof CallActionActionComponent) {
                const action = this.project.actions.find(
                    action => action.name == component.action
                );
                if (action) {
                    build.line(`// Call action ${action.name}`);
                    build.line(
                        `${action.name}(${action.userProperties
                            .map(userProperty => {
                                const arg =
                                    component.userPropertyValues.values[
                                        userProperty.id
                                    ];

                                if (arg === undefined) {
                                    return 0;
                                }

                                return this.buildExpression(
                                    component,
                                    arg,
                                    userProperty.type
                                );
                            })
                            .join(", ")});`
                    );
                }
            } else if (component instanceof LabelOutActionComponent) {
                if (component.labelInComponent) {
                    genFlowCode(component.labelInComponent);
                }
                return;
            } else if (component instanceof ShowPageActionComponent) {
                build.line(`selected_page = ${component.page}_page;`);
            } else if (component instanceof SetColorThemeActionComponent) {
                build.line(
                    `const char *theme = ${this.buildExpression(component, component.theme)};`
                );

                for (
                    let theme_index = 0;
                    theme_index < this.project.themes.length;
                    theme_index++
                ) {
                    const theme = this.project.themes[theme_index];

                    if (theme_index == 0) {
                        build.blockStart(
                            `if (strcmp(theme, "${theme.name}") == 0) {`
                        );
                    } else {
                        build.unindent();
                        build.line(
                            `} else if (strcmp(theme, "${theme.name}") == 0) {`
                        );
                        build.indent();
                    }

                    const themeColors = `${getName("", theme.name, NamingConvention.UnderscoreLowerCase)}_colors`;
                    build.line(
                        `eezgui_set_colors(&eezgui_ctx, ${themeColors}, sizeof(${themeColors}) / sizeof(${themeColors}[0]));`
                    );

                    if (theme_index == this.project.themes.length - 1) {
                        build.blockEnd("}");
                    }
                }

                build.line("eezgui_refresh(&eezgui_ctx);");
            }

            // next
            const connectionLines = flow.connectionLines.filter(
                connectionLine =>
                    connectionLine.sourceComponent == component &&
                    connectionLine.output == "@seqout"
            );
            for (const connectionLine of connectionLines) {
                genFlowCode(connectionLine.targetComponent);
            }
        };

        genFlowCode(component);
    }

    getUniqueVarName(prefix: string, varNames: Set<string>) {
        let i = 1;
        let varName = prefix + "_" + i;
        while (varNames.has(varName)) {
            i++;
            varName = prefix + "_" + i;
        }
        varNames.add(varName);
        return varName;
    }

    addDelay(delayComponent: DelayActionComponent, flowCode: string) {
        const varNames = new Set(this.delays.map(delay => delay.varName));
        const varName = this.getUniqueVarName("delay", varNames);

        const delay = {
            delayComponent,
            varName,
            flowCode
        };

        this.delays.push(delay);

        return delay;
    }

    buildDelaysUpdate(build: Build) {
        if (this.delays.length > 0) {
            for (const delay of this.delays) {
                build.line(`${delay.varName}_tick();`);
            }
            build.line("");
        }
    }

    buildDelaysCode() {
        if (this.delays.length == 0) {
            return undefined;
        }

        const build = new Build();
        build.startBuild();

        build.line("// Delays");
        build.blockStart("typedef struct delay_t {");
        build.line("bool ticking;");
        build.line("uint32_t tick_time;");
        build.blockEnd("} delay_t;");
        build.line("");

        for (const delay of this.delays) {
            build.line(`static delay_t ${delay.varName};`);
        }
        build.line("");

        for (const delay of this.delays) {
            build.blockStart(`static void ${delay.varName}_tick(void) {`);
            build.blockStart(
                `if (${delay.varName}.ticking && ((int32_t)(${delay.varName}.tick_time - System_getTick()) < 0)) {`
            );
            build.line(`${delay.varName}.ticking = false;`);
            build.text(delay.flowCode);
            build.blockEnd("}");
            build.blockEnd("}");
            build.line("");
        }

        return build.result;
    }

    buildWatchesCode(pages: Page[]) {
        let flag = false;

        const build = new Build();
        build.startBuild();

        const varNames = new Set<string>();
        
        for (const page of pages) {
            let flagPage = false;
            for (const component of page.components) {
                if (component instanceof WatchVariableActionComponent) {
                    const connectionLines = page.connectionLines.filter(
                        connectionLine =>
                            connectionLine.sourceComponent == component &&
                            connectionLine.output == "@seqout"
                    );

                    if (connectionLines.length > 0) {
                        const varName = this.getUniqueVarName("watch", varNames);
                        varNames.add(varName);
                        this.watches.push({
                            varName
                        })

                        if (!flag) {
                            build.line("// Watches");
                            build.line("");
                            flag = true;
                        }

                        if (!flagPage) {
                            build.line(`// Page ${page.name}`);
                            flagPage = true;
                        }

                        build.blockStart(`void ${varName}_tick(void) {`)

                        let resultType: {
                            valueType: ValueType;
                        } = {
                            valueType: "any"
                        };
                        const value = buildExpression(this.project, component, component.variable, undefined, resultType);

                        build.line("static bool first_time = true;");
                        build.line(`static ${this.getVarDecl("last_state", resultType.valueType, "state-variable", 0)};`);
                        build.line(`${this.getVarDecl("current_state", resultType.valueType, "state-variable", 0)} = ${value};`);

                        build.blockStart("if (first_time || last_state != current_state) {");
                        build.line("first_time = false;");
                        build.line("last_state = current_state;");
                        for (const connectionLine of connectionLines) {
                            this.genFlowCode(build, connectionLine.targetComponent, page);
                        }
                        build.blockEnd("}");

                        build.blockEnd("}");
                        build.line("");
                    }
                }
            }
        }

        if (this.watches.length > 0) {
            return build.result;
        }

        return undefined;
    }

    buildWatchesUpdate(build: Build) {
        if (this.watches.length > 0) {
            for (const watch of this.watches) {
                build.line(`${watch.varName}_tick();`);
            }
            build.line("");
        }
    }

    buildStartCode(pages: Page[]) {
        const build = new Build();
        build.startBuild();

        build.line("// Start flows");
        build.line("");
        build.blockStart("static void on_start(void) {");

        let flag = false;

        for (const page of pages) {
            let flagPage = false;
            for (const component of page.components) {
                if (component instanceof StartActionComponent) {
                    const connectionLines = page.connectionLines.filter(
                        connectionLine =>
                            connectionLine.sourceComponent == component
                    );

                    for (const connectionLine of connectionLines) {
                        if (!flagPage) {
                            build.line(`// Page ${page.name}`);
                            flagPage = true;
                        }

                        this.genFlowCode(
                            build,
                            connectionLine.targetComponent,
                            page
                        );
                        flag = true;
                    }
                }
            }
        }

        if (!flag) {
            return undefined;
        }

        build.blockEnd("}");
        build.line("");

        return build.result;
    }

    getVarDecl(
        varName: string,
        valueType: ValueType,
        context:
            | "global-variable"
            | "native-global-variable"
            | "local-variable"
            | "action-parameter"
            | "native-action-parameter"
            | "state-variable",
        size: number
    ) {
        let varType;
        if (valueType == "integer") {
            varType = "int";
        } else if (valueType == "boolean") {
            varType = "bool";
        } else if (valueType == "float") {
            varType = "float";
        } else if (valueType == "double") {
            varType = "double";
        } else if (valueType == "string") {
            varType = "?";
        } else {
            const enumType = getEnumFromType(this.project, valueType);
            if (enumType) {
                varType = `${enumType.name}`;
            } else {
                throw new Error(`Unsupported variable type: ${valueType}`);
            }
        }

        if (context == "native-global-variable") {
            if (valueType == "string") {
                return "const char *";
            }
            return varType + " ";
        }

        if (
            context == "action-parameter" ||
            context == "native-action-parameter"
        ) {
            if (valueType == "string") {
                return `const char *${varName}`;
            }
        }

        if (valueType == "string") {
            return `char ${varName}[${size}]`;
        }

        return `${varType} ${varName}`;
    }
}
