import { settingsController } from "home/settings";

export interface ThemeInterface {
    borderColor: string;
    panelHeaderColor: string;
    selectionBackgroundColor: string;
    connectionLineColor: string;
    selectedConnectionLineColor: string;
    seqConnectionLineColor: string;
    activeConnectionLineColor: string;
}

export const lightTheme: ThemeInterface = {
    borderColor: "#d5d5d5",
    panelHeaderColor: "#f0f0f0",
    selectionBackgroundColor: "#337bb7",
    connectionLineColor: "#999",
    selectedConnectionLineColor: "red",
    seqConnectionLineColor: "#3FADB5",
    activeConnectionLineColor: "blue"
};

export const darkTheme: ThemeInterface = {
    borderColor: "#555555",
    panelHeaderColor: "#333333",
    selectionBackgroundColor: "#337bb7",
    connectionLineColor: "#999",
    selectedConnectionLineColor: "red",
    seqConnectionLineColor: "#3FADB5",
    activeConnectionLineColor: "blue"
};

export const theme = () =>
    settingsController.isDarkTheme ? darkTheme : lightTheme;
