export type IActionType = "scpi-commands" | "javascript" | "micropython";

export interface IAction {
    type: IActionType;
    data: any;
}

export interface IShortcut {
    id: string;
    originalId?: string;
    name: string;
    usedIn?: string[] | undefined;
    action: IAction;
    keybinding: string;
    groupName: string;
    showInToolbar: boolean;
    toolbarButtonPosition: number;
    toolbarButtonColor: string;
    requiresConfirmation: boolean;
    selected: boolean;
}

export interface IShortcutsStore {
    shortcuts: Map<string, IShortcut>;
    newShortcutGroupName?: string;
    addShortcut?(shortcut: Partial<IShortcut>): string;
    updateShortcut?(shortcut: Partial<IShortcut>): void;
    deleteShortcut?(shortcut: Partial<IShortcut>): void;
    renderUsedInProperty?(shortcut: Partial<IShortcut>): JSX.Element;
}

export interface IGroup {
    id: string;
    name: string;
}

export interface IGroupsStore {
    groups: Map<string, IGroup>;
    addGroup(group: Partial<IGroup>): string;
    updateGroup(group: Partial<IGroup>): void;
    deleteGroup(group: Partial<IGroup>): void;
    isGroupEnabled?(group: IGroup): boolean;
    enableGroup?(group: IGroup, enable: boolean): void;
}
