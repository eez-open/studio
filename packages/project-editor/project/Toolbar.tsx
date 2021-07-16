import React from "react";
import { action } from "mobx";
import { observer } from "mobx-react";
import classNames from "classnames";
import styled from "eez-studio-ui/styled-components";
import { objectToString } from "project-editor/core/object";
import { startSearch } from "project-editor/core/search";
import { ButtonAction, IconAction } from "eez-studio-ui/action";
import { BuildConfiguration } from "project-editor/project/project";
import { ProjectContext } from "project-editor/project/context";
import { RuntimeToolbar } from "project-editor/flow/runtime";

const MATCH_CASE_ICON =
    "data:image/svg+xml;charset=utf-8,%3Csvg width='16' height='16' viewBox='0 0 16 16' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath fill-rule='evenodd' clip-rule='evenodd' d='M7.495 9.052l.891 2.35h1.091L6.237 3h-1.02L2 11.402h1.095l.838-2.35h3.562zM5.811 4.453l.044.135 1.318 3.574H4.255l1.307-3.574.044-.135.038-.156.032-.152.021-.126h.023l.024.126.029.152.038.156zm7.984 6.011v.936h.96V7.498c0-.719-.18-1.272-.539-1.661-.359-.389-.889-.583-1.588-.583-.199 0-.401.019-.606.056a4.875 4.875 0 0 0-1.078.326 2.081 2.081 0 0 0-.343.188v.984c.266-.23.566-.411.904-.54a2.927 2.927 0 0 1 1.052-.193c.188 0 .358.028.513.085a.98.98 0 0 1 .396.267c.109.121.193.279.252.472.059.193.088.427.088.7l-1.811.252c-.344.047-.64.126-.888.237a1.947 1.947 0 0 0-.615.419 1.6 1.6 0 0 0-.36.58 2.134 2.134 0 0 0-.117.721c0 .246.042.475.124.688.082.213.203.397.363.551.16.154.36.276.598.366.238.09.513.135.826.135.402 0 .76-.092 1.075-.278.315-.186.572-.454.771-.806h.023zm-2.128-1.743c.176-.064.401-.114.674-.149l1.465-.205v.609c0 .246-.041.475-.123.688a1.727 1.727 0 0 1-.343.557 1.573 1.573 0 0 1-.524.372 1.63 1.63 0 0 1-.668.135c-.187 0-.353-.025-.495-.076a1.03 1.03 0 0 1-.357-.211.896.896 0 0 1-.22-.316A1.005 1.005 0 0 1 11 9.732a1.6 1.6 0 0 1 .055-.44.739.739 0 0 1 .202-.334 1.16 1.16 0 0 1 .41-.237z' fill='%23007bff'/%3E%3C/svg%3E";

const MATCH_WHOLE_WORD_ICON =
    "data:image/svg+xml;charset=utf-8,%3Csvg width='16' height='16' viewBox='0 0 16 16' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath fill-rule='evenodd' clip-rule='evenodd' d='M1 2h14v1H1V2zm13 2h-1v8h1V4zm-2.728 4.387a2.353 2.353 0 0 0-.36-.786 1.746 1.746 0 0 0-.609-.53 1.832 1.832 0 0 0-.866-.193c-.198 0-.38.024-.547.073a1.76 1.76 0 0 0-.453.205 1.724 1.724 0 0 0-.365.318l-.179.258V4.578H7V12h.893v-.575l.126.175c.087.102.189.19.304.269.117.078.249.14.398.186.149.046.314.068.498.068.353 0 .666-.071.937-.212.272-.143.499-.338.682-.586.183-.25.321-.543.414-.879.093-.338.14-.703.14-1.097a3.756 3.756 0 0 0-.12-.962zM9.793 7.78c.151.071.282.176.39.314.109.14.194.313.255.517.051.174.082.371.089.587l-.007.125c0 .327-.033.62-.1.869a1.886 1.886 0 0 1-.278.614c-.117.162-.26.285-.421.366-.322.162-.76.166-1.069.015a1.264 1.264 0 0 1-.393-.296 1.273 1.273 0 0 1-.218-.367s-.179-.447-.179-.947c0-.5.179-1.002.179-1.002.062-.177.136-.318.224-.43.114-.143.256-.259.424-.345.168-.086.365-.129.587-.129.19 0 .364.037.517.109zM15 13H1v1h14v-1zM2.813 10l-.728 2.031H1l.025-.072 2.441-7.086h.941l2.485 7.158H5.81L5.032 10H2.813zm1.121-3.578h-.022l-.905 2.753h1.841l-.914-2.753z' fill='%23007bff'/%3E%3C/svg%3E";

const ToolbarNav = styled.nav`
    padding: 5px;
    background-color: ${props => props.theme.panelHeaderColor};
    border-bottom: 1px solid ${props => props.theme.borderColor};

    .btn-group:not(:last-child) {
        margin-right: 20px;
    }

    select {
        height: 36px;
    }
`;
const SearchInput = styled.input`
    width: 200px;
    &.empty {
        font-family: "Material Icons";
    }
    margin-right: 5px;
`;

@observer
export class Toolbar extends React.Component {
    static contextType = ProjectContext;
    declare context: React.ContextType<typeof ProjectContext>;

    startSearch() {
        startSearch(
            this.context,
            this.context.UIStateStore.searchPattern,
            this.context.UIStateStore.searchMatchCase,
            this.context.UIStateStore.searchMatchWholeWord
        );
    }

    @action.bound
    onSearchPatternChange(event: any) {
        this.context.UIStateStore.searchPattern = event.target.value;
        this.startSearch();
    }

