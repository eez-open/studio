import { autorun, observable, runInAction, toJS } from "mobx";
import type { WaveformRenderAlgorithm } from "./chart";

class GlobalViewOptions {
    static LOCAL_STORAGE_ITEM_ID = "shared/ui/chart/globalViewOptions";

    @observable enableZoomAnimations: boolean = true;
    @observable blackBackground: boolean = false;
    @observable renderAlgorithm: WaveformRenderAlgorithm = "minmax";
    @observable showSampledData: boolean = false;

    constructor() {
        const globalViewOptionsJSON = localStorage.getItem(
            GlobalViewOptions.LOCAL_STORAGE_ITEM_ID
        );
        if (globalViewOptionsJSON) {
            try {
                const globakViewOptionsJS = JSON.parse(globalViewOptionsJSON);
                runInAction(() => Object.assign(this, globakViewOptionsJS));
            } catch (err) {
                console.error(err);
            }
        }

        autorun(() => {
            localStorage.setItem(
                GlobalViewOptions.LOCAL_STORAGE_ITEM_ID,
                JSON.stringify(toJS(this))
            );
        });
    }
}

export const globalViewOptions = new GlobalViewOptions();
