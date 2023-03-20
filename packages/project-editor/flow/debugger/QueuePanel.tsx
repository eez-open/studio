import React from "react";
import { observer } from "mobx-react";
import { ITreeNode, Tree } from "eez-studio-ui/tree";
import { Panel } from "project-editor/ui-components/Panel";
import { action, computed, makeObservable } from "mobx";
import { QueueTask, RuntimeBase } from "project-editor/flow/runtime/runtime";
import { IconAction } from "eez-studio-ui/action";
import { DebugInfoRuntime } from "project-editor/flow//runtime/debug-info-runtime";
import { getQueueTaskLabel } from "project-editor/flow/debugger/logs";

////////////////////////////////////////////////////////////////////////////////

export const QueuePanel = observer(
    class QueuePanel extends React.Component<{
        runtime: RuntimeBase;
    }> {
        render() {
            const memTotal = this.props.runtime.totalMemory;
            const memAlloc = memTotal - this.props.runtime.freeMemory;
            return (
                <div className="EezStudio_DebuggerPanel">
                    <Panel
                        id="project-editor/debugger/queue"
                        title={
                            this.props.runtime.totalMemory != 0
                                ? `Memory usage: ${memAlloc} of ${memTotal} (${Math.round(
                                      (memAlloc * 100) / memTotal
                                  )}%)`
                                : ""
                        }
                        buttons={
                            this.props.runtime instanceof DebugInfoRuntime
                                ? []
                                : [
                                      <IconAction
                                          key="resume"
                                          icon={
                                              <svg viewBox="0 0 500 607.333984375">
                                                  <path d="M486 278.667c9.333 6.667 14 15.333 14 26 0 9.333-4.667 17.333-14 24l-428 266c-16 10.667-29.667 12.667-41 6-11.333-6.667-17-20-17-40v-514c0-20 5.667-33.333 17-40C28.333 0 42 2 58 12.667l428 266" />
                                              </svg>
                                          }
                                          iconSize={16}
                                          title="Resume (F5)"
                                          onClick={() =>
                                              this.props.runtime.resume()
                                          }
                                          enabled={
                                              !this.props.runtime.isStopped &&
                                              this.props.runtime.isPaused
                                          }
                                      />,
                                      <IconAction
                                          key="pause"
                                          icon={
                                              <svg viewBox="0 0 530 700">
                                                  <path d="M440 0c60 0 90 21.333 90 64v570c0 44-30 66-90 66s-90-22-90-66V64c0-42.667 30-64 90-64M90 0c60 0 90 21.333 90 64v570c0 44-30 66-90 66S0 678 0 634V64C0 21.333 30 0 90 0" />
                                              </svg>
                                          }
                                          iconSize={16}
                                          title="Pause (F6)"
                                          onClick={() =>
                                              this.props.runtime.pause()
                                          }
                                          enabled={
                                              !this.props.runtime.isStopped &&
                                              !this.props.runtime.isPaused
                                          }
                                      />,
                                      <IconAction
                                          key="step-over"
                                          icon={
                                              <svg viewBox="0 0 43 38">
                                                  <path d="M10 0h1v5h-1a5 5 0 0 0-5 5v14a5 5 0 0 0 5 5h1v-4l6.75 6.5L11 38v-4h-1C4.477 34 0 29.523 0 24V10C0 4.477 4.477 0 10 0zm7 5h26v5H17V5zm3 8h23v5H20v-5zm-3 8h26v5H17v-5z" />
                                              </svg>
                                          }
                                          iconSize={18}
                                          style={{ marginTop: 4 }}
                                          title="Step over (F10)"
                                          onClick={() => {
                                              this.props.runtime.runSingleStep(
                                                  "step-over"
                                              );
                                          }}
                                          enabled={
                                              !this.props.runtime.isStopped &&
                                              this.props.runtime.isPaused &&
                                              this.props.runtime.queue.length >
                                                  0
                                          }
                                      />,
                                      <IconAction
                                          key="step-into"
                                          icon={
                                              <svg viewBox="0 0 43 29">
                                                  <path d="M17 0h26v5H17V0zm3 8h23v5H20V8zm0 8h23v5H20v-5zm-3 8h26v5H17v-5zM5 12a4 4 0 0 0 4 4h2v-4l6.75 6.5L11 25v-4H9a9 9 0 0 1-9-9V9a9 9 0 0 1 9-9h2v5H9a4 4 0 0 0-4 4v3z" />
                                              </svg>
                                          }
                                          iconSize={18}
                                          style={{ marginTop: 4 }}
                                          title="Step into (F11)"
                                          onClick={() => {
                                              this.props.runtime.runSingleStep(
                                                  "step-into"
                                              );
                                          }}
                                          enabled={
                                              !this.props.runtime.isStopped &&
                                              this.props.runtime.isPaused &&
                                              this.props.runtime.queue.length >
                                                  0
                                          }
                                      />,
                                      <IconAction
                                          key="step-out"
                                          icon={
                                              <svg viewBox="0 0 45 30">
                                                  <path d="M19 9h26v5H19V9zm3 8h23v5H22v-5zm-3 8h26v5H19v-5zM9 22A9 9 0 1 1 9 4h3V0l6.75 6.5L12 13V9H9a4 4 0 0 0 0 8h7v5H9z" />
                                              </svg>
                                          }
                                          iconSize={18}
                                          style={{ marginTop: 4 }}
                                          title="Step out (Shift + F11)"
                                          onClick={() => {
                                              this.props.runtime.runSingleStep(
                                                  "step-out"
                                              );
                                          }}
                                          enabled={
                                              !this.props.runtime.isStopped &&
                                              this.props.runtime.isPaused &&
                                              this.props.runtime.queue.length >
                                                  0
                                          }
                                      />
                                  ]
                        }
                        body={<QueueList runtime={this.props.runtime} />}
                    />
                </div>
            );
        }
    }
);

const QueueList = observer(
    class QueueList extends React.Component<{ runtime: RuntimeBase }> {
        constructor(props: { runtime: RuntimeBase }) {
            super(props);

            makeObservable(this, {
                rootNode: computed,
                selectNode: action.bound
            });
        }

        get rootNode(): ITreeNode<QueueTask> {
            function getChildren(
                queueTasks: QueueTask[]
            ): ITreeNode<QueueTask>[] {
                return queueTasks.map(queueTask => ({
                    id: queueTask.id.toString(),
                    label: <div>{getQueueTaskLabel(queueTask)}</div>,
                    children: [],
                    selected: queueTask == selectedQueueTask,
                    expanded: false,
                    data: queueTask
                }));
            }

            const selectedQueueTask = this.props.runtime.selectedQueueTask;

            return {
                id: "root",
                label: "",
                children: getChildren(this.props.runtime.queue),
                selected: false,
                expanded: true
            };
        }

        selectNode(node?: ITreeNode<QueueTask>) {
            const queueTask = node && node.data;
            if (queueTask) {
                this.props.runtime.selectQueueTask(queueTask);
            }
        }

        render() {
            return (
                <Tree
                    showOnlyChildren={true}
                    rootNode={this.rootNode}
                    selectNode={this.selectNode}
                />
            );
        }
    }
);
