import React from "react";
import { observable, computed, action, values } from "mobx";
import { observer } from "mobx-react";

import { objectClone, isReserverdKeybinding } from "eez-studio-shared/util";
import {
    makeValidator,
    validators,
    VALIDATION_MESSAGE_REQUIRED
} from "eez-studio-shared/model/validation";
import { Dialog, showDialog, IDialogButton } from "eez-studio-ui/dialog";
import {
    PropertyList,
    TextInputProperty,
    KeybindingProperty,
    BooleanProperty,
    NumberInputProperty,
    SelectProperty,
    StaticProperty
} from "eez-studio-ui/properties";

import { CodeEditorProperty } from "eez-studio-ui/code-editor";

import { extensions } from "eez-studio-shared/extensions/extensions";

import { IActionType, IShortcut, IShortcutsStore, IGroupsStore } from "shortcuts/interfaces";
import { TOOLBAR_BUTTON_COLORS } from "shortcuts/toolbar-button-colors";

import {
    isSameShortcutFromDifferentExtension,
    SHORTCUTS_GROUP_NAME_FOR_EXTENSION_PREFIX,
    FROM_EXTENSION_GROUP_NAME
} from "shortcuts/shortcuts";

interface ShortcutDialogProps {
    shortcutsStore: IShortcutsStore;
    groupsStore?: IGroupsStore;
    shortcut: Partial<IShortcut>;
    callback: (shortcut: Partial<IShortcut>) => void;
    codeError: string | undefined;
    codeErrorLineNumber: number | undefined;
    codeErrorColumnNumber: number | undefined;
}

@observer
class ShortcutDialog extends React.Component<ShortcutDialogProps, {}> {
    constructor(props: any) {
        super(props);

        this.handleSubmit = this.handleSubmit.bind(this);
        this.resetToDefault = this.resetToDefault.bind(this);

        this.shortcut = objectClone(props.shortcut);
    }

    @observable
    shortcut: Partial<IShortcut>;
    wasValidated: boolean = false;

    validator = makeValidator({
        name: [
            validators.required,
            () => {
                if (
                    this.shortcut.name !== this.props.shortcut.name &&
                    values(this.props.shortcutsStore.shortcuts).find(
                        shortcut =>
                            shortcut.name === this.shortcut.name &&
                            (shortcut.id !== this.shortcut.id &&
                                !isSameShortcutFromDifferentExtension(shortcut, this.props
                                    .shortcut as IShortcut))
                    )
                ) {
                    return "Shortcut with the same name already exists.";
                }
                return null;
            }
        ],
        groupName: [
            () => {
                if (
                    this.props.groupsStore &&
                    !this.props.groupsStore.isGroupEnabled &&
                    !this.shortcut.groupName
                ) {
                    return VALIDATION_MESSAGE_REQUIRED;
                }
                return null;
            }
        ],
        actionCode: [
            () => {
                if (this.shortcut.action!.data.trim() === "") {
                    return VALIDATION_MESSAGE_REQUIRED;
                }
                return null;
            }
        ],
        keybinding: [
            () => {
                if (this.shortcut.keybinding) {
                    if (
                        this.shortcut.keybinding.endsWith("+") &&
                        !this.shortcut.keybinding.endsWith("++")
                    ) {
                        return "Keybinding is not completed.";
                    }

                    if (isReserverdKeybinding(this.shortcut.keybinding)) {
                        return "This keybinding is reserved for application.";
                    }
                }

                return null;
            }
        ],
        toolbarButtonPosition: [
            () => {
                if (
                    this.shortcut.showInToolbar &&
                    (!this.shortcut.toolbarButtonPosition ||
                        this.shortcut.toolbarButtonPosition < 1)
                ) {
                    return "Please enter value greater than or equal to 1.";
                }
                return null;
            }
        ]
    });

    @observable
    codeError: string | undefined = this.props.codeError;

    @computed
    get codeErrors() {
        if (this.validator.errors.actionCode) {
            if (this.codeError) {
                return this.validator.errors.actionCode.concat([this.codeError]);
            } else {
                return this.validator.errors.actionCode;
            }
        } else {
            if (this.codeError) {
                return [this.codeError];
            }
        }
        return undefined;
    }

