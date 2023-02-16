import React from "react";

import { IEezObject } from "project-editor/core/object";

export interface NavigationComponentProps {
    id: string;
    navigationObject: IEezObject;
    onDoubleClickItem?: (item: IEezObject) => void;
}

export class NavigationComponent extends React.Component<NavigationComponentProps> {}
