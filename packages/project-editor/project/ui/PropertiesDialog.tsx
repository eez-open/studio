import React from "react";
import { createRoot } from "react-dom/client";
import {
    action,
    autorun,
    computed,
    IReactionDisposer,
    makeObservable,
    observable,
    runInAction
} from "mobx";
import { observer } from "mobx-react";

import { BootstrapDialog } from "eez-studio-ui/dialog";
import { Icon } from "eez-studio-ui/icon";

import { settingsController } from "home/settings";

import { getParent, IEezObject } from "project-editor/core/object";
import {
    getAncestorOfType,
    getObjectIcon,
    isObjectExists,
    ProjectStore
} from "project-editor/store";
import { isValue } from "project-editor/store/helper";
import { ProjectContext } from "project-editor/project/context";
import { ProjectEditor } from "project-editor/project-editor-interface";
import { PropertyGrid } from "project-editor/ui-components/PropertyGrid";
import { Settings } from "project-editor/project/project";
import {
    getPropertiesPanelLabel,
    getPropertiesPanelObjects,
    PropertiesPanel
} from "project-editor/project/ui/PropertiesPanel";

////////////////////////////////////////////////////////////////////////////////

// When "Popup dialog" is selected as the Properties editor in the settings,
// there is no Properties panel, properties are edited in the non-modal
// Properties dialog instead.

export function isPropertiesDialogUsed() {
    return settingsController.isPropertiesDialog;
}

// objects which can be edited in the Properties dialog, the same ones the
// Properties panel shows
export function getPropertiesDialogObjects(objects: IEezObject[]) {
    return objects
        .map(object => (object && isValue(object) ? getParent(object) : object))
        .filter(
            object =>
                object != undefined &&
                isObjectExists(object) &&
                !getAncestorOfType(object, Settings.classInfo)
        );
}

// Returns the objects to show in the Properties dialog when the object is
// double clicked: only when the object would be shown in the Properties panel
// after it is clicked.
export function getPropertiesDialogObjectsOnDoubleClick(
    projectStore: ProjectStore,
    object: IEezObject
) {
    if (!isPropertiesDialogUsed() || projectStore.runtime) {
        return undefined;
    }

    const objects = getPropertiesDialogObjects(
        projectStore.navigationStore.propertyGridObjects
    );

    return objects.indexOf(object) != -1 ? objects : undefined;
}

////////////////////////////////////////////////////////////////////////////////

class PropertiesDialogState {
    constructor(public objects: IEezObject[]) {
        makeObservable(this, {
            objects: observable.shallow
        });
    }
}

// When pinned, the dialog shows the properties of the selected objects, the
// same as the Properties panel. When not pinned, it shows the properties of
// the objects for which it was opened.
const PropertiesDialog = observer(
    class PropertiesDialog extends React.Component<{
        state: PropertiesDialogState;
    }> {
        render() {
            return (
                <div className="EezStudio_PropertiesDialog">
                    {isPinned() ? (
                        <PropertiesPanel />
                    ) : (
                        <PropertiesDialogObjects state={this.props.state} />
                    )}
                </div>
            );
        }
    }
);

