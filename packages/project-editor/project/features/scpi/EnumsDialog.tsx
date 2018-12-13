import React from "react";
import { observable, runInAction } from "mobx";
import { observer } from "mobx-react";
import { bind } from "bind-decorator";

import { Dialog, showDialog } from "eez-studio-ui/dialog";
import { Splitter } from "eez-studio-ui/splitter";
import styled from "eez-studio-ui/styled-components";

import { getProperty } from "eez-studio-shared/model/object";
import { NavigationStore } from "eez-studio-shared/model/store";
import { List } from "eez-studio-shared/model/components/List";
import { Panel } from "eez-studio-shared/model/components/Panel";
import { PropertyGrid } from "eez-studio-shared/model/components/PropertyGrid";

import { AddButton, DeleteButton } from "project-editor/project/ui/ListNavigation";

import { ProjectStore } from "project-editor/core/store";
import { Scpi, ScpiEnum } from "project-editor/project/features/scpi/scpi";

const BodyDiv = styled.div`
    display: flex;
    height: 400px;
    border: 1px solid ${props => props.theme.borderColor};
`;

const PropertyGridContainerDiv = styled.div`
    flex-grow: 1;
    display: flex;
`;

@observer
class EnumsDialog extends React.Component<{
    onSelect: (value: string) => void;
}> {
    @observable open = true;

    get enums() {
        let scpi = getProperty(ProjectStore.project, "scpi") as Scpi;
        return scpi.enums;
    }

    get selectedEnum() {
        const object = NavigationStore.getNavigationSelectedItemAsObject(this.enums);
        if (object instanceof ScpiEnum) {
            return object;
        }
        return undefined;
    }

    @bind
    onDoubleClickItem() {
        this.props.onSelect(this.selectedEnum!.name);
        runInAction(() => (this.open = false));
    }

    @bind
    handleSubmit() {
        if (this.selectedEnum) {
            this.props.onSelect(this.selectedEnum.name);
            return true;
        }
        return false;
    }

    render() {
        return (
            <Dialog
                size="large"
                onOk={this.handleSubmit}
                okButtonText="Select"
                cancelButtonText={"Close"}
                open={this.open}
            >
                <BodyDiv>
                    <Splitter
                        type="horizontal"
                        persistId="splitters/data-dialog"
                        sizes={`180px|100%`}
                        childrenOverflow={"visible"}
                    >
                        <Panel
                            id="scpi-enums"
                            title={"SCPI Enumarations"}
                            buttons={[
                                <AddButton key="add" navigationObject={this.enums} />,
                                <DeleteButton key="delete" navigationObject={this.enums} />
                            ]}
                            body={
                                <List
                                    navigationObject={this.enums}
                                    onDoubleClick={this.onDoubleClickItem}
                                    tabIndex={0}
                                />
                            }
                        />
                        <PropertyGridContainerDiv>
                            {this.selectedEnum && <PropertyGrid object={this.selectedEnum} />}
                        </PropertyGridContainerDiv>
                    </Splitter>
                </BodyDiv>
            </Dialog>
        );
    }
}

export default function showEnumsDialog(onSelect: (value: string) => void) {
    showDialog(<EnumsDialog onSelect={onSelect} />);
}
