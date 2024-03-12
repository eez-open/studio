import React from "react";
import { observer } from "mobx-react";

import { Rect } from "eez-studio-shared/geometry";

import { Draggable } from "eez-studio-ui/draggable";

import {
    WorkbenchStore,
    WorkbenchContext,
    ViewManagerModel,
    HorizontalLayoutModel,
    VerticalLayoutModel,
    TabLayoutModel,
    ViewRefModel
} from "workbench";
import { makeObservable, observable, runInAction } from "mobx";

export const WorkbenchEditor = observer(
    class WorkbenchEditor extends React.Component<{
        workbenchStore: WorkbenchStore;
    }> {
        divRef = React.createRef<HTMLDivElement>();

        draggable = new Draggable(this);

        rect: Rect | undefined;

        constructor(props: any) {
            super(props);

            makeObservable(this, {
                rect: observable
            });
        }

        requestAnimationFrameId: any;
        requestAnimationFrameCallback = () => {
            const rect = this.divRef.current?.getBoundingClientRect();
            if (
                rect &&
                (!this.rect ||
                    rect.width != this.rect.width ||
                    rect.height != this.rect.height)
            ) {
                runInAction(() => {
                    this.rect = {
                        left: 0,
                        top: 0,
                        width: rect.width,
                        height: rect.height
                    };
                });
            }

            this.requestAnimationFrameId = requestAnimationFrame(
                this.requestAnimationFrameCallback
            );
        };

        componentDidMount() {
            this.draggable.attach(this.divRef.current);

            this.requestAnimationFrameId = requestAnimationFrame(
                this.requestAnimationFrameCallback
            );
        }

        componentWillUnmount() {
            this.draggable.attach(null);
            cancelAnimationFrame(this.requestAnimationFrameId);
        }

        // interface DraggableConfig
        onDragStart(e: PointerEvent, x: number, y: number): any {
            console.log("onDragStart", x, y);
        }
        onDragMove(e: PointerEvent, x: number, y: number, params: any): void {
            console.log("onDragMove", x, y);
        }
        onDragEnd(
            e: PointerEvent | undefined,
            cancel: boolean,
            params: any
        ): void {
            console.log("onDragEnd", cancel);
        }
        onMove(e: PointerEvent): void {
            //console.log("onMove", e);
        }
        onDraggableWheel(event: WheelEvent): void {
            console.log("onDraggableWheel", event);
        }

        render() {
            return (
                <WorkbenchContext.Provider value={this.props.workbenchStore}>
                    <div
                        className="EezStudio_WorkbenchEditor"
                        ref={this.divRef}
                    >
                        {this.rect && (
                            <ViewManager
                                viewManager={
                                    this.props.workbenchStore.workbenchModel
                                        .viewManager
                                }
                                rect={this.rect}
                            />
                        )}
                    </div>
                </WorkbenchContext.Provider>
            );
        }
    }
);

export const ViewManager = observer(
    class ViewManager extends React.Component<{
        viewManager: ViewManagerModel;
        rect: Rect;
    }> {
        render() {
            return (
                <div
                    className="EezStudio_ViewManager"
                    style={{
                        left: this.props.rect.left,
                        top: this.props.rect.top,
                        width: this.props.rect.width,
                        height: this.props.rect.height
                    }}
                >
                    <HorizontalLayout
                        model={this.props.viewManager.rootLayout}
                        rect={this.props.rect}
                    ></HorizontalLayout>
                </div>
            );
        }
    }
);

export const HorizontalLayout = observer(
    class ViewManager extends React.Component<{
        model: HorizontalLayoutModel;
        rect: Rect;
    }> {
        render() {
            const childRect: Rect[] = [];

            let left = 0;

            let remainWidth = this.props.rect.width;

            for (let i = 0; i < this.props.model.children.length; i++) {
                let childWidth;
                if (i < this.props.model.children.length - 1) {
                    childWidth = Math.round(
                        (this.props.model.sizes[i] * this.props.rect.width) /
                            100
                    );
                    remainWidth -= childWidth;
                } else {
                    childWidth = remainWidth;
                }

                childRect.push({
                    left,
                    top: 0,
                    width: childWidth,
                    height: this.props.rect.height
                });

                left += childWidth;
            }

            return (
                <div
                    className="EezStudio_ViewManager_HorizontalLayout"
                    style={{
                        left: this.props.rect.left,
                        top: this.props.rect.top,
                        width: this.props.rect.width,
                        height: this.props.rect.height
                    }}
                >
                    {this.props.model.children.map((child, i) =>
                        render(child, childRect[i])
                    )}
                </div>
            );
        }
    }
);

export const VerticalLayout = observer(
    class ViewManager extends React.Component<{
        model: VerticalLayoutModel;
        rect: Rect;
    }> {
        render() {
            const childRect: Rect[] = [];

            let top = 0;

            let remainHeight = this.props.rect.height;

            for (let i = 0; i < this.props.model.children.length; i++) {
                let childHeight;
                if (i < this.props.model.children.length - 1) {
                    childHeight = Math.round(
                        (this.props.model.sizes[i] * this.props.rect.height) /
                            100
                    );
                    remainHeight -= childHeight;
                } else {
                    childHeight = remainHeight;
                }

                childRect.push({
                    left: 0,
                    top,
                    width: this.props.rect.width,
                    height: childHeight
                });

                top += childHeight;
            }

            return (
                <div
                    className="EezStudio_ViewManager_VerticalLayout"
                    style={{
                        left: this.props.rect.left,
                        top: this.props.rect.top,
                        width: this.props.rect.width,
                        height: this.props.rect.height
                    }}
                >
                    {this.props.model.children.map((child, i) =>
                        render(child, childRect[i])
                    )}
                </div>
            );
        }
    }
);

export const TabLayout = observer(
    class ViewManager extends React.Component<{
        model: TabLayoutModel;
        rect: Rect;
    }> {
        render() {
            return (
                <div
                    className="EezStudio_ViewManager_TabLayout"
                    style={{
                        left: this.props.rect.left,
                        top: this.props.rect.top,
                        width: this.props.rect.width,
                        height: this.props.rect.height
                    }}
                >
                    {this.props.model.tabs.map(child =>
                        render(child, {
                            left: 0,
                            top: 0,
                            width: this.props.rect.width,
                            height: this.props.rect.height
                        })
                    )}
                </div>
            );
        }
    }
);

export const ViewRef = observer(
    class ViewManager extends React.Component<{
        model: ViewRefModel;
        rect: Rect;
    }> {
        render() {
            return (
                <div
                    className="EezStudio_ViewManager_ViewRef"
                    style={{
                        left: this.props.rect.left,
                        top: this.props.rect.top,
                        width: this.props.rect.width,
                        height: this.props.rect.height
                    }}
                ></div>
            );
        }
    }
);

function render(
    model:
        | HorizontalLayoutModel
        | VerticalLayoutModel
        | TabLayoutModel
        | ViewRefModel,
    rect: Rect
) {
    if (model instanceof HorizontalLayoutModel) {
        return <HorizontalLayout key={model.id} model={model} rect={rect} />;
    } else if (model instanceof VerticalLayoutModel) {
        return <VerticalLayout key={model.id} model={model} rect={rect} />;
    } else if (model instanceof TabLayoutModel) {
        return <TabLayout key={model.id} model={model} rect={rect} />;
    } else {
        return <ViewRef key={model.id} model={model} rect={rect} />;
    }
}
