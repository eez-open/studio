import { makeObservable, observable } from "mobx";

export class ViewManagerModel {
    type: "ViewManagerModel";
    id: string;
    rootLayout: HorizontalLayoutModel;

    constructor() {
        makeObservable(this, {
            rootLayout: observable
        });
    }
}

export class HorizontalLayoutModel {
    type: "HorizontalLayout";
    id: string;
    children: (VerticalLayoutModel | TabLayoutModel | ViewRefModel)[];
    sizes: number[];

    constructor() {
        makeObservable(this, {
            children: observable,
            sizes: observable
        });
    }
}

export class VerticalLayoutModel {
    type: "VerticalLayout";
    id: string;
    children: (HorizontalLayoutModel | TabLayoutModel | ViewRefModel)[];
    sizes: number[];

    constructor() {
        makeObservable(this, {
            children: observable,
            sizes: observable
        });
    }
}

export class TabLayoutModel {
    type: "TabLayout";
    id: string;
    tabs: ViewRefModel[];

    constructor() {
        makeObservable(this, {
            tabs: observable
        });
    }
}

export class ViewRefModel {
    type: "ViewRef";
    id: string;
    viewId: string;

    constructor() {
        makeObservable(this, {
            viewId: observable
        });
    }
}

export const ViewManagerModelTypes: {
    [type: string]: { new (): any };
} = {
    ViewManager: ViewManagerModel,
    HorizontalLayout: VerticalLayoutModel,
    VerticalLayout: VerticalLayoutModel,
    TabLayout: TabLayoutModel,
    ViewRef: ViewRefModel
};
