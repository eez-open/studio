import { Point, Rect, pointInRect } from "eez-studio-shared/geometry";

////////////////////////////////////////////////////////////////////////////////

const SCROLL_BAR_SIZE = 10;
const SCROLL_BAR_TRACK_BACKGROUND_COLOR = "#F1F1F1";
const SCROLL_BAR_THUMB_BACKGROUND_COLOR = "#C1C1C1";

////////////////////////////////////////////////////////////////////////////////

const SCALES: number[] = [];

for (let i = 10; i <= 1500; i += 10) {
    SCALES.push(i / 100);
}

////////////////////////////////////////////////////////////////////////////////

interface ICanvasEditor {
    nonTranslatedDeviceRect: Rect;
    deviceRect: Rect;
    documentRect: Rect;

    deviceTranslate: Point;
    documentTranslate: Point;

    scale: number;

    canvas: HTMLCanvasElement;

    getDeviceTranslate(): Point;
    deviceToDocument(p: Point): Point;
    mouseToDocument(event: any): Point;
    documentToDevice(p: Point): Point;

    transform(documentTranslate: Point, scale: number): any;
}

////////////////////////////////////////////////////////////////////////////////

interface IScrollBarState {
    trackRect: Rect;
    thumbRect: Rect;
}

function drawScrollBar(ctx: CanvasRenderingContext2D, scrollBar: IScrollBarState) {
    ctx.fillStyle = SCROLL_BAR_TRACK_BACKGROUND_COLOR;
    ctx.fillRect(
        scrollBar.trackRect.left,
        scrollBar.trackRect.top,
        scrollBar.trackRect.width,
        scrollBar.trackRect.height
    );
    ctx.fillStyle = SCROLL_BAR_THUMB_BACKGROUND_COLOR;
    ctx.fillRect(
        scrollBar.thumbRect.left,
        scrollBar.thumbRect.top,
        scrollBar.thumbRect.width,
        scrollBar.thumbRect.height
    );
}

////////////////////////////////////////////////////////////////////////////////

export enum ScrollBarsHitRegion {
    OUTSIDE,
    HORIZONTAL_TRACK,
    HORIZONTAL_THUMB,
    VERTICAL_TRACK,
    VERTICAL_THUMB,
    CORNER,
    FREE
}

////////////////////////////////////////////////////////////////////////////////

export class CanvasEditorScrollBars {
    horizontal?: IScrollBarState;
    vertical?: IScrollBarState;
    cornerRect?: Rect;
    dragging?: {
        region: ScrollBarsHitRegion;
        offset: Point;
    };

    constructor(private canvasEditor: ICanvasEditor) {}

    update() {
        const isHorizontalVisible =
            Math.floor(this.canvasEditor.documentRect.width) >
            Math.ceil(this.canvasEditor.deviceRect.width);
        const isVerticalVisible =
            Math.floor(this.canvasEditor.documentRect.height) >
            Math.ceil(this.canvasEditor.deviceRect.height);

        const left = this.canvasEditor.canvas.width - SCROLL_BAR_SIZE;
        const top = this.canvasEditor.canvas.height - SCROLL_BAR_SIZE;
        let width = this.canvasEditor.canvas.width;
        let height = this.canvasEditor.canvas.height;

        if (isHorizontalVisible && isVerticalVisible) {
            // make space for the corner
            width -= SCROLL_BAR_SIZE;
            height -= SCROLL_BAR_SIZE;
            this.cornerRect = {
                left: width,
                top: height,
                width: SCROLL_BAR_SIZE,
                height: SCROLL_BAR_SIZE
            };
        } else {
            this.cornerRect = undefined;
        }

        const scroll = this.documentTranslateToScroll(this.canvasEditor.documentTranslate);

        if (isHorizontalVisible) {
            this.horizontal = {
                trackRect: {
                    left: 0,
                    top,
                    width,
                    height: SCROLL_BAR_SIZE
                },
                thumbRect: {
                    left: (scroll.x * width) / this.canvasEditor.documentRect.width,
                    top,
                    width:
                        (this.canvasEditor.deviceRect.width * width) /
                        this.canvasEditor.documentRect.width,
                    height: SCROLL_BAR_SIZE
                }
            };
        } else {
            this.horizontal = undefined;
        }

        if (isVerticalVisible) {
            this.vertical = {
                trackRect: {
                    left,
                    top: 0,
                    width: SCROLL_BAR_SIZE,
                    height
                },
                thumbRect: {
                    left,
                    top: (scroll.y * height) / this.canvasEditor.documentRect.height,
                    width: SCROLL_BAR_SIZE,
                    height:
                        (this.canvasEditor.deviceRect.height * height) /
                        this.canvasEditor.documentRect.height
                }
            };
        } else {
            this.vertical = undefined;
        }
    }

