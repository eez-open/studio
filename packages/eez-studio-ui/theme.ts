import { settingsController } from "home/settings";

export interface ThemeInterface {
    borderColor: string;
    darkBorderColor: string;
    panelHeaderColor: string;
    selectionBackgroundColor: string;
    selectionColor: string;
    lightSelectionBackgroundColor: string;
    lightSelectionColor: string;
    tableBorderColor: string;
    nonFocusedSelectionBackgroundColor: string;
    nonFocusedSelectionColor: string;
    hoverBackgroundColor: string;
    hoverColor: string;
    scrollTrackColor: string;
    scrollThumbColor: string;
    darkTextColor: string;
    focusBackgroundColor: string;
    focusColor: string;
    dragSourceBackgroundColor: string;
    dragSourceColor: string;
    dropTargetBackgroundColor: string;
    dropTargetColor: string;
    dropPlaceColor: string;
    errorColor: string;
    actionTextColor: string;
    actionHoverColor: string;
    connectionLineColor: string;
    seqConnectionLineColor: string;
    selectedConnectionLineColor: string;
    activeConnectionLineColor: string;
    connectionLineInTheMakingColor: string;
    activeTabBackgroundColor: string;
}

export const lightTheme: ThemeInterface = {
    borderColor: "#d5d5d5",
    darkBorderColor: "#c5c5c5",
    panelHeaderColor: "#f0f0f0",
    selectionBackgroundColor: "#337bb7",
    selectionColor: "white",
    lightSelectionBackgroundColor: "#93bde0",
    lightSelectionColor: "white",
    tableBorderColor: "#e0e0e0",
    nonFocusedSelectionBackgroundColor: "#c5c5c5",
    nonFocusedSelectionColor: "black",
    hoverBackgroundColor: "#c5c5c5",
    hoverColor: "#333",
    scrollTrackColor: "#f1f1f1",
    scrollThumbColor: "#c1c1c1",
    darkTextColor: "#555",
    focusBackgroundColor: "#4e94d1",
    focusColor: "#444",
    dragSourceBackgroundColor: "#e040fb",
    dragSourceColor: "#ffffff",
    dropTargetBackgroundColor: "#7c4dff",
    dropTargetColor: "#ffffff",
    dropPlaceColor: "#7c4dff",
    errorColor: "#dc3545",
    actionTextColor: "#007bff",
    actionHoverColor: "#0056b3",
    connectionLineColor: "#999",
    selectedConnectionLineColor: "red",
    seqConnectionLineColor: "#3FADB5",
    activeConnectionLineColor: "blue",
    connectionLineInTheMakingColor: "#337bb7",
    activeTabBackgroundColor: "#ffffff"
};

export const darkTheme: ThemeInterface = {
    borderColor: "#555555",
    darkBorderColor: "#444444",
    panelHeaderColor: "#333333",
    selectionBackgroundColor: "#337bb7",
    selectionColor: "white",
    lightSelectionBackgroundColor: "#93bde0",
    lightSelectionColor: "white",
    tableBorderColor: "#e0e0e0",
    nonFocusedSelectionBackgroundColor: "#c5c5c5",
    nonFocusedSelectionColor: "black",
    hoverBackgroundColor: "#c5c5c5",
    hoverColor: "#fff",
    scrollTrackColor: "#f1f1f1",
    scrollThumbColor: "#c1c1c1",
    darkTextColor: "#555",
    focusBackgroundColor: "#4e94d1",
    focusColor: "#444",
    dragSourceBackgroundColor: "#e040fb",
    dragSourceColor: "#ffffff",
    dropTargetBackgroundColor: "#7c4dff",
    dropTargetColor: "#ffffff",
    dropPlaceColor: "#7c4dff",
    errorColor: "#dc3545",
    actionTextColor: "#007bff",
    actionHoverColor: "#0056b3",
    connectionLineColor: "#999",
    selectedConnectionLineColor: "red",
    seqConnectionLineColor: "#3FADB5",
    activeConnectionLineColor: "blue",
    connectionLineInTheMakingColor: "#337bb7",
    activeTabBackgroundColor: "#666666"
};

export const theme = () =>
    settingsController.isDarkTheme ? darkTheme : lightTheme;
