import React from "react";
import { observable, computed, action, makeObservable } from "mobx";
import { observer } from "mobx-react";

import { objectClone } from "eez-studio-shared/util";
import { isReserverdKeybinding } from "eez-studio-shared/util-renderer";
import {
    makeValidator,
    validators,
    VALIDATION_MESSAGE_REQUIRED
} from "eez-studio-shared/validation";
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

import type {
    IActionType,
    IShortcut,
    IShortcutsStore,
    IGroupsStore
} from "shortcuts/interfaces";
import { TOOLBAR_BUTTON_COLORS } from "shortcuts/toolbar-button-colors";

import { isSameShortcutFromDifferentExtension } from "shortcuts/isSameShortcutFromDifferentExtension";
import {
    SHORTCUTS_GROUP_NAME_FOR_EXTENSION_PREFIX,
    FROM_EXTENSION_GROUP_NAME
} from "shortcuts/shortcuts-store";

interface ShortcutDialogProps {
    shortcutsStore: IShortcutsStore;
    groupsStore?: IGroupsStore;
    shortcut: Partial<IShortcut>;
    callback: (shortcut: Partial<IShortcut>) => void;
    codeError: string | undefined;
    codeErrorLineNumber: number | undefined;
    codeErrorColumnNumber: number | undefined;
    hideCodeEditor: boolean | undefined;
}

