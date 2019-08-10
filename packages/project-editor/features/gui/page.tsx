import React from "react";
import { observable, computed, runInAction, action } from "mobx";
import { observer } from "mobx-react";
import { bind } from "bind-decorator";

import { _find } from "eez-studio-shared/algorithm";
import { to16bitsColor } from "eez-studio-shared/color";
import { Rect } from "eez-studio-shared/geometry";

import { Splitter } from "eez-studio-ui/splitter";

import {
    EezObject,
    ClassInfo,
    PropertyInfo,
    registerClass,
    EezArrayObject,
    PropertyType,
    isSubclassOf,
    IEditorState,
    generalGroup,
    geometryGroup,
    styleGroup,
    specificGroup,
    EditorComponent
} from "project-editor/core/object";
import {
    TreeObjectAdapter,
    ITreeObjectAdapter,
    TreeAdapter
} from "project-editor/core/objectAdapter";
import { loadObject } from "project-editor/core/serialization";
import { NavigationStore, IPanel } from "project-editor/core/store";
import { Tree } from "project-editor/components/Tree";
import { Panel } from "project-editor/components/Panel";

import { ListNavigationWithContent } from "project-editor/components/ListNavigation";

import {
    IResizeHandler,
    IDesignerContext
} from "project-editor/features/gui/page-editor/designer-interfaces";
import { PageEditor as StudioPageEditor } from "project-editor/features/gui/page-editor/editor";
import { WidgetPalette } from "project-editor/features/gui/page-editor/WidgetPalette";
import { WidgetContainerComponent } from "project-editor/features/gui/page-editor/render";

import { Widget } from "project-editor/features/gui/widget";

import { findStyle } from "project-editor/features/gui/gui";
import { getThemedColor } from "project-editor/features/gui/theme";

////////////////////////////////////////////////////////////////////////////////

@observer
export class PageEditor extends EditorComponent implements IPanel {
    @bind
    focusHandler() {
        NavigationStore.setSelectedPanel(this);
    }

    @computed
    get treeAdapter() {
        let pageTabState = this.props.editor.state as PageTabState;
        return new TreeAdapter(pageTabState.widgetContainerDisplayItem, undefined, undefined, true);
    }

    @computed
    get selectedObject() {
        let pageTabState = this.props.editor.state as PageTabState;
        return pageTabState.selectedObject;
    }

    @computed
    get selectedObjects() {
        let pageTabState = this.props.editor.state as PageTabState;
        return pageTabState.selectedObjects;
    }

    cutSelection() {
        this.treeAdapter.cutSelection();
    }

    copySelection() {
        this.treeAdapter.copySelection();
    }

    pasteSelection() {
        this.treeAdapter.pasteSelection();
    }

    deleteSelection() {
        this.treeAdapter.deleteSelection();
    }

