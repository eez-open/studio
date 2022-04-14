import { makeObservable, observable } from "mobx";
import React from "react";

import {
    EezObject,
    IEezObject,
    PropertyType
} from "project-editor/core/object";
import { Project } from "project-editor/project/project";
import { showGenericDialog } from "eez-studio-ui/generic-dialog";
import { validators } from "eez-studio-shared/validation";
import { ProjectEditor } from "project-editor/project-editor-interface";

////////////////////////////////////////////////////////////////////////////////

const ICON = (
    <svg
        width="24"
        height="24"
        strokeWidth="2"
        stroke="currentColor"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
    >
        <path d="M0 0h24v24H0z" stroke="none" />
        <path d="M4 5h7M9 3v2c0 4.418-2.239 8-5 8" />
        <path d="M5 9c-.003 2.144 2.952 3.908 6.7 4M12 20l4-9 4 9M19.1 18h-6.2" />
    </svg>
);

////////////////////////////////////////////////////////////////////////////////

export class Language extends EezObject {
    languageID: string;

    static classInfo = {
        properties: [
            {
                name: "languageID",
                type: PropertyType.String,
                unique: true
            }
        ],
        label: (language: Language) => language.languageID,
        newItem: (parent: IEezObject) => {
            return showGenericDialog({
                dialogDefinition: {
                    title: "New Language",
                    fields: [
                        {
                            name: "name",
                            type: "string",
                            validators: [
                                validators.required,
                                validators.identifier,
                                validators.unique({}, parent)
                            ]
                        }
                    ]
                },
                values: {},
                dialogContext: ProjectEditor.getProject(parent)
            }).then(result => {
                return Promise.resolve({
                    languageID: result.values.name
                });
            });
        }
    };

    constructor() {
        super();

        makeObservable(this, {
            languageID: observable
        });
    }
}

class Translation extends EezObject {
    text: string;

    static classInfo = {
        properties: [
            {
                name: "text",
                type: PropertyType.String
            }
        ]
    };

    constructor() {
        super();

        makeObservable(this, {
            text: observable
        });
    }
}

export class TextResource extends EezObject {
    resourceID: string;
    translations: {
        [languageID: string]: Translation;
    };

    static classInfo = {
        properties: [
            {
                name: "resourceID",
                type: PropertyType.String,
                unique: true
            },
            {
                name: "translations",
                type: PropertyType.Any,
                typeClass: Translation
            }
        ],
        label: (textResource: TextResource) => textResource.resourceID,
        newItem: (parent: IEezObject) => {
            return showGenericDialog({
                dialogDefinition: {
                    title: "New Text Resource",
                    fields: [
                        {
                            name: "name",
                            type: "string",
                            validators: [
                                validators.required,
                                validators.identifier,
                                validators.unique({}, parent)
                            ]
                        }
                    ]
                },
                values: {},
                dialogContext: ProjectEditor.getProject(parent)
            }).then(result => {
                return Promise.resolve({
                    resourceID: result.values.name
                });
            });
        }
    };

    constructor() {
        super();

        makeObservable(this, {
            resourceID: observable,
            translations: observable
        });
    }
}

export class Texts extends EezObject {
    languages: Language[];
    resources: TextResource[];

    static classInfo = {
        properties: [
            {
                name: "languages",
                type: PropertyType.Array,
                typeClass: Language
            },
            {
                name: "resources",
                type: PropertyType.Array,
                typeClass: TextResource
            }
        ],
        icon: ICON
    };

    constructor() {
        super();

        makeObservable(this, {
            languages: observable,
            resources: observable
        });
    }
}

////////////////////////////////////////////////////////////////////////////////

export default {
    name: "eezstudio-project-feature-texts",
    version: "0.1.0",
    description: "Localized texts support for your project",
    author: "EEZ",
    authorLogo: "../eez-studio-ui/_images/eez_logo.png",
    eezStudioExtension: {
        displayName: "Texts",
        category: "project-feature",
        implementation: {
            projectFeature: {
                mandatory: false,
                key: "texts",
                type: PropertyType.Object,
                typeClass: Texts,
                icon: ICON,
                create: () => ({
                    languages: [],
                    texts: []
                }),
                metrics: (
                    project: Project
                ): {
                    [key: string]: string | number;
                } => {
                    return {
                        Texts: 0
                    };
                }
            }
        }
    }
};
