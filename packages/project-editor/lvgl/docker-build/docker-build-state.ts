/**
 * Unified State Management for Docker Build
 *
 * This module provides per-project state management for the Docker-based
 * LVGL simulator. Each project has its own logs, preview state, and preview logs.
 * Build operations are mutually exclusive (only one project can build at a time).
 */

import { makeObservable, observable, action, computed } from "mobx";

const MAX_BUILD_LOG_ENTRIES = 10000;
const MAX_PREVIEW_LOG_ENTRIES = 1000;

////////////////////////////////////////////////////////////////////////////////
// Types
////////////////////////////////////////////////////////////////////////////////

export type LogType = "info" | "success" | "error" | "warning";

export interface LogEntry {
    id: number;
    message: string;
    type: LogType;
    timestamp: Date;
}

export type SimulatorState = "idle" | "building" | "running" | "error";

export type PreviewLogType = "log" | "info" | "warn" | "error" | "debug";

export interface PreviewLogEntry {
    id: number;
    timestamp: Date;
    type: PreviewLogType;
    message: string;
}

////////////////////////////////////////////////////////////////////////////////
// Per-Project State
////////////////////////////////////////////////////////////////////////////////

/**
 * State for a single project's Docker build/preview session.
 */
export class DockerBuildProjectState {
    // Build logs
    logs: LogEntry[] = [];
    private nextLogId = 1;

    // Preview/simulator state
    state: SimulatorState = "idle";
    previewUrl: string | undefined = undefined;
    errorMessage: string | undefined = undefined;
    buildPhase: string = "";

    // Preview console logs
    previewLogs: PreviewLogEntry[] = [];
    private nextPreviewLogId = 1;

    // Per-project build tracking
    lastBuildRevision: symbol | undefined = undefined;

    // If true, next build should do a clean build first (because another project
    // built and changed the shared Docker volume). Default is true for new projects.
    needsCleanBuild: boolean = true;

    constructor() {
        makeObservable(this, {
            // Build logs
            logs: observable,
            addLog: action,
            clearLogs: action,

            // Preview state
            state: observable,
            previewUrl: observable,
            errorMessage: observable,
            buildPhase: observable,
            setBuilding: action,
            setRunning: action,
            setError: action,
            setIdle: action,
            isLoading: computed,

            // Preview logs
            previewLogs: observable,
            addPreviewLog: action,
            clearPreviewLogs: action,

            // Build tracking
            lastBuildRevision: observable
        });
    }

    // Build log methods
    addLog(message: string, type: LogType = "info") {
        this.logs.push({
            id: this.nextLogId++,
            message,
            type,
            timestamp: new Date()
        });

        // Keep only last MAX_BUILD_LOG_ENTRIES logs
        if (this.logs.length > MAX_BUILD_LOG_ENTRIES) {
            this.logs.shift();
        }
    }

    clearLogs() {
        this.logs = [];
        this.nextLogId = 1;
    }

    // Preview state methods
    setBuilding(phase: string) {
        this.state = "building";
        this.previewUrl = undefined;
        this.buildPhase = phase;
        this.errorMessage = undefined;
    }

    setRunning(url: string) {
        this.state = "running";
        this.previewUrl = url;
        this.errorMessage = undefined;
        this.buildPhase = "";
    }

    setError(message: string) {
        this.state = "error";
        this.previewUrl = undefined;
        this.errorMessage = message;
        this.buildPhase = "";
    }

    setIdle() {
        this.state = "idle";
        this.previewUrl = undefined;
        this.errorMessage = undefined;
        this.buildPhase = "";
    }

    get isLoading() {
        return this.state === "building";
    }

    /**
     * Check if the project has changed since the last successful build.
     * Used to notify the user that a rebuild may be needed.
     */
    hasProjectChangedSinceBuild(currentRevision: symbol | undefined): boolean {
        // If we've never built, no change to report
        if (this.lastBuildRevision === undefined) {
            return true;
        }
        // If current revision is undefined, can't compare
        if (currentRevision === undefined) {
            return true;
        }
        // Compare revisions
        return this.lastBuildRevision !== currentRevision;
    }

    // Preview log methods
    addPreviewLog(type: PreviewLogType, message: string) {
        this.previewLogs.push({
            id: this.nextPreviewLogId++,
            timestamp: new Date(),
            type,
            message
        });

        // Keep only last MAX_PREVIEW_LOG_ENTRIES logs
        if (this.previewLogs.length > MAX_PREVIEW_LOG_ENTRIES) {
            this.previewLogs.shift();
        }
    }

    clearPreviewLogs() {
        this.previewLogs = [];
        this.nextPreviewLogId = 1;
    }
}

////////////////////////////////////////////////////////////////////////////////
// State Manager (Singleton)
////////////////////////////////////////////////////////////////////////////////

/**
 * Manages all Docker build state across projects.
 * Single source of truth for all Docker build-related state.
 */
class DockerBuildStateManager {
    private projectStates = new Map<string, DockerBuildProjectState>();

    // Global build state (only one project can build at a time)
    isBuilding = false;
    currentBuildingProjectPath: string | undefined = undefined;
    isCancelled = false;

    constructor() {
        makeObservable(this, {
            isBuilding: observable,
            currentBuildingProjectPath: observable,
            isCancelled: observable,
            startBuild: action,
            endBuild: action,
            cancelBuild: action
        });
    }

    /**
     * Get or create the state for a specific project.
     * For unsaved projects (no path), returns a temporary state instance.
     */
    getProjectState(projectPath: string | undefined): DockerBuildProjectState {
        if (!projectPath) {
            // Return a temporary state for unsaved projects
            return new DockerBuildProjectState();
        }

        let state = this.projectStates.get(projectPath);
        if (!state) {
            state = new DockerBuildProjectState();
            this.projectStates.set(projectPath, state);
        }
        return state;
    }

    /**
     * Remove the state for a project (call when project is closed)
     */
    removeProjectState(projectPath: string): void {
        this.projectStates.delete(projectPath);
    }

    /**
     * Try to start a build for a project.
     * Returns true if build can start, false if another build is in progress.
     * Also marks all OTHER projects as needing clean build (because we're about
     * to change the shared Docker volume).
     */
    startBuild(projectPath: string): boolean {
        if (this.isBuilding) {
            return false;
        }
        this.isBuilding = true;
        this.currentBuildingProjectPath = projectPath;
        this.isCancelled = false;

        // Mark all other projects as needing clean build
        for (const [path, state] of this.projectStates) {
            if (path !== projectPath) {
                state.needsCleanBuild = true;
            }
        }

        return true;
    }

    /**
     * Mark a project's build as complete (no longer needs clean build)
     */
    markBuildComplete(projectPath: string): void {
        const state = this.projectStates.get(projectPath);
        if (state) {
            state.needsCleanBuild = false;
        }
    }

    /**
     * End the current build
     */
    endBuild() {
        this.isBuilding = false;
        this.currentBuildingProjectPath = undefined;
    }

    /**
     * Cancel the current build
     */
    cancelBuild() {
        this.isCancelled = true;
        this.isBuilding = false;
        this.currentBuildingProjectPath = undefined;
    }

    /**
     * Get the name of the project currently building
     */
    getBuildingProjectName(): string | undefined {
        if (this.currentBuildingProjectPath) {
            // Extract filename from path
            const parts = this.currentBuildingProjectPath
                .replace(/\\/g, "/")
                .split("/");
            return parts[parts.length - 1];
        }
        return undefined;
    }
}

// Singleton instance
export const dockerBuildState = new DockerBuildStateManager();
