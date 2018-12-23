import { IWindowParams } from "main/window";

export const PROJECT_WINDOW_URL = "project-editor/index.html";
export const PROJECT_FILE_PATH_PARAM = "?open=";

export function getProjectWindowParams(filePath: string) {
    let params: IWindowParams = {
        url: PROJECT_WINDOW_URL + PROJECT_FILE_PATH_PARAM + encodeURIComponent(filePath)
    };
    return params;
}
