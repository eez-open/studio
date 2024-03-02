import { makeObservable, observable } from "mobx";
import React from "react";

import {
    ClassInfo,
    EezObject,
    getParent,
    IEezObject,
    IMessage,
    MessageType,
    PropertyInfo,
    PropertyProps,
    PropertyType,
    registerClass
} from "project-editor/core/object";
import { showGenericDialog } from "eez-studio-ui/generic-dialog";
import { validators } from "eez-studio-shared/validation";
import { ProjectEditor } from "project-editor/project-editor-interface";
import { observer } from "mobx-react";
import { ProjectContext } from "project-editor/project/context";
import {
    addObject,
    createObject,
    deleteObject,
    getChildOfObject,
    Message,
    updateObject
} from "project-editor/store";
import classNames from "classnames";
import {
    isHighlightedProperty,
    isPropertyInError
} from "project-editor/ui-components/PropertyGrid/utils";
import { LabelWithProgress } from "./LabelWithProgress";
import { LANGUAGE_ICON } from "project-editor/ui-components/icons";
import type { ProjectEditorFeature } from "project-editor/store/features";

////////////////////////////////////////////////////////////////////////////////

export class Language extends EezObject {
    languageID: string;

    static classInfo: ClassInfo = {
        properties: [
            {
                name: "languageID",
                displayName: "Language ID",
                type: PropertyType.String,
                unique: true
            }
        ],
        label: (language: Language) => language.languageID,
        listLabel: (language: Language) => {
            const project = ProjectEditor.getProject(language);
            return (
                <LabelWithProgress
                    label={language.languageID}
                    progress={
                        language.translated / project.texts.resources.length
                    }
                ></LabelWithProgress>
            );
        },
        newItem: async (parent: IEezObject) => {
            const result = await showGenericDialog({
                dialogDefinition: {
                    title: "New Language",
                    fields: [
                        {
                            name: "name",
                            type: "string",
                            validators: [
                                validators.required,
                                validators.unique({}, parent)
                            ]
                        }
                    ]
                },
                values: {},
                dialogContext: ProjectEditor.getProject(parent)
            });

            const languageProperties: Partial<Language> = {
                languageID: result.values.name
            };

            const project = ProjectEditor.getProject(parent);

            const language = createObject<Language>(
                project._store,
                languageProperties,
                Language
            );

            return language;
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
            options?: { dropPlace?: IEezObject | PropertyInfo }
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

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            languageID: observable
        });
    }

    get translated() {
        const project = ProjectEditor.getProject(this);
        let numTranslated = 0;
        project.texts.resources.forEach(textResource =>
            textResource.translations.forEach(translation => {
                if (
                    translation.languageID == this.languageID &&
                    translation.text &&
                    translation.text.trim().length > 0
                ) {
                    numTranslated++;
                }
            })
        );
        return numTranslated;
    }
}

registerClass("Language", Language);

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
        },
        check: (translation: Translation, messages: IMessage[]) => {
            if (!translation.text?.trim()) {
                const textResource = getParent(
                    getParent(translation)
                ) as TextResource;

                messages.push(
                    new Message(
                        MessageType.WARNING,
                        `"${textResource.resourceID}" not translated`,
                        getChildOfObject(translation, "languageID")
                    )
                );
            }
        }
    };

    override makeEditable() {
        super.makeEditable();

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

            const languageIDPropertyInfo =
                Translation.classInfo.properties.find(
                    propertyInfo => propertyInfo.name == "languageID"
                )!;

            return (
                <table className="EezStudio_TextResource_Translations">
                    <tbody>
                        {this.context.project.texts?.languages.map(language => {
                            const translation = textResource.translations.find(
                                translation =>
                                    translation.languageID ==
                                    language.languageID
                            )!;

                            const className = classNames({
                                inError: isPropertyInError(
                                    translation,
                                    languageIDPropertyInfo
                                ),
                                highlighted: isHighlightedProperty(
                                    translation,
                                    languageIDPropertyInfo
                                )
                            });

                            return (
                                <tr
                                    key={translation.languageID}
                                    className={className}
                                >
                                    <td
                                        style={{
                                            whiteSpace: "nowrap"
                                        }}
                                    >
                                        {translation.languageID}
                                    </td>
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
                            );
                        })}
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
        listLabel: (textResource: TextResource) => {
            const project = ProjectEditor.getProject(textResource);
            return (
                <LabelWithProgress
                    label={textResource.resourceID}
                    progress={
                        project.texts.languages.length > 0
                            ? textResource.translated /
                              project.texts.languages.length
                            : 0
                    }
                ></LabelWithProgress>
            );
        },
        newItem: async (parent: IEezObject) => {
            const result = await showGenericDialog({
                dialogDefinition: {
                    title: "New Text Resource",
                    fields: [
                        {
                            name: "name",
                            displayName: "Resource ID",
                            type: "string",
                            validators: [
                                validators.required,
                                validators.unique({}, parent)
                            ]
                        }
                    ]
                },
                values: {},
                dialogContext: ProjectEditor.getProject(parent)
            });

            const project = ProjectEditor.getProject(parent);

            const translations = [];
            for (const language of project.texts.languages) {
                translations.push({
                    languageID: language.languageID,
                    text: ""
                });
            }

            const textResourceProperties: Partial<TextResource> = {
                resourceID: result.values.name,
                translations: translations as any
            };

            const textResource = createObject<TextResource>(
                project._store,
                textResourceProperties,
                TextResource
            );

            return textResource;
        }
    };

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            resourceID: observable,
            translations: observable
        });
    }

    get translated() {
        let numTranslated = 0;
        this.translations.forEach(translation => {
            if (translation.text && translation.text.trim().length > 0) {
                numTranslated++;
            }
        });
        return numTranslated;
    }
}

registerClass("TextResource", TextResource);

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
                        addObject(
                            textResource.translations,
                            createObject<Translation>(
                                project._store,
                                {
                                    languageID: language.languageID,
                                    text: ""
                                },
                                Translation
                            )
                        );
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

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            languages: observable,
            resources: observable
        });
    }
}

////////////////////////////////////////////////////////////////////////////////

const feature: ProjectEditorFeature = {
    name: "eezstudio-project-feature-texts",
    version: "0.1.0",
    description: "Localized texts support for your project",
    author: "EEZ",
    authorLogo: "../eez-studio-ui/_images/eez_logo.png",
    displayName: "Texts",
    mandatory: false,
    key: "texts",
    type: PropertyType.Object,
    typeClass: Texts,
    icon: LANGUAGE_ICON,
    create: () => ({
        languages: [],
        texts: []
    })
};

export default feature;
