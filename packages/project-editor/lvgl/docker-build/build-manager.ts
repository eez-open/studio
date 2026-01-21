/**
 * Build Manager for Docker Simulator
 *
 * Orchestrates the Docker-based build process for LVGL projects,
 * integrating with the EEZ Studio UI to show progress and logs.
 */

import * as path from "path";
import * as fs from "fs";
import { runInAction } from "mobx";
import { app } from "@electron/remote";

import type { ProjectStore } from "project-editor/store";
import { Section } from "project-editor/store/output-sections";
import {
    BuildConfig,
    ProjectInfo,
    buildProjectInfoFromProjectData,
    checkDocker,
    setupProject,
    buildProject,
    extractBuild,
    cleanBuild,
    cleanAll,
    abortBuild,
    resetAbort,
    stopRunningContainers
} from "./docker-build-lib";
import { previewServer } from "./preview-server";
import {
    dockerSimulatorLogsStore,
    dockerBuildLogFunction
} from "./DockerSimulatorLogsPanel";
import { dockerSimulatorPreviewStore } from "./DockerSimulatorPreviewPanel";
import { previewLogsStore } from "./PreviewLogsPanel";

////////////////////////////////////////////////////////////////////////////////

export class DockerBuildManager {
    private isBuilding = false;
    private isCancelled = false;
    // Track last build revision per project path (in-memory only, resets when EEZ Studio restarts)
    private lastDockerBuildRevisions = new Map<string, symbol>();
    private currentBuildingProjectPath: string | undefined = undefined;
    private activeSimulatorProjectPath: string | undefined = undefined;

    /**
     * Reset the simulator state (call when project is closed)
     */
    resetSimulatorState(): void {
        this.activeSimulatorProjectPath = undefined;
    }

    /**
     * Check if Full Simulator mode is active for another project
     */
    isActiveForOtherProject(projectPath: string | undefined): boolean {
        return (
            this.activeSimulatorProjectPath !== undefined &&
            this.activeSimulatorProjectPath !== projectPath
        );
    }

    /**
     * Get the name of the project currently in Full Simulator mode
     */
    getActiveProjectName(): string | undefined {
        if (this.activeSimulatorProjectPath) {
            return path.basename(this.activeSimulatorProjectPath);
        }
        return undefined;
    }

    /**
     * Get the path to the docker-build resources
     */
    private getDockerBuildPath(): string {
        // In development, resources are in the project root
        // In production, they are in the app resources
        const isDev = process.env.NODE_ENV === "development" || !app.isPackaged;

        if (isDev) {
            // Development: resources/docker-build
            return path.join(__dirname, "../../../../resources/docker-build");
        } else {
            // Production: resources/docker-build (relative to app path)
            return path.join(process.resourcesPath, "docker-build");
        }
    }

    /**
     * Get the build configuration
     */
    private getBuildConfig(): BuildConfig {
        // Use a single shared volume for all projects
        // The build.sh script handles switching between different projects
        return {
            repositoryName: "lvgl-simulator-for-studio-docker-build",
            dockerVolumeName: "eez-studio-lvgl-build",
            dockerBuildPath: this.getDockerBuildPath()
        };
    }

    /**
     * Get the build output path for a project
     */
    private getBuildOutputPath(projectStore: ProjectStore): string {
        if (!projectStore.filePath) {
            throw new Error("Project must be saved before building");
        }

        const projectDir = path.dirname(projectStore.filePath);
        return path.join(projectDir, ".docker-build-output");
    }

    /**
     * Build ProjectInfo from in-memory projectStore
     */
    private buildProjectInfo(projectStore: ProjectStore): ProjectInfo {
        if (!projectStore.filePath) {
            throw new Error("Project must be saved before building");
        }

        const projectData = projectStore.project;
        const projectDir = path.dirname(projectStore.filePath);

        return buildProjectInfoFromProjectData(
            projectData,
            projectDir,
            dockerBuildLogFunction
        );
    }

    /**
     * Check if the Docker build resources exist
     */
    private checkDockerBuildResources(): boolean {
        const dockerBuildPath = this.getDockerBuildPath();
        const dockerfilePath = path.join(dockerBuildPath, "Dockerfile");
        const composePath = path.join(dockerBuildPath, "docker-compose.yml");

        return fs.existsSync(dockerfilePath) && fs.existsSync(composePath);
    }

    /**
     * Check if valid build output exists
     */
    private hasBuildOutput(outputPath: string): boolean {
        const requiredFiles = ["index.html", "index.js", "index.wasm"];
        return requiredFiles.every(file =>
            fs.existsSync(path.join(outputPath, file))
        );
    }

