import React from "react";
import ReactDOM from "react-dom";
import { action, observable, makeObservable } from "mobx";
import { observer } from "mobx-react";

import { closest } from "eez-studio-shared/dom";

import { EnumItem } from "project-editor/core/object";
import { humanize } from "eez-studio-shared/string";

////////////////////////////////////////////////////////////////////////////////

export const IconEnumDropdown = observer(
    class IconEnumDropdown extends React.Component<{
        enumItems: EnumItem[];
        value: any;
        onChange: (value: any) => void;
    }> {
        buttonRef = React.createRef<HTMLButtonElement>();
        dropDownRef = React.createRef<HTMLDivElement>();
        dropDownOpen = false;
        dropDownRight = 0;
        dropDownTop = 0;
        hoveredItemId: string | undefined = undefined;

        constructor(props: any) {
            super(props);

            makeObservable(this, {
                dropDownOpen: observable,
                dropDownRight: observable,
                dropDownTop: observable,
                hoveredItemId: observable,
                setDropDownOpen: action
            });
        }

        setDropDownOpen(open: boolean) {
            if (!open) {
                document.removeEventListener(
                    "pointerdown",
                    this.onDocumentPointerDown,
                    true
                );
            }

            this.dropDownOpen = open;

            if (this.dropDownOpen) {
                document.addEventListener(
                    "pointerdown",
                    this.onDocumentPointerDown,
                    true
                );
            }
        }

        openDropdown = action(() => {
            const buttonEl = this.buttonRef.current;
            if (!buttonEl) {
                return;
            }

            this.setDropDownOpen(!this.dropDownOpen);

            if (this.dropDownOpen) {
                this.hoveredItemId = undefined;
                const rect = buttonEl.getBoundingClientRect();

                this.dropDownRight = window.innerWidth - rect.right;
                this.dropDownTop = rect.bottom;

                const DROP_DOWN_HEIGHT = 200;
                if (
                    this.dropDownTop + DROP_DOWN_HEIGHT + 20 >
                    window.innerHeight
                ) {
                    this.dropDownTop = rect.top - DROP_DOWN_HEIGHT;
                }
            }
        });

        onDocumentPointerDown = action((event: MouseEvent) => {
            if (this.dropDownOpen) {
                if (
                    !closest(
                        event.target,
                        el =>
                            this.buttonRef.current == el ||
                            this.dropDownRef.current == el
                    )
                ) {
                    //event.preventDefault();
                    //event.stopPropagation();
                    this.setDropDownOpen(false);
                }
            }
        });

        componentWillUnmount() {
            document.removeEventListener(
                "pointerdown",
                this.onDocumentPointerDown,
                true
            );
        }

        render() {
            const { enumItems, value } = this.props;

            const selectedItem = enumItems.find(
                item => item.id.toString() === value?.toString()
            );

            const portal = ReactDOM.createPortal(
                <div
                    ref={this.dropDownRef}
                    className="dropdown-menu EezStudio_IconEnumDropdown_Menu shadow rounded"
                    style={{
                        display: this.dropDownOpen ? "block" : "none",
                        right: this.dropDownRight,
                        top: this.dropDownTop
                    }}
                >
                    <ul>
                        {enumItems.map(item => {
                            const id = item.id.toString();
                            const label = item.label || humanize(id);
                            const isSelected =
                                id === value?.toString();
                            const isHighlighted =
                                this.hoveredItemId !== undefined
                                    ? this.hoveredItemId === id
                                    : isSelected;
                            return (
                                <li
                                    key={id}
                                    className={
                                        isHighlighted
                                            ? "highlighted"
                                            : ""
                                    }
                                    onMouseEnter={action(
                                        () => {
                                            this.hoveredItemId =
                                                id;
                                        }
                                    )}
                                    onClick={action(() => {
                                        this.props.onChange(item.id);
                                        this.setDropDownOpen(false);
                                    })}
                                >
                                    <span className="EezStudio_IconEnumDropdown_ItemIcon">
                                        {item.icon}
                                    </span>
                                    <span className="EezStudio_IconEnumDropdown_ItemLabel">
                                        {label}
                                    </span>
                                </li>
                            );
                        })}
                    </ul>
                </div>,
                document.body
            );

            return (
                <div className="EezStudio_IconEnumDropdown">
                    <button
                        ref={this.buttonRef}
                        className="btn btn-secondary EezStudio_IconEnumDropdown_Button"
                        type="button"
                        onClick={this.openDropdown}
                        title={
                            selectedItem
                                ? selectedItem.label ||
                                  humanize(selectedItem.id.toString())
                                : ""
                        }
                    >
                        {selectedItem?.icon}
                        <span className="EezStudio_IconEnumDropdown_Caret" />
                    </button>
                    {portal}
                </div>
            );
        }
    }
);
