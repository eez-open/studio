import * as FlexLayout from "flexlayout-react";

export interface ILayoutModel {
    name: string;
    version: number;
    json: FlexLayout.IJsonModel;
    get: () => FlexLayout.Model;
    set: (model: FlexLayout.Model) => void;
}

export abstract class AbstractLayoutModels {
    abstract get models(): ILayoutModel[];

    load(layoutModels: any) {
        for (const model of this.models) {
            const savedModel = layoutModels && layoutModels[model.name];
            if (savedModel && savedModel.version == model.version) {
                model.set(FlexLayout.Model.fromJson(savedModel.json));
            } else {
                model.set(FlexLayout.Model.fromJson(model.json));
            }
        }
    }

    save() {
        const layoutModels: any = {};

        for (const model of this.models) {
            try {
                layoutModels[model.name] = {
                    version: model.version,
                    json: model.get().toJson()
                };
            } catch (err) {
                console.log(model);
                console.error(err);
            }
        }

        return layoutModels;
    }
}