    /**
     * Check if project needs rebuild
     */
    private needsRebuild(
        projectStore: ProjectStore,
        outputPath: string
    ): boolean {
        const projectPath = projectStore.filePath;
        if (!projectPath) {
            return true;
        }

        // No previous build revision tracked for this project (first build since EEZ Studio started)
        const lastRevision = this.lastDockerBuildRevisions.get(projectPath);
        if (!lastRevision) {
            return true;
        }

        // Project has changed since last Docker build
        if (lastRevision !== projectStore.lastRevisionStable) {
            return true;
        }

        // Build output doesn't exist
        if (!this.hasBuildOutput(outputPath)) {
            return true;
        }

        return false;
    }

    /**
     * Start the full simulator build and preview
     * @param projectStore The project store
     * @param forceRebuild If true, rebuild even if project hasn't changed
     */
    async startFullSimulator(
        projectStore: ProjectStore,
        forceRebuild: boolean = false
    ): Promise<void> {
        // Check if another project is already in Full Simulator mode
        if (this.isActiveForOtherProject(projectStore.filePath)) {
            dockerBuildLogFunction(
                `Full Simulator is already active for another project: ${this.getActiveProjectName()}`,
                "warning"
            );
            return;
        }

        // Check if this project is already in Full Simulator mode (ignore repeated clicks)
        if (
            this.activeSimulatorProjectPath === projectStore.filePath &&
            !forceRebuild
        ) {
            // Already active for this project, ignore
            return;
        }

        if (this.isBuilding) {
            if (
                this.currentBuildingProjectPath &&
                this.currentBuildingProjectPath !== projectStore.filePath
            ) {
                dockerBuildLogFunction(
                    `Build already in progress for another project: ${path.basename(
                        this.currentBuildingProjectPath
                    )}`,
                    "warning"
                );
            } else {
                dockerBuildLogFunction("Build already in progress", "warning");
            }
            return;
        }

        this.isBuilding = true;
        this.isCancelled = false;
        this.currentBuildingProjectPath = projectStore.filePath;
        this.activeSimulatorProjectPath = projectStore.filePath;

        // Reset abort state from any previous build
        resetAbort();

        const startTime = Date.now();

        try {
            // Clear previous logs
            runInAction(() => {
                dockerSimulatorLogsStore.clear();
                dockerSimulatorPreviewStore.setBuilding("Initializing...");
            });

            // Check prerequisites
            dockerBuildLogFunction("=== Starting Full Simulator ===", "info");

            // Check if project is saved
            if (!projectStore.filePath) {
                throw new Error(
                    "Please save the project before running the full simulator"
                );
            }

            const outputPath = this.getBuildOutputPath(projectStore);

            // Check if we can skip the build
            if (!forceRebuild && !this.needsRebuild(projectStore, outputPath)) {
                dockerBuildLogFunction(
                    "Project unchanged since last build, skipping Docker build...",
                    "success"
                );

                // Just start the preview server with existing build
                runInAction(() => {
                    dockerSimulatorPreviewStore.setBuilding(
                        "Starting preview server..."
                    );
                });

                dockerBuildLogFunction("Starting preview server...", "info");
                const previewUrl = await previewServer.start(outputPath);
                dockerBuildLogFunction(
                    `Preview server running at ${previewUrl}`,
                    "success"
                );

                // Clear preview logs for new session
                previewLogsStore.clear();

                runInAction(() => {
                    dockerSimulatorPreviewStore.setRunning(previewUrl);
                });

                const duration = ((Date.now() - startTime) / 1000).toFixed(1);
                dockerBuildLogFunction(
                    `=== Full Simulator Ready (${duration}s) ===`,
                    "success"
                );
                return;
            }

            // Check Docker build resources
            if (!this.checkDockerBuildResources()) {
                throw new Error(
                    "Docker build resources not found. Please ensure the docker-build folder is present."
                );
            }

            // Check Docker
            runInAction(() => {
                dockerSimulatorPreviewStore.setBuilding("Checking Docker...");
            });

            const dockerReady = await checkDocker(dockerBuildLogFunction);
            if (!dockerReady) {
                throw new Error(
                    "Docker is not available. Please install and start Docker Desktop."
                );
            }

            if (this.isCancelled) return;

            // Build the EEZ project first
            runInAction(() => {
                dockerSimulatorPreviewStore.setBuilding(
                    "Building EEZ project..."
                );
            });

            dockerBuildLogFunction("Building EEZ project...", "info");
            await projectStore.build();

            // Check if build produced errors
            if (
                projectStore.outputSectionsStore.getSection(Section.OUTPUT)
                    .numErrors > 0
            ) {
                throw new Error(
                    "EEZ project build failed with errors. Please fix the errors and try again."
                );
            }

            dockerBuildLogFunction("EEZ project built successfully", "success");

            if (this.isCancelled) return;

            // Build project info from in-memory project store
            runInAction(() => {
                dockerSimulatorPreviewStore.setBuilding(
                    "Reading project configuration..."
                );
            });

            const projectInfo = this.buildProjectInfo(projectStore);

            if (this.isCancelled) return;

            // Get build configuration
            const buildConfig = this.getBuildConfig();

            // Setup Docker project
            runInAction(() => {
                dockerSimulatorPreviewStore.setBuilding(
                    "Setting up Docker environment..."
                );
            });

            const setupResult = await setupProject(
                projectInfo,
                buildConfig,
                dockerBuildLogFunction
            );

            if (this.isCancelled) return;

            // Build with Docker
            runInAction(() => {
                dockerSimulatorPreviewStore.setBuilding(
                    "Building with Emscripten..."
                );
            });

            await buildProject(
                projectInfo,
                buildConfig,
                dockerBuildLogFunction,
                setupResult.skipEmcmakeCmake
            );

            if (this.isCancelled) return;

            // Extract build output
            runInAction(() => {
                dockerSimulatorPreviewStore.setBuilding(
                    "Extracting build files..."
                );
            });

            await extractBuild(outputPath, buildConfig, dockerBuildLogFunction);

            if (this.isCancelled) return;

            // Track this build revision for this project
            if (projectStore.filePath) {
                this.lastDockerBuildRevisions.set(
                    projectStore.filePath,
                    projectStore.lastRevisionStable
                );
            }

            // Start preview server
            runInAction(() => {
                dockerSimulatorPreviewStore.setBuilding(
                    "Starting preview server..."
                );
            });

            dockerBuildLogFunction("Starting preview server...", "info");
            const previewUrl = await previewServer.start(outputPath);
            dockerBuildLogFunction(
                `Preview server running at ${previewUrl}`,
                "success"
            );

            // Clear preview logs for new session
            previewLogsStore.clear();

            // Update UI to show preview
            runInAction(() => {
                dockerSimulatorPreviewStore.setRunning(previewUrl);
            });

            const duration = ((Date.now() - startTime) / 1000).toFixed(1);
            dockerBuildLogFunction(
                `=== Full Simulator Ready (${duration}s) ===`,
                "success"
            );
        } catch (error) {
            const errorMessage =
                error instanceof Error ? error.message : String(error);
            dockerBuildLogFunction(`Error: ${errorMessage}`, "error");

            runInAction(() => {
                dockerSimulatorPreviewStore.setError(errorMessage);
            });
        } finally {
            this.isBuilding = false;
            this.currentBuildingProjectPath = undefined;
        }
    }

