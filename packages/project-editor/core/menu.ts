import { Menu, MenuItem } from "@electron/remote";

// A context menu item: menus are built as plain IMenuItem[] and shown with
// popupMenu
export interface IMenuItem {
    // default "normal", a "submenu" item needs `submenu`
    type?: "normal" | "separator" | "checkbox" | "submenu";
    label?: string;
    click?: () => void;
    enabled?: boolean;
    // for type "checkbox"
    checked?: boolean;
    submenu?: IMenuItem[];
}

function toElectronMenuItem(item: IMenuItem): Electron.MenuItem {
    if (item.type == "separator") {
        return new MenuItem({ type: "separator" });
    }

    if (item.type == "submenu" || item.submenu) {
        const submenu = new Menu();
        (item.submenu ?? []).forEach(subItem =>
            submenu.append(toElectronMenuItem(subItem))
        );
        return new MenuItem({
            type: "submenu",
            label: item.label,
            enabled: item.enabled,
            submenu
        });
    }

    return new MenuItem({
        type: item.type == "checkbox" ? "checkbox" : "normal",
        label: item.label,
        enabled: item.enabled,
        checked: item.checked,
        click: item.click ? () => item.click!() : undefined
    });
}

// Shows the context menu at the mouse cursor, nothing if there are no items
export function popupMenu(items: IMenuItem[]) {
    if (items.length == 0) {
        return;
    }
    const menu = new Menu();
    items.forEach(item => menu.append(toElectronMenuItem(item)));
    menu.popup({});
}
