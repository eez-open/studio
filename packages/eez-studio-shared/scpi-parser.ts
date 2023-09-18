// When passed quoted string as '"str"' it will return unquoted string as 'str'.
// Returns undefined if passed value is not a valid string.
export function parseScpiString(value: string) {
    if (
        value &&
        value.length >= 2 &&
        value[0] === '"' &&
        value.slice(-1) === '"'
    ) {
        let result = value.slice(1, -1);
        // make sure there is no single quote (") inside
        // scpi can return list of strings as "str1","str2","str3", we don't want to recognize this as string
        for (let i = 0; i < result.length; i++) {
            if (result[i] == '"') {
                if (i == result.length - 1 || result[i + 1] != '"') {
                    return undefined;
                }
                i++;
            }
        }
        return result;
    }
    return undefined;
}

////////////////////////////////////////////////////////////////////////////////

type TokenTag =
    | "symbol"
    | "mnemonic"
    | "numeric"
    | "numeric_with_unit"
    | "string"
    | "binary"
    | "hexnum"
    | "input"
    | "channels"
    | "space"
    | "newline"
    | "end";

interface Token {
    tag: TokenTag;
    value: string;
    offset: number;
    line: number;
    column: number;
}

function getScpiTokens(input: string) {
    let state:
        | "mnemonic"
        | "numeric"
        | "string"
        | "binary"
        | "hexnum"
        | "input"
        | "channels"
        | "newline"
        | "space"
        | "other";
    state = "other";

    let stateNumeric: "none" | "integer" | "fraction" | "exponent" | "unit";
    stateNumeric = "none";

    let binarySizeNumDigits = 0;
    let binarySize = 0;

    const tokens: Token[] = [];

    let token = "";

    let offset = 0;
    let line = 0;
    let column = 0;

    let savedOffset = offset;
    let savedLine = offset;
    let savedColumn = offset;

    for (offset = 0; offset < input.length; ) {
        const ch = input[offset];

        if (state === "mnemonic") {
            if (
                (ch >= "a" && ch <= "z") ||
                (ch >= "A" && ch <= "Z") ||
                (ch >= "0" && ch <= "9") ||
                ch == "_"
            ) {
                token += ch;
            } else {
                tokens.push({
                    tag: "mnemonic",
                    value: token,
                    offset,
                    line,
                    column
                });
                state = "other";
                continue;
            }
        } else if (state === "numeric") {
            if (stateNumeric === "integer") {
                if (ch >= "0" && ch <= "9") {
                    token += ch;
                } else if (ch == ".") {
                    token += ch;
                    stateNumeric = "fraction";
                } else if (ch === "e" || ch === "E") {
                    token += ch;
                    stateNumeric = "exponent";
                } else if (
                    (ch >= "a" && ch <= "z") ||
                    (ch >= "A" && ch <= "Z") ||
                    ch == " "
                ) {
                    token += ch;
                    stateNumeric = "unit";
                } else {
                    tokens.push({
                        tag: "numeric",
                        value: token,
                        offset,
                        line,
                        column
                    });
                    stateNumeric = "none";
                    state = "other";
                    continue;
                }
            } else if (stateNumeric === "fraction") {
                if (ch >= "0" && ch <= "9") {
                    token += ch;
                } else {
                    if (token[token.length - 1] === ".") {
                        throw `Unexpected "${ch}" in fraction at line ${
                            line + 1
                        }, column ${column + 1}`;
                    }

                    if (ch === "e" || ch === "E") {
                        token += ch;
                        stateNumeric = "exponent";
                    } else if (
                        (ch >= "a" && ch <= "z") ||
                        (ch >= "A" && ch <= "Z") ||
                        ch == " "
                    ) {
                        token += ch;
                        stateNumeric = "unit";
                    } else {
                        tokens.push({
                            tag: "numeric",
                            value: token,
                            offset,
                            line,
                            column
                        });
                        stateNumeric = "none";
                        state = "other";
                        continue;
                    }
                }
            } else if (stateNumeric === "exponent") {
                if (ch >= "0" && ch <= "9") {
                    token += ch;
                } else {
                    if (
                        token[token.length - 1] === "e" ||
                        token[token.length - 1] === "E"
                    ) {
                        throw `Unexpected "${ch}" in exponent at line ${
                            line + 1
                        }, column ${column + 1}`;
                    }

                    if (
                        (ch >= "a" && ch <= "z") ||
                        (ch >= "A" && ch <= "Z") ||
                        ch == " "
                    ) {
                        token += ch;
                        stateNumeric = "unit";
                    } else {
                        tokens.push({
                            tag: "numeric",
                            value: token,
                            offset,
                            line,
                            column
                        });
                        stateNumeric = "none";
                        state = "other";
                        continue;
                    }
                }
            } else if (stateNumeric === "unit") {
                if ((ch >= "a" && ch <= "z") || (ch >= "A" && ch <= "Z")) {
                    token += ch;
                } else {
                    tokens.push({
                        tag: "numeric_with_unit",
                        value: token,
                        offset,
                        line,
                        column
                    });
                    stateNumeric = "none";
                    state = "other";
                    continue;
                }
            } else {
                throw `Unexpected state`;
            }
        } else if (state === "string") {
            if (ch == token[0]) {
                token += ch;
                if (
                    offset + 1 < input.length &&
                    input[offset + 1] == token[0]
                ) {
                    token += ch;
                    offset++;
                    column++;
                } else {
                    tokens.push({
                        tag: "string",
                        value: token,
                        offset,
                        line,
                        column
                    });
                    state = "other";
                }
            } else {
                token += ch;
            }
        } else if (state === "binary") {
            token += ch;
            if (token.length == 2) {
                if (ch >= "1" && ch <= "9") {
                    binarySizeNumDigits =
                        token[1].charCodeAt(0) - "0".charCodeAt(0);
                    binarySize = 0;
                } else if (ch == "H") {
                    state = "hexnum";
                } else {
                    throw `Unexpected "${ch}" in arbitrary binary data at line ${
                        line + 1
                    }, column ${column + 1}`;
                }
            } else if (token.length <= 2 + binarySizeNumDigits) {
                if (ch >= "0" && ch <= "9") {
                    binarySize =
                        binarySize * 10 +
                        token[token.length - 1].charCodeAt(0) -
                        "0".charCodeAt(0);

                    if (token.length == 2 + binarySizeNumDigits) {
                        if (binarySize == 0) {
                            tokens.push({
                                tag: "binary",
                                value: token,
                                offset,
                                line,
                                column
                            });
                            state = "other";
                        }
                    }
                } else {
                    throw `Unexpected "${ch}" in arbitrary binary data at line ${
                        line + 1
                    }, column ${column + 1}`;
                }
            } else if (token.length == 2 + binarySizeNumDigits + binarySize) {
                tokens.push({
                    tag: "binary",
                    value: token,
                    offset,
                    line,
                    column
                });
                state = "other";
            }
        } else if (state === "hexnum") {
            if (
                (ch >= "0" && ch <= "9") ||
                (ch >= "a" && ch <= "f") ||
                (ch >= "A" && ch <= "F")
            ) {
                token += ch;
            } else {
                tokens.push({
                    tag: "hexnum",
                    value: token,
                    offset,
                    line,
                    column
                });
                state = "other";
                continue;
            }
        } else if (state === "input") {
            if (ch == "}") {
                token += ch;
                tokens.push({
                    tag: "input",
                    value: token,
                    offset: savedOffset,
                    line: savedLine,
                    column: savedColumn
                });
                state = "other";
            } else {
                token += ch;
            }
        } else if (state === "channels") {
            if (token[token.length - 1] == "(") {
                if (ch != "@") {
                    throw `Unexpected "${ch}" in channels at line ${
                        line + 1
                    }, column ${column + 1}`;
                }
            }

            token += ch;

            if (ch == ")") {
                tokens.push({
                    tag: "channels",
                    value: token,
                    offset,
                    line,
                    column
                });
                state = "other";
            }
        } else if (state === "newline") {
            tokens.push({
                tag: "newline",
                value: "\n",
                offset,
                line,
                column
            });

            line++;
            column = 0;

            state = "other";

            if (token == "\n") {
                continue;
            }

            if (token == "\r" && ch != "\n") {
                continue;
            }
        } else if (state === "space") {
            if (ch != " " && ch != "\t") {
                tokens.push({
                    tag: "space",
                    value: " ",
                    offset,
                    line,
                    column
                });
                state = "other";
                continue;
            }
        } else {
            if (
                (ch >= "0" && ch <= "9") ||
                ch == "." ||
                ch == "-" ||
                ch == "+"
            ) {
                token = ch;
                state = "numeric";
                stateNumeric = "integer";
            } else if (ch == ".") {
                token = ch;
                state = "numeric";
                stateNumeric = "fraction";
            } else if ((ch >= "a" && ch <= "z") || (ch >= "A" && ch <= "Z")) {
                token = ch;
                state = "mnemonic";
            } else if (ch === '"' || ch === "'") {
                token = ch;
                state = "string";
            } else if (ch === "#") {
                token = ch;
                state = "binary";
            } else if (ch === "{") {
                token = ch;
                state = "input";
                savedOffset = offset;
                savedLine = line;
                savedColumn = column;
            } else if (ch === "\n" || ch === "\r") {
                token = ch;
                state = "newline";
            } else if (ch === " " || ch == "\t") {
                state = "space";
            } else if (ch === "(") {
                token = ch;
                state = "channels";
            } else if (
                ch == "=" ||
                ch == "*" ||
                ch == ":" ||
                ch == "?" ||
                ch == "," ||
                ch == ";" ||
                ch == "(" ||
                ch == "@" ||
                ch == ")"
            ) {
                tokens.push({
                    tag: "symbol",
                    value: ch,
                    offset,
                    line,
                    column
                });
            } else {
                throw `Unexpected "${ch}" at line ${line + 1}, column ${
                    column + 1
                }`;
            }
        }
        offset++;
        column++;
    }

    if (state == "mnemonic") {
        tokens.push({
            tag: "mnemonic",
            value: token,
            offset,
            line,
            column
        });
    } else if (state == "numeric") {
        if (stateNumeric === "integer") {
            if (
                token[token.length - 1] == "+" ||
                token[token.length - 1] == "-"
            ) {
                throw `Unexpected end of input while parsing integer part of numeric`;
            }

            tokens.push({
                tag: "numeric",
                value: token,
                offset,
                line,
                column
            });
        } else if (stateNumeric === "fraction") {
            if (token[token.length - 1] === ".") {
                throw `Unexpected end of input while parsing fraction part of numeric`;
            }

            tokens.push({
                tag: "numeric",
                value: token,
                offset,
                line,
                column
            });
        } else if (stateNumeric === "exponent") {
            if (
                token[token.length - 1] === "e" ||
                token[token.length - 1] === "E"
            ) {
                throw `Unexpected end of input while parsing exponent part of numeric`;
            }

            tokens.push({
                tag: "numeric",
                value: token,
                offset,
                line,
                column
            });
        } else if (stateNumeric === "unit") {
            tokens.push({
                tag: "numeric_with_unit",
                value: token,
                offset,
                line,
                column
            });
        } else {
            throw `Unexpected state`;
        }
    } else if (state == "string") {
        throw `Unexpected end of input while parsing string`;
    } else if (state == "binary") {
        throw `Unexpected end of input while parsing binary`;
    } else if (state == "input") {
        throw `Unexpected end of input while parsing input spec`;
    } else if (state == "channels") {
        throw `Unexpected end of input while parsing channels`;
    } else if (state === "newline") {
        tokens.push({
            tag: "newline",
            value: "\n",
            offset,
            line,
            column
        });
    } else if (state === "space") {
        tokens.push({
            tag: "space",
            value: " ",
            offset,
            line,
            column
        });
    }

    tokens.push({
        tag: "end",
        value: "",
        offset,
        line,
        column
    });

    return tokens;
}

