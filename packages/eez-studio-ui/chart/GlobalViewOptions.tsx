import { autorun, observable, runInAction, toJS, makeObservable } from "mobx";
import type { WaveformRenderAlgorithm } from "eez-studio-ui/chart/chart";

class GlobalViewOptions {
    static LOCAL_STORAGE_ITEM_ID = "shared/ui/chart/globalViewOptions";

    enableZoomAnimations: boolean = true;
    blackBackground: boolean = false;
    renderAlgorithm: WaveformRenderAlgorithm = "minmax";
    showSampledData: boolean = false;

    constructor() {
        makeObservable(this, {
            enableZoomAnimations: observable,
            blackBackground: observable,
            renderAlgorithm: observable,
            showSampledData: observable
        });

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
