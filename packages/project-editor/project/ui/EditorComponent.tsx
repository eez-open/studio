import React from "react";

import { IEezObject } from "project-editor/core/object";

export interface IEditorState {
    loadState?(state: any): void;
    saveState?(): any;
    selectObject?(object: IEezObject): void;
    selectObjects?(objects: IEezObject[]): void;
    selectObjectsAndEnsureVisible?(objects: IEezObject[]): void;
    getTitle?(editor: IEditor): string;
}

export interface IEditor {
    object: IEezObject;
    subObject?: IEezObject;
    params?: any;
    state: IEditorState | undefined;
    permanent: boolean;

    getConfig(): any;
}

export interface EditorComponentProps {
    children?: React.ReactNode;
    editor: IEditor;
}

export class EditorComponent extends React.Component<
    EditorComponentProps,
    {}
> {}
