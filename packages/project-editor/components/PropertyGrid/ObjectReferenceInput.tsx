import React from "react";
import ReactDOM from "react-dom";
import { action, observable, makeObservable } from "mobx";
import { observer } from "mobx-react";

import { SearchInput } from "eez-studio-ui/search-input";

import { ProjectContext } from "project-editor/project/context";
import { IEezObject, PropertyInfo } from "project-editor/core/object";
import { getNameProperty } from "project-editor/project/project";
import { SortDirectionType } from "project-editor/core/objectAdapter";
import { closest } from "eez-studio-shared/dom";

////////////////////////////////////////////////////////////////////////////////

export const ObjectReferenceInput = observer(
    class ObjectReferenceInput extends React.Component<{
        propertyInfo: PropertyInfo;
        value: any;
        onChange: (newValue: any) => void;
        readOnly: boolean;
    }> {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        buttonRef = React.createRef<HTMLButtonElement>();
        dropDownRef = React.createRef<HTMLDivElement>();
        dropDownOpen: boolean | undefined = false;
        dropDownLeft = 0;
        dropDownTop = 0;
        dropDownWidth = 0;

        sortDirection: SortDirectionType = "none";
        searchText: string = "";

        constructor(props: {
            propertyInfo: PropertyInfo;
            value: any;
            onChange: (newValue: any) => void;
            readOnly: boolean;
        }) {
            super(props);

            makeObservable(this, {
                dropDownOpen: observable,
                dropDownLeft: observable,
                dropDownTop: observable,
                dropDownWidth: observable,
                sortDirection: observable,
                searchText: observable,
                setDropDownOpen: action
            });
        }

        getObjectNames() {
            const { propertyInfo } = this.props;

            let objects: IEezObject[] =
                this.context.project.getAllObjectsOfType(
                    propertyInfo.referencedObjectCollectionPath!
                );

            return objects
                .slice()
                .map(object => getNameProperty(object))
                .filter(
                    objectName =>
                        !this.searchText ||
                        objectName
                            .toLowerCase()
                            .indexOf(this.searchText.toLowerCase()) != -1
                )
                .sort();
        }

        onChange = (event: React.ChangeEvent<HTMLInputElement>) => {
            this.props.onChange(event.target.value);
        };

        onSearchChange = action((event: any) => {
            this.searchText = ($(event.target).val() as string).trim();
        });

        setDropDownOpen(open: boolean) {
            if (this.dropDownOpen === false) {
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

            const dropDownEl = this.dropDownRef.current;
            if (!dropDownEl) {
                return;
            }

            this.setDropDownOpen(!this.dropDownOpen);

            if (this.dropDownOpen) {
                const rectInputGroup =
                    buttonEl.parentElement!.getBoundingClientRect();

                this.dropDownLeft = rectInputGroup.left;
                this.dropDownTop = rectInputGroup.bottom;
                this.dropDownWidth = rectInputGroup.width;

                if (
                    this.dropDownLeft + this.dropDownWidth >
                    window.innerWidth
                ) {
                    this.dropDownLeft = window.innerWidth - this.dropDownWidth;
                }

                const DROP_DOWN_HEIGHT = 270;
                if (
                    this.dropDownTop + DROP_DOWN_HEIGHT + 20 >
                    window.innerHeight
                ) {
                    this.dropDownTop =
                        window.innerHeight - (DROP_DOWN_HEIGHT + 20);
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
                    event.preventDefault();
                    event.stopPropagation();
                    this.setDropDownOpen(false);
                }
            }
        });

        render() {
            const { value, readOnly } = this.props;

            const objectNames = this.getObjectNames();

            return (
                <div className="input-group" style={{ position: "relative" }}>
                    <input
                        className="form-control"
                        type="text"
                        value={value}
                        onChange={this.onChange}
                        readOnly={readOnly}
                    />
                    {!readOnly && (
                        <>
                            <button
                                ref={this.buttonRef}
                                className="btn btn-outline-secondary dropdown-toggle EezStudio_ObjectReferenceInput_DropdownButton"
                                type="button"
                                onClick={this.openDropdown}
                            />
                            {ReactDOM.createPortal(
                                <div
                                    ref={this.dropDownRef}
                                    className="dropdown-menu dropdown-menu-end EezStudio_ObjectReferenceInput_DropdownContent shadow rounded"
                                    style={{
                                        display: this.dropDownOpen
                                            ? "block"
                                            : "none",
                                        left: this.dropDownLeft,
                                        top: this.dropDownTop,
                                        width: this.dropDownWidth
                                    }}
                                >
                                    <div>
                                        <SearchInput
                                            searchText={this.searchText}
                                            onChange={this.onSearchChange}
                                            onKeyDown={this.onSearchChange}
                                        />
                                    </div>
                                    <div>
                                        <ul>
                                            {objectNames.map(objectName => (
                                                <li
                                                    key={objectName}
                                                    onClick={action(() => {
                                                        this.props.onChange(
                                                            objectName
                                                        );
                                                        this.setDropDownOpen(
                                                            false
                                                        );
                                                    })}
                                                >
                                                    {objectName}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>,
                                document.body
                            )}
                        </>
                    )}
                </div>
            );
        }
    }
);