export const SCPI_PART_STRING = 1;
export const SCPI_PART_EXPR = 2;
export const SCPI_PART_QUERY_WITH_ASSIGNMENT = 3;
export const SCPI_PART_QUERY = 4;
export const SCPI_PART_COMMAND = 5;
export const SCPI_PART_END = 6;

type ScpiPartTag =
    | typeof SCPI_PART_STRING
    | typeof SCPI_PART_EXPR
    | typeof SCPI_PART_QUERY_WITH_ASSIGNMENT
    | typeof SCPI_PART_QUERY
    | typeof SCPI_PART_COMMAND
    | typeof SCPI_PART_END;

export function parseScpi(input: string) {
    let index = 0;

    let parts: {
        tag: ScpiPartTag;
        value: string | undefined;
        token: Token;
    }[] = [];

    let backtrackTerm:
        | "query-with-assignment"
        | "query"
        | "command-with-assignment"
        | "command" = "command";
    let backtrackToken: Token;
    let backtrack = -1;
    let backtrackTokens: Token[] | undefined = undefined;

    function emitString(token: Token) {
        if (
            parts.length > 0 &&
            parts[parts.length - 1].tag == SCPI_PART_STRING
        ) {
            parts[parts.length - 1].value += token.value;
        } else {
            parts.push({
                tag: SCPI_PART_STRING,
                value: token.value,
                token
            });
        }
    }

    function emitExpression(token: Token) {
        parts.push({
            tag: SCPI_PART_EXPR,
            value: token.value,
            token
        });
    }

    function emitExecuteQueryWithAssignment(output: string, token: Token) {
        parts.push({
            tag: SCPI_PART_QUERY_WITH_ASSIGNMENT,
            value: output,
            token
        });
    }

    function emitExecuteQuery(token: Token) {
        parts.push({
            tag: SCPI_PART_QUERY,
            value: undefined,
            token
        });
    }

    function emitExecuteCommand(token: Token) {
        parts.push({
            tag: SCPI_PART_COMMAND,
            value: undefined,
            token
        });
    }

    function emitEnd(token: Token) {
        parts.push({
            tag: SCPI_PART_END,
            value: undefined,
            token
        });
    }

    function emitToken(token: Token) {
        if (backtrackTokens) {
            backtrackTokens.push(token);
        } else {
            if (token.tag == "input") {
                emitExpression(token);
            } else if (token.tag == "end") {
                emitEnd(token);
            } else if (
                (token.tag == "symbol" && token.value == ";") ||
                token.tag == "newline"
            ) {
                // pass
            } else {
                emitString(token);
            }
        }
    }

    function backtrackStart(
        term:
            | "query-with-assignment"
            | "query"
            | "command-with-assignment"
            | "command"
    ) {
        backtrackTerm = term;
        backtrackToken = tokens[index];
        backtrack = index;
        backtrackTokens = [];
    }

    function backtrackConfirm() {
        let tokens = backtrackTokens!;
        backtrackTokens = undefined;

        if (tokens[0].tag == "space") {
            tokens.shift();
        }

        let output: string | undefined;

        if (backtrackTerm == "query-with-assignment") {
            output = tokens[0].value;

            tokens.shift();

            let tag = tokens[0].tag;
            if (tag == "space") {
                tokens.shift();
            }

            tokens.shift(); // remove '='

            tag = tokens[0].tag;
            if (tag == "space") {
                tokens.shift();
            }
        } else if (backtrackTerm == "command-with-assignment") {
            output = tokens[0].value;

            tokens.shift();

            let tag = tokens[0].tag;
            if (tag == "space") {
                tokens.shift();
            }

            tokens.shift(); // remove '='
            tokens.shift(); // remove '?'

            tag = tokens[0].tag;
            if (tag == "space") {
                tokens.shift();
            }
        }

        while (true) {
            const token = tokens.shift();
            if (!token) {
                break;
            }
            emitToken(token);
        }

        if (
            backtrackTerm == "query-with-assignment" ||
            backtrackTerm == "command-with-assignment"
        ) {
            emitExecuteQueryWithAssignment(output!, backtrackToken);
        } else if (backtrackTerm == "query") {
            emitExecuteQuery(backtrackToken);
        } else {
            emitExecuteCommand(backtrackToken);
        }
    }

    function backtrackCancel() {
        index = backtrack;
        backtrackTokens = undefined;
    }

    function advanceToken() {
        const token = tokens[index++];
        emitToken(token);
    }

    function match(tag: TokenTag, value?: string) {
        const token = tokens[index];
        if (tokens[index].tag == tag && (!value || token.value === value)) {
            advanceToken();
            return true;
        }

        throw `Unexpected token "${token.tag}" at line ${
            token.line + 1
        }, column ${token.column + 1}`;
    }

    function optional(tag: TokenTag, value?: string) {
        const token = tokens[index];
        if (tokens[index].tag == tag && (!value || token.value === value)) {
            advanceToken();
            return true;
        }

        return false;
    }

    function argument() {
        const token = tokens[index];
        if (
            token.tag == "numeric" ||
            token.tag == "numeric_with_unit" ||
            token.tag == "string" ||
            token.tag == "binary" ||
            token.tag == "hexnum" ||
            token.tag == "input" ||
            token.tag == "mnemonic" ||
            token.tag == "channels"
        ) {
            advanceToken();
            while (optional("input"));
            return true;
        }
        return false;
    }

    function commandName() {
        if (optional("symbol", "*")) {
            return match("mnemonic");
        }

        if (optional("symbol", ":")) {
            optional("space");
            match("mnemonic");
            while (optional("input"));
            while (optional("symbol", ":")) {
                optional("space");
                match("mnemonic");
                while (optional("input"));
            }
            return true;
        } else if (optional("mnemonic")) {
            while (optional("input"));
            while (optional("symbol", ":")) {
                optional("space");
                if (!optional("input")) {
                    match("mnemonic");
                }
                while (optional("input"));
            }
            return true;
        }

        return false;
    }

    function args() {
        if (argument()) {
            while (true) {
                optional("space");

                if (!optional("symbol", ",")) {
                    break;
                }

                optional("space");

                if (!argument()) {
                    const token = tokens[index];
                    throw `Unexpected token "${token.tag}" at line ${
                        token.line + 1
                    }, column ${token.column + 1}`;
                }
            }
        }
        return true;
    }

    function queryWithAssignment() {
        backtrackStart("query-with-assignment");
        if (optional("input") || optional("mnemonic")) {
            optional("space");
            if (optional("symbol", "=")) {
                optional("space");
                if (!commandName()) {
                    const token = tokens[index];
                    throw `Unexpected token "${token.tag}" at line ${
                        token.line + 1
                    }, column ${token.column + 1}`;
                }
                match("symbol", "?");
                if (optional("space")) {
                    args();
                }
                backtrackConfirm();
                return true;
            }
        }
        backtrackCancel();
        return false;
    }

    function commandWithAssignment() {
        backtrackStart("command-with-assignment");
        if (optional("input") || optional("mnemonic")) {
            optional("space");
            if (optional("symbol", "=") && optional("symbol", "?")) {
                optional("space");
                if (!commandName()) {
                    const token = tokens[index];
                    throw `Unexpected token "${token.tag}" at line ${
                        token.line + 1
                    }, column ${token.column + 1}`;
                }
                if (optional("space")) {
                    args();
                }
                backtrackConfirm();
                return true;
            }
        }
        backtrackCancel();
        return false;
    }

    function query() {
        backtrackStart("query");
        if (commandName()) {
            if (!optional("symbol", "?")) {
                backtrackCancel();
                return false;
            }
            if (optional("space")) {
                args();
            }
            backtrackConfirm();
            return true;
        }
        backtrackCancel();
        return false;
    }

    function command() {
        backtrackStart("command");
        if (commandName()) {
            if (optional("space")) {
                args();
            }
            backtrackConfirm();
            return true;
        }
        backtrackCancel();
        return false;
    }

    function queryOrCommand() {
        return (
            commandWithAssignment() ||
            queryWithAssignment() ||
            query() ||
            command()
        );
    }

    function line() {
        optional("space");
        if (queryOrCommand()) {
            optional("space");
            while (optional("symbol", ";")) {
                optional("space");
                queryOrCommand();
                optional("space");
            }
            return true;
        }
        return false;
    }

    function scpi() {
        while (line()) {
            if (!optional("newline")) {
                break;
            }
        }
        while (optional("newline"));
        match("end");
    }

    //console.log("PARSE SCPI INPUT:", input);

    const tokens = getScpiTokens(input);

    scpi();

    //console.log("PARSE SCPI OUTPUT:", parts);

    return parts;
}

// try {
//     parseScpi("{output} = LINE1? (@1);LINE2;;;\nLINE3 {input}");
//     parseScpi("LINE1\nLINE2\nLINE3\n");
//     parseScpi("SYST:RES");
//     parseScpi("VOLT 5");
//     parseScpi("{output} =MEAS:VOLT?");
//     parseScpi("{output}= *IDN?");
//     parseScpi("*TRT");
//     parseScpi("MRT 1,2,3");
// } catch (err) {
//     console.error(err);
// }
