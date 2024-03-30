export interface IActivityLogEntry {
    id: string;
    date: Date;
    sid: string | null;
    oid: string;
    type: string;
    message: string;
    data: any;
    deleted: boolean;
    temporary: boolean;
}
