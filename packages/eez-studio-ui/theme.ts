import { settingsController } from "home/settings";

export interface ThemeInterface {
    backgroundColor: string;
    borderColor: string;
    panelHeaderColor: string;
    selectionBackgroundColor: string;
    connectionLineColor: string;
    selectedConnectionLineColor: string;
    seqConnectionLineColor: string;
    activeConnectionLineColor: string;
    disabledLineColor: string;
}

export const lightTheme: ThemeInterface = {
    backgroundColor: "#f5f5f5",
    borderColor: "#e6e6e6",
    panelHeaderColor: "#f0f0f0",
    selectionBackgroundColor: "#0d99ff",
    connectionLineColor: "#999",
    selectedConnectionLineColor: "red",
    seqConnectionLineColor: "#3FADB5",
    activeConnectionLineColor: "blue",
    disabledLineColor: "#aaa"
};

export const darkTheme: ThemeInterface = {
    backgroundColor: "#1e1e1e",
    borderColor: "#444444",
    panelHeaderColor: "#2c2c2c",
    selectionBackgroundColor: "#0d99ff",
    connectionLineColor: "#999",
    selectedConnectionLineColor: "red",
    seqConnectionLineColor: "#3FADB5",
    activeConnectionLineColor: "blue",
    disabledLineColor: "#999"
};

export const theme = () =>
    settingsController.isDarkTheme ? darkTheme : lightTheme;
