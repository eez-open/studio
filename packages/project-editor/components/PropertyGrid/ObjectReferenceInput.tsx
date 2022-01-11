import React from "react";
import ReactDOM from "react-dom";
import { action, observable } from "mobx";
import { observer } from "mobx-react";

import { SearchInput } from "eez-studio-ui/search-input";

import { ProjectContext } from "project-editor/project/context";
import { IEezObject, PropertyInfo } from "project-editor/core/object";
import { getNameProperty } from "project-editor/project/project";
import { SortDirectionType } from "project-editor/core/objectAdapter";
import { closest } from "eez-studio-shared/dom";

////////////////////////////////////////////////////////////////////////////////

@observer
export class ObjectReferenceInput extends React.Component<{
    propertyInfo: PropertyInfo;
    value: any;
    onChange: (newValue: any) => void;
    readOnly: boolean;
}> {
    static contextType = ProjectContext;
    declare context: React.ContextType<typeof ProjectContext>;

    @observable dropdownOpen = false;
    @observable dropdownLeft = 0;
    @observable dropdownTop = 0;
    @observable dropdownWidth = 0;

    buttonRef = React.createRef<HTMLButtonElement>();
    dropDownRef = React.createRef<HTMLDivElement>();

    @observable sortDirection: SortDirectionType = "none";
    @observable searchText: string = "";

    getObjectNames() {
        const { propertyInfo } = this.props;

        let objects: IEezObject[] = this.context.project.getAllObjectsOfType(
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

    openDropdown = action(() => {
        const buttonEl = this.buttonRef.current;
        if (!buttonEl) {
            return;
        }

        const dropDownEl = this.dropDownRef.current;
        if (!dropDownEl) {
            return;
        }

        this.dropdownOpen = !this.dropdownOpen;
        if (this.dropdownOpen) {
            const rectInputGroup =
                buttonEl.parentElement!.getBoundingClientRect();

            this.dropdownLeft = rectInputGroup.left;
            this.dropdownTop = rectInputGroup.bottom;
            this.dropdownWidth = rectInputGroup.width;

            if (this.dropdownLeft + this.dropdownWidth > window.innerWidth) {
                this.dropdownLeft = window.innerWidth - this.dropdownWidth;
            }

            const DROP_DOWN_HEIGHT = 270;
            if (this.dropdownTop + DROP_DOWN_HEIGHT + 20 > window.innerHeight) {
                this.dropdownTop = window.innerHeight - (DROP_DOWN_HEIGHT + 20);
            }
        }
    });

    onDocumentClick = action((event: MouseEvent) => {
        if (this.dropdownOpen) {
            if (
                !closest(
                    event.target,
                    el =>
                        this.buttonRef.current == el ||
                        this.dropDownRef.current == el
                )
            ) {
                this.dropdownOpen = false;
            }
        }
    });

    componentDidMount() {
        document.addEventListener("click", this.onDocumentClick, true);
    }

    componentWillUnmount() {
        document.removeEventListener("click", this.onDocumentClick, true);
    }

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
                                    display: this.dropdownOpen
                                        ? "block"
                                        : "none",
                                    left: this.dropdownLeft,
                                    top: this.dropdownTop,
                                    width: this.dropdownWidth
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
                                                    this.dropdownOpen = false;
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
