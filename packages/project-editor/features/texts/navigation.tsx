import React from "react";
import * as FlexLayout from "flexlayout-react";

import { ProjectContext } from "project-editor/project/context";
import { NavigationComponent } from "project-editor/project/NavigationComponent";
import { LayoutModels } from "project-editor/store";
import { ListNavigation } from "project-editor/components/ListNavigation";
import { observer } from "mobx-react";
import { TextAction } from "eez-studio-ui/action";
import { showGenericDialog } from "eez-studio-ui/generic-dialog";
import { validators } from "eez-studio-shared/validation";
import { AbsoluteFileInput } from "project-editor/components/FileInput";

export const TextsNavigation = observer(
    class TextsNavigation extends NavigationComponent {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        export = () => {
            showGenericDialog({
                dialogDefinition: {
                    fields: [
                        {
                            name: "filePath",
                            type: AbsoluteFileInput,
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

                values: {
                    sourceLanguage:
                        this.context.project.texts.languages[0].languageID,
                    targetLanguage:
                        this.context.project.texts.languages[1].languageID
                }
            })
                .then(result => {
                    console.log(result);
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
                let additionalButtons;

                if (this.context.project.texts.languages.length > 1) {
                    additionalButtons = [
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
                    ];
                }

                return (
                    <ListNavigation
                        id="languages"
                        navigationObject={this.context.project.texts.languages}
                        selectedObject={
                            this.context.navigationStore.selectedLanguageObject
                        }
                        additionalButtons={[
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
                        ]}
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
