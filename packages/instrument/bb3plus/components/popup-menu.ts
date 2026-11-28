// A popup menu under a button, plain DOM in the document body (it follows the
// Bootstrap theme): items with an icon or a color swatch, a description, a
// detail text, a key shortcut, a check mark, a submenu; separators, section
// headers and custom elements.
// One menu is open at a time; a click outside, Esc, a resize or the window
// losing the focus close it.

import { h, svgIcon, ICONS, setClass } from "instrument/bb3plus/components/dom";

export type MenuItem =
    | {
          type?: undefined;
          label: string;
          // the path data of an ICONS item, or a color swatch
          icon?: string;
          color?: string;
          // a second line under the label, a detail right of it, a key
          // shortcut
          description?: string;
          detail?: string;
          shortcut?: string;
          checked?: boolean;
          danger?: boolean;
          disabled?: boolean;
          title?: string;
          onClick?: () => void;
          // the menu stays open after the click, its items made again
          keepOpen?: boolean;
          submenu?: () => MenuItem[];
      }
    | { type: "separator" }
    | { type: "header"; label: string }
    | { type: "custom"; element: HTMLElement };

// the items, made again by refresh (e.g. after a change in a custom element)
export type MenuBuilder = (menu: PopupMenu) => MenuItem[];

const GAP = 4;
const MARGIN = 8;

let openMenu: PopupMenu | undefined;

export class PopupMenu {
    element = h("div", { className: "EezStudio_BB3Plus_Menu" });
    private submenu: PopupMenu | undefined;
    private submenuItem: HTMLElement | undefined;

    private constructor(
        private build: MenuBuilder,
        private anchor: HTMLElement | undefined,
        private parent: PopupMenu | undefined
    ) {
        this.element.addEventListener("contextmenu", event =>
            event.preventDefault()
        );
        this.render();
        document.body.append(this.element);
    }

    // Opens the menu under the anchor (aligned to its left or right edge,
    // above it if there is no room below); a click on the anchor of the open
    // menu closes it.
    static show(
        anchor: HTMLElement,
        build: MenuBuilder,
        align: "left" | "right" = "left"
    ) {
        if (openMenu && openMenu.anchor == anchor) {
            openMenu.close();
            return undefined;
        }
        openMenu?.close();
        const menu = new PopupMenu(build, anchor, undefined);
        openMenu = menu;
        menu.place(anchor.getBoundingClientRect(), align, false);
        setClass(anchor, "active", true);
        document.addEventListener("pointerdown", onDocumentPointerDown, true);
        document.addEventListener("keydown", onDocumentKeyDown, true);
        window.addEventListener("resize", closeOpenMenu);
        window.addEventListener("blur", closeOpenMenu);
        return menu;
    }

    // the items made again, in place
    refresh() {
        this.closeSubmenu();
        this.render();
    }

    close() {
        if (this.parent) {
            this.parent.closeSubmenu();
            return;
        }
        this.closeSubmenu();
        this.element.remove();
        if (this.anchor) {
            setClass(this.anchor, "active", false);
        }
        if (openMenu == this) {
            openMenu = undefined;
            document.removeEventListener(
                "pointerdown",
                onDocumentPointerDown,
                true
            );
            document.removeEventListener("keydown", onDocumentKeyDown, true);
            window.removeEventListener("resize", closeOpenMenu);
            window.removeEventListener("blur", closeOpenMenu);
        }
    }

    // the menu and its open submenus
    contains(node: Node): boolean {
        return (
            this.element.contains(node) ||
            (this.submenu?.contains(node) ?? false)
        );
    }

    isAnchor(node: Node) {
        return this.anchor?.contains(node) ?? false;
    }

    private get root(): PopupMenu {
        return this.parent ? this.parent.root : this;
    }

    private closeSubmenu() {
        if (this.submenu) {
            this.submenu.closeSubmenu();
            this.submenu.element.remove();
            this.submenu = undefined;
        }
        if (this.submenuItem) {
            setClass(this.submenuItem, "open", false);
            this.submenuItem = undefined;
        }
    }

