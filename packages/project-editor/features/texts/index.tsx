import { makeObservable, observable } from "mobx";
import React from "react";

import {
    ClassInfo,
    EezObject,
    IEezObject,
    PropertyProps,
    PropertyType
} from "project-editor/core/object";
import { Project } from "project-editor/project/project";
import { showGenericDialog } from "eez-studio-ui/generic-dialog";
import { validators } from "eez-studio-shared/validation";
import { ProjectEditor } from "project-editor/project-editor-interface";
import { observer } from "mobx-react";
import { ProjectContext } from "project-editor/project/context";
import { addObject, deleteObject, updateObject } from "project-editor/store";

////////////////////////////////////////////////////////////////////////////////

export const LANGUAGE_ICON = (
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

    static classInfo: ClassInfo = {
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
        },
        updateObjectValueHook: (
            language: Language,
            values: Partial<Language>
        ) => {
            if (values.languageID != undefined) {
                const project = ProjectEditor.getProject(language);
                for (const textResource of project.texts.resources) {
                    for (const translation of textResource.translations) {
                        if (translation.languageID == language.languageID) {
                            updateObject(translation, {
                                languageID: values.languageID
                            });
                        }
                    }
                }
            }
        },
        deleteObjectRefHook: (
            language: Language,
            options?: { dropPlace?: IEezObject }
        ) => {
            if (options?.dropPlace) {
                return;
            }
            const project = ProjectEditor.getProject(language);
            for (const textResource of project.texts.resources) {
                for (const translation of textResource.translations) {
                    if (translation.languageID == language.languageID) {
                        deleteObject(translation);
                    }
                }
            }
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
    languageID: string;
    text: string;

    static classInfo: ClassInfo = {
        properties: [
            {
                name: "languageID",
                type: PropertyType.String
            },
            {
                name: "text",
                type: PropertyType.String
            }
        ],
        defaultValue: {
            languageID: "",
            text: ""
        }
    };

    constructor() {
        super();

        makeObservable(this, {
            languageID: observable,
            text: observable
        });
    }
}

const TranslationsEditorPropertyUI = observer(
    class TextResourceEditorPropertyUI extends React.Component<PropertyProps> {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        render() {
            const textResource = this.props.objects[0] as TextResource;

            return (
                <table className="EezStudio_TextResource_Translations">
                    <tbody>
                        {textResource.translations.map(translation => (
                            <tr key={translation.languageID}>
                                <td>{translation.languageID}</td>
                                <td>
                                    <input
                                        type="text"
                                        className="form-control"
                                        value={translation.text}
                                        onChange={event => {
                                            updateObject(translation, {
                                                text: event.target.value
                                            });
                                        }}
                                    ></input>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            );
        }
    }
);

export class TextResource extends EezObject {
    resourceID: string;
    translations: Translation[];

    static classInfo: ClassInfo = {
        properties: [
            {
                name: "resourceID",
                type: PropertyType.String,
                unique: true
            },
            {
                name: "translations",
                type: PropertyType.Array,
                typeClass: Translation,
                propertyGridRowComponent: TranslationsEditorPropertyUI
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
                const project = ProjectEditor.getProject(parent);

                const translations = [];
                for (const language of project.texts.languages) {
                    translations.push({
                        languageID: language.languageID,
                        text: ""
                    });
                }

                return Promise.resolve({
                    resourceID: result.values.name,
                    translations
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

    static classInfo: ClassInfo = {
        properties: [
            {
                name: "languages",
                type: PropertyType.Array,
                typeClass: Language,
                interceptAddObject: (
                    languages: Language[],
                    language: Language
                ) => {
                    const project = ProjectEditor.getProject(languages);
                    for (const textResource of project.texts.resources) {
                        addObject(textResource.translations, {
                            languageID: language.languageID
                        });
                    }
                    return language;
                }
            },
            {
                name: "resources",
                type: PropertyType.Array,
                typeClass: TextResource
            }
        ],
        icon: LANGUAGE_ICON,
        defaultValue: {
            languages: [],
            resources: []
        }
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
                icon: LANGUAGE_ICON,
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
