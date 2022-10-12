import { IEezObject, ProjectType } from "project-editor/core/object";
import { ProjectEditor } from "project-editor/project-editor-interface";
import type { Project } from "./project";

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

    get hasFlowSupport() {
        return false;
    }

    get runtimeType() {
        return RuntimeType.NONE;
    }

    get bitmapColorFormat() {
        return BitmapColorFormat.RGB;
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

    override get bitmapColorFormat() {
        return this.hasFlowSupport
            ? BitmapColorFormat.RGB
            : BitmapColorFormat.BGR;
    }

    override get runtimeType() {
        return RuntimeType.WASM;
    }
}

class FirmwareModuleProjectTypeTraits extends FirmwareProjectTypeTraits {
    override get id() {
        return 2;
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
        return true;
    }

    override get runtimeType() {
        return RuntimeType.WASM;
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

export function hasFlowSupport(object: IEezObject) {
    const project = ProjectEditor.getProject(object);
    return project.projectTypeTraits.hasFlowSupport;
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
    return new ProjectTypeTraits(project);
}