    async handleSubmit() {
        this.wasValidated = true;
        if (!(await this.validator.checkValidity(this.shortcut))) {
            return false;
        }

        if (!this.shortcut.showInToolbar) {
            delete this.shortcut.toolbarButtonColor;
            delete this.shortcut.toolbarButtonPosition;
        }

        this.props.callback(this.shortcut);

        return true;
    }

    async revalidate() {
        if (this.wasValidated) {
            await this.validator.checkValidity(this.shortcut);
        }
    }

    @computed
    get isExtensionShortcut() {
        return (
            !!this.props.shortcut.groupName &&
            this.props.shortcut.groupName.startsWith(SHORTCUTS_GROUP_NAME_FOR_EXTENSION_PREFIX)
        );
    }

    @computed
    get extension() {
        return (
            this.props.shortcut.groupName &&
            extensions.get(
                this.props.shortcut.groupName.substr(
                    SHORTCUTS_GROUP_NAME_FOR_EXTENSION_PREFIX.length
                )
            )
        );
    }

    @computed
    get groupName() {
        let groupName = this.props.shortcut.groupName;
        if (!groupName) {
            return "";
        }

        if (groupName.startsWith(SHORTCUTS_GROUP_NAME_FOR_EXTENSION_PREFIX)) {
            if (this.props.groupsStore && this.props.groupsStore.isGroupEnabled) {
                return FROM_EXTENSION_GROUP_NAME;
            }
            if (this.extension) {
                return "Extension: " + (this.extension.displayName || this.extension.name);
            }
        }

        return groupName;
    }

    @computed
    get originalShortcut() {
        if (this.extension && this.extension.properties && this.extension.properties.shortcuts) {
            return this.extension.properties.shortcuts!.find(
                shortcut => shortcut.id === this.props.shortcut.originalId
            );
        }
        return undefined;
    }

    @computed
    get hasChanges() {
        return (
            !!this.originalShortcut &&
            (this.shortcut.name !== this.originalShortcut.name ||
                this.shortcut.keybinding !== this.originalShortcut.keybinding ||
                this.shortcut.requiresConfirmation !== this.originalShortcut.requiresConfirmation ||
                this.shortcut.showInToolbar !== this.originalShortcut.showInToolbar ||
                (this.shortcut.showInToolbar &&
                    (this.shortcut.toolbarButtonPosition !==
                        this.originalShortcut.toolbarButtonPosition ||
                        this.shortcut.toolbarButtonColor !==
                            this.originalShortcut.toolbarButtonColor)))
        );
    }

    @action
    resetToDefault(event: any) {
        event.preventDefault();

        if (this.originalShortcut) {
            this.shortcut.name = this.originalShortcut.name;
            this.shortcut.keybinding = this.originalShortcut.keybinding;
            this.shortcut.requiresConfirmation = this.originalShortcut.requiresConfirmation;
            this.shortcut.showInToolbar = this.originalShortcut.showInToolbar;
            this.shortcut.toolbarButtonPosition = this.originalShortcut.toolbarButtonPosition;
            this.shortcut.toolbarButtonColor = this.originalShortcut.toolbarButtonColor;
        }
    }

    @computed
    get codeEditorMode() {
        if (this.shortcut.action!.type === "scpi-commands") {
            return "scpi";
        } else {
            return "javascript";
        }
    }

    componentWillReceiveProps(nextProps: ShortcutDialogProps) {
        this.codeError = nextProps.codeError;
    }

