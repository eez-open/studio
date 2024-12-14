import React from "react";
import {
    computed,
    action,
    makeObservable,
    observable,
    runInAction
} from "mobx";
import { observer } from "mobx-react";
import classNames from "classnames";

import { Toolbar } from "eez-studio-ui/toolbar";
import { IconAction } from "eez-studio-ui/action";
import { Draggable } from "eez-studio-ui/draggable";

import {
    IEezObject,
    PropertyInfo,
    PropertyProps,
    getParent,
    getId,
    isPropertyReadOnly,
    getObjectPropertyDisplayName,
    EezObject,
    PropertyType
} from "project-editor/core/object";
import {
    isValue,
    getClassInfo,
    addItem,
    deleteObject,
    insertObjectAfter,
    insertObjectBefore,
    createObject,
    getListLabel
} from "project-editor/store";

import { ProjectContext } from "project-editor/project/context";

import {
    getFormText,
    isArrayElementPropertyVisible,
    isHighlightedProperty,
    isPropertyInError
} from "./utils";
import { PropertyName } from "./PropertyName";
import { Property } from "./Property";
import { closestByClass } from "eez-studio-shared/dom";
import { Point, pointDistance } from "eez-studio-shared/geometry";

////////////////////////////////////////////////////////////////////////////////

