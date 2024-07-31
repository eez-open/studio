import { IEezObject, ProjectType } from "project-editor/core/object";
import { ProjectEditor } from "project-editor/project-editor-interface";
import type { Project } from "project-editor/project/project";
import {
    ValueType,
    isEnumType
} from "project-editor/features/variable/value-type";

////////////////////////////////////////////////////////////////////////////////

export enum BitmapColorFormat {
    RGB,
    BGR
}

export enum RuntimeType {
    NONE,
    WASM,
    REMOTE
}

////////////////////////////////////////////////////////////////////////////////

class ProjectTypeTraits {
    constructor(public project: Project) {}

    get id() {
        return -1;
    }

    get isFirmware() {
        return false;
    }

    get isFirmwareModule() {
        return false;
    }

    get isModule() {
        return false;
    }

    get isResource() {
        return false;
    }

    get isApplet() {
        return false;
    }

    get isDashboard() {
        return false;
    }

    get isLVGL() {
        return false;
    }

    get isIEXT() {
        return false;
    }

    get hasFlowSupport() {
        return false;
    }

    get runtimeType() {
        return RuntimeType.NONE;
    }

    get bitmapColorFormat() {
        return this.project.settings.general.colorFormat === "BGR"
            ? BitmapColorFormat.BGR
            : BitmapColorFormat.RGB;
    }

    get hasDisplaySizeProperty() {
        return false;
    }

    isVariableTypeSupportedAsNative(type: ValueType) {
        return false;
    }
}

////////////////////////////////////////////////////////////////////////////////

class FirmwareProjectTypeTraits extends ProjectTypeTraits {
    override get id() {
        return 1;
    }

    override get isFirmware() {
        return true;
    }

    override get hasFlowSupport() {
        return this.project.settings.general.flowSupport;
    }
    override get runtimeType(): RuntimeType {
        return this.hasFlowSupport ? RuntimeType.WASM : RuntimeType.NONE;
    }

    override get hasDisplaySizeProperty() {
        return true;
    }

    isVariableTypeSupportedAsNative(type: ValueType) {
        return true;
    }
}

class FirmwareModuleProjectTypeTraits extends FirmwareProjectTypeTraits {
    override get id() {
        return 2;
    }

    override get isFirmwareModule() {
        return true;
    }

    override get runtimeType() {
        return RuntimeType.NONE;
    }
}

class ResourceProjectTypeTraits extends FirmwareProjectTypeTraits {
    override get id() {
        return 3;
    }

    override get isResource() {
        return true;
    }

    override get runtimeType() {
        return RuntimeType.NONE;
    }

    override get hasDisplaySizeProperty() {
        return false;
    }

    isVariableTypeSupportedAsNative(type: ValueType) {
        return false;
    }
}

class AppletProjectTypeTraits extends FirmwareProjectTypeTraits {
    override get id() {
        return 4;
    }

    override get isApplet() {
        return true;
    }

    override get hasFlowSupport() {
        return true;
    }

    override get runtimeType() {
        return RuntimeType.REMOTE;
    }

    override get hasDisplaySizeProperty() {
        return false;
    }

    isVariableTypeSupportedAsNative(type: ValueType) {
        return false;
    }
}

////////////////////////////////////////////////////////////////////////////////

class DashboardProjectTypeTraits extends ProjectTypeTraits {
    override get id() {
        return 5;
    }

    override get isDashboard() {
        return true;
    }

    override get hasFlowSupport() {
        return true;
    }

    override get runtimeType() {
        return RuntimeType.WASM;
    }

    override get hasDisplaySizeProperty() {
        return false;
    }

    override isVariableTypeSupportedAsNative(type: ValueType) {
        return false;
    }
}

////////////////////////////////////////////////////////////////////////////////

class LVGLProjectTypeTraits extends ProjectTypeTraits {
    override get id() {
        return 6;
    }

    override get isLVGL() {
        return true;
    }

    override get hasFlowSupport() {
        return this.project.settings.general.flowSupport;
    }

    override get runtimeType() {
        return RuntimeType.WASM;
    }

    override get hasDisplaySizeProperty() {
        return true;
    }

