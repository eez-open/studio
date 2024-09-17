import React from "react";
import { action, computed, makeObservable } from "mobx";
import { observer } from "mobx-react";
import { ButtonAction, IconAction } from "eez-studio-ui/action";
import { BuildConfiguration } from "project-editor/project/project";
import { ProjectContext } from "project-editor/project/context";
import { PageTabState } from "project-editor/features/page/PageEditor";
import {
    getChildren,
    getObjectIcon,
    objectToString
} from "project-editor/store";
import { RenderVariableStatus } from "project-editor/features/variable/global-variable-status";
import { FlowTabState } from "project-editor/flow/flow-tab-state";
import { RuntimeType } from "project-editor/project/project-type-traits";
import {
    PROJECT_EDITOR_SCRAPBOOK,
    RUN_ICON
} from "project-editor/ui-components/icons";
import { getEditorComponent } from "./EditorComponentFactory";
import { getId } from "project-editor/core/object";
import type { IObjectVariableValue } from "eez-studio-types";
import { getObjectVariableTypeFromType } from "project-editor/features/variable/value-type";
import {
    isScrapbookItemFilePath,
    showScrapbookManager,
    model as scrapbookModel
} from "project-editor/store/scrapbook";

////////////////////////////////////////////////////////////////////////////////

export const Toolbar = observer(
    class Toolbar extends React.Component {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        get globalVariableStatuses() {
            let globalVariablesStatus: React.ReactNode[] = [];

            for (const variable of this.context.project.allGlobalVariables) {
                const objectVariableType = getObjectVariableTypeFromType(
                    this.context,
                    variable.type
                );
                if (objectVariableType) {
                    let objectVariableValue: IObjectVariableValue | undefined =
                        this.context.dataContext.get(variable.fullName);

                    if (objectVariableValue) {
                        const managedValue =
                            objectVariableType.getValue(objectVariableValue);
                        if (managedValue) {
                            objectVariableValue = managedValue;
                        }
                    }

                    globalVariablesStatus.push(
                        <RenderVariableStatus
                            key={variable.fullName}
                            variable={variable}
                            value={objectVariableValue}
                            onClick={async () => {
                                if (objectVariableType.editConstructorParams) {
                                    const constructorParams =
                                        await objectVariableType.editConstructorParams(
                                            variable,
                                            objectVariableValue?.constructorParams ||
                                                objectVariableValue,
                                            true
                                        );
                                    if (constructorParams !== undefined) {
                                        this.context.runtime!.setObjectVariableValue(
                                            variable.fullName,
                                            objectVariableType.createValue(
                                                constructorParams,
                                                true
                                            )
                                        );
                                    }
                                }
                            }}
                        />
                    );
                }
            }

            return globalVariablesStatus;
        }

        render() {
            const showEditorButtons =
                this.context.context.type != "run-tab" &&
                !this.context.project._isDashboardBuild &&
                !(
                    this.context.runtime &&
                    !this.context.runtime.isDebuggerActive
                );

            const showRunEditSwitchControls =
                this.context.context.type != "run-tab" &&
                !this.context.project._isDashboardBuild &&
                this.context.projectTypeTraits.runtimeType != RuntimeType.NONE;

            const globalVariablesStatuses = this.context.runtime
                ? this.globalVariableStatuses
                : [];

            if (
                !showEditorButtons &&
                !showRunEditSwitchControls &&
                globalVariablesStatuses.length == 0
            ) {
                return null;
            }

            return (
                <nav className="navbar justify-content-between EezStudio_ToolbarNav">
                    {showEditorButtons ? <EditorButtons /> : <div />}

                    {showRunEditSwitchControls ? (
                        <RunEditSwitchControls />
                    ) : (
                        <div />
                    )}

                    <div
                        className="EezStudio_FlowRuntimeControls"
                        style={{ width: 0, justifyContent: "flex-end" }}
                    >
                        {globalVariablesStatuses}
                    </div>
                </nav>
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

const EditorButtons = observer(
    class EditorButtons extends React.Component {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        constructor(props: any) {
            super(props);

            makeObservable(this, {
                featureItems: computed
            });
        }

        setFrontFace = action((enabled: boolean) => {
            if (this.pageTabState) {
                this.pageTabState.frontFace = enabled;
            }
        });

        get pageTabState() {
            const editorState = this.context.editorsStore.activeEditor?.state;
            if (editorState instanceof PageTabState) {
                return editorState as PageTabState;
            }
            return undefined;
        }

        get flowTabState() {
            const editorState = this.context.editorsStore.activeEditor?.state;
            if (editorState instanceof FlowTabState) {
                return editorState as FlowTabState;
            }
            return undefined;
        }

        get isBuildConfigurationSelectorVisible() {
            return false;
        }

        onSelectedBuildConfigurationChange(event: any) {
            this.context.uiStateStore.setSelectedBuildConfiguration(
                event.target.value
            );
        }

        toggleShowTimeline = action(() => {
            if (this.pageTabState) {
                this.pageTabState.timeline.isEditorActive =
                    !this.pageTabState.timeline.isEditorActive;
            }
        });

        get isShowTimeline() {
            if (this.pageTabState) {
                return this.pageTabState.timeline.isEditorActive;
            }
            return false;
        }

        get featureItems() {
            if (this.context.runtime) {
                return undefined;
            }

            let featureItems = getChildren(this.context.project).filter(
                object =>
                    getObjectIcon(object) &&
                    getEditorComponent(object, undefined) &&
                    !(
                        object == this.context.project.userPages ||
                        object == this.context.project.userWidgets ||
                        object == this.context.project.actions ||
                        object == this.context.project.variables ||
                        object == this.context.project.styles ||
                        object == this.context.project.lvglStyles ||
                        object == this.context.project.fonts ||
                        object == this.context.project.bitmaps ||
                        object == this.context.project.texts ||
                        object == this.context.project.scpi ||
                        object == this.context.project.extensionDefinitions ||
                        object == this.context.project.changes
                    )
            );

            // push Settings to the end
            if (featureItems) {
                const settingsIndex = featureItems.findIndex(
                    item => item == this.context.project.settings
                );
                if (settingsIndex != -1) {
                    featureItems.splice(settingsIndex, 1);
                    featureItems.push(this.context.project.settings);
                }
            }

            return featureItems;
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
                <div
                    style={{
                        width: 0,
                        justifyContent: "flex-start",
                        display: "flex"
                    }}
                >
                    {!this.context.runtime && (
                        <div className="btn-group" role="group">
                            <IconAction
                                title="Save"
                                icon="material:save"
                                onClick={() => this.context.save()}
                                enabled={this.context.isModified}
                            />
                        </div>
                    )}

                    {!this.context.runtime && (
                        <>
                            <div className="btn-group" role="group">
                                <IconAction
                                    title={
                                        this.context.undoManager.canUndo
                                            ? `Undo "${this.context.undoManager.undoDescription}"`
                                            : ""
                                    }
                                    icon="material:undo"
                                    onClick={() =>
                                        this.context.undoManager.undo()
                                    }
                                    enabled={this.context.undoManager.canUndo}
                                />
                                <IconAction
                                    title={
                                        this.context.undoManager.canRedo
                                            ? `Redo "${this.context.undoManager.redoDescription}"`
                                            : ""
                                    }
                                    icon="material:redo"
                                    onClick={() =>
                                        this.context.undoManager.redo()
                                    }
                                    enabled={this.context.undoManager.canRedo}
                                />
                            </div>

                            <div className="btn-group" role="group">
                                {false && (
                                    <IconAction
                                        title="Cut"
                                        icon="material:content_cut"
                                        iconSize={22}
                                        onClick={this.context.cut}
                                        enabled={this.context.canCut}
                                    />
                                )}
                                <IconAction
                                    title="Copy"
                                    icon="material:content_copy"
                                    iconSize={22}
                                    onClick={this.context.copy}
                                    enabled={this.context.canCopy}
                                />
                                <IconAction
                                    title="Paste"
                                    icon="material:content_paste"
                                    iconSize={22}
                                    onClick={this.context.paste}
                                    enabled={this.context.canPaste}
                                />
                            </div>
                            <div className="btn-group" role="group">
                                <IconAction
                                    title="Scrapbook"
                                    icon={PROJECT_EDITOR_SCRAPBOOK}
                                    iconSize={24}
                                    onClick={() => showScrapbookManager()}
                                    selected={scrapbookModel.isVisible}
                                />
                            </div>
                        </>
                    )}

                    {!this.context.runtime &&
                        this.isBuildConfigurationSelectorVisible && (
                            <div className="btn-group">
                                <select
                                    title="Configuration"
                                    id="btn-toolbar-configuration"
                                    className="form-select"
                                    value={
                                        this.context.uiStateStore
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

                    {!this.context.runtime && (
                        <div className="btn-group" role="group">
                            {!this.context.projectTypeTraits.isDashboard && (
                                <IconAction
                                    title="Check"
                                    icon="material:check"
                                    onClick={() => this.context.check()}
                                    enabled={this.context.project._fullyLoaded}
                                />
                            )}
                            {!(
                                this.context.filePath &&
                                isScrapbookItemFilePath(this.context.filePath)
                            ) && (
                                <IconAction
                                    title="Build"
                                    icon="material:build"
                                    onClick={() => this.context.build()}
                                    enabled={this.context.project._fullyLoaded}
                                />
                            )}
                        </div>
                    )}

                    {this.context.projectTypeTraits.isResource &&
                        this.context.project.micropython && (
                            <div className="btn-group" role="group">
                                <IconAction
                                    title="Run MicroPython Script"
                                    icon={RUN_ICON}
                                    iconSize={28}
                                    onClick={() =>
                                        this.context.project.micropython.runScript()
                                    }
                                    enabled={this.context.project._fullyLoaded}
                                />
                            </div>
                        )}

                    {this.context.projectTypeTraits.hasFlowSupport && (
                        <>
                            {this.pageTabState && (
                                <>
                                    <div className="btn-group" role="group">
                                        <IconAction
                                            title="Show front face"
                                            icon="material:flip_to_front"
                                            iconSize={20}
                                            onClick={() =>
                                                this.setFrontFace(true)
                                            }
                                            selected={
                                                this.pageTabState.frontFace
                                            }
                                        />
                                        <IconAction
                                            title="Show back face"
                                            icon="material:flip_to_back"
                                            iconSize={20}
                                            onClick={() =>
                                                this.setFrontFace(false)
                                            }
                                            selected={
                                                !this.pageTabState.frontFace
                                            }
                                        />
                                    </div>

                                    {!this.flowTabState?.flowState && (
                                        <div className="btn-group" role="group">
                                            <IconAction
                                                title="Show timeline"
                                                icon={
                                                    <svg viewBox="0 0 551 372">
                                                        <path d="M42.4631 336.4972H204.996v-42.4224h-65.4195v-60.132h65.4195v-42.4495H0l.0008 145.005zm-.0045-102.5747H99.046v60.132H42.4586zm233.9184-42.4632v42.4405h61.8929v60.132h-61.893v42.4405h61.352l42.4247.009h171.5298v-145.013zM442.0555 294.007h-61.893v-60.132h61.893zm67.1986 0h-24.74v-60.132h24.74z" />
                                                        <path d="M348.4318 42.4321c0-10.8489-4.1291-21.7155-12.4228-30.0003C327.7332 4.138 316.8667.009 306.0177.009L176.8741 0c-10.849 0-21.7243 4.129-30.0185 12.4227-8.2757 8.2937-12.7264 19.1555-12.4227 30.0004v53.5542l85.791 54.0862v221.6388h42.4495V150.0637l85.7751-54.0861.009-53.5362z" />
                                                    </svg>
                                                }
                                                iconSize={24}
                                                onClick={() =>
                                                    this.toggleShowTimeline()
                                                }
                                                selected={this.isShowTimeline}
                                            />
                                        </div>
                                    )}
                                </>
                            )}

                            {(this.flowTabState ||
                                (this.pageTabState &&
                                    !this.pageTabState.frontFace)) && (
                                <div className="btn-group" role="group">
                                    <IconAction
                                        title="Show component descriptions"
                                        icon="material:comment"
                                        iconSize={20}
                                        onClick={action(
                                            () =>
                                                (this.context.uiStateStore.showComponentDescriptions =
                                                    !this.context.uiStateStore
                                                        .showComponentDescriptions)
                                        )}
                                        selected={
                                            this.context.uiStateStore
                                                .showComponentDescriptions
                                        }
                                    />
                                </div>
                            )}
                        </>
                    )}

                    {!this.context.runtime &&
                        this.context.project.texts?.languages.length > 0 && (
                            <div className="btn-group" role="group">
                                <SelectLanguage />
                            </div>
                        )}

                    {this.featureItems && (
                        <div className="btn-group" role="group">
                            {this.featureItems.map(featureItem => {
                                const title = objectToString(featureItem);

                                let icon = getObjectIcon(featureItem);

                                const editorComponent = getEditorComponent(
                                    featureItem,
                                    undefined
                                )!;

                                const onClick = action(() => {
                                    if (editorComponent) {
                                        this.context.editorsStore.openEditor(
                                            editorComponent.object,
                                            editorComponent.subObject
                                        );
                                    }
                                });

                                const isActive =
                                    editorComponent &&
                                    this.context.editorsStore.activeEditor &&
                                    this.context.editorsStore.getEditorByObject(
                                        editorComponent.object
                                    ) == this.context.editorsStore.activeEditor;

                                return (
                                    <IconAction
                                        key={getId(featureItem)}
                                        title={title}
                                        icon={icon}
                                        onClick={onClick}
                                        enabled={!isActive}
                                    />
                                );
                            })}
                        </div>
                    )}
                </div>
            );
        }
    }
);

const SelectLanguage = observer(
    class SelectLanguage extends React.Component {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        render() {
            return (
                <select
                    className="form-select"
                    value={
                        this.context.uiStateStore.selectedLanguage.languageID
                    }
                    onChange={action(
                        (event: React.ChangeEvent<HTMLSelectElement>) =>
                            (this.context.uiStateStore.selectedLanguageID =
                                event.currentTarget.value)
                    )}
                    style={{ width: "fit-content" }}
                >
                    {this.context.project.texts.languages.map(language => (
                        <option
                            key={language.languageID}
                            value={language.languageID}
                        >
                            {language.languageID}
                        </option>
                    ))}
                </select>
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

const RunEditSwitchControls = observer(
    class RunEditSwitchControls extends React.Component {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        render() {
            const iconSize = 30;
            return (
                <div className="EezStudio_ProjectEditor_RunEditSwitchControls d-flex">
                    <ButtonAction
                        text="Edit"
                        title="Enter edit mode (Shift+F5)"
                        icon="material:mode_edit"
                        iconSize={iconSize}
                        onClick={this.context.onSetEditorMode}
                        selected={!this.context.runtime}
                    />

                    <ButtonAction
                        text="Run"
                        title="Enter run mode (F5)"
                        icon={RUN_ICON}
                        iconSize={iconSize}
                        onClick={this.context.onSetRuntimeMode}
                        selected={
                            this.context.runtime &&
                            !this.context.runtime.isDebuggerActive
                        }
                    />

                    <ButtonAction
                        text="Debug"
                        title="Enter debug mode (Ctrl+F5)"
                        icon={
                            <svg viewBox="0 0 64 64" fill="currentColor">
                                <g transform="translate(-1,-1)">
                                    <path
                                        id="path2"
                                        d="m64 32h-3c-0.5-13.4-10.8-24.9-24.1-26.7-1-0.2-1.9-0.2-2.9-0.3v-3c0-0.6-0.4-1-1-1s-1 0.4-1 1v3c-6.5 0.2-12.7 2.7-17.6 7.1-5.7 5.1-9.1 12.3-9.4 19.9h-3c-0.6 0-1 0.4-1 1s0.4 1 1 1h3c0.5 13.4 10.8 24.9 24.1 26.7 1 0.1 1.9 0.2 2.9 0.2v3c0 0.6 0.4 1 1 1s1-0.4 1-1v-3c6.5-0.2 12.7-2.7 17.6-7.1 5.7-5.1 9.1-12.3 9.4-19.9h3c0.6 0 1-0.4 1-1s-0.4-0.9-1-0.9zm-13.7 20.4c-4.5 4-10.3 6.3-16.3 6.6v-3c0-0.6-0.4-1-1-1s-1 0.4-1 1v3c-0.9 0-1.7-0.1-2.6-0.2-12.4-1.7-21.9-12.3-22.4-24.8h3c0.6 0 1-0.4 1-1s-0.4-1-1-1h-3c0.3-7.1 3.4-13.7 8.7-18.4 4.6-4.1 10.3-6.3 16.3-6.5v2.9c0 0.6 0.4 1 1 1s1-0.4 1-1v-3c0.9 0 1.8 0.1 2.6 0.2 12.4 1.8 21.9 12.4 22.4 24.8h-3c-0.6 0-1 0.4-1 1s0.4 1 1 1h3c-0.3 7.1-3.4 13.7-8.7 18.4z"
                                    />
                                    <g>
                                        <g transform="matrix(1.237 0 0 1.2197 -7.8175 -7.1947)">
                                            <g>
                                                <g transform="matrix(.92683 0 0 .92683 2.4138 2.3964)">
                                                    <path d="m27.4 18.3c1.2 0 2.4 0.5 3.2 1.4-2 0.9-3.2 3-3.3 5.1-0.1 2.6 1.7 4.9 5.7 4.9 4.1 0 5.7-2 5.7-4.6 0-2.4-1.3-4.6-3.3-5.5 0.9-0.9 2-1.4 3.2-1.4 0.5 0 0.9-0.4 0.9-0.9s-0.4-0.9-0.9-0.9c-2.1 0-3.9 1-5.2 2.7h-0.8c-1.2-1.7-3.1-2.7-5.2-2.7-0.5 0-0.9 0.4-0.9 0.9 0 0.6 0.4 1 0.9 1z" />
                                                    <path d="m47.9 45.4c0.3 0.4 0.1 1-0.3 1.3s-1 0.1-1.3-0.3l-1.8-3h-2.9c-1.3 2.7-3.3 4.8-5.8 5.7l-2.8-13.2-2.9 13.1c-2.5-0.9-4.6-3-5.8-5.7h-2.9l-1.8 3c-0.3 0.4-0.8 0.6-1.3 0.3-0.4-0.3-0.6-0.8-0.3-1.3l2.1-3.4c0.2-0.3 0.5-0.5 0.8-0.5h2.7c-0.4-1.2-0.6-2.6-0.6-4 0-0.4 0-0.9 0.1-1.3h-1.7l-1.8 3c-0.3 0.4-0.8 0.6-1.3 0.3s-0.6-0.8-0.3-1.3l2.1-3.5c0.2-0.3 0.5-0.4 0.8-0.4h2.5c0.5-2.3 1.6-4.3 3.1-5.9 1.5 2.4 3.7 3.1 6.5 3.1 2.7 0 5.2-0.7 6.6-3 1.4 1.5 2.5 3.5 3 5.8h2.5c0.3 0 0.6 0.2 0.8 0.4l2.1 3.5c0.3 0.4 0.1 1-0.3 1.3s-1 0.1-1.3-0.3l-1.8-3h-1.7c0 0.4 0.1 0.9 0.1 1.3 0 1.4-0.2 2.7-0.6 4h2.7c0.3 0 0.6 0.2 0.8 0.5z" />
                                                </g>
                                            </g>
                                        </g>
                                    </g>
                                </g>
                            </svg>
                        }
                        iconSize={iconSize}
                        onClick={this.context.onSetDebuggerMode}
                        selected={
                            this.context.runtime &&
                            this.context.runtime.isDebuggerActive
                        }
                        attention={
                            !!(
                                this.context.runtime &&
                                this.context.runtime.error
                            )
                        }
                    />
                </div>
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////
