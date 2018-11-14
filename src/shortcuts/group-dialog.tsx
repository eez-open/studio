import * as React from "react";
import { observable, action, values } from "mobx";
import { observer } from "mobx-react";

import { makeValidator, validators } from "eez-studio-shared/model/validation";
import { PropertyList, TextInputProperty } from "eez-studio-shared/ui/properties";
import { Dialog } from "eez-studio-shared/ui/dialog";

import { IGroup, IGroupsStore } from "shortcuts/interfaces";

@observer
export class GroupDialog extends React.Component<
    {
        groupsStore: IGroupsStore;
        group: IGroup;
        callback: (group: IGroup) => void;
    },
    {}
> {
    constructor(props: any) {
        super(props);

        this.handleSubmit = this.handleSubmit.bind(this);

        this.group = { ...this.props.group };
    }

    @observable group: IGroup;

    validator = makeValidator({
        name: [
            validators.required,
            () => {
                if (
                    values(this.props.groupsStore.groups).find(
                        group => group.name === this.group.name && group.id !== this.group.id
                    )
                ) {
                    return "Group with the same name already exists.";
                }
                return null;
            }
        ]
    });

    async handleSubmit() {
        if (!await this.validator.checkValidity(this.group)) {
            return false;
        }
        this.props.callback(this.group);
        return true;
    }

    render() {
        return (
            <Dialog onOk={this.handleSubmit}>
                <PropertyList>
                    <TextInputProperty
                        name="Name"
                        value={this.group.name!}
                        onChange={action((value: string) => (this.group.name = value))}
                        errors={this.validator.errors.name}
                    />
                </PropertyList>
            </Dialog>
        );
    }
}
