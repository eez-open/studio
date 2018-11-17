import { observable } from "mobx";

import { registerMetaData, EezObject, EezArrayObject } from "project-editor/core/metaData";
import { TreeObjectAdapter } from "project-editor/core/objectAdapter";

import { StoryboardEditor } from "project-editor/project/features/gui/StoryboardEditor";

////////////////////////////////////////////////////////////////////////////////

export class StoryboardPageProperties extends EezObject {
    @observable x: number;
    @observable y: number;
    @observable page: string;
}

export const storyboardPageMetaData = registerMetaData({
    getClass: function(jsObject: any) {
        return StoryboardPageProperties;
    },
    className: "StoryboardPage",
    label: (storyboardPageProperties: StoryboardPageProperties) => storyboardPageProperties.page,
    properties: () => [
        {
            name: "x",
            type: "number"
        },
        {
            name: "y",
            type: "number"
        },
        {
            name: "page",
            type: "object-reference",
            referencedObjectCollectionPath: ["gui", "pages"]
        }
    ]
});

////////////////////////////////////////////////////////////////////////////////

export class StoryboardLineSourceProperties extends EezObject {
    @observable page: string;
}

export const storyboardLineSourceMetaData = registerMetaData({
    getClass: function(jsObject: any) {
        return StoryboardLineSourceProperties;
    },
    className: "StoryboardLineSource",
    label: (storyboardLineSourceProperties: StoryboardLineSourceProperties) =>
        storyboardLineSourceProperties.page,
    properties: () => [
        {
            name: "page",
            type: "object-reference",
            referencedObjectCollectionPath: ["gui", "pages"]
        }
    ]
});

////////////////////////////////////////////////////////////////////////////////

export class StoryboardLineTargetProperties extends EezObject {
    @observable page: string;
}

export const storyboardLineTargetMetaData = registerMetaData({
    getClass: function(jsObject: any) {
        return StoryboardLineTargetProperties;
    },
    className: "StoryboardLineTarget",
    label: (storyboardLineSourceProperties: StoryboardLineSourceProperties) =>
        storyboardLineSourceProperties.page,
    properties: () => [
        {
            name: "page",
            type: "object-reference",
            referencedObjectCollectionPath: ["gui", "pages"]
        }
    ]
});

////////////////////////////////////////////////////////////////////////////////

export class StoryboardLineProperties extends EezObject {
    @observable source: StoryboardLineSourceProperties;
    @observable target: StoryboardLineTargetProperties;
}

export const storyboardLineMetaData = registerMetaData({
    getClass: function(jsObject: any) {
        return StoryboardLineTargetProperties;
    },
    className: "StoryboardLine",
    label: (storyboardLineProperties: StoryboardLineProperties) =>
        storyboardLineProperties.source.page + "->" + storyboardLineProperties.target.page,
    properties: () => [
        {
            name: "source",
            type: "object",
            typeMetaData: storyboardLineSourceMetaData
        },
        {
            name: "target",
            type: "object",
            typeMetaData: storyboardLineTargetMetaData
        }
    ]
});

////////////////////////////////////////////////////////////////////////////////

export class StoryboardProperties extends EezObject {
    @observable pages: EezArrayObject<StoryboardPageProperties>;
    @observable lines: EezArrayObject<StoryboardLineProperties>;
}

export class StoryboardTabState {
    storyboardAdapter: TreeObjectAdapter;

    constructor(object: EezObject) {
        this.storyboardAdapter = new TreeObjectAdapter(object);
    }

    saveState() {
        return this.storyboardAdapter.saveState();
    }

    loadState(state: any) {
        this.storyboardAdapter.loadState(state);
    }

    selectObject(object: EezObject) {
        let item = this.storyboardAdapter.getObjectAdapter(object);
        if (item) {
            this.storyboardAdapter.selectItems([item]);
        }
    }
}

export const storyboardMetaData = registerMetaData({
    getClass: function(jsObject: any) {
        return StoryboardProperties;
    },
    className: "Storyboard",
    label: (storyboard: StoryboardProperties) => "Storyboard",
    properties: () => [
        {
            name: "pages",
            type: "array",
            typeMetaData: storyboardPageMetaData,
            hideInPropertyGrid: true
        },
        {
            name: "lines",
            type: "array",
            typeMetaData: storyboardLineMetaData,
            hideInPropertyGrid: true,
            skipSearch: true
        }
    ],
    editorComponent: StoryboardEditor,
    createEditorState: (object: EezObject) => new StoryboardTabState(object),
    defaultValue: {
        pages: [],
        lines: []
    },
    icon: "apps"
});
