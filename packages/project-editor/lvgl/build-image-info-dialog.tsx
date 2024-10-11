import os from "os";
import React from "react";
import { observer } from "mobx-react";

import { Dialog, showDialog } from "eez-studio-ui/dialog";
import { makeObservable } from "mobx";

export function showBuildImageInfoDialog() {
    showDialog(<BuildImageInfoDialog />);
}

const BuildImageInfoDialog = observer(
    class NewLVGLActionDialog extends React.Component {
        constructor(props: any) {
            super(props);

            makeObservable(this, {});
        }

        get isWindows() {
            return os.platform() == "win32";
        }

        get isLinux() {
            return os.platform() == "linux";
        }

        get isMac() {
            return os.platform() == "darwin";
        }

        get pyhonInstallationInfo() {
            if (this.isWindows) {
                return (
                    <li>
                        <p>
                            <b>Python 3</b> is installed on your system
                        </p>
                        <p>
                            You can install it from:{" "}
                            <a
                                href="#"
                                onClick={event => {
                                    event.preventDefault();
                                    openLink(
                                        "https://www.python.org/downloads/"
                                    );
                                }}
                            >
                                https://www.python.org/downloads/
                            </a>
                            .
                        </p>
                    </li>
                );
            }

            return (
                <li>
                    <p>
                        <b>Python 3</b> is installed on your system
                    </p>
                </li>
            );
        }

        get pythonModulesInfo() {
            if (this.isWindows) {
                return (
                    <li>
                        <p>
                            Install <b>pypng</b> and <b>lz4</b> Python modules:
                        </p>
                        <pre>python -m pip install pypng==0.20220715.0</pre>
                        <pre>python -m pip install lz4</pre>
                        <p>
                            To install <b>lz4</b> module you will also need{" "}
                            <a
                                href="#"
                                onClick={event => {
                                    event.preventDefault();
                                    openLink(
                                        "https://visualstudio.microsoft.com/visual-cpp-build-tools/"
                                    );
                                }}
                            >
                                Microsoft Visual C++ Build Tools
                            </a>
                            .
                        </p>
                    </li>
                );
            }

            if (this.isLinux) {
                return (
                    <li>
                        <p>
                            Install <b>pypng</b> and <b>lz4</b> Python modules:
                        </p>
                        <pre>python3 -m pip install pypng==0.20220715.0</pre>
                        <pre>python3 -m pip install lz4</pre>
                    </li>
                );
            }

            return (
                <li>
                    <p>
                        Install <b>pypng</b> and <b>lz4</b> Python modules:
                    </p>
                    <pre>python3 -m pip install pypng==0.20220715.0</pre>
                    <pre>python3 -m pip install lz4</pre>
                    <p>
                        <a
                            href="#"
                            onClick={event => {
                                event.preventDefault();
                                openLink(
                                    "https://github.com/eez-open/studio/issues/346"
                                );
                            }}
                        >
                            Check this
                        </a>{" "}
                        if Studio has trouble finding these modules.
                    </p>
                </li>
            );
        }

        get pngquantInfo() {
            if (this.isWindows) {
                return (
                    <li>
                        <p>
                            Install <b>pngquant</b> tool:
                        </p>
                        <p>
                            Download from{" "}
                            <a
                                href="#"
                                onClick={event => {
                                    event.preventDefault();
                                    openLink("https://pngquant.org");
                                }}
                            >
                                https://pngquant.org
                            </a>
                            , put it in your PATH and restart Studio.
                        </p>
                    </li>
                );
            }

            if (this.isLinux) {
                return (
                    <li>
                        <p>
                            Install <b>pngquant</b> tool:
                        </p>
                        <pre>sudo apt install pngquant</pre>
                    </li>
                );
            }

            if (this.isMac) {
                return (
                    <li>
                        <p>
                            Install <b>pngquant</b> tool:
                        </p>
                        <pre>brew install pngquant</pre>
                    </li>
                );
            }

            return null;
        }

        render() {
            return (
                <Dialog
                    modal={true}
                    size="large"
                    title={
                        "An error occured while building images for the LVGL 9.x!"
                    }
                    cancelButtonText="Close"
                    className="EezStudio_LVGLBuildImageInfoDialog"
                >
                    <p>
                        To convert images to C source files, EEZ Studio is using{" "}
                        <a
                            href="#"
                            onClick={event => {
                                event.preventDefault();
                                openLink(
                                    "https://github.com/lvgl/lvgl/blob/master/scripts/LVGLImage.py"
                                );
                            }}
                        >
                            LVGLImage.py
                        </a>{" "}
                        script provided by the LVGL team.
                    </p>

                    <p>
                        To be able to execute this script the following
                        requirements must be fulfilled:
                    </p>

                    <ol>
                        {this.pyhonInstallationInfo}
                        {this.pythonModulesInfo}
                        {this.pngquantInfo}
                    </ol>

                    <div className="EezStudio_LVGLBuildImageInfo"></div>
                </Dialog>
            );
        }
    }
);

function openLink(url: string) {
    const { shell } = require("electron");
    shell.openExternal(url);
}
