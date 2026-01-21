/**
 * Cleanup C preprocessor definitions from source files.
 *
 * This module provides functionality to simplify C source files by evaluating
 * preprocessor conditionals (#if/#ifdef/#ifndef/#elif/#else/#endif) based on
 * a set of defined macros.
 */

type DirectiveType =
    | "if"
    | "ifdef"
    | "ifndef"
    | "elif"
    | "else"
    | "endif";

interface Directive {
    type: DirectiveType;
    condition?: string;
    lineIndex: number;
    fullLine: string;
}

interface ConditionalBlock {
    directives: Directive[];
    startLine: number;
    endLine: number;
}

/**
 * Parses defines array into a Map of macro name → value.
 * Supports both "MACRO" (value defaults to "1") and "MACRO=VALUE" syntax.
 */
function parseDefines(defines: string[]): Map<string, string> {
    const result = new Map<string, string>();
    for (const def of defines) {
        const eqIndex = def.indexOf("=");
        if (eqIndex !== -1) {
            const name = def.substring(0, eqIndex);
            const value = def.substring(eqIndex + 1);
            result.set(name, value);
        } else {
            result.set(def, "1");
        }
    }
    return result;
}

/**
 * Evaluates a preprocessor condition expression given a map of defined macros.
 * Macros in the defines map are considered defined (true) and substituted with their values.
 * Macros in the notDefinedSet are considered NOT defined (false).
 * Other macros are UNKNOWN - we cannot determine their value.
 *
 * @param condition - The condition expression (e.g., "defined(FOO) || defined(BAR)")
 * @param definesMap - Map of macro names to their values
 * @param notDefinedSet - Set of macro names that are explicitly not defined
 * @returns true/false if fully determinable, undefined if unknown macros are involved
 */
function evaluateCondition(
    condition: string,
    definesMap: Map<string, string>,
    notDefinedSet: Set<string>
): boolean | undefined {
    // Normalize whitespace
    let expr = condition.trim();

    // Track if we encounter any unknown macros
    let hasUnknown = false;

    // Handle defined(MACRO) and defined MACRO
    // Replace with "1" if in defines, "0" if in notDefined, "unknown" otherwise
    expr = expr.replace(/defined\s*\(\s*(\w+)\s*\)/g, (_, macro) => {
        if (definesMap.has(macro)) {
            return "1";
        } else if (notDefinedSet.has(macro)) {
            return "0";
        } else {
            hasUnknown = true;
            return "unknown";
        }
    });
    expr = expr.replace(/defined\s+(\w+)/g, (_, macro) => {
        if (definesMap.has(macro)) {
            return "1";
        } else if (notDefinedSet.has(macro)) {
            return "0";
        } else {
            hasUnknown = true;
            return "unknown";
        }
    });

    // Check if there are any remaining identifiers (macros used directly without defined())
    // Substitute with their values if known, "0" if in notDefined, otherwise mark as unknown
    const remainingIdentifiers = expr.match(/\b[A-Za-z_][A-Za-z0-9_]*\b/g);
    if (remainingIdentifiers) {
        for (const id of remainingIdentifiers) {
            if (!["true", "false", "unknown"].includes(id) && !/^\d+$/.test(id)) {
                if (definesMap.has(id)) {
                    // Substitute with the macro's value
                    expr = expr.replace(new RegExp(`\\b${id}\\b`, "g"), definesMap.get(id)!);
                } else if (notDefinedSet.has(id)) {
                    // Macro is explicitly not defined, treat as 0
                    expr = expr.replace(new RegExp(`\\b${id}\\b`, "g"), "0");
                } else {
                    hasUnknown = true;
                    expr = expr.replace(new RegExp(`\\b${id}\\b`, "g"), "unknown");
                }
            }
        }
    }

    // If we have unknown macros, try to evaluate with short-circuit logic
    if (hasUnknown) {
        // If the expression contains comparison operators (>, <, >=, <=, ==, !=)
        // with unknown values, we cannot safely evaluate it because unknown
        // could be any numeric value, not just 0 or 1
        if (/unknown\s*[><=!]=?|[><=!]=?\s*unknown/.test(expr)) {
            return undefined;
        }

        // For purely boolean expressions, try evaluating with unknown=true and unknown=false
        // If both give the same result, we know the answer
        try {
            const exprTrue = expr.replace(/unknown/g, "1");
            const exprFalse = expr.replace(/unknown/g, "0");

            const prepareExpr = (e: string) => {
                e = e.replace(/&&/g, " && ");
                e = e.replace(/\|\|/g, " || ");
                e = e.replace(/!/g, " ! ");
                return e;
            };

            const resultTrue = new Function(`return !!(${prepareExpr(exprTrue)});`)();
            const resultFalse = new Function(`return !!(${prepareExpr(exprFalse)});`)();

            if (resultTrue === resultFalse) {
                return resultTrue;
            }
        } catch {
            // Evaluation failed
        }

        return undefined;
    }

    // Now we have an expression with only numbers and operators
    // Evaluate the expression
    try {
        // Replace C-style operators with JavaScript equivalents
        expr = expr.replace(/&&/g, " && ");
        expr = expr.replace(/\|\|/g, " || ");
        expr = expr.replace(/!/g, " ! ");

        // Simple evaluation using Function (safe since we control the input)
        const result = new Function(`return !!(${expr});`)();
        return result;
    } catch {
        return undefined;
    }
}

