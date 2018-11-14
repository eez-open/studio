import { action } from "mobx";

import { capitalize } from "eez-studio-shared/string";
import { UIStateStore } from "project-editor/core/store";

const LAYOUT_TIMEOUT = 100;
const MIN_SPLITTER_DISTANCE = 0.05;

function setPxStyle(el: HTMLElement, name: string, value: any) {
    let cssValue = value + "px";
    if ((el.style as any)[name] !== cssValue) {
        (el.style as any)[name] = cssValue;
    }
}

function getPathTo(node: Node): string | undefined {
    if (node instanceof HTMLElement) {
        let element = node as HTMLElement;
        if (element.id !== "") {
            return 'id("' + element.id + '")';
        }

        if (element === document.body) {
            return element.tagName;
        }

        if (element.parentNode) {
            let ix = 0;
            let siblings = element.parentNode.childNodes;
            for (let i = 0; i < siblings.length; i++) {
                let sibling = siblings[i];

                if (sibling === element) {
                    return (
                        getPathTo(element.parentNode) + "/" + element.tagName + "[" + (ix + 1) + "]"
                    );
                }

                if (
                    sibling.nodeType === 1 &&
                    (sibling as HTMLElement).tagName === element.tagName
                ) {
                    ix++;
                }
            }
        }
    }

    return undefined;
}

// read position from persistent settings
function getSplitterPosition($splitter: JQuery, defaultPosition: number) {
    let path = getPathTo($splitter[0]);
    if (path) {
        return (UIStateStore.splitters && UIStateStore.splitters.get(path)) || defaultPosition;
    }
    return defaultPosition;
}

// read position from persistent settings
var setSplitterPosition = action(($splitter: JQuery, position: number) => {
    let path = getPathTo($splitter[0]);
    if (path) {
        UIStateStore.splitters.set(path, position);
    }
});

////////////////////////////////////////////////////////////////////////////////

type Orientation = "horizontal" | "vertical";

function getSplitterPositions(
    $container: JQuery,
    orientation: Orientation,
    resizeAutoPanels?: boolean,
    width?: number,
    height?: number
) {
    const $elements = $container.find(
        `>.layoutSplit${capitalize(orientation)}:not(.layoutDetached)`
    );
    const $splitters = $container.find(`>.${orientation}Splitter`);

    let splitterPositions: any[] = [];
    for (let i = 0; i < $splitters.length; i++) {
        let position: any = $($splitters[i]).attr("data-splitter-position");

        if (position == "auto") {
            if (orientation == "horizontal") {
                if (resizeAutoPanels) {
                    $($elements[i]).css("width", "auto");
                    if (height !== undefined) {
                        $($elements[i]).css("height", "auto");
                    }
                }
                position = $($elements[i]).outerWidth()! / $container.innerWidth()!;
            } else {
                if (resizeAutoPanels) {
                    if (width !== undefined) {
                        $($elements[i]).css("width", width);
                    }
                    $($elements[i]).css("height", "auto");
                }
                position = $($elements[i]).outerHeight()! / $container.innerHeight()!;
            }
        } else {
            position = parseFloat(position);
        }

        splitterPositions.push(position);
    }

    splitterPositions.push(1);

    // adjust positions in case some elements are empty
    $elements.each(function(i, el) {
        if ($(el).is(":empty")) {
            if (i == 0) {
                splitterPositions[i] = 0;
            } else {
                splitterPositions[i - 1] = splitterPositions[i];
            }
        }
    });

    return splitterPositions;
}