    render() {
        let pageTabState = this.props.editor.state as PageTabState;

        let editor = <StudioPageEditor widgetContainer={pageTabState.widgetContainerDisplayItem} />;

        let pageStructure = <Tree treeAdapter={this.treeAdapter} tabIndex={0} />;

        return (
            <Splitter
                type="horizontal"
                persistId="page-editor/horizontal"
                sizes={`100%|240px`}
                tabIndex={0}
                onFocus={this.focusHandler}
                childrenOverflow="hidden"
            >
                {editor}
                <Splitter
                    type="vertical"
                    persistId="page-editor/vertical"
                    sizes={`100%|240px`}
                    childrenOverflow="hidden"
                >
                    <Panel id="page-structure" title="Page Structure" body={pageStructure} />
                    <Panel id="widgets" title="Widget Palette" body={<WidgetPalette />} />
                </Splitter>
            </Splitter>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

export class PageTabState implements IEditorState {
    page: Page;
    widgetContainerDisplayItem: ITreeObjectAdapter;

    constructor(object: EezObject) {
        this.page = object as Page;
        this.widgetContainerDisplayItem = new TreeObjectAdapter(this.page);
    }

    @computed
    get selectedObject(): EezObject | undefined {
        return this.widgetContainerDisplayItem.selectedObject || this.page;
    }

    @computed
    get selectedObjects() {
        return this.widgetContainerDisplayItem.selectedObjects;
    }

    loadState(state: any) {
        this.widgetContainerDisplayItem.loadState(state);
    }

    saveState() {
        return this.widgetContainerDisplayItem.saveState();
    }

    @action
    selectObject(object: EezObject) {
        let item = this.widgetContainerDisplayItem.getObjectAdapter(object);
        if (item) {
            this.widgetContainerDisplayItem.selectItems([item]);
        }
    }
}

////////////////////////////////////////////////////////////////////////////////

// We will not load all widgets for all pages at once, since it could take several seconds
// for large project, and during that time application will be blocked. Therefore, we are
// lazy loading, one page at a time.

export const lazyLoadPageWidgets = (function() {
    const pageWidgets = new Map<Page, any>();
    const priority: Page[] = [];

    function setPageWidgets(page: Page, widgets: any) {
        pageWidgets.set(page, widgets);

        if (pageWidgets.size == 1) {
            setTimeout(loadNextPage, 1000);
        }
    }

    function loadPageWidgets(page: Page) {
        const widgets = pageWidgets.get(page);
        if (widgets) {
            pageWidgets.delete(page);
            runInAction(
                () =>
                    (page.widgets = loadObject(page, widgets, Widget, "widgets") as EezArrayObject<
                        Widget
                    >)
            );
        }
    }

    function loadNextPage() {
        if (pageWidgets.size > 0) {
            let page = priority.shift();
            if (!page) {
                page = pageWidgets.keys().next().value;
            }
            loadPageWidgets(page);

            if (pageWidgets.size > 0) {
                setTimeout(loadNextPage);
            }
        }
    }

    return {
        setPageWidgets,

        // this method is exported, so app can load some page widgets in advance if required
        prioritizePage(page: Page) {
            if (pageWidgets.has(page)) {
                priority.push(page);
            }
        }
    };
})();

////////////////////////////////////////////////////////////////////////////////

export class Page extends EezObject {
    @observable name: string;
    @observable description?: string;
    @observable style?: string;
    @observable widgets: EezArrayObject<Widget>;
    @observable usedIn: string[] | undefined;
    @observable closePageIfTouchedOutside: boolean;

    @observable left: number;
    @observable top: number;
    @observable width: number;
    @observable height: number;

    static classInfo: ClassInfo = {
        properties: [
            {
                name: "name",
                type: PropertyType.String,
                unique: true,
                propertyGridGroup: generalGroup
            },
            {
                name: "description",
                type: PropertyType.MultilineText,
                propertyGridGroup: generalGroup
            },
            {
                name: "left",
                type: PropertyType.Number,
                propertyGridGroup: geometryGroup
            },
            {
                name: "top",
                type: PropertyType.Number,
                propertyGridGroup: geometryGroup
            },
            {
                name: "width",
                type: PropertyType.Number,
                propertyGridGroup: geometryGroup
            },
            {
                name: "height",
                type: PropertyType.Number,
                propertyGridGroup: geometryGroup
            },
            {
                name: "style",
                type: PropertyType.ObjectReference,
                referencedObjectCollectionPath: ["gui", "styles"],
                propertyGridGroup: styleGroup
            },
            {
                name: "widgets",
                type: PropertyType.Array,
                typeClass: Widget,
                hideInPropertyGrid: true
            },
            {
                name: "usedIn",
                type: PropertyType.ConfigurationReference,
                propertyGridGroup: generalGroup
            },
            {
                name: "closePageIfTouchedOutside",
                type: PropertyType.Boolean,
                propertyGridGroup: specificGroup
            }
        ],
        beforeLoadHook: (page: Page, jsObject: any) => {
            if (jsObject["x"] !== undefined) {
                jsObject["left"] = jsObject["x"];
                delete jsObject["x"];
            }

            if (jsObject["x_"] !== undefined) {
                jsObject["left_"] = jsObject["x_"];
                delete jsObject["x_"];
            }

            if (jsObject["y"] !== undefined) {
                jsObject["top"] = jsObject["y"];
                delete jsObject["y"];
            }

            if (jsObject["y_"] !== undefined) {
                jsObject["top_"] = jsObject["y_"];
                delete jsObject["y_"];
            }

            lazyLoadPageWidgets.setPageWidgets(page, jsObject.widgets);
            jsObject.widgets = [];
        },
        isPropertyMenuSupported: true,
        newItem: (parent: EezObject) => {
            return Promise.resolve({
                name: "Page",
                left: 0,
                top: 0,
                width: 480,
                height: 272,
                widgets: []
            });
        },
        createEditorState: (page: Page) => {
            // make sure widgets are loaded for this page to be ready for editor
            lazyLoadPageWidgets.prioritizePage(page);
            return new PageTabState(page);
        },
        navigationComponentId: "pages",
        findPastePlaceInside: (
            object: EezObject,
            classInfo: ClassInfo,
            isSingleObject: boolean
        ): EezObject | PropertyInfo | undefined => {
            if (object && isSubclassOf(classInfo, Widget.classInfo)) {
                return (object as Page).widgets;
            }
            return undefined;
        },
        editorComponent: PageEditor,
        navigationComponent: ListNavigationWithContent,
        icon: "filter_none"
    };

    @computed
    get rect() {
        return {
            left: this.left,
            top: this.top,
            width: this.width,
            height: this.height
        };
    }

    getResizeHandlers(): IResizeHandler[] | undefined | false {
        return [
            {
                x: 100,
                y: 50,
                type: "e-resize"
            },
            {
                x: 50,
                y: 100,
                type: "s-resize"
            },
            {
                x: 100,
                y: 100,
                type: "se-resize"
            }
        ];
    }

    render(rect: Rect) {
        return <WidgetContainerComponent containerWidget={this} widgets={this.widgets._array} />;
    }

    styleHook(style: React.CSSProperties, designerContext: IDesignerContext | undefined) {
        if (this.style) {
            const pageStyle = findStyle(this.style);
            if (pageStyle && pageStyle.backgroundColor) {
                style.backgroundColor = to16bitsColor(getThemedColor(pageStyle.backgroundColor));
            }
        }
    }
}

registerClass(Page);
