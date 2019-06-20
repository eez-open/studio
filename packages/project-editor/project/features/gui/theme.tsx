import { observable } from "mobx";
import React from "react";
import { observer } from "mobx-react";
import styled from "eez-studio-ui/styled-components";

import { EditorComponent, EezArrayObject } from "eez-studio-shared/model/object";

import { ClassInfo, EezObject, registerClass, PropertyType } from "eez-studio-shared/model/object";

import { ListNavigationWithContent } from "project-editor/project/ui/ListNavigation";

////////////////////////////////////////////////////////////////////////////////

const ThemeEditorContainer = styled.div``;

@observer
class ThemeEditor extends EditorComponent {
    render() {
        const theme = this.props.editor.object as Theme;

        return <ThemeEditorContainer>Hello {theme.name}</ThemeEditorContainer>;
    }
}

////////////////////////////////////////////////////////////////////////////////

class Color extends EezObject {
    @observable name: string;
    @observable color: string;

    static classInfo: ClassInfo = {
        properties: [
            {
                name: "name",
                type: PropertyType.String,
                unique: true
            },
            {
                name: "color",
                type: PropertyType.Color
            }
        ]
    };
}

registerClass(Color);

////////////////////////////////////////////////////////////////////////////////

export class Theme extends EezObject {
    @observable name: string;
    @observable description?: string;
    @observable colors: EezArrayObject<Color>;

    static classInfo: ClassInfo = {
        properties: [
            {
                name: "name",
                type: PropertyType.String,
                unique: true
            },
            {
                name: "description",
                type: PropertyType.MultilineText
            },
            {
                name: "colors",
                type: PropertyType.Array,
                typeClass: Color
            }
        ],
        newItem: (object: EezObject) => {
            return Promise.resolve({
                name: "Theme"
            });
        },
        editorComponent: ThemeEditor,
        navigationComponent: ListNavigationWithContent,
        navigationComponentId: "themes",
        icon: "palette"
    };
}

registerClass(Theme);