    documentTranslateToScroll(documentTranslate: Point) {
        return {
            x:
                documentTranslate.x +
                this.canvasEditor.nonTranslatedDeviceRect.left -
                this.canvasEditor.documentRect.left,
            y:
                documentTranslate.y +
                this.canvasEditor.nonTranslatedDeviceRect.top -
                this.canvasEditor.documentRect.top
        };
    }

    scrollToDocumentTranslate(scroll: Point) {
        return {
            x:
                scroll.x -
                (this.canvasEditor.nonTranslatedDeviceRect.left -
                    this.canvasEditor.documentRect.left),
            y:
                scroll.y -
                (this.canvasEditor.nonTranslatedDeviceRect.top - this.canvasEditor.documentRect.top)
        };
    }

    scrollClamp(scroll: Point) {
        let x = scroll.x;
        if (this.horizontal) {
            if (x < 0) {
                x = 0;
            } else if (
                x + this.canvasEditor.deviceRect.width >
                this.canvasEditor.documentRect.width
            ) {
                x = this.canvasEditor.documentRect.width - this.canvasEditor.deviceRect.width;
            }
        } else {
            x = 0;
        }

        let y = scroll.y;
        if (this.vertical) {
            if (y < 0) {
                y = 0;
            } else if (
                y + this.canvasEditor.deviceRect.height >
                this.canvasEditor.documentRect.height
            ) {
                y = this.canvasEditor.documentRect.height - this.canvasEditor.deviceRect.height;
            }
        } else {
            y = 0;
        }

        return {
            x,
            y
        };
    }

    draw(ctx: CanvasRenderingContext2D) {
        if (this.horizontal) {
            drawScrollBar(ctx, this.horizontal);
        }

        if (this.vertical) {
            drawScrollBar(ctx, this.vertical);
        }

        if (this.cornerRect) {
            // draw white corner
            ctx.fillStyle = "white";
            ctx.fillRect(
                this.cornerRect.left,
                this.cornerRect.top,
                this.cornerRect.width,
                this.cornerRect.height
            );
        }
    }

    findNextScale() {
        for (const scale of SCALES) {
            if (scale > this.canvasEditor.scale) {
                return scale;
            }
        }
        return this.canvasEditor.scale;
    }

    findPrevScale() {
        for (let i = SCALES.length - 1; i >= 0; i--) {
            if (SCALES[i] < this.canvasEditor.scale) {
                return SCALES[i];
            }
        }
        return this.canvasEditor.scale;
    }

    onMouseWheel(event: any) {
        let newScroll: Point;
        let newScale: number;

        if (event.ctrlKey) {
            if (event.deltaY > 0) {
                newScale = this.findPrevScale();
            } else if (event.deltaY < 0) {
                newScale = this.findNextScale();
            } else {
                newScale = 1;
            }

            //
            const p1 = this.canvasEditor.mouseToDocument(event);

            //
            const documentTranslateSaved = this.canvasEditor.documentTranslate;
            const scaleSaved = this.canvasEditor.scale;
            const deviceTranslateSaved = this.canvasEditor.deviceTranslate;

            this.canvasEditor.documentTranslate = { x: 0, y: 0 };
            this.canvasEditor.scale = newScale;
            this.canvasEditor.deviceTranslate = this.canvasEditor.getDeviceTranslate();

            const p2 = this.canvasEditor.mouseToDocument(event);

            this.canvasEditor.documentTranslate = documentTranslateSaved;
            this.canvasEditor.scale = scaleSaved;
            this.canvasEditor.deviceTranslate = deviceTranslateSaved;

            //
            newScroll = this.documentTranslateToScroll({
                x: p1.x - p2.x,
                y: p1.y - p2.y
            });
        } else {
            newScroll = this.documentTranslateToScroll(this.canvasEditor.documentTranslate);
            newScroll = {
                x: newScroll.x + event.deltaX,
                y: newScroll.y + event.deltaY
            };

            newScale = this.canvasEditor.scale;
        }

        newScroll = this.scrollClamp(newScroll);

        this.canvasEditor.transform(this.scrollToDocumentTranslate(newScroll), newScale);
    }

