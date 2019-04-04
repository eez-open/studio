import React from "react";
import { observable, computed, action } from "mobx";
import styled from "styled-components";

import { _find } from "eez-studio-shared/algorithm";
import { Rect } from "eez-studio-shared/geometry";

import {
    EezObject,
    EezClass,
    ClassInfo,
    PropertyInfo,
    registerClass,
    EezArrayObject,
    PropertyType,
    isSubclassOf,
    IEditorState,
    generalGroup,
    geometryGroup,
    styleGroup
} from "eez-studio-shared/model/object";
import { TreeObjectAdapter, ITreeObjectAdapter } from "eez-studio-shared/model/objectAdapter";

import { IResizeHandler } from "eez-studio-designer/designer-interfaces";

import { Widget } from "eez-studio-page-editor/widget";
import { PageContext, IDataContext } from "eez-studio-page-editor/page-context";
import { WidgetContainerComponent } from "eez-studio-page-editor/render";
import { IResizing, resizingProperty } from "eez-studio-page-editor/resizing-widget-property";
import { withResolutionDependableProperties } from "eez-studio-page-editor/resolution-dependable-properties";

////////////////////////////////////////////////////////////////////////////////

export class Page extends EezObject {
    @observable name: string;
    @observable description?: string;
    @observable style?: string;
    @observable widgets: EezArrayObject<Widget>;
    @observable closePageIfTouchedOutside: boolean;
    @observable usedIn: string[] | undefined;
    @observable scrollable: boolean;

    // resolution dependandable properties
    display: string;
    position: string;
    left: string;
    top: string;
    right: string;
    bottom: string;
    width: string;
    height: string;
    private windowWidth: number;
    private windowHeight: number;
    resizing: IResizing;
    css: string;
    className: string;

    static classInfo: ClassInfo = {
        getClass: function(jsObject: any, aClass: EezClass) {
            withResolutionDependableProperties(aClass);
            return aClass;
        },

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
                name: "display",
                type: PropertyType.Enum,
                enumItems: [
                    {
                        id: "none"
                    },
                    {
                        id: "inline"
                    },
                    {
                        id: "block"
                    },
                    {
                        id: "contents"
                    },
                    {
                        id: "flex"
                    },
                    {
                        id: "grid"
                    },
                    {
                        id: "inline-block"
                    },
                    {
                        id: "inline-flex"
                    },
                    {
                        id: "inline-grid"
                    },
                    {
                        id: "inline-table"
                    },
                    {
                        id: "list-item"
                    },
                    {
                        id: "run-in"
                    },
                    {
                        id: "table"
                    },
                    {
                        id: "table-caption"
                    },
                    {
                        id: "table-column-group"
                    },
                    {
                        id: "table-header-group"
                    },
                    {
                        id: "table-footer-group"
                    },
                    {
                        id: "table-row-group"
                    },
                    {
                        id: "table-cell"
                    },
                    {
                        id: "table-column"
                    },
                    {
                        id: "table-row"
                    },
                    {
                        id: "initial"
                    },
                    {
                        id: "inherit"
                    }
                ],
                defaultValue: "block",
                propertyGridGroup: geometryGroup,
                resolutionDependable: true
            },
            {
                name: "position",
                type: PropertyType.Enum,
                enumItems: [
                    {
                        id: "static"
                    },
                    {
                        id: "absolute"
                    },
                    {
                        id: "fixed"
                    },
                    {
                        id: "relative"
                    },
                    {
                        id: "sticky"
                    },
                    {
                        id: "initial"
                    },
                    {
                        id: "inherit"
                    }
                ],
                defaultValue: "absolute",
                propertyGridGroup: geometryGroup,
                resolutionDependable: true
            },
            {
                name: "left",
                type: PropertyType.String,
                propertyGridGroup: geometryGroup,
                resolutionDependable: true
            },
            {
                name: "top",
                type: PropertyType.String,
                propertyGridGroup: geometryGroup,
                resolutionDependable: true
            },
            {
                name: "right",
                type: PropertyType.String,
                propertyGridGroup: geometryGroup,
                resolutionDependable: true
            },
            {
                name: "bottom",
                type: PropertyType.String,
                propertyGridGroup: geometryGroup,
                resolutionDependable: true
            },
            {
                name: "width",
                type: PropertyType.String,
                propertyGridGroup: geometryGroup,
                resolutionDependable: true
            },
            {
                name: "height",
                type: PropertyType.String,
                propertyGridGroup: geometryGroup,
                resolutionDependable: true
            },
            {
                name: "windowWidth",
                type: PropertyType.Number,
                resolutionDependable: true
            },
            {
                name: "windowHeight",
                type: PropertyType.Number,
                resolutionDependable: true
            },
            resizingProperty,
            {
                name: "style",
                type: PropertyType.ObjectReference,
                referencedObjectCollectionPath: ["gui", "styles"],
                propertyGridGroup: styleGroup
            },
            {
                name: "css",
                type: PropertyType.CSS,
                propertyGridGroup: styleGroup,
                resolutionDependable: true
            },
            {
                name: "className",
                type: PropertyType.String,
                propertyGridGroup: styleGroup,
                resolutionDependable: true
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
            },
            {
                name: "scrollable",
                type: PropertyType.Boolean
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

    get contentRect() {
        return this.rect;
    }

    getResizeHandlers(): IResizeHandler[] | undefined | false {
        if (!this.position || this.position === "absolute") {
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
        } else {
            return [];
        }
    }

    getClassNameStr(dataContext: IDataContext) {
        return dataContext.get(this.className);
    }

    render(rect: Rect, dataContext: IDataContext) {
        return (
            <WidgetContainerComponent
                containerWidget={this}
                widgets={this.widgets._array}
                dataContext={dataContext}
            />
        );
    }

    styleHook(style: React.CSSProperties) {
        style.overflow = PageContext.inEditor ? "visible" : this.scrollable ? "auto" : "visible";
        if (this.style) {
            const pageStyle = PageContext.findStyle(this.style);
            if (pageStyle) {
                style.backgroundColor = pageStyle.backgroundColor;
            }
        }
    }

    @computed get Div() {
        return this.css
            ? styled.div`
                  ${this.css}
              `
            : styled.div``;
    }

    get WindowWidth() {
        if (this.windowWidth) {
            return this.windowWidth;
        }
        if (PageContext.resolution < PageContext.allResolutions.length) {
            return PageContext.allResolutions[PageContext.resolution].windowWidth;
        }
        return this.rect.width;
    }

    get WindowHeight() {
        if (this.windowHeight) {
            return this.windowHeight;
        }
        if (PageContext.resolution < PageContext.allResolutions.length) {
            return PageContext.allResolutions[PageContext.resolution].windowHeight;
        }
        return this.rect.height;
    }
}

registerClass(Page);

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
