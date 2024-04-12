import bootstrap from "bootstrap";
import React from "react";
import {
    computed,
    observable,
    action,
    makeObservable,
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

        selectedObject: EezObject | undefined;

        constructor(props: PropertyProps) {
            super(props);

            this.selectedObject = undefined;

            makeObservable(this, {
                value: computed,
                objects: computed,
                selectedObject: observable
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

        componentDidUpdate(prevProps: Readonly<PropertyProps>) {
            runInAction(() => {
                if (prevProps.objects[0] != this.props.objects[0]) {
                    this.selectedObject =
                        this.value && this.value.length > 0
                            ? this.value[0]
                            : undefined;
                } else if (
                    this.selectedObject &&
                    this.value?.indexOf(this.selectedObject) == -1
                ) {
                    this.selectedObject = undefined;
                }
            });
        }

        selectObject = action(
            (object: EezObject, select: boolean, toggle: boolean) => {
                if (select) {
                    if (this.selectedObject != object) {
                        this.selectedObject = object;
                    } else if (toggle) {
                        this.selectedObject = undefined;
                    }
                } else {
                    if (this.selectedObject == object) {
                        this.selectedObject = undefined;
                    }
                }
            }
        );

        onAdd = async (event: any) => {
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
                const object = await addItem(value);
                if (object) {
                    runInAction(() => {
                        this.selectedObject = object;
                    });
                }
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

                    runInAction(() => {
                        this.selectedObject = object;
                    });
                }
            }
        };

        onDelete = (event: any) => {
            event.preventDefault();

            if (this.selectedObject) {
                this.context.deleteObject(this.selectedObject);
                runInAction(() => {
                    this.selectedObject = undefined;
                });
            }
        };

        onMoveUp = action((event: any) => {
            event.preventDefault();

            if (this.value && this.selectedObject) {
                const selectedObjectIndex = this.value.indexOf(
                    this.selectedObject
                );
                if (selectedObjectIndex > 0) {
                    this.context.undoManager.setCombineCommands(true);

                    const objectBefore = this.value[selectedObjectIndex - 1];

                    deleteObject(this.selectedObject);
                    this.selectedObject = insertObjectBefore(
                        objectBefore,
                        this.selectedObject
                    );

                    this.context.undoManager.setCombineCommands(false);
                }
            }
        });

        onMoveDown = action((event: any) => {
            event.preventDefault();

            if (this.value && this.selectedObject) {
                const selectedObjectIndex = this.value.indexOf(
                    this.selectedObject
                );
                if (selectedObjectIndex < this.value.length - 1) {
                    this.context.undoManager.setCombineCommands(true);

                    const objectAfter = this.value[selectedObjectIndex + 1];

                    deleteObject(this.selectedObject);
                    this.selectedObject = insertObjectAfter(
                        objectAfter,
                        this.selectedObject
                    );

                    this.context.undoManager.setCombineCommands(false);
                }
            }
        });

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

        render() {
            const { objects, propertyInfo } = this.props;

            let isVerticalOrientation =
                propertyInfo.arrayItemOrientation == "vertical" ? true : false;

            const toolbar = (
                <div className="rounded d-flex justify-content-between EezStudio_ArrayPropertyToolbar">
                    <PropertyName {...this.props} />
                    <Toolbar>
                        <IconAction
                            icon="material:add"
                            iconSize={16}
                            onClick={this.onAdd}
                            title="Add item"
                        />
                        <IconAction
                            icon="material:delete"
                            iconSize={16}
                            onClick={this.onDelete}
                            title="Delete item"
                            enabled={this.selectedObject != undefined}
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
                                    <line x1="12" y1="5" x2="12" y2="19"></line>
                                    <line x1="18" y1="11" x2="12" y2="5"></line>
                                    <line x1="6" y1="11" x2="12" y2="5"></line>
                                </svg>
                            }
                            iconSize={16}
                            onClick={this.onMoveUp}
                            title="Move up"
                            enabled={
                                this.objects.length > 1 &&
                                this.selectedObject != undefined &&
                                this.objects.indexOf(this.selectedObject) > 0
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
                                    <line x1="12" y1="5" x2="12" y2="19"></line>
                                    <line
                                        x1="18"
                                        y1="13"
                                        x2="12"
                                        y2="19"
                                    ></line>
                                    <line x1="6" y1="13" x2="12" y2="19"></line>
                                </svg>
                            }
                            iconSize={16}
                            onClick={this.onMoveDown}
                            title="Move down"
                            enabled={
                                this.objects.length > 1 &&
                                this.selectedObject != undefined &&
                                this.objects.indexOf(this.selectedObject) <
                                    this.objects.length - 1
                            }
                        />
                    </Toolbar>
                </div>
            );

            const typeClass = propertyInfo.typeClass!;

            let content;
            if (this.objects.length > 0) {
                if (isVerticalOrientation) {
                    content = (
                        <ArrayPropertyContentVerticalOrientation
                            objects={this.objects}
                            selectedObject={this.selectedObject}
                            selectObject={this.selectObject}
                            moveItem={this.moveItem}
                            readOnly={this.props.readOnly}
                        />
                    );
                } else {
                    const properties = typeClass.classInfo.properties.filter(
                        propertyInfo =>
                            isArrayElementPropertyVisible(propertyInfo)
                    );

                    content = (
                        <table>
                            <thead>
                                <tr>
                                    {properties.map(propertyInfo => (
                                        <th
                                            key={propertyInfo.name}
                                            className={propertyInfo.name}
                                            style={{
                                                width: `${
                                                    100 / properties.length
                                                }%`
                                            }}
                                        >
                                            {getObjectPropertyDisplayName(
                                                objects[0],
                                                propertyInfo
                                            )}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody style={{ position: "relative" }}>
                                {this.objects.map((object, itemIndex) => (
                                    <ArrayElementPropertiesHorizontalOrientation
                                        itemIndex={itemIndex}
                                        key={getId(object)}
                                        object={object}
                                        readOnly={this.props.readOnly}
                                        selected={object == this.selectedObject}
                                        selectObject={this.selectObject}
                                        moveItem={this.moveItem}
                                    />
                                ))}
                            </tbody>
                        </table>
                    );
                }
            }

            const formText = getFormText(this.props);

            return (
                <>
                    <div
                        className={classNames(
                            "rounded EezStudio_ArrayProperty",
                            {
                                "vertical-orientation": isVerticalOrientation
                            }
                        )}
                    >
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

const ArrayPropertyContentVerticalOrientation = observer(
    class ArrayPropertyContentVerticalOrientation extends React.Component<{
        objects: EezObject[];
        selectedObject: EezObject | undefined;
        selectObject: (
            object: EezObject,
            select: boolean,
            toggle: boolean
        ) => void;
        moveItem: (currentIndex: number, newIndex: number) => void;
        readOnly: boolean;
    }> {
        render() {
            const idAccordion =
                "accordion-" + getId(getParent(this.props.objects[0]));

            return (
                <div className="accordion accordion-flush" id={idAccordion}>
                    {this.props.objects.map((object, itemIndex) => (
                        <ArrayElementPropertiesVerticalOrientation
                            key={getId(object)}
                            itemIndex={itemIndex}
                            object={object}
                            readOnly={this.props.readOnly}
                            selected={this.props.selectedObject == object}
                            selectObject={this.props.selectObject}
                            moveItem={this.props.moveItem}
                            idAccordion={idAccordion}
                        />
                    ))}
                </div>
            );
        }
    }
);

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
        if (this.cloneElement instanceof HTMLTableRowElement) {
            this.cloneElement
                .querySelectorAll("td")
                ?.forEach(
                    (tdElement: HTMLTableCellElement) =>
                        (tdElement.style.width = 1 / 3 + "%")
                );
        }

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

        this.cloneElement.style.transform = `translate(0px, 0px) scale(${ArrayPropertyItemDraggable.PICKED_UP_SCALE})`;

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

            if (this.itemElement) {
                const collapseElement = this.itemElement.querySelector(
                    ".accordion-collapse"
                );
                if (collapseElement) {
                    const bsCollapse =
                        bootstrap.Collapse.getInstance(collapseElement);
                    if (bsCollapse) {
                        bsCollapse.toggle();
                    }
                }
            }
        }
    }
}

////////////////////////////////////////////////////////////////////////////////

const ArrayElementPropertiesVerticalOrientation = observer(
    class ArrayElementPropertiesVerticalOrientation extends React.Component<{
        itemIndex: number;
        object: IEezObject;
        readOnly: boolean;
        className?: string;
        selected: boolean;
        selectObject: (
            object: IEezObject,
            select: boolean,
            toggle: boolean
        ) => void;
        moveItem: (currentIndex: number, newIndex: number) => void;
        idAccordion: string;
    }> {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        refCollapse = React.createRef<HTMLDivElement>();
        refHeader = React.createRef<HTMLHeadingElement>();

        bsCollapse: bootstrap.Collapse;

        draggable = new ArrayPropertyItemDraggable(
            "accordion-item",
            this.props.moveItem
        );

        componentDidMount() {
            this.draggable.attach(this.refHeader.current!);

            this.bsCollapse = new bootstrap.Collapse(
                this.refCollapse.current!,
                { toggle: false }
            );
            if (this.props.selected) {
                this.bsCollapse.show();
            } else {
                this.bsCollapse.hide();
            }

            this.refCollapse.current!.addEventListener(
                "show.bs.collapse",
                this.onShow
            );
            this.refCollapse.current!.addEventListener(
                "hide.bs.collapse",
                this.onHide
            );
        }

        componentDidUpdate() {
            if (this.props.selected) {
                this.bsCollapse.show();
            } else {
                this.bsCollapse.hide();
            }
        }

        componentWillUnmount() {
            this.draggable.attach(null);

            this.refCollapse.current!.removeEventListener(
                "show.bs.collapse",
                this.onShow
            );
            this.refCollapse.current!.removeEventListener(
                "hide.bs.collapse",
                this.onHide
            );
        }

        onShow = (event: any) => {
            if (event.target == this.refCollapse.current) {
                this.props.selectObject(this.props.object, true, false);
            }
        };

        onHide = (event: any) => {
            if (event.target == this.refCollapse.current) {
                this.props.selectObject(this.props.object, false, false);
            }
        };

        render() {
            const idAccordionHeading =
                "accordion-heading-" + getId(this.props.object);
            const idAccordionCollapse =
                "accordion-collapse-" + getId(this.props.object);

            return (
                <div
                    className={classNames("element-enclosure accordion-item", {
                        open: this.props.selected
                    })}
                    data-item-index={this.props.itemIndex}
                >
                    <h2
                        ref={this.refHeader}
                        className="accordion-header"
                        id={idAccordionHeading}
                    >
                        <button
                            className={classNames("accordion-button", {
                                collapsed: !this.props.selected
                            })}
                            type="button"
                            data-bs-toggle="collapse"
                            data-bs-target={`#${idAccordionCollapse}`}
                            aria-expanded="false"
                            aria-controls={idAccordionCollapse}
                        >
                            <div className="element-index">
                                {`#${this.props.itemIndex + 1} `}
                            </div>
                            <div className="label">
                                {getListLabel(
                                    this.props.object,
                                    !this.props.selected
                                )}
                            </div>
                        </button>
                    </h2>
                    <div
                        ref={this.refCollapse}
                        id={idAccordionCollapse}
                        className="accordion-collapse collapse"
                        aria-labelledby={idAccordionHeading}
                        data-bs-parent={this.props.idAccordion}
                    >
                        <div className="accordion-body">
                            <table>
                                <tbody>
                                    {getClassInfo(
                                        this.props.object
                                    ).properties.map(propertyInfo => (
                                        <tr
                                            key={propertyInfo.name}
                                            className={classNames({
                                                inError: isPropertyInError(
                                                    this.props.object,
                                                    propertyInfo
                                                )
                                            })}
                                        >
                                            <ArrayElementPropertyVerticalOrientation
                                                propertyInfo={propertyInfo}
                                                object={this.props.object}
                                                readOnly={this.props.readOnly}
                                            />
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            );
        }
    }
);

const ArrayElementPropertyVerticalOrientation = observer(
    class ArrayElementPropertyVerticalOrientation extends React.Component<{
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

            const className = classNames(propertyInfo.name, {
                inError: isPropertyInError(object, propertyInfo),
                highlighted: isHighlightedProperty(object, propertyInfo)
            });

            if (isArrayElementPropertyVisible(propertyInfo, object)) {
                if (
                    propertyInfo.type == PropertyType.Array &&
                    !propertyInfo.onSelect
                ) {
                    return (
                        <td className={className} colSpan={2}>
                            <Property
                                propertyInfo={propertyInfo}
                                objects={[object]}
                                readOnly={
                                    readOnly ||
                                    isPropertyReadOnly(object, propertyInfo)
                                }
                                updateObject={this.updateObject}
                            />
                        </td>
                    );
                } else {
                    return (
                        <>
                            <td className={propertyInfo.name}>
                                {getObjectPropertyDisplayName(
                                    object,
                                    propertyInfo
                                )}
                            </td>
                            <td className={className}>
                                <Property
                                    propertyInfo={propertyInfo}
                                    objects={[object]}
                                    readOnly={
                                        readOnly ||
                                        isPropertyReadOnly(object, propertyInfo)
                                    }
                                    updateObject={this.updateObject}
                                />
                            </td>
                        </>
                    );
                }
            } else {
                return <td />;
            }
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

const ArrayElementPropertiesHorizontalOrientation = observer(
    class ArrayElementPropertiesHorizontalOrientation extends React.Component<{
        itemIndex: number;
        object: IEezObject;
        readOnly: boolean;
        className?: string;
        selected: boolean;
        selectObject: (
            object: IEezObject,
            select: boolean,
            toggle: boolean
        ) => void;
        moveItem: (currentIndex: number, newIndex: number) => void;
    }> {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        refRow = React.createRef<HTMLTableRowElement>();

        draggable = new ArrayPropertyItemDraggable(
            "horizontal-item",
            this.props.moveItem
        );

        componentDidMount() {
            this.draggable.attach(this.refRow.current!);
        }

        componentWillUnmount() {
            this.draggable.attach(null);
        }

        render() {
            return (
                <tr
                    ref={this.refRow}
                    className={classNames("horizontal-item", {
                        selected: this.props.selected
                    })}
                    onClick={event => {
                        if (
                            event.nativeEvent.target instanceof
                                HTMLTableCellElement ||
                            event.nativeEvent.target instanceof
                                HTMLTableRowElement
                        ) {
                            this.props.selectObject(
                                this.props.object,
                                true,
                                true
                            );
                        } else {
                            this.props.selectObject(
                                this.props.object,
                                true,
                                false
                            );
                        }
                    }}
                    data-item-index={this.props.itemIndex}
                >
                    {getClassInfo(this.props.object).properties.map(
                        propertyInfo => (
                            <ArrayElementPropertyHorizontalOrientation
                                key={propertyInfo.name}
                                propertyInfo={propertyInfo}
                                object={this.props.object}
                                readOnly={this.props.readOnly}
                            />
                        )
                    )}
                </tr>
            );
        }
    }
);

const ArrayElementPropertyHorizontalOrientation = observer(
    class ArrayElementPropertyHorizontalOrientation extends React.Component<{
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

            const className = classNames(propertyInfo.name, {
                inError: isPropertyInError(object, propertyInfo),
                highlighted: isHighlightedProperty(object, propertyInfo)
            });

            if (isArrayElementPropertyVisible(propertyInfo, object)) {
                return (
                    <td className={className}>
                        <div
                            style={{
                                display: "flex",
                                justifyContent: "center"
                            }}
                        >
                            <div
                                className="eez-flow-editor-capture-pointers"
                                style={{ width: "100%" }}
                            >
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
                    </td>
                );
            } else {
                return <td />;
            }
        }
    }
);
