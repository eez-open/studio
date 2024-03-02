import { makeObservable, observable } from "mobx";
import React from "react";

import {
    ClassInfo,
    EezObject,
    PropertyType,
    registerClass
} from "project-editor/core/object";
import type { ProjectEditorFeature } from "project-editor/store/features";

const README_ICON = (
    <svg width="24" height="24" fill="none" viewBox="0 0 24 24">
        <path
            clipRule="evenodd"
            d="M4 5.5h5c1.1046 0 2 .8954 2 2v9c0 .5523-.4477 1-1 1H4c-.5523 0-1-.4477-1-1v-10c0-.5523.4477-1 1-1Zm10 14a2.9967 2.9967 0 0 1-1-.1707V19.5c0 .5523-.4477 1-1 1s-1-.4477-1-1v-.1707a2.9967 2.9967 0 0 1-1 .1707H4c-1.6568 0-3-1.3431-3-3v-10c0-1.6569 1.3432-3 3-3h5c1.1947 0 2.2671.5238 3 1.3542.7329-.8304 1.8053-1.3542 3-1.3542h5c1.6569 0 3 1.3431 3 3v10c0 1.6569-1.3431 3-3 3h-6Zm-1-12v9c0 .5523.4477 1 1 1h6c.5523 0 1-.4477 1-1v-10c0-.5523-.4477-1-1-1h-5c-1.1046 0-2 .8954-2 2Zm-8 0h4v2H5v-2Zm10 0h4v2h-4v-2Zm4 3h-4v2h4v-2Zm-14 0h4v2H5v-2Zm14 3h-4v2h4v-2Zm-14 0h4v2H5v-2Z"
            fill="currentColor"
            fillRule="evenodd"
        />
    </svg>
);

////////////////////////////////////////////////////////////////////////////////

export class Readme extends EezObject {
    readmeFile: string | undefined;

    static classInfo: ClassInfo = {
        properties: [
            {
                name: "readmeFile",
                type: PropertyType.RelativeFile
            }
        ],
        icon: README_ICON
    };

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            readmeFile: observable
        });
    }
}

registerClass("Readme", Readme);

////////////////////////////////////////////////////////////////////////////////

const feature: ProjectEditorFeature = {
    name: "eezstudio-project-feature-readme",
    version: "0.1.0",
    description: "Readme file",
    author: "EEZ",
    authorLogo: "../eez-studio-ui/_images/eez_logo.png",
    displayName: "Readme",
    mandatory: false,
    key: "readme",
    type: PropertyType.Object,
    typeClass: Readme,
    icon: README_ICON,
    create: () => ({})
};

export default feature;
