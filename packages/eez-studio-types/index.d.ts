import React from "react";

interface IEezObject {}

interface PropertyInfo {
    name: string;
    type: any;
    hideInPropertyGrid?:
        | boolean
        | ((object: IEezObject, propertyInfo: PropertyInfo) => boolean);
}

interface ClassInfo {
    properties: PropertyInfo[];
    icon?: React.ReactNode;
}

declare class ActionNode {
    static classInfo: ClassInfo;
}

export interface IEezStudio {
    React: typeof React;
    registerClass: (classToRegister: any) => void;
    PropertyType: any;
    makeDerivedClassInfo: (
        baseClassInfo: ClassInfo,
        derivedClassInfoProperties: Partial<ClassInfo>
    ) => ClassInfo;
    ActionNode: typeof ActionNode;
}
