import React from "react";
import { observer } from "mobx-react";

import { isDark } from "eez-studio-shared/color";

import { getProperty } from "project-editor/core/object";
import { getEezStudioDataFromDragEvent } from "project-editor/core/store";

import { getThemedColor } from "project-editor/features/style/theme";

import { ProjectContext } from "project-editor/project/context";

////////////////////////////////////////////////////////////////////////////////

@observer
export class ThemedColorInput extends React.Component<{
    value: any;
    onChange: (newValue: any) => void;
    readOnly: boolean;
}> {
    static contextType = ProjectContext;
    declare context: React.ContextType<typeof ProjectContext>;

    onDragOver = (event: React.DragEvent) => {
        event.preventDefault();
        event.stopPropagation();

        var data = getEezStudioDataFromDragEvent(this.context, event);
        if (data && data.objectClassName === "Color" && data.object) {
            event.dataTransfer.dropEffect = "copy";
        }
    };

    onDrop = (event: React.DragEvent) => {
        event.stopPropagation();
        event.preventDefault();
        var data = getEezStudioDataFromDragEvent(this.context, event);
        if (data && data.objectClassName === "Color" && data.object) {
            this.props.onChange(getProperty(data.object, "name"));
        }
    };

    onChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const color = event.target.value;
        // const color16bits = to16bitsColor(color);
        // if (!compareColors(color, color16bits)) {
        //     await info(
        //         "Selected color is using more then 16 bits (i.e. 5-6-5 RGB color scheme).",
        //         "It will be saved as is but it will be truncated to 16 bits before displaying and building."
        //     );
        // }
        this.props.onChange(color);
    };

    render() {
        const { value, readOnly } = this.props;

        const color = getThemedColor(this.context, value);

        return (
            <label
                className="EezStudio_ColorInputLabel form-label"
                style={{
                    color: isDark(color) ? "#fff" : undefined,
                    backgroundColor: color
                }}
                onDrop={this.onDrop}
                onDragOver={this.onDragOver}
            >
                <input
                    type="color"
                    value={value}
                    onChange={this.onChange}
                    readOnly={readOnly}
                />
                {value}
            </label>
        );
    }
}
