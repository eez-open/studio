export interface ThemeInterface {
    borderColor: string;
    darkBorderColor: string;
    panelHeaderColor: string;
    selectionBackgroundColor: string;
    selectionColor: string;
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
}

export const theme: ThemeInterface = {
    borderColor: "#d5d5d5",
    darkBorderColor: "#c5c5c5",
    panelHeaderColor: "#f0f0f0",
    selectionBackgroundColor: "#337bb7",
    selectionColor: "white",
    tableBorderColor: "#e0e0e0",
    nonFocusedSelectionBackgroundColor: "#c5c5c5",
    nonFocusedSelectionColor: "black",
    hoverBackgroundColor: "#c5c5c5",
    hoverColor: "black",
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
    actionHoverColor: "#0056b3"
};