    /**
     * Stop the full simulator
     */
    async stopFullSimulator(): Promise<void> {
        this.isCancelled = true;
        this.isBuilding = false;
        this.currentBuildingProjectPath = undefined;
        this.activeSimulatorProjectPath = undefined;

        // Abort any running build processes
        abortBuild();

        // Stop any running Docker containers
        const buildConfig = this.getBuildConfig();
        await stopRunningContainers(buildConfig, dockerBuildLogFunction);

        if (previewServer.isRunning) {
            dockerBuildLogFunction("Stopping preview server...", "info");
            await previewServer.stop();
            dockerBuildLogFunction("Preview server stopped", "success");
        }

        runInAction(() => {
            dockerSimulatorPreviewStore.setIdle();
        });
    }

    /**
     * Rebuild the simulator (quick rebuild without full setup)
     */
    async rebuildFullSimulator(projectStore: ProjectStore): Promise<void> {
        await this.stopFullSimulator();
        await this.startFullSimulator(projectStore);
    }

    /**
     * Clean the Docker build cache
     */
    async cleanBuildCache(projectStore: ProjectStore): Promise<void> {
        if (this.isBuilding) {
            dockerBuildLogFunction("Cannot clean while building", "warning");
            return;
        }

        try {
            // Reset abort state in case previous build was stopped
            resetAbort();

            const buildConfig = this.getBuildConfig();
            // Ensure no containers are running before cleaning
            await stopRunningContainers(buildConfig, dockerBuildLogFunction);
            await cleanBuild(buildConfig, dockerBuildLogFunction);
        } catch (error) {
            const errorMessage =
                error instanceof Error ? error.message : String(error);
            dockerBuildLogFunction(`Clean failed: ${errorMessage}`, "error");
        }
    }

    /**
     * Clean all Docker resources for a fresh start
     */
    async cleanAll(projectStore: ProjectStore): Promise<void> {
        if (this.isBuilding) {
            dockerBuildLogFunction("Cannot clean while building", "warning");
            return;
        }

        try {
            // Reset abort state in case previous build was stopped
            resetAbort();

            const buildConfig = this.getBuildConfig();
            // Ensure no containers are running before cleaning
            await stopRunningContainers(buildConfig, dockerBuildLogFunction);
            await cleanAll(buildConfig, dockerBuildLogFunction);
        } catch (error) {
            const errorMessage =
                error instanceof Error ? error.message : String(error);
            dockerBuildLogFunction(
                `Clean all failed: ${errorMessage}`,
                "error"
            );
        }
    }
}

////////////////////////////////////////////////////////////////////////////////

// Singleton instance
export const dockerBuildManager = new DockerBuildManager();