const PropertiesDialogObjects = observer(
    class PropertiesDialogObjects extends React.Component<{
        state: PropertiesDialogState;
    }> {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        constructor(props: any) {
            super(props);

            makeObservable(this, {
                objects: computed
            });
        }

        get objects() {
            this.context.lastRevision;
            return this.props.state.objects.filter(object =>
                isObjectExists(object)
            );
        }

        render() {
            this.context.lastRevision;

            const objects = this.objects;

            let icon: React.ReactNode = null;
            let title;

            if (objects.length == 0) {
                title = "Nothing selected";
            } else if (objects.length == 1) {
                icon = getObjectIcon(objects[0]);
                title = getPropertiesPanelLabel(objects[0]);
            } else {
                title = "Multiple objects selected";
            }

            // if LVGL project show properties for both Page object and Screen widget object
            let secondObject;
            if (
                objects.length == 1 &&
                objects[0] instanceof ProjectEditor.PageClass &&
                this.context.projectTypeTraits.isLVGL
            ) {
                secondObject = objects[0].lvglScreenWidget;
            }

            return (
                <div className="EezStudio_PropertiesPanel">
                    <div className="EezStudio_PropertiesPanel_Header">
                        {typeof icon === "string" ? <Icon icon={icon} /> : icon}
                        {title}
                    </div>
                    <div className="EezStudio_PropertiesPanel_Body">
                        <PropertyGrid
                            objects={objects}
                            readOnly={!!this.context.runtime}
                        />
                        {secondObject && (
                            <div style={{ marginTop: 10 }}>
                                <PropertyGrid
                                    objects={[secondObject]}
                                    readOnly={!!this.context.runtime}
                                />
                            </div>
                        )}
                    </div>
                </div>
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////
// Position and size of the dialog, and whether it is pinned, are remembered
// (also after restart).

interface IDialogLayout {
    left: number;
    top: number;
    width: number;
    height: number;
}

const DIALOG_ID = "EezStudio_ProjectEditor_PropertiesDialog";
const LAYOUT_STORAGE_KEY = "ProjectEditorPropertiesDialogLayout";
const PINNED_STORAGE_KEY = "ProjectEditorPropertiesDialogPinned";

const DEFAULT_WIDTH = 480;
const DEFAULT_HEIGHT = 640;
const MIN_WIDTH = 240;
const MIN_HEIGHT = 160;

function loadLayout(): IDialogLayout | undefined {
    try {
        const layout = JSON.parse(
            window.localStorage.getItem(LAYOUT_STORAGE_KEY) ?? ""
        );
        if (
            layout &&
            Number.isFinite(layout.left) &&
            Number.isFinite(layout.top) &&
            Number.isFinite(layout.width) &&
            Number.isFinite(layout.height)
        ) {
            return {
                left: layout.left,
                top: layout.top,
                width: layout.width,
                height: layout.height
            };
        }
    } catch (err) {}
    return undefined;
}

function saveLayout(layout: IDialogLayout) {
    try {
        window.localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(layout));
    } catch (err) {}
}

function loadPinned() {
    try {
        return window.localStorage.getItem(PINNED_STORAGE_KEY) == "1";
    } catch (err) {
        return false;
    }
}

function savePinned(pinned: boolean) {
    try {
        window.localStorage.setItem(PINNED_STORAGE_KEY, pinned ? "1" : "0");
    } catch (err) {}
}

// whether the dialog is pinned, the same for all the dialogs opened later
const pinnedState = observable.box(loadPinned());

function isPinned() {
    return pinnedState.get();
}

function setPinned(pinned: boolean) {
    runInAction(() => pinnedState.set(pinned));
    savePinned(pinned);
}

function getDefaultLayout(container: HTMLElement): IDialogLayout {
    const width = Math.min(DEFAULT_WIDTH, container.clientWidth);
    const height = Math.min(
        DEFAULT_HEIGHT,
        Math.round(container.clientHeight * 0.9)
    );
    return {
        left: Math.round((container.clientWidth - width) / 2),
        top: Math.round((container.clientHeight - height) / 2),
        width,
        height
    };
}

// moves and, if it doesn't fit, shrinks the dialog to be inside the container
function fitLayout(
    layout: IDialogLayout,
    container: HTMLElement
): IDialogLayout {
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;

    const width = Math.max(
        Math.min(layout.width, containerWidth),
        Math.min(MIN_WIDTH, containerWidth)
    );
    const height = Math.max(
        Math.min(layout.height, containerHeight),
        Math.min(MIN_HEIGHT, containerHeight)
    );

    const left = Math.max(0, Math.min(layout.left, containerWidth - width));
    const top = Math.max(0, Math.min(layout.top, containerHeight - height));

    return {
        left: Math.round(left),
        top: Math.round(top),
        width: Math.round(width),
        height: Math.round(height)
    };
}

function getPanelLayout(panel: HTMLElement, container: HTMLElement) {
    const panelRect = panel.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    return {
        left: panelRect.left - containerRect.left - container.clientLeft,
        top: panelRect.top - containerRect.top - container.clientTop,
        width: panelRect.width,
        height: panelRect.height
    };
}

function setPanelLayout(panel: any, layout: IDialogLayout) {
    panel.style.left = layout.left + "px";
    panel.style.top = layout.top + "px";
    panel.resize({ width: layout.width, height: layout.height });
}

////////////////////////////////////////////////////////////////////////////////

// not pinned: tilted pin outline
const UNPINNED_ICON = `<svg focusable="false" class="jsPanel-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><g transform="rotate(45 12 12)"><path fill="currentColor" d="M14 4v5c0 1.12.37 2.16 1 3H9c.65-.86 1-1.9 1-3V4h4m3-2H7c-.55 0-1 .45-1 1s.45 1 1 1h1v5c0 1.66-1.34 3-3 3v2h5.97v7l1 1 1-1v-7H19v-2c-1.66 0-3-1.34-3-3V4h1c.55 0 1-.45 1-1s-.45-1-1-1z"/></g></svg>`;

// pinned: upright filled pin (and highlighted button, see project-editor.less)
const PINNED_ICON = `<svg focusable="false" class="jsPanel-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="M16 9V4h1c.55 0 1-.45 1-1s-.45-1-1-1H7c-.55 0-1 .45-1 1s.45 1 1 1h1v5c0 1.66-1.34 3-3 3v2h5.97v7l1 1 1-1v-7H19v-2c-1.66 0-3-1.34-3-3z"/></svg>`;

function updatePinControl(control: HTMLElement, pinned: boolean) {
    control.innerHTML = pinned ? PINNED_ICON : UNPINNED_ICON;
    control.classList.toggle("pinned", pinned);
    control.title = pinned
        ? "Pinned: the dialog stays open when clicked outside of it (click to unpin)"
        : "Not pinned: the dialog closes when clicked outside of it (click to pin)";
    control.setAttribute("aria-pressed", pinned ? "true" : "false");
}

////////////////////////////////////////////////////////////////////////////////

interface IOpenedPropertiesDialog {
    projectStore: ProjectStore;
    state: PropertiesDialogState;
    jsPanel: any;
    dispose: () => void;
}

let openedPropertiesDialog: IOpenedPropertiesDialog | undefined;

export function closePropertiesDialog(projectStore?: ProjectStore) {
    const dialog = openedPropertiesDialog;
    if (dialog && (!projectStore || dialog.projectStore == projectStore)) {
        openedPropertiesDialog = undefined;
        dialog.dispose();
        try {
            dialog.jsPanel.close();
        } catch (err) {}
    }
}

// project which tab is active
let activeProjectStore: ProjectStore | undefined;

// the dialog is hidden while the tab of its project is not active
export function setPropertiesDialogProjectActive(
    projectStore: ProjectStore,
    isActive: boolean
) {
    if (isActive) {
        activeProjectStore = projectStore;
    } else if (activeProjectStore == projectStore) {
        activeProjectStore = undefined;
    }

    const dialog = openedPropertiesDialog;
    if (dialog && dialog.projectStore == projectStore) {
        dialog.jsPanel.style.display = isActive ? "" : "none";
    }

    if (isActive) {
        restorePropertiesDialog(projectStore);
    }
}

// The pinned dialog stays opened after restart: it is saved in the project UI
// state whether the pinned dialog is opened for the project. The pinned
// dialog shows the selected objects, so which objects is not saved.
export function isPinnedPropertiesDialogOpened(projectStore: ProjectStore) {
    const dialog = openedPropertiesDialog;
    return (
        dialog != undefined &&
        dialog.projectStore == projectStore &&
        isPinned() &&
        isPropertiesDialogUsed()
    );
}

// Opens the dialog saved in the project UI state, when the project is loaded
// and its tab is active.
export function restorePropertiesDialog(projectStore: ProjectStore) {
    const navigationStore = projectStore.navigationStore;
    if (!navigationStore?.propertiesDialogRestorePending) {
        return;
    }

    if (
        activeProjectStore != projectStore ||
        !projectStore.project ||
        !projectStore.project._fullyLoaded
    ) {
        // try again later
        return;
    }

    navigationStore.propertiesDialogRestorePending = false;

    if (!isPinned() || !isPropertiesDialogUsed() || projectStore.runtime) {
        return;
    }

    // after the project editor is rendered
    setTimeout(() => {
        if (activeProjectStore == projectStore && !openedPropertiesDialog) {
            openPropertiesDialog(
                projectStore,
                getPropertiesPanelObjects(projectStore)
            );
        }
    });
}

function isAnotherDialogOpened() {
    return (
        BootstrapDialog.openBootstrapDialogs.length > 0 ||
        document.querySelector(".jsPanel-modal-backdrop") != null
    );
}

export function showPropertiesDialog(
    projectStore: ProjectStore,
    objects: IEezObject[]
) {
    objects = getPropertiesDialogObjects(objects);
    if (objects.length == 0) {
        return;
    }

    // already opened (for example, when pinned): show the new objects
    if (
        openedPropertiesDialog &&
        openedPropertiesDialog.projectStore == projectStore
    ) {
        const dialog = openedPropertiesDialog;
        runInAction(() => (dialog.state.objects = objects));
        dialog.jsPanel.style.display = "";
        try {
            dialog.jsPanel.front();
        } catch (err) {}
        return;
    }

    openPropertiesDialog(projectStore, objects);
}

function openPropertiesDialog(
    projectStore: ProjectStore,
    objects: IEezObject[]
) {
    closePropertiesDialog();

    const container = document.getElementById("EezStudio_Content");
    const jsPanelLib: any = (window as any).jsPanel;
    if (!container || !jsPanelLib) {
        return;
    }

    const state = new PropertiesDialogState(objects);

    const element = document.createElement("div");
    element.style.position = "absolute";
    element.style.width = "100%";
    element.style.height = "100%";
    element.style.display = "flex";

    const root = createRoot(element);
    root.render(
        <ProjectContext.Provider value={projectStore}>
            <PropertiesDialog state={state} />
        </ProjectContext.Provider>
    );

    // Position and size set by the user. When the window is resized the
    // dialog is moved/shrunk to stay visible, but this is remembered so the
    // dialog goes back where it was when there is enough space again.
    let userLayout = loadLayout() ?? getDefaultLayout(container);
    const layout = fitLayout(userLayout, container);

    const onUserLayoutChange = () => {
        if (jsPanel && jsPanel.isConnected) {
            userLayout = fitLayout(getPanelLayout(jsPanel, container), container);
            saveLayout(userLayout);
        }
    };

    const jsPanel = jsPanelLib.create({
        id: DIALOG_ID,
        container,
        theme: "primary",
        headerTitle: "Properties",
        panelSize: {
            width: layout.width,
            height: layout.height
        },
        position: {
            my: "left-top",
            at: "left-top",
            offsetX: layout.left,
            offsetY: layout.top
        },
        content: element,
        headerControls: {
            minimize: "remove",
            smallify: "remove",
            maximize: "remove",
            add: {
                name: "pin",
                html: isPinned() ? PINNED_ICON : UNPINNED_ICON,
                position: 1,
                afterInsert: (control: HTMLElement) =>
                    updatePinControl(control, isPinned()),
                handler: (panel: any, control: HTMLElement) => {
                    if (isPinned()) {
                        // when unpinned, keep showing the currently
                        // selected objects
                        const selectedObjects =
                            getPropertiesPanelObjects(projectStore);
                        runInAction(() => {
                            state.objects = selectedObjects;
                        });
                    }
                    setPinned(!isPinned());
                    updatePinControl(control, isPinned());
                }
            }
        },
        dragit: {
            containment: [0, 0, 0, 0],
            stop: onUserLayoutChange
        },
        resizeit: {
            containment: [0, 0, 0, 0],
            minWidth: MIN_WIDTH,
            minHeight: MIN_HEIGHT,
            stop: onUserLayoutChange
        },
        onclosed: () => {
            // closed with the header close button
            if (openedPropertiesDialog == dialog) {
                openedPropertiesDialog = undefined;
            }
            dialog.dispose();
        }
    });

    // keep the dialog visible when the window is resized
    const onContainerResize = () => {
        if (jsPanel.isConnected) {
            setPanelLayout(jsPanel, fitLayout(userLayout, container));
        }
    };
    const resizeObserver = new ResizeObserver(onContainerResize);
    resizeObserver.observe(container);

    // The dialog is not modal: it is closed when clicked outside of it,
    // unless it is pinned.
    const onPointerDown = (event: PointerEvent) => {
        if (isPinned()) {
            return;
        }

        const target = event.target;
        if (!(target instanceof Element) || !target.isConnected) {
            return;
        }

        if (jsPanel.contains(target)) {
            return;
        }

        // Ignore clicks inside the other dialogs and inside the popups
        // opened from the Properties dialog (dropdowns etc.). Also, those
        // are, usually, not rendered inside the #EezStudio_Content.
        if (
            isAnotherDialogOpened() ||
            target.closest(
                ".jsPanel, .jsPanel-modal-backdrop, .modal, .modal-backdrop, .dropdown-menu, .popover"
            )
        ) {
            return;
        }

        if (!container.contains(target)) {
            return;
        }

        closePropertiesDialog();
    };

    const onKeyDown = (event: KeyboardEvent) => {
        if (
            event.key == "Escape" &&
            !isPinned() &&
            !event.defaultPrevented &&
            !isAnotherDialogOpened()
        ) {
            closePropertiesDialog();
        }
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown);

    let disposed = false;

    const dialog: IOpenedPropertiesDialog = {
        projectStore,
        state,
        jsPanel,
        dispose: action(() => {
            if (disposed) {
                return;
            }
            disposed = true;

            document.removeEventListener("pointerdown", onPointerDown, true);
            document.removeEventListener("keydown", onKeyDown);
            resizeObserver.disconnect();
            disposeAutorun();

            // not while React is rendering (dispose could be called from
            // a React event handler)
            setTimeout(() => root.unmount());
        })
    };

    // close the not pinned dialog when the edited objects are deleted (the
    // pinned dialog shows the selected objects)
    const disposeAutorun: IReactionDisposer = autorun(() => {
        projectStore.lastRevision;
        if (
            !isPinned() &&
            state.objects.length > 0 &&
            state.objects.find(object => isObjectExists(object)) == undefined
        ) {
            setTimeout(() => {
                if (openedPropertiesDialog == dialog) {
                    closePropertiesDialog();
                }
            });
        }
    });

    openedPropertiesDialog = dialog;
}
