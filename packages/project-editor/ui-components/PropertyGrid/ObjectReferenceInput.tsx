import React from "react";
import ReactDOM from "react-dom";
import { action, observable, makeObservable } from "mobx";
import { observer } from "mobx-react";

import { closest } from "eez-studio-shared/dom";

import { SearchInput } from "eez-studio-ui/search-input";

import { ProjectContext } from "project-editor/project/context";
import { IEezObject, PropertyInfo } from "project-editor/core/object";
import { findBitmap } from "project-editor/project/project";
import { SortDirectionType } from "project-editor/core/objectAdapter";
import { getEnumItems } from "./utils";

////////////////////////////////////////////////////////////////////////////////

export const ObjectReferenceInput = observer(
    class ObjectReferenceInput extends React.Component<{
        objects: IEezObject[];
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

        constructor(props: any) {
            super(props);

            makeObservable(this, {
                dropDownOpen: observable,
                dropDownLeft: observable,
                dropDownTop: observable,
                dropDownWidth: observable,
                sortDirection: observable,
                searchText: observable,
                onSearchChange: action.bound,
                setDropDownOpen: action
            });
        }

        getObjectNames() {
            const { propertyInfo } = this.props;

            if (!propertyInfo.referencedObjectCollectionPath) {
                if (propertyInfo.enumItems) {
                    return getEnumItems(this.props.objects, propertyInfo)
                        .filter(
                            enumItem =>
                                (enumItem.label || enumItem.id.toString())
                                    .toLowerCase()
                                    .indexOf(
                                        this.searchText.trim().toLowerCase()
                                    ) != -1
                        )
                        .map(enumItem => enumItem.id);
                }
                return [];
            }

            let assets = this.context.project._assets.maps[
                "name"
            ].getAllObjectsOfType(propertyInfo.referencedObjectCollectionPath!);

            return assets
                .slice()
                .filter(asset =>
                    propertyInfo.filterReferencedObjectCollection
                        ? propertyInfo.filterReferencedObjectCollection(
                              this.props.objects,
                              asset.object
                          )
                        : true
                )
                .map(asset => asset.name)
                .filter(
                    objectName =>
                        !this.searchText ||
                        objectName
                            .toLowerCase()
                            .indexOf(this.searchText.trim().toLowerCase()) != -1
                )
                .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
        }

        onChange = (event: React.ChangeEvent<HTMLInputElement>) => {
            this.props.onChange(event.target.value);
        };

        onSearchChange(event: any) {
            this.searchText = $(event.target).val() as string;
        }

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

            const portal = ReactDOM.createPortal(
                <div
                    ref={this.dropDownRef}
                    className="dropdown-menu dropdown-menu-end EezStudio_ObjectReferenceInput_DropdownContent shadow rounded"
                    style={{
                        display: this.dropDownOpen ? "block" : "none",
                        left: this.dropDownLeft,
                        top: this.dropDownTop,
                        width: this.dropDownWidth
                    }}
                >
                    <div>
                        <SearchInput
                            searchText={this.searchText}
                            onClear={action(() => {
                                this.searchText = "";
                            })}
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
                                        this.props.onChange(objectName);
                                        this.setDropDownOpen(false);
                                    })}
                                >
                                    {objectName}
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>,
                document.body
            );

            let bitmap;
            if (
                !this.props.propertyInfo.disableBitmapPreview &&
                this.props.propertyInfo.referencedObjectCollectionPath ===
                    "bitmaps"
            ) {
                bitmap = findBitmap(this.context.project, this.props.value);
            }

            const placeholder =
                this.props.propertyInfo.inputPlaceholder &&
                this.props.objects.length == 1
                    ? this.props.propertyInfo.inputPlaceholder(
                          this.props.objects[0]
                      )
                    : "";

            return (
                <div style={{ width: "100%" }}>
                    <div className="input-group">
                        <input
                            className="form-control"
                            type="text"
                            value={value}
                            onChange={this.onChange}
                            readOnly={readOnly}
                            placeholder={placeholder}
                        />
                        {!readOnly && (
                            <>
                                <button
                                    ref={this.buttonRef}
                                    className="btn btn-secondary dropdown-toggle EezStudio_ObjectReferenceInput_DropdownButton"
                                    type="button"
                                    onClick={this.openDropdown}
                                />
                                {portal}
                            </>
                        )}
                    </div>
                    {bitmap && bitmap.imageSrc && bitmap.imageElement && (
                        <div
                            className="EezStudio_BitmapEditorContainer"
                            style={{ marginTop: 5, marginBottom: 10 }}
                        >
                            <div style={{ marginBottom: 5 }}>
                                Dimension: {bitmap.imageElement.width} x{" "}
                                {bitmap.imageElement.height} px
                            </div>
                            <div>
                                <img
                                    src={bitmap.imageSrc}
                                    style={{
                                        backgroundColor: bitmap.backgroundColor
                                    }}
                                />
                            </div>
                        </div>
                    )}
                </div>
            );
        }
    }
);
