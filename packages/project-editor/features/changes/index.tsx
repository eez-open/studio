import React from "react";

import {
    ClassInfo,
    EezObject,
    PropertyType,
    registerClass
} from "project-editor/core/object";

import { ChangesState } from "./state";

const CHANGES_ICON = (
    <svg width="24" height="24" viewBox="0 0 13 16">
        <path
            fillRule="evenodd"
            d="M6 7h2v1H6v2H5V8H3V7h2V5h1v2zm-3 6h5v-1H3v1zM7.5 2 11 5.5V15c0 .55-.45 1-1 1H1c-.55 0-1-.45-1-1V3c0-.55.45-1 1-1h6.5zM10 6 7 3H1v12h9V6zM8.5 0H3v1h5l4 4v8h1V4.5L8.5 0z"
            fill="currentColor"
        />
    </svg>
);

////////////////////////////////////////////////////////////////////////////////

export class Changes extends EezObject {
    static classInfo: ClassInfo = {
        properties: [],
        icon: CHANGES_ICON
    };

    _state = new ChangesState();
}

registerClass("Changes", Changes);

////////////////////////////////////////////////////////////////////////////////

export default {
    name: "eezstudio-project-feature-changes",
    version: "0.1.0",
    description: "Compare project with previous versions",
    author: "EEZ",
    authorLogo: "../eez-studio-ui/_images/eez_logo.png",
    displayName: "Changes",
    mandatory: false,
    key: "changes",
    type: PropertyType.Object,
    typeClass: Changes,
    icon: CHANGES_ICON,
    create: () => ({})
};
