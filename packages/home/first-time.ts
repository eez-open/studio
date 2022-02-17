import { ipcRenderer } from "electron";
import { observable, reaction } from "mobx";

export const firstTime = observable.box<boolean>(
    ipcRenderer.sendSync("getFirstTime")
);

reaction(
    () => firstTime.get(),
    firstTime => ipcRenderer.send("setFirstTime", firstTime)
);
