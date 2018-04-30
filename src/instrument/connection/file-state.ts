export type FileStateState =
    | "init"
    | "download-filesize"
    | "download-start"
    | "progress"
    | "download-error"
    | "download-finish"
    | "success"
    | "abort"
    | "timeout"
    | "error";

export interface FileState {
    direction: "upload" | "download";
    state: FileStateState;
    sourceFilePath: string;
    destinationFilePath: string;
    fileType:
        | string
        | {
              ext: string;
              mime: string;
          };
    dataLength: number;
    expectedDataLength: number;
    transferSpeed: number;
    error: string | undefined;
    note: string | undefined;
    description: string | undefined;
}