function initSplit(container: HTMLElement, orientation: Orientation) {
    let $container = $(container);
    $container.remove(`.${orientation}Splitter`);

    const $elements = $container.find(`>.layoutSplit${capitalize(orientation)}`);

    const N = $elements.length;

    $elements.each(function(i: number, el: Element) {
        if (i < N - 1) {
            const $el = $(el);

            let $splitter = $(`<div class="${orientation}Splitter"></div>`);

            let splitterId = $el.attr("data-splitter-id");
            if (splitterId) {
                $splitter.attr("id", splitterId);
            }

            $container.append($splitter);

            // set splitter initial position
            let defaultPosition: any = $el.attr("data-splitter-position");
            if (defaultPosition != "auto") {
                defaultPosition = parseFloat(defaultPosition);
                if (isNaN(defaultPosition)) {
                    defaultPosition = 1 / N;
                }
            }
            let position = getSplitterPosition($splitter, defaultPosition); // read position from persistent settings
            $splitter.attr("data-splitter-position", position);

            (<any>$splitter)
                .drag(
                    function(ev: any, dd: any) {
                        let position: number;

                        if (orientation == "horizontal") {
                            let left = $($elements[i]).position().left;

                            let width =
                                $($elements[i + 1]).position().left +
                                $($elements[i + 1]).outerWidth()! -
                                left;

                            let totalWidth =
                                $elements.last().position().left +
                                $elements.last().outerWidth()! -
                                $elements.first().position().left;

                            let x = dd.offsetX;
                            if (x < left) {
                                x = left;
                            } else if (x >= left + width) {
                                x = left + width - 1;
                            }

                            position = x / totalWidth;
                        } else {
                            let top = $($elements[i]).position().top;

                            let height =
                                $($elements[i + 1]).position().top +
                                $($elements[i + 1]).outerHeight()! -
                                top;

                            let totalHeight =
                                $elements.last().position().top +
                                $elements.last().outerHeight()! -
                                $elements.first().position().top;

                            let y = dd.offsetY;
                            if (y < top) {
                                y = top;
                            } else if (y >= top + height) {
                                y = top + height - 1;
                            }

                            position = y / totalHeight;
                        }

                        let splitterPositions = getSplitterPositions($container, orientation);

                        let prevPosition = i > 0 ? splitterPositions[i - 1] : 0;
                        let nextPosition = i < N - 2 ? splitterPositions[i + 1] : 1;

                        if (
                            position - prevPosition > MIN_SPLITTER_DISTANCE &&
                            nextPosition - position > MIN_SPLITTER_DISTANCE
                        ) {
                            $splitter.attr("data-splitter-position", position);
                            // save position to persistent settings
                            setSplitterPosition($splitter, position);
                            split(container, orientation);
                        }
                    },
                    {
                        relative: true
                    }
                )
                .on("dragstart", function(event: any) {
                    $("body iframe").css("pointer-events", "none");
                })
                .on("dragend", function(event: any) {
                    $("body iframe").css("pointer-events", "");
                });
        }
    });
}

