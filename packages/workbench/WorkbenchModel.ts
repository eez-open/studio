import { makeObservable, observable } from "mobx";

import { ViewManagerModel } from "workbench";

export class WorkbenchViewModel {
    type: "WorkbenchView";
    id: string;

    title: string;
}

export class WorkbenchModel {
    type: "WorkbenchModel";
    id: string;

    views: WorkbenchViewModel[];
    viewManager: ViewManagerModel;

    constructor() {
        makeObservable(this, {
            views: observable,
            viewManager: observable
        });
    }
}

export const WorkbenchModelTypes: {
    [type: string]: { new (): any };
} = {
    Workbench: WorkbenchModel,
    WorkbenchView: WorkbenchViewModel
};
