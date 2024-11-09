import React from "react";
import { observable, action, makeObservable } from "mobx";
import { observer } from "mobx-react";

import { makeValidator, validators } from "eez-studio-shared/validation";
import { PropertyList, TextInputProperty } from "eez-studio-ui/properties";
import { Dialog } from "eez-studio-ui/dialog";

import { IGroup, IGroupsStore } from "shortcuts/interfaces";

export const GroupDialog = observer(
    class GroupDialog extends React.Component<{
        groupsStore: IGroupsStore;
        group: IGroup;
        callback: (group: IGroup) => void;
    }> {
        constructor(props: any) {
            super(props);

            makeObservable(this, {
                group: observable
            });

            this.group = { ...this.props.group };
        }

        group: IGroup;

        validator = makeValidator({
            name: [
                validators.required,
                () => {
                    if (
                        Array.from(this.props.groupsStore.groups.values()).find(
                            group =>
                                group.name === this.group.name &&
                                group.id !== this.group.id
                        )
                    ) {
                        return "Group with the same name already exists.";
                    }
                    return null;
                }
            ]
        });

        handleSubmit = async () => {
            if (!(await this.validator.checkValidity(this.group))) {
                return false;
            }
            this.props.callback(this.group);
            return true;
        };

        render() {
            return (
                <Dialog onOk={this.handleSubmit}>
                    <PropertyList>
                        <TextInputProperty
                            name="Name"
                            value={this.group.name!}
                            onChange={action(
                                (value: string) => (this.group.name = value)
                            )}
                            errors={this.validator.errors.name}
                        />
                    </PropertyList>
                </Dialog>
            );
        }
    }
);
