import { IMeasureTask } from "eez-studio-shared/extensions/extension";

export default function (task: IMeasureTask) {
    if (task.inputs[0].samplingRate !== task.inputs[1].samplingRate) {
        task.result = "Different sampling rate!";
        return;
    }

    let uRMS = 0;
    let uNumSamples = 0;

    let iRMS = 0;
    let iNumSamples = 0;

    const xEndIndex = task.xStartIndex + task.xNumSamples;
    for (let i = task.xStartIndex; i < xEndIndex; ++i) {
        const sampleU = task.inputs[0].getSampleValueAtIndex(i);
        if (!isNaN(sampleU)) {
            uRMS += sampleU * sampleU;
            uNumSamples++;
        }

        const sampleI = task.inputs[1].getSampleValueAtIndex(i);
        if (!isNaN(sampleI)) {
            iRMS += sampleI * sampleI;
            iNumSamples++;
        }
    }

    uRMS = Math.sqrt(uRMS / uNumSamples);
    iRMS = Math.sqrt(iRMS / iNumSamples);

    task.result = uRMS * iRMS;
}
