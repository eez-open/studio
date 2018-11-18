import { observable } from "mobx";

import {
    registerMetaData,
    EezObject,
    EezArrayObject,
    PropertyType
} from "project-editor/core/metaData";
import { TreeObjectAdapter } from "project-editor/core/objectAdapter";

import { StoryboardEditor } from "project-editor/project/features/gui/StoryboardEditor";

////////////////////////////////////////////////////////////////////////////////

export class StoryboardPage extends EezObject {
    @observable x: number;
    @observable y: number;
    @observable page: string;

    static metaData = {
        getClass: function(jsObject: any) {
            return StoryboardPage;
        },
        className: "StoryboardPage",
        label: (storyboardPageProperties: StoryboardPage) => storyboardPageProperties.page,
        properties: () => [
            {
                name: "x",
                type: PropertyType.Number
            },
            {
                name: "y",
                type: PropertyType.Number
            },
            {
                name: "page",
                type: PropertyType.ObjectReference,
                referencedObjectCollectionPath: ["gui", "pages"]
            }
        ]
    };
}

registerMetaData(StoryboardPage.metaData);

////////////////////////////////////////////////////////////////////////////////

export class StoryboardLineSource extends EezObject {
    @observable page: string;

    static metaData = {
        getClass: function(jsObject: any) {
            return StoryboardLineSource;
        },
        className: "StoryboardLineSource",
        label: (storyboardLineSourceProperties: StoryboardLineSource) =>
            storyboardLineSourceProperties.page,
        properties: () => [
            {
                name: "page",
                type: PropertyType.ObjectReference,
                referencedObjectCollectionPath: ["gui", "pages"]
            }
        ]
    };
}

registerMetaData(StoryboardLineSource.metaData);

////////////////////////////////////////////////////////////////////////////////

export class StoryboardLineTarget extends EezObject {
    @observable page: string;

    static metaData = {
        getClass: function(jsObject: any) {
            return StoryboardLineTarget;
        },
        className: "StoryboardLineTarget",
        label: (storyboardLineSourceProperties: StoryboardLineSource) =>
            storyboardLineSourceProperties.page,
        properties: () => [
            {
                name: "page",
                type: PropertyType.ObjectReference,
                referencedObjectCollectionPath: ["gui", "pages"]
            }
        ]
    };
}

registerMetaData(StoryboardLineTarget.metaData);

////////////////////////////////////////////////////////////////////////////////

export class StoryboardLine extends EezObject {
    @observable source: StoryboardLineSource;
    @observable target: StoryboardLineTarget;

    static metaData = {
        getClass: function(jsObject: any) {
            return StoryboardLineTarget;
        },
        className: "StoryboardLine",
        label: (storyboardLineProperties: StoryboardLine) =>
            storyboardLineProperties.source.page + "->" + storyboardLineProperties.target.page,
        properties: () => [
            {
                name: "source",
                type: PropertyType.Object,
                typeMetaData: StoryboardLineSource.metaData
            },
            {
                name: "target",
                type: PropertyType.Object,
                typeMetaData: StoryboardLineTarget.metaData
            }
        ]
    };
}

registerMetaData(StoryboardLine.metaData);

////////////////////////////////////////////////////////////////////////////////

export class Storyboard extends EezObject {
    @observable pages: EezArrayObject<StoryboardPage>;
    @observable lines: EezArrayObject<StoryboardLine>;

    static metaData = {
        getClass: function(jsObject: any) {
            return Storyboard;
        },
        className: "Storyboard",
        label: (storyboard: Storyboard) => "Storyboard",
        properties: () => [
            {
                name: "pages",
                type: PropertyType.Array,
                typeMetaData: StoryboardPage.metaData,
                hideInPropertyGrid: true
            },
            {
                name: "lines",
                type: PropertyType.Array,
                typeMetaData: StoryboardLine.metaData,
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
    };
}

registerMetaData(Storyboard.metaData);

////////////////////////////////////////////////////////////////////////////////

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
