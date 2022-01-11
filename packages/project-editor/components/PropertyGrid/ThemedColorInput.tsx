import React from "react";
import { observer } from "mobx-react";
import { SketchPicker } from "react-color";

import { isDark, isValid } from "eez-studio-shared/color";

import { getProperty } from "project-editor/core/object";
import { getEezStudioDataFromDragEvent } from "project-editor/core/store";

import { getThemedColor } from "project-editor/features/style/theme";

import { ProjectContext } from "project-editor/project/context";
import { settingsController } from "home/settings";

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

    combine: boolean = false;

    onChangeColor = (color: string, completed: boolean) => {
        if (!this.combine) {
            this.context.undoManager.setCombineCommands(true);
            this.combine = true;
        }

        this.props.onChange(color);

        if (completed) {
            this.context.undoManager.setCombineCommands(false);
            this.combine = false;
        }
    };

    render() {
        const { value, readOnly } = this.props;

        let color: string | undefined =
            value == "transparent"
                ? settingsController.isDarkTheme
                    ? "black"
                    : "white"
                : getThemedColor(this.context, value);

        if (!isValid(color)) {
            color = undefined;
        }

        return (
            <div className="input-group">
                <input
                    className="form-control"
                    style={{
                        color: color && isDark(color) ? "#fff" : undefined,
                        backgroundColor: color
                    }}
                    type="text"
                    value={value}
                    onChange={this.onChange}
                    readOnly={readOnly}
                    onDrop={this.onDrop}
                    onDragOver={this.onDragOver}
                />
                {!readOnly && (
                    <>
                        <button
                            className="btn btn-outline-secondary dropdown-toggle EezStudio_ThemedColorInput_DropdownButton"
                            type="button"
                            data-bs-toggle="dropdown"
                        />
                        <div className="dropdown-menu dropdown-menu-end EezStudio_ThemedColorInput_DropdownContent">
                            <SketchPicker
                                width="260px"
                                color={color}
                                disableAlpha={true}
                                presetColors={[]}
                                onChange={color =>
                                    this.onChangeColor(color.hex, false)
                                }
                                onChangeComplete={color =>
                                    this.onChangeColor(color.hex, true)
                                }
                            />
                        </div>
                    </>
                )}
            </div>
        );
    }
}
