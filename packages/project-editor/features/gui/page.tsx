import React from "react";
import { observable, computed, action } from "mobx";
import { observer } from "mobx-react";
import { bind } from "bind-decorator";

import { _find } from "eez-studio-shared/algorithm";
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
    EditorComponent
} from "project-editor/model/object";
import {
    TreeObjectAdapter,
    ITreeObjectAdapter,
    TreeAdapter
} from "project-editor/model/objectAdapter";
import { NavigationStore } from "project-editor/model/store";
import { Tree } from "project-editor/model/components/Tree";
import { Panel } from "project-editor/model/components/Panel";

import { ListNavigationWithContent } from "project-editor/ui/ListNavigation";

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
export class PageEditor extends EditorComponent {
    get page() {
        return this.props.editor.object as Page;
    }

    @bind
    focusHandler() {
        NavigationStore.setSelectedPanel(this);
    }

    @computed
    get selectedObject() {
        let pageTabState = this.props.editor.state as PageTabState;
        return pageTabState.selectedObject;
    }

    render() {
        let pageTabState = this.props.editor.state as PageTabState;

        let editor = <StudioPageEditor widgetContainer={pageTabState.widgetContainerDisplayItem} />;

        let pageStructure = (
            <Tree
                treeAdapter={
                    new TreeAdapter(
                        pageTabState.widgetContainerDisplayItem,
                        undefined,
                        undefined,
                        true
                    )
                }
                tabIndex={0}
            />
        );

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

export class Page extends EezObject {
    @observable name: string;
    @observable description?: string;
    @observable style?: string;
    @observable widgets: EezArrayObject<Widget>;
    @observable closePageIfTouchedOutside: boolean;
    @observable usedIn: string[] | undefined;
    @observable scrollable: boolean;

    @observable left: string;
    @observable top: string;
    @observable width: string;
    @observable height: string;

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
                type: PropertyType.String,
                propertyGridGroup: geometryGroup
            },
            {
                name: "top",
                type: PropertyType.String,
                propertyGridGroup: geometryGroup
            },
            {
                name: "width",
                type: PropertyType.String,
                propertyGridGroup: geometryGroup
            },
            {
                name: "height",
                type: PropertyType.String,
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
                name: "closePageIfTouchedOutside",
                type: PropertyType.Boolean,
                propertyGridGroup: generalGroup
            },
            {
                name: "usedIn",
                type: PropertyType.ConfigurationReference,
                propertyGridGroup: generalGroup
            }
        ],
        beforeLoadHook: (object: EezObject, jsObject: any) => {
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
        },
        isPropertyMenuSupported: true,
        newItem: (parent: EezObject) => {
            return Promise.resolve({
                name: "Page",
                left: 0,
                top: 0,
                width: 480,
                height: 272,
                widgets: [],
                closePageIfTouchedOutside: false
            });
        },
        createEditorState: (object: EezObject) => new PageTabState(object),
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
        let left = parseInt(this.left);
        if (isNaN(left)) {
            left = 0;
        }

        let top = parseInt(this.top);
        if (isNaN(top)) {
            top = 0;
        }

        let width = parseInt(this.width);
        if (isNaN(width)) {
            width = 0;
        }

        let height = parseInt(this.height);
        if (isNaN(height)) {
            height = 0;
        }

        return {
            left,
            top,
            width,
            height
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
        style.overflow = designerContext ? "visible" : this.scrollable ? "auto" : "visible";
        if (this.style) {
            const pageStyle = findStyle(this.style);
            if (pageStyle && pageStyle.backgroundColor) {
                style.backgroundColor = getThemedColor(pageStyle.backgroundColor);
            }
        }
    }
}

registerClass(Page);
