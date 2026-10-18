import React from "react";

import { PropertyProps } from "project-editor/core/object";
import { ProjectContext } from "project-editor/project/context";
import { ScrubLabel } from "project-editor/ui-components/numeric-input";

import { getObjectPropertyValue } from "./utils";

////////////////////////////////////////////////////////////////////////////////

// Label of a number property, dragging it changes the value.
export class PropertyScrubLabel extends React.Component<
    PropertyProps & {
        className?: string;
        title?: string;
        children?: React.ReactNode;
    }
> {
    static contextType = ProjectContext;
    declare context: React.ContextType<typeof ProjectContext>;

    getValue = () => {
        const value = getObjectPropertyValue(
            this.props.objects[0],
            this.props.propertyInfo
        );
        return typeof value == "number" ? value : undefined;
    };

    setValue = (value: number) => {
        this.props.updateObject({ [this.props.propertyInfo.name]: value });
    };

    render() {
        return (
            <ScrubLabel
                getValue={this.getValue}
                setValue={this.setValue}
                onStart={() => this.context.undoManager.setCombineCommands(true)}
                onEnd={() => this.context.undoManager.setCombineCommands(false)}
                readOnly={this.props.readOnly}
                className={this.props.className}
                title={this.props.title}
            >
                {this.props.children}
            </ScrubLabel>
        );
    }
}
