import React from "react";
import ReactDOM from "react-dom";
import { observer } from "mobx-react";
import { SketchPicker } from "react-color";

import { isDark, isValid } from "eez-studio-shared/color";

import { getProperty } from "project-editor/core/object";
import { getEezStudioDataFromDragEvent } from "project-editor/store";

import { getThemedColor } from "project-editor/features/style/theme";

import { ProjectContext } from "project-editor/project/context";
import { settingsController } from "home/settings";
import { action, observable, makeObservable } from "mobx";
import { closest } from "eez-studio-shared/dom";

////////////////////////////////////////////////////////////////////////////////

export const ThemedColorInput = observer(
    class ThemedColorInput extends React.Component<{
        inputRef?: (ref: any) => void;
        value: any;
        onChange: (newValue: any) => void;
        readOnly: boolean;
    }> {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        buttonRef = React.createRef<HTMLButtonElement>();
        dropDownRef = React.createRef<HTMLDivElement>();
        dropDownOpen: boolean | undefined = undefined;
        dropDownLeft = 0;
        dropDownTop = 0;

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

        constructor(props: {
            value: any;
            onChange: (newValue: any) => void;
            readOnly: boolean;
        }) {
            super(props);

            makeObservable(this, {
                dropDownOpen: observable,
                dropDownLeft: observable,
                dropDownTop: observable,
                setDropDownOpen: action
            });
        }

        setDropDownOpen(open: boolean) {
            if (this.dropDownOpen === false) {
                document.removeEventListener(
                    "pointerdown",
                    this.onDocumentPointerDown,
                    true
                );
            }

            this.dropDownOpen = open;

            if (this.dropDownOpen) {
                document.addEventListener(
                    "pointerdown",
                    this.onDocumentPointerDown,
                    true
                );
            }
        }

        openDropdown = action(() => {
            const buttonEl = this.buttonRef.current;
            if (!buttonEl) {
                return;
            }

            const dropDownEl = this.dropDownRef.current;
            if (!dropDownEl) {
                return;
            }

            this.setDropDownOpen(!this.dropDownOpen);

            if (this.dropDownOpen) {
                const rectButton = buttonEl.getBoundingClientRect();

                const DROP_DOWN_WIDTH = 280;

                this.dropDownLeft = rectButton.right - DROP_DOWN_WIDTH;
                this.dropDownTop = rectButton.bottom;
            }
        });

        onDocumentPointerDown = action((event: MouseEvent) => {
            if (this.dropDownOpen) {
                if (
                    !closest(
                        event.target,
                        el =>
                            this.buttonRef.current == el ||
                            this.dropDownRef.current == el
                    )
                ) {
                    event.preventDefault();
                    event.stopPropagation();
                    this.setDropDownOpen(false);
                }
            }
        });

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

            const portal = ReactDOM.createPortal(
                <div
                    ref={this.dropDownRef}
                    className="dropdown-menu dropdown-menu-end EezStudio_ThemedColorInput_DropdownContent shadow rounded"
                    style={{
                        display: this.dropDownOpen ? "block" : "none",
                        left: this.dropDownLeft,
                        top: this.dropDownTop
                    }}
                >
                    <SketchPicker
                        width="260px"
                        color={color}
                        disableAlpha={true}
                        presetColors={[]}
                        onChange={color => this.onChangeColor(color.hex, false)}
                        onChangeComplete={color => {
                            this.onChangeColor(color.hex, true);
                        }}
                    />
                </div>,
                document.body
            );

            return (
                <div className="input-group">
                    <input
                        ref={this.props.inputRef}
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
                                ref={this.buttonRef}
                                className="btn btn-secondary dropdown-toggle EezStudio_ThemedColorInput_DropdownButton"
                                type="button"
                                onClick={this.openDropdown}
                            />
                            {portal}
                        </>
                    )}
                </div>
            );
        }
    }
);
