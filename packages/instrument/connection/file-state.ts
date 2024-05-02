export type FileStateState =
    | "init"
    | "upload-filesize"
    | "upload-start"
    | "progress"
    | "upload-error"
    | "upload-finish"
    | "success"
    | "abort"
    | "timeout"
    | "error"
    | "live";

export interface FileState {
    state: FileStateState;
    sourceFilePath: string;
    destinationFilePath: string;
    fileType:
        | string
        | {
              ext?: string;
              mime: string;
          };
    dataLength: number;
    expectedDataLength: number;
    transferSpeed: number;
    error: string | undefined;
    note: string | undefined;
    description: string | undefined;
}
