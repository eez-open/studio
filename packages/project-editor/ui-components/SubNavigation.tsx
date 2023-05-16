import React from "react";
import { computed, makeObservable, action } from "mobx";
import { observer } from "mobx-react";

import { ProjectContext } from "project-editor/project/context";
import classNames from "classnames";

export interface SubNavigationItem {
    name: string;
    component: React.ReactNode;
    numItems: number;
}

interface SubNavigationProps {
    id: string;
    items: SubNavigationItem[];
}

export const SubNavigation = observer(
    class SubNavigation extends React.Component<SubNavigationProps> {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        constructor(props: any) {
            super(props);

            makeObservable(this, {
                selectedItem: computed,
                selectItem: action.bound
            });
        }

        get selectedItem() {
            const selectedItem =
                this.context.navigationStore.subnavigationSelectedItems[
                    this.props.id
                ];

            if (
                selectedItem != undefined &&
                this.props.items.find(item => item.name == selectedItem)
            ) {
                return selectedItem;
            }

            return this.props.items[0].name;
        }

        selectItem(name: string) {
            this.context.navigationStore.subnavigationSelectedItems[
                this.props.id
            ] = name;
        }

        render() {
            return (
                <div
                    className="EezStudio_SubNavigation"
                    onContextMenu={e => e.preventDefault()}
                >
                    <ul className="nav nav-pills">
                        {this.props.items.map(item => (
                            <li
                                key={item.name}
                                className="nav-item"
                                onClick={() => this.selectItem(item.name)}
                            >
                                <a
                                    className={classNames("nav-link", {
                                        active: this.selectedItem == item.name
                                    })}
                                    href="#"
                                >
                                    {item.name}
                                    {item.numItems > 0 ? (
                                        <span
                                            className="badge rounded-pill bg-secondary ms-1"
                                            style={{
                                                opacity: 0.7,
                                                transform: "translateY(-1px)"
                                            }}
                                        >
                                            {item.numItems}
                                        </span>
                                    ) : (
                                        ""
                                    )}
                                </a>
                            </li>
                        ))}
                    </ul>
                    <div>
                        {this.props.items.find(
                            item => item.name == this.selectedItem
                        )?.component ?? null}
                    </div>
                </div>
            );
        }
    }
);
