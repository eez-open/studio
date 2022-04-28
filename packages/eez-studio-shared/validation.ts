import { observable, runInAction } from "mobx";

import { UNITS } from "eez-studio-shared/units";

const VALIDATION_MESSAGE_INVALID_VALUE = "Invalid value.";
export const VALIDATION_MESSAGE_REQUIRED = "Please fill out this field.";
const VALIDATION_MESSAGE_RANGE_INCLUSIVE =
    "Please enter value between ${min} and ${max}.";
const VALIDATION_MESSAGE_RANGE_INCLUSIVE_WITHOUT_MAX =
    "Please enter value greater than or equal to ${min}.";
const VALIDATION_MESSAGE_RANGE_EXCLUSIVE =
    "Please enter value between (not included) ${min} and ${max}.";
const VALIDATION_MESSAGE_RANGE_EXCLUSIVE_WITHOUT_MAX =
    "Please enter value greater than ${min}.";
const VALIDATION_MESSAGE_NOT_UNIQUE = "This field has no unique value.";
const VALIDATION_MESSAGE_INVALID_IDENTIFIER =
    "Not a valid identifier. Identifier starts with a letter or an underscore (_), followed by zero or more letters, digits, or underscores. Spaces are not allowed.";

import { filterInteger } from "eez-studio-shared/validation-filters";
import { parseIdentifier } from "project-editor/flow/expression/helper";

export {
    filterInteger,
    filterFloat,
    filterNumber
} from "eez-studio-shared/validation-filters";

export type Rule = (
    object: any,
    ruleName: string
) => Promise<string | null> | string | null;

interface Rules {
    [ruleName: string]: Rule | Rule[];
}

export const validators = {
    required: (object: any, ruleName: string) => {
        if (
            object[ruleName] == undefined ||
            object[ruleName].toString().trim() === ""
        ) {
            return VALIDATION_MESSAGE_REQUIRED;
        }
        return null;
    },

    rangeInclusive: (min: number, max?: number) => {
        return (object: any, ruleName: string) => {
            const value = object[ruleName];
            if (max !== undefined) {
                if (value < min || value > max) {
                    return VALIDATION_MESSAGE_RANGE_INCLUSIVE.replace(
                        "${min}",
                        min.toString()
                    ).replace("${max}", max.toString());
                }
            } else {
                if (value < min) {
                    return VALIDATION_MESSAGE_RANGE_INCLUSIVE_WITHOUT_MAX.replace(
                        "${min}",
                        min.toString()
                    );
                }
            }
            return null;
        };
    },

    rangeExclusive: (min: number, max?: number) => {
        return (object: any, ruleName: string) => {
            const value = object[ruleName];
            if (max !== undefined) {
                if (value <= min || value >= max) {
                    return VALIDATION_MESSAGE_RANGE_EXCLUSIVE.replace(
                        "${min}",
                        min.toString()
                    ).replace("${max}", max.toString());
                }
            } else {
                if (value <= min) {
                    return VALIDATION_MESSAGE_RANGE_EXCLUSIVE_WITHOUT_MAX.replace(
                        "${min}",
                        min.toString()
                    );
                }
            }
            return null;
        };
    },

    unique: (origObject: any, collection: any, message?: string) => {
        return function (object: any, ruleName: string) {
            const value = object[ruleName];
            if (value == undefined) {
                return null;
            }
            if (
                collection.find(
                    (element: any) =>
                        element !== origObject && element[ruleName] === value
                )
            ) {
                return message || VALIDATION_MESSAGE_NOT_UNIQUE;
            }
            return null;
        };
    },

    integer: (object: any, ruleName: string) => {
        let value = filterInteger(object[ruleName]);
        if (isNaN(value) || typeof value !== "number") {
            return VALIDATION_MESSAGE_INVALID_VALUE;
        }
        return null;
    },

    optionalInteger: (object: any, ruleName: string) => {
        if (object[ruleName] == undefined) {
            return null;
        }
        let value = filterInteger(object[ruleName]);
        if (isNaN(value) || typeof value !== "number") {
            return VALIDATION_MESSAGE_INVALID_VALUE;
        }
        return null;
    },

    unit: (unit: keyof typeof UNITS) => {
        return function (object: any, ruleName: string) {
            let value = UNITS[unit].parseValue(object[ruleName].toString());
            if (typeof value !== "number" || isNaN(value)) {
                return VALIDATION_MESSAGE_INVALID_VALUE;
            }
            return null;
        };
    },

    identifier: (object: any, ruleName: string) => {
        const value = object[ruleName];
        if (!parseIdentifier(value) || value.startsWith("$")) {
            return VALIDATION_MESSAGE_INVALID_IDENTIFIER;
        }
        return null;
    }
};

export function makeValidator<T extends Rules>(rules: T) {
    type Errors = Partial<{ [ruleName in keyof T]: string[] }>;

    const self = observable({
        errors: {} as Errors,

        checkValidity(object: any) {
            return new Promise<boolean>(resolve => {
                let isValid = true;
                let errors = {} as Errors;

                let promises: Promise<void>[] = [];

                function setError(ruleName: keyof T, error: string | null) {
                    if (error !== null) {
                        isValid = false;
                        const existingError = errors[ruleName];
                        if (existingError) {
                            existingError.push(error);
                        } else {
                            errors[ruleName] = [error] as any;
                        }
                    }
                }

                function checkRule(ruleName: string, rule: Rule) {
                    const error = rule(object, ruleName);
                    if (error instanceof Promise) {
                        promises.push(
                            new Promise(resolve => {
                                error.then(error => {
                                    setError(ruleName, error);
                                    resolve();
                                });
                            })
                        );
                    } else {
                        setError(ruleName, error);
                    }
                }

                Object.keys(rules).forEach(ruleName => {
                    const rule = rules[ruleName];
                    if (Array.isArray(rule)) {
                        rule.forEach(rule => checkRule(ruleName, rule));
                    } else {
                        checkRule(ruleName, rule);
                    }
                });

                Promise.all(promises).then(() => {
                    runInAction(() => (self.errors = errors));
                    resolve(isValid);
                });
            });
        }
    });

    return self;
}
