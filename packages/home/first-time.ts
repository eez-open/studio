import { observable, reaction } from "mobx";

export const firstTime = observable.box<boolean>(
    EEZStudio.electron.ipcRenderer.sendSync("getFirstTime")
);

reaction(
    () => firstTime.get(),
    firstTime => EEZStudio.electron.ipcRenderer.send("setFirstTime", firstTime)
);
