import { parseIdentifier } from "project-editor/flow/expression";

const VALIDATION_MESSAGE_INVALID_IDENTIFIER =
    "Not a valid identifier. Identifier starts with a letter or an underscore (_), followed by zero or more letters, digits, or underscores. Spaces are not allowed.";

export const validators = {
    identifierValidator: (object: any, ruleName: string) => {
        const value = object[ruleName];
        if (!parseIdentifier(value) || value.startsWith("$")) {
            return VALIDATION_MESSAGE_INVALID_IDENTIFIER;
        }
        return null;
    }
};