function split(
    container: HTMLElement,
    orientation: Orientation,
    left_?: number,
    top_?: number,
    width_?: number,
    height_?: number
) {
    let $container = $(container);
    const $elements = $container.find(
        `>.layoutSplit${capitalize(orientation)}:not(.layoutDetached)`
    );
    const $splitters = $container.find(`>.${orientation}Splitter`);

    let left = left_ != undefined ? left_ : $elements.first().position().left;
    let top = top_ != undefined ? top_ : $elements.first().position().top;
    let width =
        width_ != undefined
            ? width_
            : $elements.last().position().left + $elements.last().outerWidth()! - left;
    let height =
        height_ != undefined
            ? height_
            : $elements.last().position().top + $elements.last().outerHeight()! - top;

    const N = $elements.length;

    let splitterPositions = getSplitterPositions($container, orientation, true, width, height);

    // hide/show elements and splitters depending on element emptiness
    let lastNonEmptyIndex = -1;
    $elements.each(function(i, el) {
        const $el = $(el);

        let isElementEmpty = $el.is(":empty");

        $el.css("visibility", isElementEmpty ? "hidden" : "visible");
        if (i < N - 1) {
            $($splitters[i]).css("visibility", isElementEmpty ? "hidden" : "visible");
        }

        if (!isElementEmpty) {
            lastNonEmptyIndex = i;
        }
    });

    // mark last element so we can hide right border in CSS
    $elements.removeClass("lastLayoutSplit");
    if (lastNonEmptyIndex != -1) {
        $($elements[lastNonEmptyIndex]).addClass("lastLayoutSplit");
    }

    $elements.each(function(i, el: HTMLElement) {
        const $el = $(el);
        if (i < N - 1) {
            const $splitter = $($splitters[i]);

            let splitterPosition = splitterPositions[i];

            if (orientation == "horizontal") {
                let splitterLeft = Math.round(
                    splitterPosition * width - $splitter.outerWidth()! / 2
                );
                setPxStyle($splitter[0], "left", splitterLeft);
                setPxStyle($splitter[0], "top", top);
                setPxStyle($splitter[0], "height", height);
            } else {
                let splitterTop = Math.round(
                    splitterPosition * height - $splitter.outerHeight()! / 2
                );
                setPxStyle($splitter[0], "left", left);
                setPxStyle($splitter[0], "top", splitterTop);
                setPxStyle($splitter[0], "width", width);
            }
        }

        if (orientation == "horizontal") {
            let elLeft = left + (i == 0 ? 0 : Math.round(splitterPositions[i - 1] * width));
            let elWidth = (i < N - 1 ? Math.round(splitterPositions[i] * width) : width) - elLeft;

            setPxStyle($el[0], "left", elLeft);
            setPxStyle($el[0], "top", top);
            setPxStyle($el[0], "width", elWidth);
            setPxStyle($el[0], "height", height);
        } else {
            let elTop = top + (i == 0 ? 0 : Math.round(splitterPositions[i - 1] * height));
            let elHeight = (i < N - 1 ? Math.round(splitterPositions[i] * height) : height) - elTop;

            setPxStyle($el[0], "left", left);
            setPxStyle($el[0], "top", elTop);
            setPxStyle($el[0], "width", width);
            setPxStyle($el[0], "height", elHeight);
        }

        doLayout(el);
    });

    const $detachedElement = $container.find(
        `>.layoutSplit${capitalize(orientation)}.layoutDetached`
    );
    if ($detachedElement.length > 0) {
        let position: any = $detachedElement.attr("data-splitter-position");

        if (position == "auto") {
            if (orientation == "horizontal") {
                $detachedElement.css({
                    width: "auto",
                    height: height
                });
                position = $detachedElement.outerWidth()! / $container.innerWidth()!;
            } else {
                $detachedElement.css({
                    width: width,
                    height: "auto"
                });
                position = $detachedElement.outerHeight()! / $container.innerHeight()!;
            }
        } else {
            position = parseFloat(position);
            if (isNaN(position)) {
                position = 1 / (N + 1);
            }
        }

        if (orientation == "horizontal") {
            $detachedElement.css({
                left: left + 5,
                top: top + 5,
                width: Math.round(position * height) - 10,
                height: height - 10
            });
        } else {
            $detachedElement.css({
                left: left + 1,
                top: top + 1,
                width: width - 2,
                height: Math.round(position * height) - 2
            });
        }
    }
}

////////////////////////////////////////////////////////////////////////////////

function initSplitHorizontally(container: HTMLElement) {
    initSplit(container, "horizontal");
}

function splitHorizontally(
    container: HTMLElement,
    left?: number,
    top?: number,
    width?: number,
    height?: number
) {
    split(container, "horizontal", left, top, width, height);
}

function initSplitVertically(container: HTMLElement) {
    initSplit(container, "vertical");
}

function splitVertically(
    container: HTMLElement,
    left?: number,
    top?: number,
    width?: number,
    height?: number
) {
    split(container, "vertical", left, top, width, height);
}

////////////////////////////////////////////////////////////////////////////////

