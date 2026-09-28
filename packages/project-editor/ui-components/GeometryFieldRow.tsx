import React from "react";
import classNames from "classnames";

import { getProjectStore } from "project-editor/store";

import { Property } from "project-editor/ui-components/PropertyGrid/Property";
import { findPropertyByNameInClassInfo } from "project-editor/core/object";

// One Figma-style geometry field: bordered container with the axis letter
// inside on the left. Holding the letter and moving the mouse horizontally
// scrubs the value; consecutive updates are merged into one undo step.

export const GeometryFieldRow = React.memo(
    class GeometryFieldRow extends React.Component<
        {
            label: string;
            title?: string;
            propertyName: string;
            classInfo: any;
            objects: any[];
            updateObject: (propertyValues: any) => void;
            unitPropertyName?: string;
            readOnly?: boolean | undefined;
            scrub?: boolean | undefined;
        },
        { scrubbing: boolean }
    > {
        state = { scrubbing: false };

        onScrubStart = (event: React.MouseEvent) => {
            if (event.button !== 0) {
                return;
            }
            event.preventDefault();

            const object = this.props.objects[0];
            const startValue = Number(object[this.props.propertyName]) || 0;
            const startX = event.clientX;
            const propertyName = this.props.propertyName;
            const updateObject = this.props.updateObject;

            // all updates during one drag gesture merge into a single
            // undo step
            const undoManager = getProjectStore(object).undoManager;
            undoManager.setCombineCommands(true);

            this.setState({ scrubbing: true });

            const onMouseMove = (e: MouseEvent) => {
                const value = Math.round(startValue + (e.clientX - startX));
                updateObject({ [propertyName]: value });
            };
            const onMouseUp = () => {
                window.removeEventListener("mousemove", onMouseMove);
                window.removeEventListener("mouseup", onMouseUp);
                undoManager.setCombineCommands(false);
                this.setState({ scrubbing: false });
            };

            window.addEventListener("mousemove", onMouseMove);
            window.addEventListener("mouseup", onMouseUp);
        };

        render() {
            const readOnly = this.props.readOnly;
            const scrub = this.props.scrub && !readOnly;

            return (
                <div
                    className={classNames("EezStudio_LVGLGeometryField", {
                        EezStudio_LVGLGeometryField_Scrubbing:
                            this.state.scrubbing
                    })}
                >
                    <div
                        className="EezStudio_LVGLGeometryField_Label"
                        title={this.props.title}
                        style={scrub ? undefined : { cursor: "default" }}
                        onMouseDown={
                            scrub
                                ? event => this.onScrubStart(event)
                                : undefined
                        }
                    >
                        {this.props.label}
                    </div>
                    <Property
                        propertyInfo={
                            findPropertyByNameInClassInfo(
                                this.props.classInfo,
                                this.props.propertyName
                            )!
                        }
                        objects={this.props.objects}
                        readOnly={!!readOnly}
                        updateObject={this.props.updateObject}
                    />
                    {this.props.unitPropertyName && (
                        <Property
                            propertyInfo={
                                findPropertyByNameInClassInfo(
                                    this.props.classInfo,
                                    this.props.unitPropertyName
                                )!
                            }
                            objects={this.props.objects}
                            readOnly={!!this.props.readOnly}
                            updateObject={this.props.updateObject}
                        />
                    )}
                </div>
            );
        }
    }
);
