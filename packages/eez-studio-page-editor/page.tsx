import React from "react";
import { observable, computed, action } from "mobx";

import { _find } from "eez-studio-shared/algorithm";
import { Rect } from "eez-studio-shared/geometry";

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
    styleGroup
} from "eez-studio-shared/model/object";
import { TreeObjectAdapter, ITreeObjectAdapter } from "eez-studio-shared/model/objectAdapter";

import { IResizeHandler } from "eez-studio-designer/designer-interfaces";

import { Widget } from "eez-studio-page-editor/widget";
import { PageContext, IDataContext } from "eez-studio-page-editor/page-context";
import { WidgetContainerComponent } from "eez-studio-page-editor/render";
import { IResizing, resizingProperty } from "eez-studio-page-editor/resizing-widget-property";

import styled from "eez-studio-ui/styled-components";

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
    x: number;
    y: number;
    width: number;
    height: number;
    resizing: IResizing;
    css: string;
    className: string;

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
                name: "x",
                type: PropertyType.Number,
                propertyGridGroup: geometryGroup
            },
            {
                name: "y",
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
                propertyGridGroup: styleGroup
            },
            {
                name: "className",
                type: PropertyType.String,
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
            },
            {
                name: "scrollable",
                type: PropertyType.Boolean
            }
        ],
        isPropertyMenuSupported: true,
        newItem: (parent: EezObject) => {
            return Promise.resolve({
                name: "Page",
                x: 0,
                y: 0,
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
        return {
            left: this.x,
            top: this.y,
            width: this.width,
            height: this.height
        };
    }

    get contentRect() {
        return this.rect;
    }

    getClassNameStr(dataContext: IDataContext) {
        return dataContext.get(this.className);
    }

    @computed get Div() {
        return styled.div``;
    }

    render(rect: Rect, dataContext: IDataContext, root: boolean) {
        const style = PageContext.findStyleOrGetDefault(this.style);

        return (
            <this.Div
                className={this.getClassNameStr(dataContext)}
                style={{
                    position: "absolute",
                    left: root ? rect.left : 0,
                    top: root ? rect.top : 0,
                    width: rect.width,
                    height: rect.height,
                    backgroundColor: style.backgroundColor,
                    overflow: PageContext.inEditor
                        ? "visible"
                        : this.scrollable
                        ? "auto"
                        : "visible"
                }}
                data-simplebar={!PageContext.inEditor && this.scrollable ? 1 : undefined}
            >
                <WidgetContainerComponent
                    containerWidget={this}
                    rectContainer={rect}
                    widgets={this.widgets._array}
                    dataContext={dataContext}
                />
            </this.Div>
        );
    }

    getResizeHandlers(): IResizeHandler[] | undefined | false {
        return false;
    }
}

registerClass(
    withResolutionDependableProperties(Page, [
        "x",
        "y",
        "width",
        "height",
        "resizing",
        "css",
        "className"
    ])
);

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
