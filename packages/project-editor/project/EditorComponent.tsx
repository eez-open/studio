import React from "react";

import { IEezObject } from "project-editor/core/object";

export interface IEditorState {
    loadState(state: any): void;
    saveState(): any;
    selectObject(object: IEezObject): void;
    selectObjects(objects: IEezObject[]): void;
    selectObjectsAndEnsureVisible(objects: IEezObject[]): void;
}

export interface IEditor {
    object: IEezObject;
    subObject?: IEezObject;
    state: IEditorState | undefined;
}

export interface EditorComponentProps {
    editor: IEditor;
}

export class EditorComponent extends React.Component<
    EditorComponentProps,
    {}
> {}
