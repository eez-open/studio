import React from "react";
import mobx from "mobx";

interface IEezObject {}

interface PropertyInfo {
    name: string;
    displayName?: string;
    type: any;
    hideInPropertyGrid?:
        | boolean
        | ((object: IEezObject, propertyInfo: PropertyInfo) => boolean);
}

interface ClassInfo {
    properties: PropertyInfo[];
    icon?: React.ReactNode;
}

declare class ActionComponent {
    static classInfo: ClassInfo;
}

export interface IEezStudio {
    React: typeof React;
    mobx: typeof mobx;
    registerClass: (classToRegister: any) => void;
    PropertyType: any;
    makeDerivedClassInfo: (
        baseClassInfo: ClassInfo,
        derivedClassInfoProperties: Partial<ClassInfo>
    ) => ClassInfo;
    ActionComponent: typeof ActionComponent;
}
