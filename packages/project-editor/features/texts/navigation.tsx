import React from "react";
import * as FlexLayout from "flexlayout-react";
import { observer } from "mobx-react";

import { readTextFile, writeTextFile } from "eez-studio-shared/util-electron";
import { validators } from "eez-studio-shared/validation";

import * as notification from "eez-studio-ui/notification";
import { ListNavigation } from "project-editor/ui-components/ListNavigation";
import { FlexLayoutContainer } from "eez-studio-ui/FlexLayout";
import { TextAction } from "eez-studio-ui/action";
import { showGenericDialog } from "eez-studio-ui/generic-dialog";

import { ProjectContext } from "project-editor/project/context";
import {
    AbsoluteFileInput,
    AbsoluteFileSaveInput
} from "project-editor/ui-components/FileInput";
import { LabelWithProgress } from "./LabelWithProgress";
import { LabelWithInfo } from "./LabelWithInfo";

export const TextsTab = observer(
    class TextsNavigation extends React.Component {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        export = () => {
            showGenericDialog({
                dialogDefinition: {
                    title: "Export to XLIFF",
                    fields: [
                        {
                            name: "filePath",
                            type: AbsoluteFileSaveInput,
                            validators: [validators.required],
                            options: {
                                filters: [
                                    {
                                        name: "XLIFF files",
                                        extensions: ["xliff", "xlf"]
                                    },
                                    { name: "All Files", extensions: ["*"] }
                                ]
                            }
                        },
                        {
                            name: "sourceLanguage",
                            type: "enum",
                            enumItems: (values: any) =>
                                this.context.project.texts.languages
                                    .filter(
                                        language =>
                                            language.languageID !=
                                            values.targetLanguage
                                    )
                                    .map(language => ({
                                        id: language.languageID,
                                        label: language.languageID
                                    })),
                            validators: [validators.required]
                        },
                        {
                            name: "targetLanguage",
                            type: "enum",
                            enumItems: (values: any) =>
                                this.context.project.texts.languages
                                    .filter(
                                        language =>
                                            language.languageID !=
                                            values.sourceLanguage
                                    )
                                    .map(language => ({
                                        id: language.languageID,
                                        label: language.languageID
                                    })),
                            validators: [validators.required]
                        },
                        {
                            name: "xliffVersion",
                            displayName: "XLIFF file format version",
                            type: "enum",
                            enumItems: [
                                { id: "1.2", label: "1.2" },
                                { id: "2.0", label: "2.0" }
                            ],
                            validators: [validators.required]
                        }
                    ]
                },

                okButtonText: "Export",

                values: {
                    sourceLanguage:
                        this.context.project.texts.languages[0].languageID,
                    targetLanguage:
                        this.context.project.texts.languages[1].languageID,
                    xliffVersion: "1.2"
                }
            })
                .then(result => {
                    const keys: {
                        [key: string]: {
                            source: string;
                            target: string;
                        };
                    } = {};

                    this.context.project.texts.resources.map(textResource => {
                        const source = textResource.translations.find(
                            translation =>
                                translation.languageID ==
                                result.values.sourceLanguage
                        )?.text;
                        if (source) {
                            const target = textResource.translations.find(
                                translation =>
                                    translation.languageID ==
                                    result.values.targetLanguage
                            )?.text;

                            keys[textResource.resourceID] = {
                                source,
                                target: target || ""
                            };
                        }
                    });

                    const js = {
                        resources: {
                            default: keys
                        },
                        sourceLanguage: result.values.sourceLanguage,
                        targetLanguage: result.values.targetLanguage
                    };

                    const xliff = require("xliff");

                    const jsToXliff =
                        result.values.xliffVersion == "1.2"
                            ? xliff.jsToXliff12
                            : xliff.js2xliff;

                    jsToXliff(js, async (err: any, res: any) => {
                        if (err) {
                            notification.error(err.toString());
                        } else {
                            try {
                                let filePath: string = result.values.filePath;
                                if (
                                    !filePath
                                        .toLowerCase()
                                        .endsWith(".xliff") &&
                                    !filePath.toLowerCase().endsWith(".xlf")
                                ) {
                                    filePath += ".xliff";
                                }

                                await writeTextFile(filePath, res);
                                notification.info("File saved!");
                            } catch (err) {
                                notification.error(err.toString());
                            }
                        }
                    });
                })
                .catch(() => {});
        };

        import = () => {
            showGenericDialog({
                dialogDefinition: {
                    title: "Import from XLIFF",
                    fields: [
                        {
                            name: "filePath",
                            type: AbsoluteFileInput,
                            validators: [validators.required],
                            options: {
                                filters: [
                                    {
                                        name: "XLIFF files",
                                        extensions: ["xliff", "xlf"]
                                    },
                                    { name: "All Files", extensions: ["*"] }
                                ]
                            }
                        },
                        {
                            name: "targetLanguage",
                            displayName: "Import into language",
                            type: "enum",
                            enumItems: (values: any) =>
                                this.context.project.texts.languages.map(
                                    language => ({
                                        id: language.languageID,
                                        label: language.languageID
                                    })
                                ),
                            validators: [validators.required]
                        }
                    ]
                },

                values: {},

                okButtonText: "Import"
            })
                .then(async result => {
                    try {
                        const xliffDoc = await readTextFile(
                            result.values.filePath
                        );

                        console.log(xliffDoc);

                        const doit = (err: any, js: any) => {
                            this.context.undoManager.setCombineCommands(true);

                            const translationContext = js.resources.default;

                            let updated = 0;
                            for (const key of Object.keys(translationContext)) {
                                const textResource =
                                    this.context.project.texts.resources.find(
                                        textResource =>
                                            textResource.resourceID == key
                                    );
                                if (textResource) {
                                    const translation =
                                        textResource.translations.find(
                                            translation =>
                                                translation.languageID ==
                                                result.values.targetLanguage
                                        );
                                    if (translation) {
                                        const text =
                                            translationContext[key].target;
                                        if (text) {
                                            this.context.updateObject(
                                                translation,
                                                {
                                                    text
                                                }
                                            );
                                            updated++;
                                        }
                                    }
                                }
                            }

                            this.context.undoManager.setCombineCommands(false);

                            notification.info(
                                `Updated ${updated} translation(s) in language ${result.values.targetLanguage}`
                            );
                        };

                        const xliff = require("xliff");

                        try {
                            xliff.xliff2js(xliffDoc, doit);
                        } catch (err) {
                            xliff.xliff12ToJs(xliffDoc, doit);
                        }
                    } catch (err) {
                        notification.error(err.toString());
                    }
                })
                .catch(() => {});
        };

        factory = (node: FlexLayout.TabNode) => {
            var component = node.getComponent();

            if (component === "statistics") {
                return <Statistics />;
            }

            if (component === "resources") {
                return (
                    <ListNavigation
                        id="resources"
                        navigationObject={this.context.project.texts.resources}
                        selectedObject={
                            this.context.navigationStore
                                .selectedTextResourceObject
                        }
                    />
                );
            }

            if (component === "languages") {
                return (
                    <ListNavigation
                        id="languages"
                        navigationObject={this.context.project.texts.languages}
                        selectedObject={
                            this.context.navigationStore.selectedLanguageObject
                        }
                        additionalButtons={
                            this.context.project.texts.languages.length > 1
                                ? [
                                      <TextAction
                                          key="export"
                                          text="Export"
                                          title="Export to XLIFF"
                                          onClick={this.export}
                                      />,
                                      <TextAction
                                          key="import"
                                          text="Import"
                                          title="Import from XLIFF"
                                          onClick={this.import}
                                      />
                                  ]
                                : undefined
                        }
                        searchInput={false}
                    />
                );
            }

            return null;
        };

        render() {
            return (
                <FlexLayoutContainer
                    model={this.context.layoutModels.texts}
                    factory={this.factory}
                />
            );
        }
    }
);

export const Statistics = observer(
    class Statistics extends React.Component {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        get totalStrings() {
            return (
                this.context.project.texts.languages.length *
                this.context.project.texts.resources.length
            );
        }

        get numTranslated() {
            let numTranslated = 0;
            this.context.project.texts.resources.forEach(textResource =>
                textResource.translations.forEach(translation => {
                    if (
                        translation.text &&
                        translation.text.trim().length > 0
                    ) {
                        numTranslated++;
                    }
                })
            );
            return numTranslated;
        }

        get progress() {
            if (this.totalStrings == 0) {
                return 1;
            }
            return this.numTranslated / this.totalStrings;
        }

        render() {
            return (
                <div className="EezStudio_TextsStatistics">
                    <LabelWithProgress
                        label="Progress"
                        progress={this.progress}
                    />
                    <LabelWithInfo
                        label="Available languages"
                        info={this.context.project.texts.languages.length}
                    />
                    <LabelWithInfo
                        label="Available text resources"
                        info={this.context.project.texts.resources.length}
                    />
                    <LabelWithInfo
                        label="Total strings"
                        info={this.totalStrings}
                    />
                    <LabelWithInfo
                        label="No. translations"
                        info={this.numTranslated}
                    />
                </div>
            );
        }
    }
);