    isDragging(): boolean {
        return this.dragging != undefined;
    }

    hitTest(event: any): ScrollBarsHitRegion {
        const mousePoint: Point = {
            x: event.offsetX,
            y: event.offsetY
        };

        if (this.horizontal) {
            if (pointInRect(mousePoint, this.horizontal.thumbRect)) {
                return ScrollBarsHitRegion.HORIZONTAL_THUMB;
            }

            if (pointInRect(mousePoint, this.horizontal.trackRect)) {
                return ScrollBarsHitRegion.HORIZONTAL_TRACK;
            }
        }

        if (this.vertical) {
            if (pointInRect(mousePoint, this.vertical.thumbRect)) {
                return ScrollBarsHitRegion.VERTICAL_THUMB;
            }

            if (pointInRect(mousePoint, this.vertical.trackRect)) {
                return ScrollBarsHitRegion.VERTICAL_TRACK;
            }
        }

        if (this.cornerRect && pointInRect(mousePoint, this.cornerRect)) {
            return ScrollBarsHitRegion.CORNER;
        }

        return ScrollBarsHitRegion.OUTSIDE;
    }

    onMouseDown(event: any): boolean {
        this.dragging = undefined;

        let region = ScrollBarsHitRegion.OUTSIDE;
        if (event.buttons == 1) {
            region = this.hitTest(event);
        } else if (event.buttons == 2 || event.buttons == 3) {
            region = ScrollBarsHitRegion.FREE;
        }

        if (region == ScrollBarsHitRegion.OUTSIDE) {
            return false;
        }
        if (
            region != ScrollBarsHitRegion.HORIZONTAL_THUMB &&
            region != ScrollBarsHitRegion.VERTICAL_THUMB &&
            region != ScrollBarsHitRegion.FREE
        ) {
            return true;
        }

        const scroll = this.documentTranslateToScroll(this.canvasEditor.documentTranslate);

        let offset: Point;

        if (region == ScrollBarsHitRegion.FREE) {
            offset = {
                x: scroll.x + event.offsetX / this.canvasEditor.scale,
                y: scroll.y + event.offsetY / this.canvasEditor.scale
            };
        } else {
            if (this.horizontal && region == ScrollBarsHitRegion.HORIZONTAL_THUMB) {
                offset = {
                    x:
                        (scroll.x * this.horizontal.trackRect.width) /
                            this.canvasEditor.documentRect.width -
                        event.offsetX,
                    y: 0
                };
            } else if (this.vertical && region == ScrollBarsHitRegion.VERTICAL_THUMB) {
                offset = {
                    x: 0,
                    y:
                        (scroll.y * this.vertical.trackRect.height) /
                            this.canvasEditor.documentRect.height -
                        event.offsetY
                };
            } else {
                return false;
            }
        }

        this.dragging = {
            region,
            offset
        };

        return true;
    }

    onMouseMove(event: any) {
        if (!this.dragging) {
            return;
        }

        let newScroll: Point;

        if (this.dragging.region == ScrollBarsHitRegion.FREE) {
            newScroll = {
                x: this.dragging.offset.x - event.offsetX / this.canvasEditor.scale,
                y: this.dragging.offset.y - event.offsetY / this.canvasEditor.scale
            };
        } else {
            newScroll = this.documentTranslateToScroll(this.canvasEditor.documentTranslate);
            if (this.horizontal && this.dragging.region == ScrollBarsHitRegion.HORIZONTAL_THUMB) {
                newScroll.x =
                    ((event.offsetX + this.dragging.offset.x) *
                        this.canvasEditor.documentRect.width) /
                    this.horizontal.trackRect.width;
            } else if (
                this.vertical &&
                this.dragging.region == ScrollBarsHitRegion.VERTICAL_THUMB
            ) {
                newScroll.y =
                    ((event.offsetY + this.dragging.offset.y) *
                        this.canvasEditor.documentRect.height) /
                    this.vertical.trackRect.height;
            } else {
                return;
            }
        }

        newScroll = this.scrollClamp(newScroll);
        this.canvasEditor.transform(
            this.scrollToDocumentTranslate(newScroll),
            this.canvasEditor.scale
        );
    }

    stopDragging() {
        this.dragging = undefined;
    }
}
