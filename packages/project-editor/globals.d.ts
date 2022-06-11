/// <reference path="../eez-studio-shared/globals.d.ts"/>

declare const opentype: {
    parse(arg: any): any;
};

declare const ace: {
    edit(arg: any): any;
    acequire(arg: any): any;
};

declare module "jspanel4";

declare module "xliff";

//

type IIndexes = { [key: string]: number };

interface IField {
    name: string;
    valueType: ValueType;
}

interface ITypeBase {
    kind: "object" | "array";
    valueType: ValueType;
}

interface IObjectType {
    kind: "object";
    valueType: ValueType;
    fields: IField[];
    fieldIndexes: IIndexes;
    open: boolean;
}

interface IArrayType {
    kind: "array";
    valueType: ValueType;
    elementType: IType;
}

interface IBasicType {
    kind: "basic";
    valueType: ValueType;
}

type IType = IArrayType | IObjectType | IBasicType;

interface AssetsMap {
    flows: {
        flowIndex: number;
        path: string;
        readablePath: string;
        components: {
            componentIndex: number;
            path: string;
            readablePath: string;
            inputIndexes: {
                [inputName: string]: number;
            };
            outputs: {
                outputName: string;
                valueTypeIndex: number;
                connectionLines: {
                    targetComponentIndex: number;
                    targetInputIndex: number;
                }[];
            }[];
            outputIndexes: {
                [outputName: string]: number;
            };
            properties: {
                valueTypeIndex: number;
            }[];
            propertyIndexes: {
                [propertyName: string]: number;
            };
        }[];
        componentIndexes: { [path: string]: number };
        componentInputs: {
            inputIndex: number;
            componentIndex: number;
            inputName: string;
            inputType: string;
        }[];
        localVariables: {
            index: number;
            name: string;
        }[];
        widgetDataItems: {
            widgetDataItemIndex: number;
            flowIndex: number;
            componentIndex: number;
            propertyValueIndex: number;
        }[];
        widgetActions: {
            widgetActionIndex: number;
            flowIndex: number;
            componentIndex: number;
            outputIndex: number;
        }[];
    }[];
    flowIndexes: { [path: string]: number };
    actionFlowIndexes: { [actionName: string]: number };
    constants: any[];
    globalVariables: {
        index: number;
        name: string;
    }[];
    dashboardComponentTypeToNameMap: {
        [componentType: number]: string;
    };
    types: IType[];
    typeIndexes: IIndexes;
    displayWidth: number;
    displayHeight: number;
}

interface IMessageFromWorker {
    id: number;
    flowStateIndex: number;
    componentIndex: number;
    message: any;
    callback?: (result: any) => void;
}
