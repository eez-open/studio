import { observable } from "mobx";

import {
    ClassInfo,
    registerClass,
    EezObject,
    EezArrayObject,
    PropertyType
} from "project-editor/core/object";
import { TreeObjectAdapter } from "project-editor/core/objectAdapter";

import { StoryboardEditor } from "project-editor/project/features/gui/StoryboardEditor";

////////////////////////////////////////////////////////////////////////////////

export class StoryboardPage extends EezObject {
    @observable x: number;
    @observable y: number;
    @observable page: string;

    static classInfo: ClassInfo = {
        label: (storyboardPageProperties: StoryboardPage) => storyboardPageProperties.page,
        properties: [
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

registerClass(StoryboardPage);

////////////////////////////////////////////////////////////////////////////////

export class StoryboardLineSource extends EezObject {
    @observable page: string;

    static classInfo: ClassInfo = {
        label: (storyboardLineSourceProperties: StoryboardLineSource) =>
            storyboardLineSourceProperties.page,

        properties: [
            {
                name: "page",
                type: PropertyType.ObjectReference,
                referencedObjectCollectionPath: ["gui", "pages"]
            }
        ]
    };
}

registerClass(StoryboardLineSource);

////////////////////////////////////////////////////////////////////////////////

export class StoryboardLineTarget extends EezObject {
    @observable page: string;

    static classInfo: ClassInfo = {
        label: (storyboardLineSourceProperties: StoryboardLineSource) =>
            storyboardLineSourceProperties.page,

        properties: [
            {
                name: "page",
                type: PropertyType.ObjectReference,
                referencedObjectCollectionPath: ["gui", "pages"]
            }
        ]
    };
}

registerClass(StoryboardLineTarget);

////////////////////////////////////////////////////////////////////////////////

export class StoryboardLine extends EezObject {
    @observable source: StoryboardLineSource;
    @observable target: StoryboardLineTarget;

    static classInfo: ClassInfo = {
        label: (storyboardLineProperties: StoryboardLine) =>
            storyboardLineProperties.source.page + "->" + storyboardLineProperties.target.page,

        properties: [
            {
                name: "source",
                type: PropertyType.Object,
                typeClass: StoryboardLineSource
            },
            {
                name: "target",
                type: PropertyType.Object,
                typeClass: StoryboardLineTarget
            }
        ]
    };
}

registerClass(StoryboardLine);

////////////////////////////////////////////////////////////////////////////////

export class Storyboard extends EezObject {
    @observable pages: EezArrayObject<StoryboardPage>;
    @observable lines: EezArrayObject<StoryboardLine>;

    static classInfo: ClassInfo = {
        label: (storyboard: Storyboard) => "Storyboard",

        properties: [
            {
                name: "pages",
                type: PropertyType.Array,
                typeClass: StoryboardPage,
                hideInPropertyGrid: true
            },
            {
                name: "lines",
                type: PropertyType.Array,
                typeClass: StoryboardLine,
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

registerClass(Storyboard);

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