    @action.bound
    toggleMatchCase() {
        this.context.UIStateStore.searchMatchCase =
            !this.context.UIStateStore.searchMatchCase;
        this.startSearch();
    }

    @action.bound
    toggleMatchWholeWord() {
        this.context.UIStateStore.searchMatchWholeWord =
            !this.context.UIStateStore.searchMatchWholeWord;
        this.startSearch();
    }

    onSelectedBuildConfigurationChange(event: any) {
        this.context.UIStateStore.setSelectedBuildConfiguration(
            event.target.value
        );
    }

    get isBuildConfigurationSelectorVisible() {
        return (
            !this.context.isDashboardProject &&
            (this.context.project.pages ||
                this.context.project.actions ||
                this.context.project.data)
        );
    }

    render() {
        let configurations =
            this.context.project.settings.build.configurations.map(
                (item: BuildConfiguration) => {
                    return (
                        <option key={item.name} value={item.name}>
                            {objectToString(item)}
                        </option>
                    );
                }
            );

        return (
            <ToolbarNav className="navbar justify-content-between">
                <div>
                    <div className="btn-group" role="group">
                        <IconAction
                            title="Save"
                            icon="material:save"
                            onClick={() => this.context.save()}
                            enabled={this.context.isModified}
                        />
                    </div>

                    <div className="btn-group" role="group">
                        <IconAction
                            title={
                                this.context.UndoManager.canUndo
                                    ? `Undo "${this.context.UndoManager.undoDescription}"`
                                    : ""
                            }
                            icon="material:undo"
                            onClick={() => this.context.UndoManager.undo()}
                            enabled={this.context.UndoManager.canUndo}
                        />
                        <IconAction
                            title={
                                this.context.UndoManager.canRedo
                                    ? `Redo "${this.context.UndoManager.redoDescription}"`
                                    : ""
                            }
                            icon="material:redo"
                            onClick={() => this.context.UndoManager.redo()}
                            enabled={this.context.UndoManager.canRedo}
                        />
                    </div>

                    {this.isBuildConfigurationSelectorVisible && (
                        <div className="btn-group">
                            <select
                                title="Configuration"
                                id="btn-toolbar-configuration"
                                className="form-control"
                                value={
                                    this.context.UIStateStore
                                        .selectedBuildConfiguration
                                }
                                onChange={this.onSelectedBuildConfigurationChange.bind(
                                    this
                                )}
                            >
                                {configurations}
                            </select>
                        </div>
                    )}

                    {!this.context.isDashboardProject && (
                        <div className="btn-group" role="group">
                            <IconAction
                                title="Check"
                                icon="material:check"
                                onClick={() => this.context.check()}
                            />
                            <IconAction
                                title="Build"
                                icon="material:build"
                                onClick={() => this.context.build()}
                            />
                        </div>
                    )}
                </div>

                <div>
                    {(this.context.isDashboardProject ||
                        this.context.isAppletProject) && (
                        <div className="btn-group" role="group">
                            <ButtonAction
                                text="Run"
                                title="Enter run mode"
                                icon={
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        width="24"
                                        height="24"
                                        viewBox="0 0 24 24"
                                        strokeWidth="2"
                                        stroke="currentColor"
                                        fill="none"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    >
                                        <path
                                            stroke="none"
                                            d="M0 0h24v24H0z"
                                            fill="none"
                                        ></path>
                                        <circle cx="13" cy="4" r="1"></circle>
                                        <path d="M4 17l5 1l.75 -1.5"></path>
                                        <path d="M15 21l0 -4l-4 -3l1 -6"></path>
                                        <path d="M7 12l0 -3l5 -1l3 3l3 1"></path>
                                    </svg>
                                }
                                onClick={
                                    this.context.RuntimeStore.setRuntimeMode
                                }
                                selected={
                                    this.context.RuntimeStore.isRuntimeMode
                                }
                            />
                            <ButtonAction
                                text="Edit"
                                title="Enter edit mode"
                                icon="material:mode_edit"
                                onClick={
                                    this.context.RuntimeStore.setEditorMode
                                }
                                selected={
                                    !this.context.RuntimeStore.isRuntimeMode
                                }
                            />
                        </div>
                    )}
                </div>

                <div>
                    {this.context.RuntimeStore.isRuntimeMode && (
                        <RuntimeToolbar />
                    )}
                    {!this.context.RuntimeStore.isRuntimeMode && (
                        <div className="btn-group">
                            <SearchInput
                                className={classNames("form-control", {
                                    empty: !this.context.UIStateStore
                                        .searchPattern
                                })}
                                type="text"
                                placeholder="&#xe8b6;"
                                value={
                                    this.context.UIStateStore.searchPattern ??
                                    ""
                                }
                                onChange={this.onSearchPatternChange}
                            />
                            <div className="btn-group" role="group">
                                <IconAction
                                    icon={MATCH_CASE_ICON}
                                    title="Match case"
                                    iconSize={20}
                                    enabled={true}
                                    selected={
                                        this.context.UIStateStore
                                            .searchMatchCase
                                    }
                                    onClick={this.toggleMatchCase}
                                />
                                <IconAction
                                    icon={MATCH_WHOLE_WORD_ICON}
                                    title="Match whole word"
                                    iconSize={20}
                                    enabled={true}
                                    selected={
                                        this.context.UIStateStore
                                            .searchMatchWholeWord
                                    }
                                    onClick={this.toggleMatchWholeWord}
                                />
                                <IconAction
                                    title="Refresh search results"
                                    icon="material:refresh"
                                    enabled={true}
                                    onClick={() => this.startSearch()}
                                />
                            </div>
                        </div>
                    )}
                </div>
            </ToolbarNav>
        );
    }
}
