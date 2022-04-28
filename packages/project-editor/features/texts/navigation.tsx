import React from "react";
import * as FlexLayout from "flexlayout-react";
import xliff from "xliff";

import * as notification from "eez-studio-ui/notification";
import { ProjectContext } from "project-editor/project/context";
import { NavigationComponent } from "project-editor/project/NavigationComponent";
import { LayoutModels } from "project-editor/store";
import { ListNavigation } from "project-editor/components/ListNavigation";
import { observer } from "mobx-react";
import { TextAction } from "eez-studio-ui/action";
import { showGenericDialog } from "eez-studio-ui/generic-dialog";
import { validators } from "eez-studio-shared/validation";
import { AbsoluteFileSaveInput } from "project-editor/components/FileInput";
import { writeTextFile } from "eez-studio-shared/util-electron";

export const TextsNavigation = observer(
    class TextsNavigation extends NavigationComponent {
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
                                        extensions: ["xliff"]
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
                        }
                    ]
                },

                okButtonText: "Export",

                values: {
                    sourceLanguage:
                        this.context.project.texts.languages[0].languageID,
                    targetLanguage:
                        this.context.project.texts.languages[1].languageID
                }
            })
                .then(result => {
                    console.log(result);

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
                            namespace1: keys
                        },
                        sourceLanguage: result.values.sourceLanguage,
                        targetLanguage: result.values.targetLanguage
                    };

                    xliff.js2xliff(js, async (err: any, res: any) => {
                        if (err) {
                            notification.error(err.toString());
                        } else {
                            try {
                                await writeTextFile(
                                    result.values.filePath,
                                    res
                                );
                                notification.info("File saved!");
                            } catch (err) {
                                notification.error(err.toString());
                            }
                        }
                    });
                })
                .catch(() => {});
        };

        import = () => {};

        factory = (node: FlexLayout.TabNode) => {
            var component = node.getComponent();

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
                    />
                );
            }

            return null;
        };

        render() {
            return (
                <FlexLayout.Layout
                    model={this.context.layoutModels.texts}
                    factory={this.factory}
                    realtimeResize={true}
                    font={LayoutModels.FONT_SUB}
                />
            );
        }
    }
);