export function doLayout(container?: HTMLElement, reinitialize?: boolean) {
    if (container) {
        $(container).trigger("autoLayout:resize");
    }

    let top = 0;
    let left = 0;

    let width: number;
    let height: number;
    if (container) {
        let rect = container.getBoundingClientRect();

        width = rect.width;
        height = rect.height;
    } else {
        container = document.body;

        width = window.innerWidth;
        height = window.innerHeight;
    }

    if (container.style.visibility !== "visible") {
        container.style.visibility = "visible";
    }

    let children = container.children;
    for (let i = 0; i < children.length; i++) {
        let el = children[i] as HTMLElement;

        if (!el.className || !el.className.indexOf) {
            continue;
        }

        if (el.className.indexOf("layoutSplitHorizontal") != -1) {
            if (!container.getAttribute("data-splitter-initialized") || reinitialize) {
                initSplitHorizontally(container);
                container.setAttribute("data-splitter-initialized", "1");
            }
            splitHorizontally(container, left, top, width, height);
            break;
        }

        if (el.className.indexOf("layoutSplitVertical") != -1) {
            if (!container.getAttribute("data-splitter-initialized") || reinitialize) {
                initSplitVertically(container);
                container.setAttribute("data-splitter-initialized", "1");
            }
            splitVertically(container, left, top, width, height);
            break;
        }

        let rect = el.getBoundingClientRect();

        if (el.className.indexOf("layoutTop") != -1) {
            setPxStyle(el, "left", left);
            setPxStyle(el, "top", top);
            setPxStyle(el, "width", width);

            top += rect.height;
            height -= rect.height;

            doLayout(el);
        } else if (el.className.indexOf("layoutLeft") != -1) {
            setPxStyle(el, "left", left);
            setPxStyle(el, "top", top);
            setPxStyle(el, "height", height);

            left += rect.width;
            width -= rect.width;

            doLayout(el);
        } else if (el.className.indexOf("layoutBottom") != -1) {
            setPxStyle(el, "left", left);
            setPxStyle(el, "top", top + height - rect.height);
            setPxStyle(el, "width", width);

            height -= rect.height;

            doLayout(el);
        } else if (el.className.indexOf("layoutRight") != -1) {
            setPxStyle(el, "left", left + width - rect.width);
            setPxStyle(el, "top", top);
            setPxStyle(el, "height", height);

            width -= rect.width;

            doLayout(el);
        } else if (el.className.indexOf("layoutCenter") != -1) {
            setPxStyle(el, "left", left);
            setPxStyle(el, "top", top);
            setPxStyle(el, "width", width);
            setPxStyle(el, "height", height);

            doLayout(el);
        } else if (el.className.indexOf("layoutInner") != -1) {
            doLayout(el);
        }
    }
}

function onResize() {
    doLayout();
}

let WindowMutationObserver = (<any>window).MutationObserver || (<any>window).WebKitMutationObserver;
let mutationObserver: any;
let intervalID: any;
let enabled = false;

export function isEnabled() {
    return enabled;
}

export function enable() {
    if (enabled) {
        return false;
    }

    if (WindowMutationObserver) {
        let doLayoutTimerID: any;

        mutationObserver = new WindowMutationObserver(function(mutations: any, observer: any) {
            let dl = false;
            for (let i = 0; i < mutations.length; i++) {
                if (
                    mutations[i].target &&
                    mutations[i].target.className &&
                    mutations[i].target.className.toLowerCase &&
                    mutations[i].target.className.toLowerCase().indexOf("layout") !== -1
                ) {
                    dl = true;
                    break;
                }
            }

            if (!dl) {
                return;
            }

            if (doLayoutTimerID) {
                clearTimeout(doLayoutTimerID);
            }
            doLayoutTimerID = setTimeout(function() {
                doLayoutTimerID = undefined;
                doLayout();
            }, 0);
        });

        mutationObserver.observe(document, {
            subtree: true,
            childList: true,
            attributes: false
        });

        $(window).on("resize", onResize);
    } else {
        intervalID = setInterval(doLayout, LAYOUT_TIMEOUT);
    }

    enabled = true;
    doLayout();

    return true;
}

export function disable() {
    if (!enabled) {
        return false;
    }

    if (WindowMutationObserver) {
        mutationObserver.disconnect();
        mutationObserver = undefined;

        $(window).off("resize", onResize);
    } else {
        if (intervalID != undefined) {
            clearInterval(intervalID);
            intervalID = undefined;
        }
    }

    enabled = false;

    return true;
}