/**
 * Parses preprocessor directives from source lines.
 */
function parseDirective(line: string, lineIndex: number): Directive | null {
    const trimmed = line.trim();
    if (!trimmed.startsWith("#")) {
        return null;
    }

    // Match preprocessor directives
    const ifMatch = trimmed.match(/^#\s*if\s+(.+)$/);
    if (ifMatch) {
        return { type: "if", condition: ifMatch[1], lineIndex, fullLine: line };
    }

    const ifdefMatch = trimmed.match(/^#\s*ifdef\s+(\w+)\s*$/);
    if (ifdefMatch) {
        return {
            type: "ifdef",
            condition: ifdefMatch[1],
            lineIndex,
            fullLine: line
        };
    }

    const ifndefMatch = trimmed.match(/^#\s*ifndef\s+(\w+)\s*$/);
    if (ifndefMatch) {
        return {
            type: "ifndef",
            condition: ifndefMatch[1],
            lineIndex,
            fullLine: line
        };
    }

    const elifMatch = trimmed.match(/^#\s*elif\s+(.+)$/);
    if (elifMatch) {
        return {
            type: "elif",
            condition: elifMatch[1],
            lineIndex,
            fullLine: line
        };
    }

    if (/^#\s*else\s*$/.test(trimmed)) {
        return { type: "else", lineIndex, fullLine: line };
    }

    if (/^#\s*endif\s*$/.test(trimmed)) {
        return { type: "endif", lineIndex, fullLine: line };
    }

    return null;
}

/**
 * Finds matching conditional blocks (if/ifdef/ifndef with their elif/else/endif).
 */
function findConditionalBlocks(lines: string[]): ConditionalBlock[] {
    const blocks: ConditionalBlock[] = [];
    const stack: Directive[][] = [];

    for (let i = 0; i < lines.length; i++) {
        const directive = parseDirective(lines[i], i);
        if (!directive) continue;

        if (
            directive.type === "if" ||
            directive.type === "ifdef" ||
            directive.type === "ifndef"
        ) {
            stack.push([directive]);
        } else if (
            directive.type === "elif" ||
            directive.type === "else"
        ) {
            if (stack.length > 0) {
                stack[stack.length - 1].push(directive);
            }
        } else if (directive.type === "endif") {
            if (stack.length > 0) {
                const directives = stack.pop()!;
                directives.push(directive);
                blocks.push({
                    directives,
                    startLine: directives[0].lineIndex,
                    endLine: directive.lineIndex
                });
            }
        }
    }

    return blocks;
}

/**
 * Processes a single conditional block and returns the resulting lines.
 * Returns null if the block should be kept as-is (cannot be simplified).
 */
function processBlock(
    lines: string[],
    block: ConditionalBlock,
    definesMap: Map<string, string>,
    notDefinedSet: Set<string>
): string[] | null {
    const { directives } = block;

    // Build sections: each section has a condition evaluation, directive info, and line range
    interface Section {
        directive: Directive;
        conditionResult: boolean | undefined;
        startLine: number;
        endLine: number;
    }

    const sections: Section[] = [];
    let previousBranchTaken = false;

    for (let i = 0; i < directives.length - 1; i++) {
        const current = directives[i];
        const next = directives[i + 1];

        let conditionResult: boolean | undefined;

        if (current.type === "if") {
            conditionResult = evaluateCondition(current.condition!, definesMap, notDefinedSet);
        } else if (current.type === "ifdef") {
            // For #ifdef MACRO: true if in defines, false if in notDefined, undefined if unknown
            const macro = current.condition!;
            if (definesMap.has(macro)) {
                conditionResult = true;
            } else if (notDefinedSet.has(macro)) {
                conditionResult = false;
            } else {
                conditionResult = undefined;
            }
        } else if (current.type === "ifndef") {
            // For #ifndef MACRO: false if in defines, true if in notDefined, undefined if unknown
            const macro = current.condition!;
            if (definesMap.has(macro)) {
                conditionResult = false;
            } else if (notDefinedSet.has(macro)) {
                conditionResult = true;
            } else {
                conditionResult = undefined;
            }
        } else if (current.type === "elif") {
            if (previousBranchTaken) {
                conditionResult = false;
            } else {
                conditionResult = evaluateCondition(current.condition!, definesMap, notDefinedSet);
            }
        } else if (current.type === "else") {
            conditionResult = !previousBranchTaken;
        }

        sections.push({
            directive: current,
            conditionResult,
            startLine: current.lineIndex + 1,
            endLine: next.lineIndex
        });

        if (conditionResult === true) {
            previousBranchTaken = true;
        }
    }

    // Check if we can simplify this block
    const definitelyTrueSection = sections.find(s => s.conditionResult === true);
    const allDefinitelyFalse = sections.every(s => s.conditionResult === false);
    const anyUndefined = sections.some(s => s.conditionResult === undefined);

    if (definitelyTrueSection && !anyUndefined) {
        // All conditions are known and one is true - return only that section's content
        return lines.slice(definitelyTrueSection.startLine, definitelyTrueSection.endLine);
    } else if (allDefinitelyFalse) {
        // All conditions are definitely false - remove the entire block
        return [];
    } else if (anyUndefined) {
        // Partial simplification: remove definitely-false branches, keep undefined ones,
        // and if there's a definitely-true branch, make it the else

        // Filter to get non-false sections (undefined or true)
        const nonFalseSections = sections.filter(s => s.conditionResult !== false);

        if (nonFalseSections.length === 0) {
            // Shouldn't happen, but safety check
            return [];
        }

        // Check if we removed any sections (otherwise no simplification needed)
        if (nonFalseSections.length === sections.length) {
            return null; // No simplification possible
        }

        // Build the new conditional block
        const result: string[] = [];

        // Find the first true section (if any) - this becomes the else branch
        const trueSectionIndex = nonFalseSections.findIndex(s => s.conditionResult === true);

        // Get undefined sections (these stay as conditions)
        const undefinedSections = nonFalseSections.filter(s => s.conditionResult === undefined);

        if (undefinedSections.length === 0 && trueSectionIndex !== -1) {
            // Only a true section remains - just return its content
            return lines.slice(nonFalseSections[trueSectionIndex].startLine, nonFalseSections[trueSectionIndex].endLine);
        }

        // Build the new #if/#elif/#else/#endif structure
        for (let i = 0; i < undefinedSections.length; i++) {
            const section = undefinedSections[i];
            const directive = section.directive;

            if (i === 0) {
                // First section becomes #if
                result.push(`#if ${directive.condition}`);
            } else {
                // Subsequent undefined sections become #elif
                result.push(`#elif ${directive.condition}`);
            }

            // Add the section content
            for (let j = section.startLine; j < section.endLine; j++) {
                result.push(lines[j]);
            }
        }

        // If there's a true section, add it as #else
        if (trueSectionIndex !== -1) {
            const trueSection = nonFalseSections[trueSectionIndex];
            result.push("#else");
            for (let j = trueSection.startLine; j < trueSection.endLine; j++) {
                result.push(lines[j]);
            }
        }

        result.push("#endif");

        return result;
    }

    // Cannot simplify - keep as-is
    return null;
}

/**
 * Removes #include directives that match any of the given prefixes.
 * Matches both #include <prefix...> and #include "prefix..." forms.
 *
 * @param lines - Array of source lines
 * @param prefixes - Array of prefixes to match (e.g., ["eez/"])
 * @returns Array of lines with matching includes removed
 */
function removeIncludes(lines: string[], prefixes: string[]): string[] {
    if (prefixes.length === 0) {
        return lines;
    }

    return lines.filter(line => {
        const trimmed = line.trim();

        // Match #include <...> or #include "..."
        const includeMatch = trimmed.match(/^#\s*include\s*[<"]([^>"]+)[>"]/)
        if (!includeMatch) {
            return true; // Not an include, keep the line
        }

        const includePath = includeMatch[1];

        // Check if the include path starts with any of the prefixes
        for (const prefix of prefixes) {
            if (includePath.startsWith(prefix)) {
                return false; // Remove this line
            }
        }

        return true; // Keep the line
    });
}

/**
 * Normalizes empty lines in the content:
 * - Replaces consecutive empty lines with a single empty line
 * - Removes leading and trailing empty lines
 *
 * @param content - The source content
 * @returns The content with normalized empty lines
 */
function normalizeEmptyLines(content: string): string {
    // Replace consecutive empty lines with a single empty line
    // An empty line is one that contains only whitespace
    let result = content.replace(/(\r?\n\s*){3,}/g, "\n\n");

    // Remove leading empty lines
    result = result.replace(/^(\s*\r?\n)+/, "");

    // Remove trailing empty lines
    result = result.replace(/(\r?\n\s*)+$/, "");

    return result;
}

/**
 * Cleans up C preprocessor definitions from a source file.
 *
 * @param content - The source file content
 * @param defines - Array of macro definitions. Supports both "MACRO" and "MACRO=VALUE" syntax.
 * @param notDefined - Array of macro names that are explicitly not defined (optional)
 * @param removeIncludePrefixes - Array of include path prefixes to remove (optional)
 * @returns The cleaned up source file content
 */
export function cleanupSourceFile(
    content: string,
    defines: string[],
    notDefined: string[] = [],
    removeIncludePrefixes: string[] = []
): string {
    const definesMap = parseDefines(defines);
    const notDefinedSet = new Set(notDefined);
    let lines = content.split("\n");

    // Remove includes with matching prefixes
    lines = removeIncludes(lines, removeIncludePrefixes);

    // Process blocks from innermost to outermost (by processing in reverse order of discovery)
    // This handles nested conditionals correctly
    let changed = true;
    while (changed) {
        changed = false;
        const blocks = findConditionalBlocks(lines);

        // Sort by start line descending to process from bottom to top
        // This ensures line indices remain valid after modifications
        blocks.sort((a, b) => b.startLine - a.startLine);

        for (const block of blocks) {
            const result = processBlock(lines, block, definesMap, notDefinedSet);
            if (result !== null) {
                // Replace the block with the result
                const before = lines.slice(0, block.startLine);
                const after = lines.slice(block.endLine + 1);
                lines = [...before, ...result, ...after];
                changed = true;
                break; // Restart since line indices changed
            }
        }
    }

    // Normalize empty lines
    return normalizeEmptyLines(lines.join("\n"));
}
