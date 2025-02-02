import { makeObservable, computed } from "mobx";

import { ProjectStore, getAncestorOfType } from "project-editor/store";

import { ProjectEditor } from "project-editor/project-editor-interface";
import type { Flow } from "project-editor/flow/flow";
import { Page } from "project-editor/features/page/page";

import type { LVGLWidget } from "project-editor/lvgl/widgets";
import {
    getName,
    NamingConvention,
    USER_WIDGET_IDENTIFIER_SEPARATOR
} from "project-editor/build/helper";

export const GENERATED_NAME_PREFIX = "obj";

interface LVGLIdentifier {
    identifier: string;
    widgets: LVGLWidget[];
}

export class LVGLIdentifiers {
    constructor(public store: ProjectStore) {
        makeObservable(this, {
            pages: computed,
            userPages: computed,
            actions: computed,
            styles: computed,
            widgetIdentifiers: computed
        });
    }

    get pages() {
        const userPages = [];
        const userWidgets = [];

        for (const project of this.store.openProjectsManager.projects) {
            userPages.push(...project.userPages);
            userWidgets.push(...project.userWidgets);
        }

        return [...userPages, ...userWidgets];
    }

    get userPages() {
        return this.pages.filter(page => !page.isUsedAsUserWidget);
    }

    get actions() {
        const actions = [];

        for (const project of this.store.openProjectsManager.projects) {
            actions.push(...project.actions);
        }

        return actions;
    }

    get styles() {
        const styles = [];

        for (const project of this.store.openProjectsManager.projects) {
            styles.push(...project.lvglStyles.allStyles);
        }

        return styles;
    }

    get fonts() {
        const styles = [];

        for (const project of this.store.openProjectsManager.projects) {
            styles.push(...project.fonts);
        }

        return styles;
    }

    get bitmaps() {
        const styles = [];

        for (const project of this.store.openProjectsManager.projects) {
            styles.push(...project.bitmaps);
        }

        return styles;
    }

    enumIdentifiers(page: Page, identifiers: LVGLIdentifier[], prefix: string) {
        page._lvglWidgets.forEach(widget => {
            let identifierName;

            if (widget instanceof ProjectEditor.LVGLScreenWidgetClass) {
                identifierName = getName(
                    "",
                    page.name,
                    NamingConvention.UnderscoreLowerCase
                );
            } else {
                if (!widget.identifier) {
                    return;
                }

                identifierName =
                    prefix +
                    getName(
                        "",
                        widget.identifier,
                        NamingConvention.UnderscoreLowerCase
                    );
            }

            if (!identifierName) {
                return;
            }

            const identifier = identifiers.find(
                identifier => identifier.identifier == identifierName
            );
            if (identifier) {
                identifier.widgets.push(widget);
            } else {
                identifiers.push({
                    identifier: identifierName,
                    widgets: [widget]
                });
            }

            if (widget instanceof ProjectEditor.LVGLUserWidgetWidgetClass) {
                if (widget.userWidgetPage) {
                    this.enumIdentifiers(
                        widget.userWidgetPage,
                        identifiers,
                        identifierName + USER_WIDGET_IDENTIFIER_SEPARATOR
                    );
                }
            }
        });
    }

    get widgetIdentifiers(): {
        global: LVGLIdentifier[];
        userWidget: Map<Page, LVGLIdentifier[]>;
    } {
        const result = {
            global: [],
            userWidget: new Map()
        };

        for (const page of this.pages) {
            if (page.isUsedAsUserWidget) {
                const identifiers: LVGLIdentifier[] = [];
                this.enumIdentifiers(page, identifiers, "");
                result.userWidget.set(page, identifiers);
            } else {
                this.enumIdentifiers(page, result.global, "");
            }
        }

        return result;
    }

    getIdentifier(object: LVGLWidget): LVGLIdentifier | undefined {
        return this.getIdentifierByName(
            getAncestorOfType(object, ProjectEditor.FlowClass.classInfo)!,
            object.identifier
        );
    }

    getIdentifierByName(
        flow: Flow,
        displayName: string
    ): LVGLIdentifier | undefined {
        const identifierName = getName(
            "",
            displayName,
            NamingConvention.UnderscoreLowerCase
        );

        let identifiers = this.getIdentifiersVisibleFromFlow(flow);

        return identifiers.find(
            lvglIdentifier => lvglIdentifier.identifier == identifierName
        );
    }

    getIdentifiersVisibleFromFlow(flow: Flow) {
        if (
            flow instanceof ProjectEditor.PageClass &&
            flow.isUsedAsUserWidget
        ) {
            return this.widgetIdentifiers.userWidget.get(flow)!;
        }
        return this.widgetIdentifiers.global;
    }
}