export const ShortcutDialog = observer(
    class ShortcutDialog extends React.Component<ShortcutDialogProps> {
        constructor(props: any) {
            super(props);

            makeObservable(this, {
                shortcut: observable,
                codeError: observable,
                codeErrors: computed,
                isExtensionShortcut: computed,
                extension: computed,
                groupName: computed,
                originalShortcut: computed,
                hasChanges: computed,
                resetToDefault: action,
                codeEditorMode: computed
            });

            this.shortcut = objectClone(props.shortcut);
        }

        shortcut: Partial<IShortcut>;
        wasValidated: boolean = false;

        validator = makeValidator({
            name: [
                validators.required,
                () => {
                    if (
                        this.shortcut.name !== this.props.shortcut.name &&
                        Array.from(
                            this.props.shortcutsStore.shortcuts.values()
                        ).find(
                            shortcut =>
                                shortcut.name === this.shortcut.name &&
                                shortcut.id !== this.shortcut.id &&
                                !isSameShortcutFromDifferentExtension(
                                    shortcut,
                                    this.props.shortcut as IShortcut
                                )
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
                    if (
                        this.props.hideCodeEditor !== true &&
                        this.shortcut.action!.data.trim() === ""
                    ) {
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

        codeError: string | undefined = this.props.codeError;

        get codeErrors() {
            if (this.validator.errors.actionCode) {
                if (this.codeError) {
                    return this.validator.errors.actionCode.concat([
                        this.codeError
                    ]);
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

        handleSubmit = async () => {
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
        };

        async revalidate() {
            if (this.wasValidated) {
                await this.validator.checkValidity(this.shortcut);
            }
        }

        get isExtensionShortcut() {
            return (
                !!this.props.shortcut.groupName &&
                this.props.shortcut.groupName.startsWith(
                    SHORTCUTS_GROUP_NAME_FOR_EXTENSION_PREFIX
                )
            );
        }

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

        get groupName() {
            let groupName = this.props.shortcut.groupName;
            if (!groupName) {
                return "";
            }

            if (
                groupName.startsWith(SHORTCUTS_GROUP_NAME_FOR_EXTENSION_PREFIX)
            ) {
                if (
                    this.props.groupsStore &&
                    this.props.groupsStore.isGroupEnabled
                ) {
                    return FROM_EXTENSION_GROUP_NAME;
                }
                if (this.extension) {
                    return (
                        "Extension: " +
                        (this.extension.displayName || this.extension.name)
                    );
                }
            }

            return groupName;
        }

        get originalShortcut() {
            if (
                this.extension &&
                this.extension.properties &&
                this.extension.properties.shortcuts
            ) {
                return this.extension.properties.shortcuts!.find(
                    shortcut => shortcut.id === this.props.shortcut.originalId
                );
            }
            return undefined;
        }

        get hasChanges() {
            return (
                !!this.originalShortcut &&
                (this.shortcut.name !== this.originalShortcut.name ||
                    this.shortcut.keybinding !==
                        this.originalShortcut.keybinding ||
                    this.shortcut.requiresConfirmation !==
                        this.originalShortcut.requiresConfirmation ||
                    this.shortcut.showInToolbar !==
                        this.originalShortcut.showInToolbar ||
                    (this.shortcut.showInToolbar &&
                        (this.shortcut.toolbarButtonPosition !==
                            this.originalShortcut.toolbarButtonPosition ||
                            this.shortcut.toolbarButtonColor !==
                                this.originalShortcut.toolbarButtonColor)))
            );
        }

        resetToDefault = (event: any) => {
            event.preventDefault();

            if (this.originalShortcut) {
                this.shortcut.name = this.originalShortcut.name;
                this.shortcut.keybinding = this.originalShortcut.keybinding;
                this.shortcut.requiresConfirmation =
                    this.originalShortcut.requiresConfirmation;
                this.shortcut.showInToolbar =
                    this.originalShortcut.showInToolbar;
                this.shortcut.toolbarButtonPosition =
                    this.originalShortcut.toolbarButtonPosition;
                this.shortcut.toolbarButtonColor =
                    this.originalShortcut.toolbarButtonColor;
            }
        };

        get codeEditorMode() {
            if (
                this.shortcut.action!.type === "scpi-commands" ||
                this.shortcut.action!.type === "commands"
            ) {
                return "scpi";
            } else {
                return "javascript";
            }
        }

        componentDidUpdate(prevProps: any) {
            if (this.props != prevProps) {
                this.codeError = this.props.codeError;
            }
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
                <Dialog
                    onOk={this.handleSubmit}
                    size="large"
                    additionalButtons={
                        resetToDefaultButton ? [resetToDefaultButton] : []
                    }
                >
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
                            this.props.shortcutsStore.renderUsedInProperty(
                                this.shortcut
                            )}

                        {this.props.groupsStore &&
                            !this.isExtensionShortcut && (
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
                                    {Array.from(
                                        this.props.groupsStore.groups.values()
                                    ).map(group => (
                                        <option
                                            key={group.id}
                                            value={group.name}
                                        >
                                            {group.name}
                                        </option>
                                    ))}
                                </SelectProperty>
                            )}

                        {this.props.groupsStore && this.isExtensionShortcut && (
                            <StaticProperty
                                name="Group"
                                value={this.groupName}
                            />
                        )}

                        {this.shortcut.action!.type !== "micropython" && (
                            <KeybindingProperty
                                name="Keybinding"
                                value={this.shortcut.keybinding!}
                                onChange={action((value: string) => {
                                    this.shortcut.keybinding = value;
                                    this.revalidate();
                                })}
                                errors={this.validator.errors.keybinding}
                            />
                        )}

                        {!this.isExtensionShortcut && (
                            <SelectProperty
                                name="Action type"
                                value={this.shortcut.action!.type}
                                onChange={action(
                                    (value: IActionType) =>
                                        (this.shortcut.action!.type = value)
                                )}
                            >
                                {this.props.shortcutsStore.isScpiInstrument ? (
                                    <option value="scpi-commands">SCPI</option>
                                ) : (
                                    <option value="commands">Commands</option>
                                )}
                                <option value="javascript">JavaScript</option>
                                {this.props.shortcutsStore.isScpiInstrument && (
                                    <option value="micropython">
                                        MicroPython
                                    </option>
                                )}
                            </SelectProperty>
                        )}
                        {this.isExtensionShortcut && (
                            <StaticProperty
                                name="Action type"
                                value={
                                    this.shortcut.action!.type ===
                                    "scpi-commands"
                                        ? "SCPI"
                                        : this.shortcut.action!.type ===
                                          "commands"
                                        ? "Commands"
                                        : this.shortcut.action!.type ===
                                          "javascript"
                                        ? "JavaScript"
                                        : "MicroPython"
                                }
                            />
                        )}

                        {this.props.hideCodeEditor !== true && (
                            <CodeEditorProperty
                                name={
                                    "Action code" +
                                    (this.isExtensionShortcut
                                        ? " (read only)"
                                        : "")
                                }
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
                        )}

                        {this.shortcut.action!.type !== "micropython" && (
                            <BooleanProperty
                                name="Requires confirmation"
                                value={this.shortcut.requiresConfirmation!}
                                onChange={action(
                                    (value: boolean) =>
                                        (this.shortcut.requiresConfirmation =
                                            value)
                                )}
                            />
                        )}

                        {this.shortcut.action!.type !== "micropython" && (
                            <BooleanProperty
                                name="Show in Shortcuts bar"
                                value={this.shortcut.showInToolbar!}
                                onChange={action(
                                    (value: boolean) =>
                                        (this.shortcut.showInToolbar = value)
                                )}
                            />
                        )}

                        {this.shortcut.action!.type !== "micropython" &&
                            this.shortcut.showInToolbar && (
                                <NumberInputProperty
                                    name="Button position"
                                    value={this.shortcut.toolbarButtonPosition!}
                                    onChange={action((value: number) => {
                                        this.shortcut.toolbarButtonPosition =
                                            value;
                                        this.revalidate();
                                    })}
                                    min={1}
                                    errors={
                                        this.validator.errors
                                            .toolbarButtonPosition
                                    }
                                />
                            )}

                        {this.shortcut.action!.type !== "micropython" &&
                            this.shortcut.showInToolbar && (
                                <SelectProperty
                                    name="Button color"
                                    value={this.shortcut.toolbarButtonColor!}
                                    onChange={action(
                                        (value: string) =>
                                            (this.shortcut.toolbarButtonColor =
                                                value)
                                    )}
                                    selectStyle={{
                                        backgroundColor:
                                            this.shortcut.toolbarButtonColor!
                                    }}
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
);

export function showShortcutDialog(
    shortcutsStore: IShortcutsStore,
    groupsStore: IGroupsStore | undefined,
    shortcut: Partial<IShortcut>,
    callback: (shortcut: Partial<IShortcut>) => void,
    codeError?: string,
    codeErrorLineNumber?: number,
    codeErrorColumnNumber?: number,
    hideCodeEditor?: boolean
) {
    if (shortcutsStore.showShortcutDialog) {
        shortcutsStore.showShortcutDialog(
            shortcutsStore,
            groupsStore,
            shortcut,
            callback,
            codeError,
            codeErrorLineNumber,
            codeErrorColumnNumber,
            hideCodeEditor
        );
    } else {
        showDialog(
            <ShortcutDialog
                shortcutsStore={shortcutsStore}
                groupsStore={groupsStore}
                shortcut={shortcut}
                callback={callback}
                codeError={codeError}
                codeErrorLineNumber={codeErrorLineNumber}
                codeErrorColumnNumber={codeErrorColumnNumber}
                hideCodeEditor={hideCodeEditor}
            />
        );
    }
}