export const ArrayProperty = observer(
    class ArrayProperty extends React.Component<PropertyProps> {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        collapsed = new Set<IEezObject>();

        constructor(props: PropertyProps) {
            super(props);

            makeObservable(this, {
                collapsed: observable,
                value: computed,
                objects: computed
            });
        }

        get value() {
            return (this.props.objects[0] as any)[
                this.props.propertyInfo.name
            ] as EezObject[] | undefined;
        }

        get objects(): EezObject[] {
            return this.value ?? [];
        }

        onAdd = (event: any) => {
            event.preventDefault();

            this.context.undoManager.setCombineCommands(true);

            let value = this.value;
            if (value === undefined) {
                this.context.updateObject(this.props.objects[0], {
                    [this.props.propertyInfo.name]: []
                });

                value = (this.props.objects[0] as any)[
                    this.props.propertyInfo.name
                ] as EezObject[];
            }

            const typeClass = this.props.propertyInfo.typeClass!;

            if (typeClass.classInfo.newItem) {
                addItem(value);
            } else {
                if (!typeClass.classInfo.defaultValue) {
                    console.error(
                        `Class "${typeClass.name}" is missing defaultValue`
                    );
                } else {
                    const object = createObject(
                        this.context,
                        typeClass.classInfo.defaultValue,
                        typeClass
                    );

                    this.context.addObject(value, object);

                    this.context.undoManager.setCombineCommands(false);
                }
            }
        };

        moveItem = action((currentIndex: number, newIndex: number) => {
            const overObject = this.objects[newIndex];
            const activeObject = this.objects[currentIndex];

            this.context.undoManager.setCombineCommands(true);

            deleteObject(activeObject);

            if (newIndex < currentIndex) {
                insertObjectBefore(overObject, activeObject);
            } else {
                insertObjectAfter(overObject, activeObject);
            }

            this.context.undoManager.setCombineCommands(false);
        });

        get allCollapsed() {
            return this.collapsed.size == this.objects.length;
        }

        collapseAll = action((event: any) => {
            event.preventDefault();

            if (this.collapsed.size == this.objects.length) {
                this.collapsed.clear();
            } else {
                this.objects.forEach(object => this.collapsed.add(object));
            }
        });

        render() {
            const buttons = [];

            if (this.objects.length > 0) {
                buttons.push(
                    <IconAction
                        key="collapse"
                        icon={
                            this.allCollapsed ? (
                                <svg viewBox="0 0 16 16">
                                    <path d="M9.00024 9H4.00024V10H9.00024V9Z" />
                                    <path d="M7.00024 12L7.00024 7L6.00024 7L6.00024 12L7.00024 12Z" />
                                    <path
                                        fillRule="evenodd"
                                        clipRule="evenodd"
                                        d="M5.00024 3L6.00024 2H13.0002L14.0002 3V10L13.0002 11H11.0002V13L10.0002 14H3.00024L2.00024 13V6L3.00024 5H5.00024V3ZM6.00024 5H10.0002L11.0002 6V10H13.0002V3H6.00024V5ZM10.0002 6H3.00024V13H10.0002V6Z"
                                    />
                                </svg>
                            ) : (
                                <svg viewBox="0 0 16 16">
                                    <path d="M9 9H4v1h5z" />
                                    <path
                                        fillRule="evenodd"
                                        clipRule="evenodd"
                                        d="m5 3 1-1h7l1 1v7l-1 1h-2v2l-1 1H3l-1-1V6l1-1h2zm1 2h4l1 1v4h2V3H6zm4 1H3v7h7z"
                                    />
                                </svg>
                            )
                        }
                        iconSize={17}
                        onClick={this.collapseAll}
                        title={
                            this.allCollapsed
                                ? "Expand All Items"
                                : "Collapse All Items"
                        }
                    />
                );
            }

            if (this.objects.length == 0) {
                buttons.push(
                    <IconAction
                        key="add"
                        icon="material:add"
                        iconSize={18}
                        onClick={this.onAdd}
                        title="Add item"
                    />
                );
            }

            if (this.props.propertyInfo.arrayPropertyEditorAdditionalButtons) {
                buttons.push(
                    ...this.props.propertyInfo.arrayPropertyEditorAdditionalButtons(
                        this.props.objects[0],
                        this.props.propertyInfo,
                        this.context
                    )
                );
            }

            const toolbar = (
                <div className="d-flex justify-content-between EezStudio_ArrayPropertyToolbar">
                    <PropertyName {...this.props} />
                    <Toolbar>{buttons}</Toolbar>
                </div>
            );

            let content;
            if (this.objects.length > 0) {
                content = (
                    <ArrayPropertyContent
                        objects={this.objects}
                        moveItem={this.moveItem}
                        readOnly={this.props.readOnly}
                        propertyInfo={this.props.propertyInfo}
                        collapsed={this.collapsed}
                    />
                );
            }

            const formText = getFormText(this.props);

            return (
                <>
                    <div className="EezStudio_ArrayProperty">
                        {toolbar}
                        {content}
                    </div>
                    {formText && <div className="form-text">{formText}</div>}
                </>
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

const ArrayPropertyContent = observer(
    class ArrayPropertyContent extends React.Component<{
        objects: EezObject[];
        moveItem: (currentIndex: number, newIndex: number) => void;
        readOnly: boolean;
        propertyInfo: PropertyInfo;
        collapsed: Set<IEezObject>;
    }> {
        render() {
            return (
                <div className="EezStudio_ArrayPropertyContent">
                    {this.props.objects.map((object, itemIndex) => (
                        <ArrayElementProperties
                            key={getId(object)}
                            itemIndex={itemIndex}
                            object={object}
                            readOnly={this.props.readOnly}
                            moveItem={this.props.moveItem}
                            propertyInfo={this.props.propertyInfo}
                            collapsed={this.props.collapsed}
                        />
                    ))}
                </div>
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

class ArrayPropertyItemDraggable {
    static MIN_DISTANCE = 10;
    static MIN_TIME = 300;
    static PICKED_UP_SCALE = 1.05;

    draggable = new Draggable(this);

    currentItemIndex: number;
    itemElement: HTMLDivElement | null;

    cloneElement: HTMLDivElement;

    allItemElements: HTMLDivElement[];
    itemRects: DOMRect[];

    testDraggingTimeout: any;

    dragging: boolean;
    startTime: number;
    startPoint: Point;

    newItemIndex: number;

    constructor(
        public itemClassName: string,
        public moveItem: (currentIndex: number, newIndex: number) => void
    ) {}

    attach(element: HTMLElement | null) {
        this.draggable.attach(element);
    }

    showMoveItem() {
        if (this.currentItemIndex < this.newItemIndex) {
            for (
                let itemIndex = 0;
                itemIndex < this.allItemElements.length;
                itemIndex++
            ) {
                if (itemIndex == this.currentItemIndex) {
                    let height = 0;
                    for (
                        let itemIndex = this.currentItemIndex + 1;
                        itemIndex <= this.newItemIndex;
                        itemIndex++
                    ) {
                        height += this.itemRects[itemIndex].height;
                    }

                    this.allItemElements[
                        itemIndex
                    ].style.transform = `translate(0px, ${height}px)`;
                } else if (
                    itemIndex > this.currentItemIndex &&
                    itemIndex <= this.newItemIndex
                ) {
                    this.allItemElements[
                        itemIndex
                    ].style.transform = `translate(0px, ${-this.itemRects[
                        this.currentItemIndex
                    ].height}px)`;
                } else {
                    this.allItemElements[itemIndex].style.transform = ``;
                }
            }
        } else {
            for (
                let itemIndex = 0;
                itemIndex < this.allItemElements.length;
                itemIndex++
            ) {
                if (
                    itemIndex >= this.newItemIndex &&
                    itemIndex < this.currentItemIndex
                ) {
                    this.allItemElements[
                        itemIndex
                    ].style.transform = `translate(0px, ${
                        this.itemRects[this.currentItemIndex].height
                    }px)`;
                } else if (itemIndex == this.currentItemIndex) {
                    let height = 0;
                    for (
                        let itemIndex = this.newItemIndex;
                        itemIndex < this.currentItemIndex;
                        itemIndex++
                    ) {
                        height += this.itemRects[itemIndex].height;
                    }

                    this.allItemElements[
                        itemIndex
                    ].style.transform = `translate(0px, ${-height}px)`;
                } else {
                    this.allItemElements[itemIndex].style.transform = ``;
                }
            }
        }
    }

    startDragging() {
        if (!this.itemElement) {
            return;
        }

        this.dragging = true;

        this.allItemElements.forEach(
            itemElement => (itemElement.style.transition = "transform 0.2s")
        );

        this.itemRects = this.allItemElements.map(itemElement => {
            return itemElement.getBoundingClientRect();
        });

        this.itemRects.forEach(rect => (rect.height += 10)); // add margin of 10px

        this.cloneElement = this.itemElement.cloneNode(true) as HTMLDivElement;

        // cloneNode doesn't clone select values
        const itemSelectElements = this.itemElement.querySelectorAll("select");
        const cloneSelectElements =
            this.cloneElement.querySelectorAll("select");
        if (
            itemSelectElements &&
            cloneSelectElements &&
            itemSelectElements.length == cloneSelectElements.length
        ) {
            itemSelectElements.forEach((selectElement, selectElementIndex) => {
                cloneSelectElements[selectElementIndex].value =
                    selectElement.value;
            });
        }

        //
        const r1 = this.itemRects[0];
        const r2 = this.itemRects[this.currentItemIndex];

        this.cloneElement.style.position = "absolute";
        this.cloneElement.style.transition = "transform 0s";
        this.cloneElement.style.left = r2.left - r1.left + "px";
        this.cloneElement.style.top = r2.top - r1.top + "px";
        this.cloneElement.style.width = r2.width + "px";
        this.cloneElement.style.height = r2.height + "px";
        this.cloneElement.style.boxShadow =
            "0 0 0 1px rgba(63, 63, 68, 0.05), -1px 0 15px 0 rgba(34, 33, 81, 0.01), 0px 15px 15px 0 rgba(34, 33, 81, 0.25)";
        this.cloneElement.style.margin = "0";

        this.cloneElement.style.transform = `translate(0px, 0px) scale(${ArrayPropertyItemDraggable.PICKED_UP_SCALE})`;

        this.cloneElement.style.backgroundColor = "var(--bs-body-bg)";

        this.itemElement.style.opacity = "0.5";
        this.itemElement.parentElement!.appendChild(this.cloneElement);
    }

    onDragStart(event: PointerEvent) {
        this.itemElement = closestByClass(event.target, this.itemClassName);
        if (!this.itemElement) {
            return;
        }

        const itemElements = this.itemElement.parentElement?.querySelectorAll(
            "." + this.itemClassName
        );
        if (!itemElements) {
            return;
        }
        this.allItemElements = [];
        itemElements.forEach(element =>
            this.allItemElements.push(element as HTMLDivElement)
        );

        const itemIndexStr = this.itemElement.getAttribute("data-item-index");
        if (itemIndexStr == null) {
            return;
        }
        this.currentItemIndex = Number.parseInt(itemIndexStr);
        this.newItemIndex = this.currentItemIndex;

        this.dragging = false;
        this.startPoint = {
            x: event.clientX,
            y: event.clientY
        };
        this.startTime = Date.now();

        this.testDraggingTimeout = setTimeout(() => {
            this.testDraggingTimeout = undefined;
            this.startDragging();
        }, ArrayPropertyItemDraggable.MIN_TIME);
    }

    onDragMove = (event: PointerEvent) => {
        if (!this.itemElement) {
            return;
        }

        if (!this.dragging) {
            if (
                pointDistance(this.startPoint, {
                    x: event.clientX,
                    y: event.clientY
                }) > ArrayPropertyItemDraggable.MIN_DISTANCE
            ) {
                if (this.testDraggingTimeout) {
                    clearTimeout(this.testDraggingTimeout);
                    this.testDraggingTimeout = undefined;
                }

                this.startDragging();
            }
        }

        if (this.dragging) {
            const point = {
                x: event.clientX,
                y: event.clientY
            };

            if (this.itemElement) {
                const dx = point.x - this.startPoint.x;
                const dy = point.y - this.startPoint.y;
                this.cloneElement.style.transform = `translate(${dx}px, ${dy}px) scale(${ArrayPropertyItemDraggable.PICKED_UP_SCALE})`;
            }

            const yPoint = point.y - this.itemRects[0].top;
            let y = 0;
            let yNext = 0;

            let newItemIndex = -1;
            for (
                let itemIndex = 0;
                itemIndex < this.allItemElements.length;
                itemIndex++
            ) {
                yNext = y + this.itemRects[itemIndex].height;

                if (yPoint < yNext) {
                    newItemIndex = itemIndex;
                    break;
                }

                y = yNext;
            }

            if (newItemIndex == -1) {
                newItemIndex = this.allItemElements.length - 1;
            }

            if (newItemIndex != this.newItemIndex) {
                this.newItemIndex = newItemIndex;
                this.showMoveItem();
            }
        }
    };

    onDragEnd(event: PointerEvent) {
        if (!this.itemElement) {
            return;
        }

        if (this.dragging) {
            if (this.cloneElement) {
                const transitionDuration = 0.2;

                this.cloneElement.style.transition = `transform ${transitionDuration}s`;

                const r1 = this.itemRects[this.currentItemIndex];
                const r2 =
                    this.allItemElements[
                        this.currentItemIndex
                    ].getBoundingClientRect();

                this.cloneElement.style.transform = `translate(0px, ${
                    r2.top - r1.top
                }px) scale(1)`;

                setTimeout(() => {
                    this.cloneElement.remove();

                    setTimeout(() => {
                        this.allItemElements.forEach(itemElement => {
                            itemElement.style.transition = "";
                            itemElement.style.transform = "";
                            itemElement.style.opacity = "";
                        });
                    }, 0);

                    if (this.currentItemIndex != this.newItemIndex) {
                        this.moveItem(this.currentItemIndex, this.newItemIndex);
                    }
                }, 1000 * transitionDuration);
            }
        } else {
            if (this.testDraggingTimeout) {
                clearTimeout(this.testDraggingTimeout);
                this.testDraggingTimeout = undefined;
            }
        }
    }
}

////////////////////////////////////////////////////////////////////////////////

const ArrayElementProperties = observer(
    class ArrayElementProperties extends React.Component<{
        itemIndex: number;
        object: EezObject;
        readOnly: boolean;
        className?: string;
        moveItem: (currentIndex: number, newIndex: number) => void;
        propertyInfo: PropertyInfo;
        collapsed: Set<IEezObject>;
    }> {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        static updateStartTime = observable.box<number | undefined>(undefined);

        refHeader = React.createRef<HTMLHeadingElement>();

        draggable = new ArrayPropertyItemDraggable(
            "EezStudio_ArrayElementProperty_Item",
            this.props.moveItem
        );

        componentDidMount() {
            this.draggable.attach(this.refHeader.current!);
        }

        componentDidUpdate() {}

        componentWillUnmount() {
            this.draggable.attach(null);
        }

        get objects() {
            return getParent(this.props.object) as EezObject[];
        }

        animate<T>(
            start: (
                elements: NodeListOf<HTMLDivElement>,
                rects: DOMRect[],
                parent: HTMLDivElement
            ) => T,
            step: (params: T, t: number) => void,
            finish: (params: T) => void
        ) {
            const ANIM_DURATION = 150;

            const startTime = Date.now();

            const animate = () => {
                let t = (Date.now() - startTime) / ANIM_DURATION;
                if (t > 1.0) {
                    t = 1.0;
                }

                step(params, t);

                if (t < 1.0) {
                    window.requestAnimationFrame(animate);
                } else {
                    finish(params);
                }
            };

            const parent: HTMLDivElement = this.refHeader.current!.closest(
                ".EezStudio_ArrayPropertyContent"
            )!;

            const elements: NodeListOf<HTMLDivElement> =
                parent?.querySelectorAll(
                    ".EezStudio_ArrayElementProperty_Item"
                );

            const rects = [...elements].map(el => {
                return el.getBoundingClientRect();
            });

            const params = start(elements, rects, parent);
            animate();
        }

        animateAdd(onFinish: () => void, i: number) {
            this.animate(
                (elements, rects, parent) => {
                    const y = -rects[i].height;

                    for (let j = 0; j < i; j++) {
                        elements[j].style.position = "relative";
                        elements[j].style.zIndex =
                            j < i ? "2" : j == i ? "1" : "0";
                    }

                    return {
                        elements,
                        i,
                        y,
                        parent,
                        parentHeight: parent.clientHeight
                    };
                },
                ({ elements, i, y, parent, parentHeight }, t) => {
                    for (let j = i; j < elements.length; j++) {
                        elements[j].style.transform = `translate(0px, ${
                            (1 - t) * y
                        }px)`;
                    }
                    elements[i].style.opacity = `${t}`;
                    parent.style.height = `${parentHeight + (1 - t) * y}px`;
                },
                ({ elements, i, parent }) => {
                    for (let j = i; j < elements.length; j++) {
                        elements[j].style.transform = "";
                    }
                    elements[i].style.opacity = "";

                    for (let j = 0; j < i; j++) {
                        elements[j].style.position = "";
                        elements[j].style.zIndex = "";
                    }

                    onFinish();
                    setTimeout(() => (parent.style.height = ""));
                }
            );
        }

        onAdd = async (addBefore: boolean) => {
            const typeClass = this.props.propertyInfo.typeClass!;

            let newObject: EezObject | null;

            if (typeClass.classInfo.newItem) {
                this.context.undoManager.setCombineCommands(true);

                try {
                    newObject = await addItem(this.objects);
                } catch (err) {
                    runInAction(() =>
                        ArrayElementProperties.updateStartTime.set(undefined)
                    );
                    return;
                }

                if (!newObject) {
                    this.context.undoManager.setCombineCommands(false);

                    runInAction(() =>
                        ArrayElementProperties.updateStartTime.set(undefined)
                    );

                    return;
                }

                deleteObject(newObject);

                if (addBefore) {
                    this.context.insertObjectBefore(
                        this.props.object,
                        newObject
                    );
                } else {
                    this.context.insertObjectAfter(
                        this.props.object,
                        newObject
                    );
                }

                this.context.undoManager.setCombineCommands(false);
            } else {
                if (!typeClass.classInfo.defaultValue) {
                    console.error(
                        `Class "${typeClass.name}" is missing defaultValue`
                    );

                    runInAction(() =>
                        ArrayElementProperties.updateStartTime.set(undefined)
                    );

                    return;
                }

                this.context.undoManager.setCombineCommands(true);

                newObject = createObject(
                    this.context,
                    typeClass.classInfo.defaultValue,
                    typeClass
                );

                if (addBefore) {
                    this.context.insertObjectBefore(
                        this.props.object,
                        newObject
                    );
                } else {
                    this.context.insertObjectAfter(
                        this.props.object,
                        newObject
                    );
                }

                this.context.undoManager.setCombineCommands(false);
            }

            setTimeout(() => {
                if (newObject) {
                    this.animateAdd(() => {
                        runInAction(() =>
                            ArrayElementProperties.updateStartTime.set(
                                undefined
                            )
                        );
                    }, this.objects.indexOf(newObject));
                } else {
                    ArrayElementProperties.updateStartTime.set(undefined);
                }
            });
        };

        onAddBefore = (event: any) => {
            event.preventDefault();

            if (ArrayElementProperties.updateStartTime.get() != undefined) {
                return;
            }

            runInAction(() =>
                ArrayElementProperties.updateStartTime.set(Date.now())
            );

            this.onAdd(true);
        };

        onAddAfter = (event: any) => {
            event.preventDefault();

            if (ArrayElementProperties.updateStartTime.get() != undefined) {
                return;
            }

            runInAction(() =>
                ArrayElementProperties.updateStartTime.set(Date.now())
            );

            this.onAdd(false);
        };

        animateDelete(onFinish: () => void, i: number) {
            this.animate(
                (elements, rects, parent) => {
                    const y = -rects[i].height;

                    return {
                        elements,
                        i,
                        y,
                        parent,
                        parentHeight: parent.clientHeight
                    };
                },
                ({ elements, i, y, parent, parentHeight }, t) => {
                    for (let j = i + 1; j < elements.length; j++) {
                        elements[j].style.transform = `translate(0px, ${
                            t * y
                        }px)`;
                    }
                    elements[i].style.opacity = `${1 - t}`;
                    parent.style.height = `${parentHeight + t * y}px`;
                },
                ({ elements, i, parent }) => {
                    onFinish();

                    setTimeout(() => {
                        for (let j = i + 1; j < elements.length; j++) {
                            elements[j].style.transform = "";
                        }

                        parent.style.height = "";
                    });
                }
            );
        }

        onDelete = (event: any) => {
            event.preventDefault();

            if (ArrayElementProperties.updateStartTime.get() != undefined) {
                return;
            }

            runInAction(() =>
                ArrayElementProperties.updateStartTime.set(Date.now())
            );

            this.animateDelete(() => {
                this.context.deleteObject(this.props.object);

                runInAction(() =>
                    ArrayElementProperties.updateStartTime.set(undefined)
                );
            }, this.objects.indexOf(this.props.object));
        };

        animateMove(onFinish: () => void, i: number, fixZIndex: boolean) {
            this.animate(
                (elements, rects) => {
                    const y1 = rects[i].height;
                    const y2 = -rects[i - 1].height;

                    if (fixZIndex) {
                        elements[i - 1].style.position = "relative";
                        elements[i - 1].style.zIndex = "1";
                    }

                    return {
                        elements,
                        i,
                        y1,
                        y2
                    };
                },
                ({ elements, i, y1, y2 }, t) => {
                    elements[i - 1].style.transform = `translate(10px, ${
                        t * y1
                    }px)`;
                    elements[i].style.transform = `translate(-10px, ${
                        t * y2
                    }px)`;
                },
                ({ elements, i }) => {
                    onFinish();

                    setTimeout(() => {
                        elements[i - 1].style.position = "static";
                        elements[i - 1].style.zIndex = "";
                        elements[i - 1].style.transform = "";
                        elements[i].style.transform = "";
                    });
                }
            );
        }

        onMoveUp = action((event: any) => {
            event.preventDefault();

            if (ArrayElementProperties.updateStartTime.get() != undefined) {
                return;
            }

            const objectIndex = this.objects.indexOf(this.props.object);
            if (objectIndex > 0) {
                runInAction(() =>
                    ArrayElementProperties.updateStartTime.set(Date.now())
                );

                this.animateMove(
                    () => {
                        this.context.undoManager.setCombineCommands(true);

                        const objectBefore = this.objects[objectIndex - 1];

                        deleteObject(this.props.object);

                        insertObjectBefore(objectBefore, this.props.object);

                        this.context.undoManager.setCombineCommands(false);

                        runInAction(() =>
                            ArrayElementProperties.updateStartTime.set(
                                undefined
                            )
                        );
                    },
                    this.objects.indexOf(this.props.object),
                    false
                );
            }
        });

        onMoveDown = action((event: any) => {
            event.preventDefault();

            if (ArrayElementProperties.updateStartTime.get() != undefined) {
                return;
            }

            const objectIndex = this.objects.indexOf(this.props.object);
            if (objectIndex < this.objects.length - 1) {
                this.animateMove(
                    () => {
                        this.context.undoManager.setCombineCommands(true);

                        const objectAfter = this.objects[objectIndex + 1];

                        deleteObject(this.props.object);

                        insertObjectAfter(objectAfter, this.props.object);

                        this.context.undoManager.setCombineCommands(false);

                        runInAction(() =>
                            ArrayElementProperties.updateStartTime.set(
                                undefined
                            )
                        );
                    },
                    this.objects.indexOf(this.props.object) + 1,
                    true
                );
            }
        });

        toggleCollapse = action((event: any) => {
            event.preventDefault();

            if (this.props.collapsed.has(this.props.object)) {
                this.props.collapsed.delete(this.props.object);
            } else {
                this.props.collapsed.add(this.props.object);
            }
        });

        render() {
            const collapsed = this.props.collapsed.has(this.props.object);

            return (
                <div
                    className={"EezStudio_ArrayElementProperty_Item"}
                    data-item-index={this.props.itemIndex}
                >
                    <div className="EezStudio_ArrayElementProperty_Header">
                        <IconAction
                            icon={
                                collapsed
                                    ? "material:keyboard_arrow_right"
                                    : "material:keyboard_arrow_down"
                            }
                            iconSize={18}
                            onClick={this.toggleCollapse}
                            title="Add Item Before"
                        />

                        <div ref={this.refHeader}>
                            <div className="element-index">
                                {`#${this.props.itemIndex + 1} `}
                            </div>
                            <div className="label">
                                {getListLabel(this.props.object, collapsed)}
                            </div>
                        </div>

                        <Toolbar>
                            <IconAction
                                icon={
                                    <svg viewBox="0 0 24 24" fill="none">
                                        <path
                                            d="M3 5a1 1 0 0 0 1 1h16a1 1 0 1 0 0-2H4a1 1 0 0 0-1 1m9 15a1 1 0 0 0 1-1v-3h3a1 1 0 1 0 0-2h-3v-3a1 1 0 1 0-2 0v3H8a1 1 0 1 0 0 2h3v3a1 1 0 0 0 1 1"
                                            fill="currentColor"
                                        />
                                    </svg>
                                }
                                iconSize={18}
                                onClick={this.onAddBefore}
                                title="Add Item Before"
                                enabled={
                                    ArrayElementProperties.updateStartTime.get() ==
                                    undefined
                                }
                            />
                            <IconAction
                                icon={
                                    <svg viewBox="0 0 24 24" fill="none">
                                        <path
                                            d="M12 4a1 1 0 0 1 1 1v3h3a1 1 0 1 1 0 2h-3v3a1 1 0 1 1-2 0v-3H8a1 1 0 0 1 0-2h3V5a1 1 0 0 1 1-1M3 19a1 1 0 0 1 1-1h16a1 1 0 1 1 0 2H4a1 1 0 0 1-1-1"
                                            fill="currentColor"
                                        />
                                    </svg>
                                }
                                iconSize={18}
                                onClick={this.onAddAfter}
                                title="Add Item After"
                                enabled={
                                    ArrayElementProperties.updateStartTime.get() ==
                                    undefined
                                }
                            />

                            <IconAction
                                icon="material:delete"
                                iconSize={16}
                                onClick={this.onDelete}
                                title="Delete Item"
                                enabled={
                                    ArrayElementProperties.updateStartTime.get() ==
                                    undefined
                                }
                            />
                            <IconAction
                                icon={
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        className="icon icon-tabler icon-tabler-arrow-up"
                                        width="24"
                                        height="24"
                                        viewBox="0 0 24 24"
                                        strokeWidth="2"
                                        stroke="currentColor"
                                        fill="none"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    >
                                        <path
                                            stroke="none"
                                            d="M0 0h24v24H0z"
                                            fill="none"
                                        ></path>
                                        <line
                                            x1="12"
                                            y1="5"
                                            x2="12"
                                            y2="19"
                                        ></line>
                                        <line
                                            x1="18"
                                            y1="11"
                                            x2="12"
                                            y2="5"
                                        ></line>
                                        <line
                                            x1="6"
                                            y1="11"
                                            x2="12"
                                            y2="5"
                                        ></line>
                                    </svg>
                                }
                                iconSize={16}
                                onClick={this.onMoveUp}
                                title="Move Up"
                                enabled={
                                    ArrayElementProperties.updateStartTime.get() ==
                                        undefined &&
                                    this.objects.length > 1 &&
                                    this.objects.indexOf(this.props.object) > 0
                                }
                            />
                            <IconAction
                                icon={
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        className="icon icon-tabler icon-tabler-arrow-down"
                                        width="24"
                                        height="24"
                                        viewBox="0 0 24 24"
                                        strokeWidth="2"
                                        stroke="currentColor"
                                        fill="none"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    >
                                        <path
                                            stroke="none"
                                            d="M0 0h24v24H0z"
                                            fill="none"
                                        ></path>
                                        <line
                                            x1="12"
                                            y1="5"
                                            x2="12"
                                            y2="19"
                                        ></line>
                                        <line
                                            x1="18"
                                            y1="13"
                                            x2="12"
                                            y2="19"
                                        ></line>
                                        <line
                                            x1="6"
                                            y1="13"
                                            x2="12"
                                            y2="19"
                                        ></line>
                                    </svg>
                                }
                                iconSize={16}
                                onClick={this.onMoveDown}
                                title="Move Down"
                                enabled={
                                    ArrayElementProperties.updateStartTime.get() ==
                                        undefined &&
                                    this.objects.length > 1 &&
                                    this.objects.indexOf(this.props.object) <
                                        this.objects.length - 1
                                }
                            />
                        </Toolbar>
                    </div>
                    {!collapsed && (
                        <div className="EezStudio_ArrayElementProperty_Body">
                            {getClassInfo(this.props.object).properties.map(
                                propertyInfo => (
                                    <ArrayElementProperty
                                        key={propertyInfo.name}
                                        propertyInfo={propertyInfo}
                                        object={this.props.object}
                                        readOnly={this.props.readOnly}
                                    />
                                )
                            )}
                        </div>
                    )}
                </div>
            );
        }
    }
);

const ArrayElementProperty = observer(
    class ArrayElementProperty extends React.Component<{
        propertyInfo: PropertyInfo;
        object: IEezObject;
        readOnly: boolean;
    }> {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        updateObject = (propertyValues: Object) => {
            let object = this.props.object;
            if (object) {
                if (isValue(object)) {
                    object = getParent(object);
                }
                this.context.updateObject(object, propertyValues);
            }
        };

        render() {
            const { object, propertyInfo, readOnly } = this.props;

            const className = classNames(
                "EezStudio_ArrayElementProperty_Body_Property",
                {
                    inError: isPropertyInError(object, propertyInfo),
                    highlighted: isHighlightedProperty(object, propertyInfo)
                }
            );

            if (isArrayElementPropertyVisible(propertyInfo, object)) {
                if (
                    propertyInfo.type == PropertyType.Array &&
                    !propertyInfo.onSelect
                ) {
                    return (
                        <div className={className}>
                            <Property
                                propertyInfo={propertyInfo}
                                objects={[object]}
                                readOnly={
                                    readOnly ||
                                    isPropertyReadOnly(object, propertyInfo)
                                }
                                updateObject={this.updateObject}
                            />
                        </div>
                    );
                } else {
                    const propertyName = getObjectPropertyDisplayName(
                        object,
                        propertyInfo
                    );
                    return (
                        <div className={className}>
                            <div
                                className={propertyInfo.name}
                                title={propertyName}
                            >
                                {propertyName}
                            </div>
                            <div className={propertyInfo.name}>
                                <Property
                                    propertyInfo={propertyInfo}
                                    objects={[object]}
                                    readOnly={
                                        readOnly ||
                                        isPropertyReadOnly(object, propertyInfo)
                                    }
                                    updateObject={this.updateObject}
                                />
                            </div>
                        </div>
                    );
                }
            } else {
                return <div />;
            }
        }
    }
);
