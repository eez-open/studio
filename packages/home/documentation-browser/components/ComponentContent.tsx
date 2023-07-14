import React from "react";
import { observer } from "mobx-react";
import classNames from "classnames";
import { ComponentInfo } from "../component-info";
import { ComponentHelp } from "./ComponentHelp";

export const ComponentContent = observer(
    class Content extends React.Component<{
        componentInfo: ComponentInfo;
        generateHTML: boolean;
    }> {
        render() {
            const { componentInfo } = this.props;

            return (
                <div
                    className={classNames(
                        "EezStudio_DocumentationBrowser_Content_Help",
                        {
                            generateHTML: this.props.generateHTML
                        }
                    )}
                >
                    <ComponentHelp
                        componentInfo={componentInfo}
                        generateHTML={this.props.generateHTML}
                    />
                </div>
            );
        }
    }
);
