import { Rect } from "shared/geometry";
import { IObject } from "shared/extensions/extension";

////////////////////////////////////////////////////////////////////////////////

export interface IBaseObject extends IObject {
    type: string;
    oid: string;
    rect: Rect;
    selected: boolean;
    boundingRect: Rect;
    setBoundingRect(rect: Rect): void;
    toggleSelect(): void;
    setRect(rect: Rect): void;
    saveRect(): void;
}
