import path from "path";
import React from "react";
import {
    autorun,
    makeObservable,
    observable,
    runInAction,
    IReactionDisposer
} from "mobx";
import { observer } from "mobx-react";

import { ProjectContext } from "project-editor/project/context";
import { EditorComponent } from "project-editor/project/ui/EditorComponent";
import { IPanel } from "project-editor/store";
import { readTextFile } from "eez-studio-shared/util-electron";

export const ReadmeEditor = observer(
    class ReadmeEditor extends EditorComponent implements IPanel {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        divRef = React.createRef<HTMLDivElement>();

        dispose: IReactionDisposer | undefined;

        text: string | undefined;

        constructor(props: any) {
            super(props);

            makeObservable(this, {
                text: observable
            });
        }

        componentDidMount() {
            if (this.divRef.current) {
                this.divRef.current.focus();
            }

            this.dispose = autorun(() => {
                this.context.project.readme?.readmeFile;
                this.loadText();
            });

            this.context.navigationStore.mountPanel(this);
        }

        componentDidUpdate() {
            if (this.divRef.current) {
                $(this.divRef.current).find("a").on("click", this.onClick);

                // fix image paths
                let readmeFile = this.context.project.readme.readmeFile;
                if (readmeFile) {
                    const imageSrcPrefix =
                        "file://" +
                        path.dirname(
                            this.context.getAbsoluteFilePath(readmeFile)
                        );

                    $.each($(this.divRef.current).find("img"), function () {
                        let src = $(this).attr("src");
                        if (
                            typeof src == "string" &&
                            !src.startsWith("http://") &&
                            !src.startsWith("https://")
                        ) {
                            src = imageSrcPrefix + "/" + src;
                            $(this).attr("src", src);
                        }
                    });
                }
            }
        }

        componentWillUnmount() {
            if (this.divRef.current) {
                $(this.divRef.current).find("a").off("click", this.onClick);
            }

            this.context.navigationStore.unmountPanel(this);

            if (this.dispose) {
                this.dispose();
            }
        }

        onClick = (event: JQuery.ClickEvent<HTMLAnchorElement>) => {
            event.preventDefault();
            event.stopPropagation();
            openLink(event.target.href);
        };

        async loadText() {
            let text: string | undefined;

            if (this.context.project.readme?.readmeFile) {
                try {
                    text = await readTextFile(
                        this.context.getAbsoluteFilePath(
                            this.context.project.readme.readmeFile
                        )
                    );
                } catch (err) {
                    console.error(err);
                }
            }

            runInAction(() => {
                this.text = text;
            });
        }

        // interface IPanel implementation
        get selectedObject() {
            return this.context.project.readme;
        }
        onFocus = () => {
            this.context.navigationStore.setSelectedPanel(this);
        };

        render() {
            let html;

            let style: React.CSSProperties = {
                padding: 10
            };

            if (this.context.project.readme.readmeFile && this.text) {
                const showdown = require("showdown");
                const converter = new showdown.Converter();
                html = { __html: converter.makeHtml(this.text || "") };
            } else {
                html = { __html: "" };
                style.height = "100%";
            }

            return (
                <div
                    ref={this.divRef}
                    className="EeezStudio_Readme_Container"
                    onFocus={this.onFocus}
                    tabIndex={0}
                    dangerouslySetInnerHTML={html}
                    style={style}
                />
            );
        }
    }
);

function openLink(url: string) {
    const { shell } = require("electron");
    shell.openExternal(url);
}