    render() {
        let resetToDefaultButton: IDialogButton | undefined;
        if (this.isExtensionShortcut && this.hasChanges) {
            resetToDefaultButton = {
                id: "resetToDefault",
                type: "secondary",
                position: "left",
                onClick: this.resetToDefault,
                disabled: false,
                style: { marginRight: "auto" },
                text: "Reset to default values"
            };
        }

        return (
            <Dialog onOk={this.handleSubmit} size="large" additionalButton={resetToDefaultButton}>
                <PropertyList>
                    <TextInputProperty
                        name="Name"
                        value={this.shortcut.name!}
                        onChange={action((value: string) => {
                            this.shortcut.name = value;
                            this.revalidate();
                        })}
                        errors={this.validator.errors.name}
                    />

                    {this.props.shortcutsStore.renderUsedInProperty &&
                        this.props.shortcutsStore.renderUsedInProperty(this.shortcut)}

                    {this.props.groupsStore && !this.isExtensionShortcut && (
                        <SelectProperty
                            name="Group"
                            value={this.shortcut.groupName!}
                            onChange={action((value: string) => {
                                this.shortcut.groupName = value;
                                this.revalidate();
                            })}
                            errors={this.validator.errors.groupName}
                        >
                            <option key="" value="" />
                            {values(this.props.groupsStore.groups).map(group => (
                                <option key={group.id} value={group.name}>
                                    {group.name}
                                </option>
                            ))}
                        </SelectProperty>
                    )}

                    {this.props.groupsStore && this.isExtensionShortcut && (
                        <StaticProperty name="Group" value={this.groupName} />
                    )}

                    <KeybindingProperty
                        name="Keybinding"
                        value={this.shortcut.keybinding!}
                        onChange={action((value: string) => {
                            this.shortcut.keybinding = value;
                            this.revalidate();
                        })}
                        errors={this.validator.errors.keybinding}
                    />

                    <SelectProperty
                        name="Action type"
                        value={this.shortcut.action!.type}
                        onChange={action(
                            (value: IActionType) => (this.shortcut.action!.type = value)
                        )}
                    >
                        <option value="scpi-commands">SCPI</option>
                        <option value="javascript">JavaScript</option>
                    </SelectProperty>

                    <CodeEditorProperty
                        name="Action code"
                        value={this.shortcut.action!.data}
                        onChange={action((value: string) => {
                            this.codeError = undefined;
                            this.shortcut.action!.data = value;
                        })}
                        errors={this.codeErrors}
                        readOnly={this.isExtensionShortcut}
                        mode={this.codeEditorMode}
                        lineNumber={this.props.codeErrorLineNumber}
                        columnNumber={this.props.codeErrorColumnNumber}
                    />

                    <BooleanProperty
                        name="Requires confirmation"
                        value={this.shortcut.requiresConfirmation!}
                        onChange={action(
                            (value: boolean) => (this.shortcut.requiresConfirmation = value)
                        )}
                    />

                    <BooleanProperty
                        name="Show in toolbar"
                        value={this.shortcut.showInToolbar!}
                        onChange={action((value: boolean) => (this.shortcut.showInToolbar = value))}
                    />

                    {this.shortcut.showInToolbar && (
                        <NumberInputProperty
                            name="Button position"
                            value={this.shortcut.toolbarButtonPosition!}
                            onChange={action((value: number) => {
                                this.shortcut.toolbarButtonPosition = value;
                                this.revalidate();
                            })}
                            min={1}
                            errors={this.validator.errors.toolbarButtonPosition}
                        />
                    )}

                    {this.shortcut.showInToolbar && (
                        <SelectProperty
                            name="Button color"
                            value={this.shortcut.toolbarButtonColor!}
                            onChange={action(
                                (value: string) => (this.shortcut.toolbarButtonColor = value)
                            )}
                            selectStyle={{ backgroundColor: this.shortcut.toolbarButtonColor! }}
                        >
                            {TOOLBAR_BUTTON_COLORS.map(color => (
                                <option
                                    key={color}
                                    value={color}
                                    style={{ backgroundColor: color }}
                                >
                                    &nbsp;
                                </option>
                            ))}
                        </SelectProperty>
                    )}
                </PropertyList>
            </Dialog>
        );
    }
}

export function showShortcutDialog(
    shortcutsStore: IShortcutsStore,
    groupsStore: IGroupsStore | undefined,
    shortcut: Partial<IShortcut>,
    callback: (shortcut: Partial<IShortcut>) => void,
    codeError?: string,
    codeErrorLineNumber?: number,
    codeErrorColumnNumber?: number
) {
    showDialog(
        <ShortcutDialog
            shortcutsStore={shortcutsStore}
            groupsStore={groupsStore}
            shortcut={shortcut}
            callback={callback}
            codeError={codeError}
            codeErrorLineNumber={codeErrorLineNumber}
            codeErrorColumnNumber={codeErrorColumnNumber}
        />
    );

    // let win = new EEZStudio.electron.remote.BrowserWindow({
    //     parent: EEZStudio.electron.remote.getCurrentWindow(),
    //     modal: true,
    //     title: "Edit Shortuct Definition - EEZ Studio",
    //     minimizable: false,
    //     maximizable: false
    // });

    // win.loadURL(`file://${__dirname}/../../../../eez-studio-shared/download.html`);

    // win.setMenu(null);
}
