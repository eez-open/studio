import { ipcRenderer } from "electron";
import { autorun } from "mobx";

import { Message, ProjectStore, Section } from "project-editor/store";

import { initProjectEditor } from "project-editor/project-editor-bootstrap";

export async function buildProject(filePath: string) {
    ipcRenderer.send("on-build-project-message", "Build project: " + filePath);

    try {
        await initProjectEditor(undefined, undefined as any);

        const projectStore = ProjectStore.create({
            type: "read-only"
        });

        await projectStore.openFile(filePath);

        // dump build messages
        const messages =
            projectStore.outputSectionsStore.sections[Section.OUTPUT].messages;
        let lastMessageIndexDumped = -1;
        autorun(() => {
            let messageIndex = 0;
            function dumpMessages(messages: Message[], indent: string) {
                for (let i = 0; i < messages.length; i++, messageIndex++) {
                    const message = messages[i];
                    if (messageIndex > lastMessageIndexDumped) {
                        lastMessageIndexDumped = messageIndex;

                        ipcRenderer.send(
                            "on-build-project-message",
                            indent + message.text
                        );
                    }
                    if (message.messages) {
                        dumpMessages(message.messages, indent + "\t");
                    }
                }
            }
            dumpMessages(messages.messages, "");
        });

        await projectStore.build();
    } catch (err) {
        ipcRenderer.send(
            "on-build-project-message",
            "Unhandled error: " + err.toString()
        );
    }

    ipcRenderer.send("on-build-project-message", undefined);
}
