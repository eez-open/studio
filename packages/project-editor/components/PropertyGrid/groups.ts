import type {
    IEezObject,
    IPropertyGridGroupDefinition
} from "project-editor/core/object";
import { ProjectEditor } from "project-editor/project-editor-interface";

export const indentationGroup: IPropertyGridGroupDefinition = {
    id: "indentation",
    title: "Indentation",
    position: 3
};

export const generalGroup: IPropertyGridGroupDefinition = {
    id: "general",
    title: "General",
    position: (object: IEezObject) =>
        object instanceof ProjectEditor.ActionComponentClass ? 0 : 2
};

export const specificGroup: IPropertyGridGroupDefinition = {
    id: "specific",
    title: "Specific",
    position: (object: IEezObject) =>
        object instanceof ProjectEditor.ActionComponentClass ? 1 : 3
};

export const flowGroup: IPropertyGridGroupDefinition = {
    id: "flow",
    title: "Flow",
    position: (object: IEezObject) =>
        object instanceof ProjectEditor.ActionComponentClass ? 2 : 4
};

export const geometryGroup: IPropertyGridGroupDefinition = {
    id: "geometry",
    title: "Position and size",
    position: (object: IEezObject) =>
        object instanceof ProjectEditor.ActionComponentClass ? 3 : 0
};

export const styleGroup: IPropertyGridGroupDefinition = {
    id: "style",
    title: "Style",
    position: (object: IEezObject) =>
        object instanceof ProjectEditor.ActionComponentClass ? 4 : 1
};

export const topGroup: IPropertyGridGroupDefinition = {
    id: "top",
    title: "",
    position: (object: IEezObject) => -1
};

export const timelineGroup: IPropertyGridGroupDefinition = {
    id: "timeline",
    title: "Timeline keyframe",
    position: (object: IEezObject) => -2
};