    private openSubmenu(item: HTMLElement, items: () => MenuItem[]) {
        if (this.submenuItem == item) {
            return;
        }
        this.closeSubmenu();
        this.submenuItem = item;
        setClass(item, "open", true);
        const submenu = new PopupMenu(() => items(), undefined, this);
        this.submenu = submenu;
        submenu.place(item.getBoundingClientRect(), "left", true);
    }

    // at the rect: under it (a submenu: right of it), inside the window
    private place(rect: DOMRect, align: "left" | "right", side: boolean) {
        const element = this.element;
        const width = element.offsetWidth;
        const height = element.offsetHeight;
        let left: number;
        let top: number;
        if (side) {
            left = rect.right + GAP;
            if (left + width > window.innerWidth - MARGIN) {
                left = rect.left - GAP - width;
            }
            // the first item next to the item of the submenu
            top = rect.top - 6;
        } else {
            left = align == "left" ? rect.left : rect.right - width;
            top = rect.bottom + GAP;
            if (
                top + height > window.innerHeight - MARGIN &&
                rect.top - GAP - height >= MARGIN
            ) {
                top = rect.top - GAP - height;
            }
        }
        left = Math.max(
            MARGIN,
            Math.min(left, window.innerWidth - MARGIN - width)
        );
        top = Math.max(
            MARGIN,
            Math.min(top, window.innerHeight - MARGIN - height)
        );
        element.style.left = left + "px";
        element.style.top = top + "px";
    }

    private render() {
        const items = this.build(this);
        this.element.replaceChildren(
            ...items.map(item => this.renderItem(item))
        );
    }

    private renderItem(item: MenuItem): HTMLElement {
        if (item.type == "separator") {
            return h("div", { className: "separator" });
        }
        if (item.type == "header") {
            return h("div", { className: "header" }, item.label);
        }
        if (item.type == "custom") {
            return h("div", { className: "custom" }, item.element);
        }

        const element = h(
            "div",
            {
                className:
                    "item" +
                    (item.description ? " with-description" : "") +
                    (item.danger ? " danger" : "") +
                    (item.disabled ? " disabled" : ""),
                title: item.title,
                role: "menuitem"
            },
            item.color
                ? h("span", {
                      className: "swatch",
                      style: { backgroundColor: item.color }
                  })
                : item.icon
                  ? h("span", { className: "icon" }, svgIcon(item.icon, 16))
                  : null,
            item.description
                ? h(
                      "span",
                      { className: "label" },
                      item.label,
                      h("span", { className: "description" }, item.description)
                  )
                : h("span", { className: "label" }, item.label),
            item.detail
                ? h("span", { className: "detail" }, item.detail)
                : null,
            item.shortcut
                ? h("kbd", { className: "shortcut" }, item.shortcut)
                : null,
            item.checked
                ? h("span", { className: "check" }, svgIcon(ICONS.check, 16))
                : null,
            item.submenu
                ? h(
                      "span",
                      { className: "chevron" },
                      svgIcon(ICONS.chevronRight, 14)
                  )
                : null
        );
        if (item.disabled) {
            return element;
        }
        element.addEventListener("mouseenter", () => {
            if (item.submenu) {
                this.openSubmenu(element, item.submenu);
            } else {
                this.closeSubmenu();
            }
        });
        element.addEventListener("click", () => {
            if (item.submenu) {
                this.openSubmenu(element, item.submenu);
                return;
            }
            if (!item.keepOpen) {
                this.root.close();
            }
            item.onClick?.();
            if (item.keepOpen) {
                this.refresh();
            }
        });
        return element;
    }
}

function closeOpenMenu() {
    openMenu?.close();
}

// a press outside the menu closes it, not on its anchor (its click toggles
// the menu)
function onDocumentPointerDown(event: PointerEvent) {
    const target = event.target as Node;
    if (openMenu && !openMenu.contains(target) && !openMenu.isAnchor(target)) {
        openMenu.close();
    }
}

function onDocumentKeyDown(event: KeyboardEvent) {
    if (event.key == "Escape" && openMenu) {
        event.preventDefault();
        event.stopPropagation();
        openMenu.close();
    }
}