    override isVariableTypeSupportedAsNative(type: ValueType) {
        return (
            isEnumType(type) ||
            type == "integer" ||
            type == "float" ||
            type == "double" ||
            type == "boolean" ||
            type == "string"
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

class IEXTProjectTypeTraits extends ProjectTypeTraits {
    override get id() {
        return 7;
    }

    override get isIEXT() {
        return true;
    }
}

////////////////////////////////////////////////////////////////////////////////

export function isDashboardProject(object: IEezObject) {
    const project = ProjectEditor.getProject(object);
    return project.projectTypeTraits.isDashboard;
}

export function isNotDashboardProject(object: IEezObject) {
    const project = ProjectEditor.getProject(object);
    return !project.projectTypeTraits.isDashboard;
}

export function isFirmwareWithFlowSupportProject(object: IEezObject) {
    const project = ProjectEditor.getProject(object);
    return (
        project.projectTypeTraits.isFirmware &&
        project.projectTypeTraits.hasFlowSupport
    );
}

export function isFirmwareProject(object: IEezObject) {
    const project = ProjectEditor.getProject(object);
    return (
        project.projectTypeTraits.isFirmware ||
        project.projectTypeTraits.isFirmwareModule ||
        project.projectTypeTraits.isResource ||
        project.projectTypeTraits.isApplet
    );
}

export function isNotFirmwareProject(object: IEezObject) {
    return !isFirmwareProject(object);
}

export function isAppletProject(object: IEezObject) {
    const project = ProjectEditor.getProject(object);
    return project.projectTypeTraits.isApplet;
}

export function hasFlowSupport(object: IEezObject) {
    const project = ProjectEditor.getProject(object);
    return project.projectTypeTraits.hasFlowSupport;
}

export function hasNotFlowSupport(object: IEezObject) {
    const project = ProjectEditor.getProject(object);
    return !project.projectTypeTraits.hasFlowSupport;
}

export function isDashboardOrApplet(object: IEezObject) {
    const project = ProjectEditor.getProject(object);
    return (
        project.projectTypeTraits.isDashboard ||
        project.projectTypeTraits.isApplet
    );
}

export function isProjectWithFlowSupport(object: IEezObject) {
    const project = ProjectEditor.getProject(object);
    return project.projectTypeTraits.hasFlowSupport;
}

export function isNotProjectWithFlowSupport(object: IEezObject) {
    return !isProjectWithFlowSupport(object);
}

export function isV1Project(object: IEezObject) {
    const project = ProjectEditor.getProject(object);
    return project.settings.general.projectVersion === "v1";
}

export function isNotV1Project(object: IEezObject) {
    const project = ProjectEditor.getProject(object);
    return project.settings.general.projectVersion !== "v1";
}

export function isV3OrNewerProject(object: IEezObject) {
    const project = ProjectEditor.getProject(object);
    return (
        project.settings.general.projectVersion !== "v1" &&
        project.settings.general.projectVersion !== "v2"
    );
}

export function isLVGLProject(object: IEezObject) {
    const project = ProjectEditor.getProject(object);
    return project.projectTypeTraits.isLVGL;
}

export function isNotLVGLProject(object: IEezObject) {
    const project = ProjectEditor.getProject(object);
    return !project.projectTypeTraits.isLVGL;
}

export function isIEXTProject(object: IEezObject) {
    const project = ProjectEditor.getProject(object);
    return project.projectTypeTraits.isIEXT;
}

export function isNotScpiProject(object: IEezObject) {
    const projectStore = ProjectEditor.getProjectStore(object);
    return !projectStore.isScpiInstrument;
}

////////////////////////////////////////////////////////////////////////////////

export function createProjectTypeTraits(project: Project) {
    const projectType = project.settings.general.projectType;
    if (projectType === ProjectType.FIRMWARE)
        return new FirmwareProjectTypeTraits(project);
    if (projectType === ProjectType.FIRMWARE_MODULE)
        return new FirmwareModuleProjectTypeTraits(project);
    if (projectType === ProjectType.RESOURCE)
        return new ResourceProjectTypeTraits(project);
    if (projectType === ProjectType.APPLET)
        return new AppletProjectTypeTraits(project);
    if (projectType === ProjectType.DASHBOARD)
        return new DashboardProjectTypeTraits(project);
    if (projectType === ProjectType.LVGL)
        return new LVGLProjectTypeTraits(project);
    if (projectType === ProjectType.IEXT)
        return new IEXTProjectTypeTraits(project);
    return new ProjectTypeTraits(project);
}
