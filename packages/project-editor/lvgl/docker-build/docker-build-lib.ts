/**
 * Docker Build Library for EEZ Projects
 *
 * Core functionality for Docker-based builds separated from CLI interface
 */

import * as fs from "fs";
import * as path from "path";
import { spawn, spawnSync, ChildProcess } from "child_process";
import * as crypto from "crypto";

// Global state for abort handling
let abortRequested = false;
let runningProcesses: ChildProcess[] = [];
let currentContainerId: string | null = null;

// Global state for incremental builds
let lastProjectInfo: ProjectInfo | null = null;

export interface BuildConfig {
    repositoryName: string;
    dockerVolumeName: string;
    dockerBuildPath: string;
}

export interface FontInfo {
    localPath: string; // Absolute path on local system
    targetPath: string; // Path in Docker container (/fonts/...)
    fileName: string; // Font file name
}

export interface FileManifest {
    [relativePath: string]: string; // relativePath -> file hash
}

export interface ProjectInfo {
    lvglVersion: string;
    flowSupport: boolean;
    projectDir: string;
    uiDir: string;
    destinationFolder: string;
    displayWidth: number;
    displayHeight: number;
    fonts: FontInfo[]; // Array of FreeType fonts to include
    encoderGroup?: string; // Default group for encoder in simulator
    keyboardGroup?: string; // Default group for keyboard in simulator
    fileManifest?: FileManifest; // Manifest of source files with hashes
}

export interface CommandResult {
    success: boolean;
    output?: string;
    error?: string;
}

export type LogFunction = (
    message: string,
    type?: "info" | "success" | "error" | "warning"
) => void;

/**
 * Request abort of current operation
 */
export function abortBuild(): void {
    abortRequested = true;

    // Kill all running processes
    for (const proc of runningProcesses) {
        try {
            if (!proc.killed && proc.pid) {
                // On Windows, use taskkill to kill the entire process tree
                if (process.platform === "win32") {
                    try {
                        spawnSync(
                            "taskkill",
                            ["/pid", proc.pid.toString(), "/T", "/F"],
                            {
                                shell: true
                            }
                        );
                    } catch (e) {
                        // Fallback to regular kill
                        proc.kill("SIGKILL");
                    }
                } else {
                    // On Unix, send SIGTERM then SIGKILL
                    proc.kill("SIGTERM");
                    setTimeout(() => {
                        if (!proc.killed) {
                            proc.kill("SIGKILL");
                        }
                    }, 1000);
                }
            }
        } catch (error) {
            // Ignore errors during cleanup
        }
    }
    runningProcesses = [];

    // Stop any running Docker containers
    if (currentContainerId) {
        try {
            spawnSync("docker", ["stop", currentContainerId], {
                shell: true,
                timeout: 5000
            });
        } catch (error) {
            // Ignore errors during cleanup
        }
    }
}

/**
 * Reset abort state (call before starting new build)
 */
export function resetAbort(): void {
    abortRequested = false;
    runningProcesses = [];
    currentContainerId = null;
}

/**
 * Check if abort was requested
 */
export function isAbortRequested(): boolean {
    return abortRequested;
}

/**
 * Stop any running Docker containers and clean up
 */
export async function stopRunningContainers(
    config: BuildConfig,
    log: LogFunction
): Promise<void> {
    try {
        // Stop containers managed by docker compose
        log("Stopping any running containers...");
        const result = spawnSync(
            "docker",
            ["compose", "down", "--remove-orphans"],
            {
                cwd: config.dockerBuildPath,
                shell: true,
                timeout: 15000
            }
        );
        if (result.status === 0) {
            log("Containers stopped successfully");
        }
    } catch (error) {
        // Ignore errors during cleanup
    }

    // Also stop tracked container if any
    if (currentContainerId) {
        try {
            spawnSync("docker", ["stop", currentContainerId], {
                cwd: config.dockerBuildPath,
                shell: true,
                timeout: 10000
            });
        } catch (error) {
            // Ignore errors during cleanup
        }
        currentContainerId = null;
    }
}

/**
 * Calculate MD5 hash of a file
 */
function calculateFileHash(filePath: string): string {
    const content = fs.readFileSync(filePath);
    return crypto.createHash("md5").update(content).digest("hex");
}

/**
 * Build a file manifest from a directory (recursively)
 */
function buildFileManifest(baseDir: string): FileManifest {
    const manifest: FileManifest = {};

    function scanDirectory(dir: string) {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                scanDirectory(fullPath);
            } else if (entry.isFile()) {
                const relativePath = path
                    .relative(baseDir, fullPath)
                    .replace(/\\/g, "/");
                manifest[relativePath] = calculateFileHash(fullPath);
            }
        }
    }

    scanDirectory(baseDir);
    return manifest;
}

/**
 * Compare two ProjectInfo objects (excluding fileManifest)
 */
function projectInfoMatches(a: ProjectInfo | null, b: ProjectInfo): boolean {
    if (!a) return false;
    return (
        a.lvglVersion === b.lvglVersion &&
        a.flowSupport === b.flowSupport &&
        a.projectDir === b.projectDir &&
        a.destinationFolder === b.destinationFolder &&
        a.displayWidth === b.displayWidth &&
        a.displayHeight === b.displayHeight &&
        a.encoderGroup === b.encoderGroup &&
        a.keyboardGroup === b.keyboardGroup &&
        JSON.stringify(a.fonts) === JSON.stringify(b.fonts)
    );
}

/**
 * Build ProjectInfo from project data (either from JSON file or in-memory project)
 * @param projectData The project data object (same structure in JSON and memory)
 * @param projectDir The project directory path
 * @param log Logging function
 */
export function buildProjectInfoFromProjectData(
    projectData: any,
    projectDir: string,
    log: LogFunction
): ProjectInfo {
    let lvglVersion = projectData.settings?.general?.lvglVersion;
    const flowSupport = projectData.settings?.general?.flowSupport || false;
    const displayWidth = projectData.settings?.general?.displayWidth || 800;
    const displayHeight = projectData.settings?.general?.displayHeight || 480;
    const destinationFolder =
        projectData.settings?.build?.destinationFolder || "src/ui";

    if (!lvglVersion) {
        throw new Error("LVGL version not specified in project settings");
    }

    // Map unsupported versions to supported ones
    const versionMap: Record<string, string> = {
        "8.3": "8.4.0",
        "8.3.0": "8.4.0",
        "9.0": "9.2.2",
        "9.0.0": "9.2.2"
    };

    if (versionMap[lvglVersion]) {
        log(
            `LVGL version ${lvglVersion} mapped to ${versionMap[lvglVersion]}`,
            "info"
        );
        lvglVersion = versionMap[lvglVersion];
    }

    const normalizedDestination = destinationFolder.replace(/\\/g, "/");
    const uiDir = path.join(projectDir, normalizedDestination);

    // Check if destination folder exists
    if (!fs.existsSync(uiDir)) {
        throw new Error(`Build destination directory not found at: ${uiDir}`);
    }

    // Parse fonts
    const fonts: FontInfo[] = [];
    if (projectData.fonts && Array.isArray(projectData.fonts)) {
        for (const font of projectData.fonts) {
            if (font.lvglUseFreeType === true) {
                const localFontPath = path.join(
                    projectDir,
                    font.source.filePath.replace(/\\/g, "/")
                );
                const targetFontPath = font.lvglFreeTypeFilePath;
                const fontFileName = path.basename(localFontPath);

                // Validate that font file exists
                if (!fs.existsSync(localFontPath)) {
                    log(
                        `Warning: Font file not found: ${localFontPath}`,
                        "warning"
                    );
                    continue;
                }

                fonts.push({
                    localPath: localFontPath,
                    targetPath: targetFontPath,
                    fileName: fontFileName
                });

                log(
                    `Found FreeType font: ${fontFileName} -> ${targetFontPath}`
                );
            }
        }
    }

    if (fonts.length > 0) {
        log(`Total FreeType fonts to include: ${fonts.length}`, "success");
    }

    // Parse lvglGroups for encoder and keyboard group settings
    const encoderGroup =
        projectData.lvglGroups?.defaultGroupForEncoderInSimulator;
    const keyboardGroup =
        projectData.lvglGroups?.defaultGroupForKeyboardInSimulator;

    if (encoderGroup) {
        log(`Encoder group: ${encoderGroup}`);
    }
    if (keyboardGroup) {
        log(`Keyboard group: ${keyboardGroup}`);
    }

    log(
        `Detected project: LVGL ${lvglVersion} (${
            flowSupport ? "with" : "no"
        } flow support)`,
        "success"
    );
    log(`Display: ${displayWidth}x${displayHeight}`);
    log(`UI directory: ${uiDir}`);

    // Build file manifest for incremental builds
    log("Building file manifest...");
    const fileManifest = buildFileManifest(uiDir);
    const fileCount = Object.keys(fileManifest).length;
    log(`Tracked ${fileCount} source file(s)`);

    return {
        lvglVersion,
        flowSupport,
        projectDir,
        uiDir,
        destinationFolder: normalizedDestination,
        displayWidth,
        displayHeight,
        fonts,
        encoderGroup,
        keyboardGroup,
        fileManifest
    };
}

/**
 * Read and parse the EEZ project file
 */
export async function readProjectFile(
    projectPath: string,
    log: LogFunction
): Promise<ProjectInfo> {
    log(`Reading project file: ${projectPath}`);

    if (!fs.existsSync(projectPath)) {
        throw new Error(`Project file not found: ${projectPath}`);
    }

    const content = fs.readFileSync(projectPath, "utf8");
    const projectData = JSON.parse(content);
    const projectDir = path.dirname(projectPath);

    return buildProjectInfoFromProjectData(projectData, projectDir, log);
}

/**
 * Run a command and return the result
 */
function runCommand(
    command: string,
    args: string[],
    cwd: string | undefined,
    env: Record<string, string> | undefined,
    log: LogFunction,
    skipStdoutLogging: boolean = false
): Promise<CommandResult> {
    return new Promise(resolve => {
        // Check if abort was requested before starting
        if (abortRequested) {
            resolve({
                success: false,
                error: "Operation aborted by user"
            });
            return;
        }

        log(`Running: ${command} ${args.join(" ")}`);

        const mergedEnv = { ...process.env, ...env };
        const proc = spawn(command, args, {
            cwd: cwd || process.cwd(),
            env: mergedEnv,
            shell: true
        });

        // Track this process
        runningProcesses.push(proc);

        let stdout = "";
        let stderr = "";

        if (!skipStdoutLogging) {
            proc.stdout?.on("data", data => {
                const text = data.toString();
                stdout += text;
                // Log each line to the UI
                const lines = text.split("\n");
                for (const line of lines) {
                    const trimmed = line.trim();
                    if (trimmed) {
                        log(trimmed);
                    }
                }
            });
        }

        proc.stderr?.on("data", data => {
            const text = data.toString();
            stderr += text;
            // Filter out Docker noise and log to UI
            if (!shouldFilterDockerMessage(text)) {
                const lines = text.split("\n");
                for (const line of lines) {
                    const trimmed = line.trim();
                    if (trimmed) {
                        log(trimmed, "warning");
                    }
                }
            }
        });

        proc.on("close", code => {
            // Remove from tracking
            const index = runningProcesses.indexOf(proc);
            if (index > -1) runningProcesses.splice(index, 1);

            if (abortRequested) {
                resolve({
                    success: false,
                    error: "Operation aborted by user"
                });
            } else {
                resolve({
                    success: code === 0,
                    output: stdout,
                    error: stderr
                });
            }
        });

        proc.on("error", error => {
            // Remove from tracking
            const index = runningProcesses.indexOf(proc);
            if (index > -1) runningProcesses.splice(index, 1);

            resolve({
                success: false,
                error: error.message
            });
        });
    });
}

/**
 * Run a command silently (suppress output)
 */
function runCommandSilent(
    command: string,
    args: string[],
    cwd: string | undefined,
    env: Record<string, string> | undefined
): Promise<CommandResult> {
    return new Promise(resolve => {
        const mergedEnv = { ...process.env, ...env };
        const proc = spawn(command, args, {
            cwd: cwd || process.cwd(),
            env: mergedEnv,
            shell: true,
            stdio: "pipe"
        });

        let stdout = "";
        let stderr = "";

        proc.stdout?.on("data", data => {
            stdout += data.toString();
        });

        proc.stderr?.on("data", data => {
            stderr += data.toString();
        });

        proc.on("close", code => {
            resolve({
                success: code === 0,
                output: stdout,
                error: stderr
            });
        });

        proc.on("error", error => {
            resolve({
                success: false,
                error: error.message
            });
        });
    });
}

/**
 * Filter out Docker noise messages
 */
function shouldFilterDockerMessage(text: string): boolean {
    const filters = [
        "Found orphan containers",
        "Container docker-build-emscripten-build-run-",
        "Container ID:",
        "--remove-orphans flag",
        "cache:INFO"
    ];

    if (filters.some(filter => text.includes(filter))) {
        return true;
    }

    // Filter out 64-character container IDs (hex strings on their own line)
    const isContainerId = /^[a-f0-9]{64}$/.test(text.trim());
    return isContainerId;
}

/**
 * Check if Docker is installed and running
 */
export async function checkDocker(log: LogFunction): Promise<boolean> {
    log("Checking Docker status...");

    // Check if Docker is installed
    const versionResult = spawnSync("docker", ["--version"], { shell: true });
    if (versionResult.status !== 0) {
        log("Docker is not installed. Please install Docker Desktop.", "error");
        return false;
    }

    // Check if Docker daemon is running
    const psResult = spawnSync("docker", ["ps"], { shell: true });
    if (psResult.status !== 0) {
        log("Docker is not running. Please start Docker Desktop.", "error");
        return false;
    }

    log("Docker is ready.", "success");
    return true;
}

/**
 * Create a temporary Docker container
 */
async function createTempContainer(
    config: BuildConfig,
    env: Record<string, string>,
    log: LogFunction
): Promise<string> {
    const result = await runCommandSilent(
        "docker",
        ["compose", "run", "-d", "emscripten-build", "sleep", "infinity"],
        config.dockerBuildPath,
        env
    );

    if (!result.success || !result.output) {
        if (result.error) {
            log(`Container creation error: ${result.error}`, "error");
        }
        throw new Error("Failed to create temporary container");
    }

    const containerId = result.output.trim();

    // Track container ID for abort handling
    currentContainerId = containerId;

    return containerId;
}

/**
 * Setup the Docker environment and project files
 */
export async function setupProject(
    projectInfo: ProjectInfo,
    config: BuildConfig,
    log: LogFunction
): Promise<{ skipEmcmakeCmake: boolean }> {
    const startTime = Date.now();
    log("=== Step 1/3: Setup ===");

    if (abortRequested) {
        throw new Error("Operation aborted by user");
    }

    const env = { PROJECT_VOLUME: config.dockerVolumeName };

    // Check if we can do incremental setup
    const canDoIncremental =
        lastProjectInfo &&
        projectInfoMatches(lastProjectInfo, projectInfo) &&
        lastProjectInfo.fileManifest &&
        projectInfo.fileManifest;

    if (canDoIncremental) {
        log(
            "Project configuration unchanged, performing incremental update...",
            "info"
        );
        log(`LVGL version: ${projectInfo.lvglVersion}`, "info");
        const result = await incrementalSetup(
            projectInfo,
            lastProjectInfo!,
            config,
            env,
            log
        );
        lastProjectInfo = projectInfo;
        return result;
    }

    log("Performing full setup...");

    // Step 1: Build Docker image
    log("Building Docker image...");
    let result = await runCommand(
        "docker",
        ["compose", "build"],
        config.dockerBuildPath,
        env,
        log,
        true
    );
    if (!result.success) {
        if (result.error) {
            log(`Docker build error: ${result.error}`, "error");
        }
        throw new Error("Failed to build Docker image");
    }
    log("Docker image built successfully.", "success");

    // Step 1.5: Clean src directory first to remove any leftover files
    log("Cleaning src directory...");
    result = await runCommandSilent(
        "docker",
        ["compose", "run", "--rm", "emscripten-build", "rm", "-rf", "/project/src"],
        config.dockerBuildPath,
        env
    );
    // Ignore errors if src doesn't exist yet

    // Step 2: Check if volume exists and has content
    log("Checking if project is already set up...");
    result = await runCommandSilent(
        "docker",
        ["compose", "run", "--rm", "emscripten-build", "test", "-f", "/project/build.sh"],
        config.dockerBuildPath,
        env
    );

    const projectAlreadySetup = result.success;

    let containerId: string | undefined;

    if (!projectAlreadySetup) {
        // Step 3: Clone repository (only on first setup)
        log("First-time setup: Cloning repository from GitHub...");

        containerId = await createTempContainer(config, env, log);

        result = await runCommand(
            "docker",
            [
                "exec",
                containerId,
                "sh",
                "-c",
                `"cd /project && git clone --recursive https://github.com/eez-open/${config.repositoryName} ."`
            ],
            config.dockerBuildPath,
            env,
            log
        );

        if (!result.success) {
            await runCommand(
                "docker",
                ["stop", containerId],
                config.dockerBuildPath,
                env,
                log
            );
            throw new Error("Git clone failed");
        }

        log("Repository cloned successfully.", "success");
    } else {
        log("Project already exists in Docker volume. Checking for updates...");

        // Pull latest changes from GitHub
        log("Pulling latest changes from GitHub...");

        result = await runCommand(
            "docker",
            [
                "compose",
                "run",
                "--rm",
                "emscripten-build",
                "sh",
                "-c",
                '"cd /project && git pull"'
            ],
            config.dockerBuildPath,
            env,
            log
        );

        if (!result.success) {
            log("Git pull failed, continuing with existing code...", "warning");
        } else {
            log("Latest changes pulled successfully.", "success");
        }
    }

    // Step 4: Update build files
    log("Updating build files...");
    if (!containerId) {
        containerId = await createTempContainer(config, env, log);
    }

    // Remove and recreate src directory
    log("Preparing src directory...");
    await runCommand(
        "docker",
        [
            "exec",
            containerId,
            "sh",
            "-c",
            '"rm -rf /project/src && mkdir -p /project/src"'
        ],
        config.dockerBuildPath,
        env,
        log
    );

    // Copy build destination directory
    if (!projectInfo.uiDir) {
        await runCommand(
            "docker",
            ["stop", containerId],
            config.dockerBuildPath,
            env,
            log
        );
        throw new Error("UI directory path is missing");
    }

    if (!fs.existsSync(projectInfo.uiDir)) {
        await runCommand(
            "docker",
            ["stop", containerId],
            config.dockerBuildPath,
            env,
            log
        );
        throw new Error(`UI directory not found: ${projectInfo.uiDir}`);
    }

    const resolvedUiDir = path.resolve(projectInfo.uiDir);
    log(`Copying ${resolvedUiDir} to container...`);

    // Copy contents of destination folder directly into /project/src/
    // Quote the source path to handle paths with spaces
    result = await runCommand(
        "docker",
        ["cp", `"${resolvedUiDir}/."`, `${containerId}:/project/src/`],
        config.dockerBuildPath,
        env,
        log
    );

    if (!result.success) {
        await runCommand(
            "docker",
            ["stop", containerId],
            config.dockerBuildPath,
            env,
            log
        );
        throw new Error("Failed to copy build destination directory");
    }

    // Update timestamps to ensure CMake detects changes
    await runCommand(
        "docker",
        [
            "exec",
            containerId,
            "find",
            "/project/src",
            "-type",
            "f",
            "(",
            "-name",
            "*.cpp",
            "-o",
            "-name",
            "*.c",
            "-o",
            "-name",
            "*.h",
            ")",
            "-exec",
            "touch",
            "{}",
            "+"
        ],
        config.dockerBuildPath,
        env,
        log
    );

    // Copy fonts if any are specified
    if (projectInfo.fonts && projectInfo.fonts.length > 0) {
        log(`Copying ${projectInfo.fonts.length} font(s) to container...`);

        // Create fonts directory in container
        await runCommand(
            "docker",
            ["exec", containerId, "mkdir", "-p", "/project/fonts"],
            config.dockerBuildPath,
            env,
            log
        );

        // Copy each font file
        for (const font of projectInfo.fonts) {
            log(`Copying font: ${font.fileName}`);

            // Determine target directory from targetPath
            const targetDir = path.posix.dirname(font.targetPath);
            const targetFileName = path.posix.basename(font.targetPath);

            // Create target directory structure in container
            await runCommand(
                "docker",
                ["exec", containerId, "mkdir", "-p", `/project${targetDir}`],
                config.dockerBuildPath,
                env,
                log
            );

            // Copy the font file to the container
            // Quote the source path to handle paths with spaces
            result = await runCommand(
                "docker",
                [
                    "cp",
                    `"${font.localPath}"`,
                    `${containerId}:/project${targetDir}/${targetFileName}`
                ],
                config.dockerBuildPath,
                env,
                log
            );

            if (!result.success) {
                await runCommand(
                    "docker",
                    ["stop", containerId],
                    config.dockerBuildPath,
                    env,
                    log
                );
                throw new Error(`Failed to copy font file: ${font.fileName}`);
            }
        }

        // Create fonts manifest file for build.sh
        const fontsManifest = projectInfo.fonts
            .map(f => f.targetPath)
            .join("\n");
        const manifestContent = Buffer.from(fontsManifest).toString("base64");

        await runCommand(
            "docker",
            [
                "exec",
                containerId,
                "sh",
                "-c",
                `"echo '${manifestContent}' | base64 -d > /project/fonts.txt"`
            ],
            config.dockerBuildPath,
            env,
            log
        );

        log("Fonts manifest created: /project/fonts.txt", "success");
    }

    // Stop container
    await runCommand(
        "docker",
        ["stop", containerId],
        config.dockerBuildPath,
        env,
        log
    );

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    log(`Setup completed successfully in ${duration}s!`, "success");

    // Store project info for next build
    lastProjectInfo = projectInfo;

    return { skipEmcmakeCmake: false };
}

/**
 * Perform incremental setup (only update changed files)
 */
async function incrementalSetup(
    projectInfo: ProjectInfo,
    lastProjectInfo: ProjectInfo,
    config: BuildConfig,
    env: Record<string, string>,
    log: LogFunction
): Promise<{ skipEmcmakeCmake: boolean }> {
    const startTime = Date.now();

    const oldManifest = lastProjectInfo.fileManifest!;
    const newManifest = projectInfo.fileManifest!;

    // Find added, modified, and deleted files
    const addedFiles: string[] = [];
    const modifiedFiles: string[] = [];
    const deletedFiles: string[] = [];

    // Check for added and modified files
    for (const [file, hash] of Object.entries(newManifest)) {
        if (!oldManifest[file]) {
            addedFiles.push(file);
        } else if (oldManifest[file] !== hash) {
            modifiedFiles.push(file);
        }
    }

    // Check for deleted files
    for (const file of Object.keys(oldManifest)) {
        if (!newManifest[file]) {
            deletedFiles.push(file);
        }
    }

    const totalChanges =
        addedFiles.length + modifiedFiles.length + deletedFiles.length;

    if (totalChanges === 0) {
        log("No file changes detected, skipping setup.", "success");
        return { skipEmcmakeCmake: true };
    }

    log(
        `Detected changes: ${addedFiles.length} added, ${modifiedFiles.length} modified, ${deletedFiles.length} deleted`
    );

    // Log detailed file changes for debugging
    if (addedFiles.length > 0) {
        log(`Added files: ${addedFiles.join(", ")}`);
    }
    if (modifiedFiles.length > 0) {
        log(`Modified files: ${modifiedFiles.join(", ")}`);
    }
    if (deletedFiles.length > 0) {
        log(`Deleted files: ${deletedFiles.join(", ")}`);
    }

    // Create temp container for file operations
    const containerId = await createTempContainer(config, env, log);

    try {
        // Handle deleted files - batch all deletes into single command
        if (deletedFiles.length > 0) {
            log(`Removing ${deletedFiles.length} deleted file(s)...`);
            const deleteCommands = deletedFiles
                .map(file => `rm -f "/project/src/${file}"`)
                .join(" && ");

            await runCommand(
                "docker",
                ["exec", containerId, "sh", "-c", deleteCommands],
                config.dockerBuildPath,
                env,
                log
            );
        }

        // Handle added and modified files
        const changedFiles = [...addedFiles, ...modifiedFiles];
        if (changedFiles.length > 0) {
            log(`Copying ${changedFiles.length} added/modified file(s)...`);

            // Collect all unique parent directories
            const parentDirs = new Set<string>();
            for (const file of changedFiles) {
                const containerPath = `/project/src/${file}`;
                const parentDir = path.posix.dirname(containerPath);
                parentDirs.add(parentDir);
            }

            // Create all parent directories in a single command
            if (parentDirs.size > 0) {
                const mkdirCommands = Array.from(parentDirs)
                    .map(dir => `mkdir -p "${dir}"`)
                    .join(" && ");

                await runCommand(
                    "docker",
                    ["exec", containerId, "sh", "-c", mkdirCommands],
                    config.dockerBuildPath,
                    env,
                    () => {} // Silent
                );
            }

            // Copy files (must be done individually as docker cp runs outside container)
            for (const file of changedFiles) {
                const localPath = path.join(projectInfo.uiDir, file);
                const containerPath = `/project/src/${file}`;

                const result = await runCommand(
                    "docker",
                    ["cp", `"${localPath}"`, `${containerId}:${containerPath}`],
                    config.dockerBuildPath,
                    env,
                    log
                );

                if (!result.success) {
                    throw new Error(`Failed to copy file: ${file}`);
                }
            }

            // Update timestamps on all copied files in a single command
            log(`Updating timestamps on ${changedFiles.length} file(s)...`);
            const touchCommands = changedFiles
                .map(file => `touch "/project/src/${file}"`)
                .join(" && ");

            await runCommand(
                "docker",
                ["exec", containerId, "sh", "-c", touchCommands],
                config.dockerBuildPath,
                env,
                () => {} // Silent
            );
        }

        // Stop container
        await runCommand(
            "docker",
            ["stop", containerId],
            config.dockerBuildPath,
            env,
            log
        );

        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        log(`Incremental setup completed in ${duration}s!`, "success");

        // Skip emcmake/cmake if only files were modified (no adds/deletes)
        const skipEmcmakeCmake =
            addedFiles.length === 0 && deletedFiles.length === 0;
        if (skipEmcmakeCmake) {
            log(
                "Only file modifications detected, build will skip CMake reconfiguration"
            );
        }

        return { skipEmcmakeCmake };
    } catch (error) {
        // Cleanup on error
        await runCommand(
            "docker",
            ["stop", containerId],
            config.dockerBuildPath,
            env,
            () => {}
        );
        throw error;
    }
}

/**
 * Build the project using Emscripten
 */
export async function buildProject(
    projectInfo: ProjectInfo,
    config: BuildConfig,
    log: LogFunction,
    skipEmcmakeCmake: boolean = false
): Promise<void> {
    const startTime = Date.now();
    log("=== Step 2/3: Build ===");

    if (abortRequested) {
        throw new Error("Operation aborted by user");
    }

    const env = { PROJECT_VOLUME: config.dockerVolumeName };

    log(
        `Starting build (LVGL ${projectInfo.lvglVersion}, ${projectInfo.displayWidth}x${projectInfo.displayHeight})...`
    );

    // Use the build.sh script with parameters
    let buildCommand = `"./build.sh --lvgl=${projectInfo.lvglVersion} --display-width=${projectInfo.displayWidth} --display-height=${projectInfo.displayHeight}`;

    // Skip CMake reconfiguration if only files were modified
    if (skipEmcmakeCmake) {
        buildCommand += " --skip-emcmake-cmake";
        log(
            "Build will skip CMake reconfiguration (incremental build)",
            "info"
        );
    }

    // Add fonts parameter if fonts are present
    if (projectInfo.fonts && projectInfo.fonts.length > 0) {
        buildCommand += " --fonts=/project/fonts.txt";
    }

    // Add encoder group parameter if specified
    if (projectInfo.encoderGroup) {
        buildCommand += ` --encoder-group=groups.${projectInfo.encoderGroup}`;
    }

    // Add keyboard group parameter if specified
    if (projectInfo.keyboardGroup) {
        buildCommand += ` --keyboard-group=groups.${projectInfo.keyboardGroup}`;
    }

    buildCommand += '"';

    const result = await runCommand(
        "docker",
        ["compose", "run", "--rm", "emscripten-build", "sh", "-c", buildCommand],
        config.dockerBuildPath,
        env,
        log
    );

    if (!result.success) {
        throw new Error("Build failed");
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    log(`Build completed successfully in ${duration}s!`, "success");
}

/**
 * Extract build output from Docker volume
 */
export async function extractBuild(
    outputPath: string,
    config: BuildConfig,
    log: LogFunction
): Promise<void> {
    const startTime = Date.now();
    log("=== Step 3/3: Extract ===");

    if (abortRequested) {
        throw new Error("Operation aborted by user");
    }

    const env = { PROJECT_VOLUME: config.dockerVolumeName };

    log(`Output path: ${outputPath}`);

    // Clean output directory first
    log("Cleaning output directory...");
    if (fs.existsSync(outputPath)) {
        fs.rmSync(outputPath, { recursive: true, force: true });
        log("Output directory cleaned.");
    }

    // Create fresh output directory
    fs.mkdirSync(outputPath, { recursive: true });

    log("Extracting build files from Docker volume...");

    // Create temp container and copy files
    const containerId = await createTempContainer(config, env, log);

    const requiredFiles = ["index.html", "index.js", "index.wasm"];
    const optionalFiles = ["index.data"];
    const files = [...requiredFiles, ...optionalFiles];

    for (const file of files) {
        const isOptional = optionalFiles.includes(file);

        // For optional files, check if they exist first to avoid error messages
        if (isOptional) {
            const checkResult = await runCommand(
                "docker",
                ["exec", containerId, "test", "-f", `/project/build/${file}`],
                config.dockerBuildPath,
                env,
                () => {} // Silent check
            );
            if (!checkResult.success) {
                log(`${file} not found (optional file, skipping)`);
                continue;
            }
        }

        const destPath = path.join(outputPath, file);
        // Quote the destination path to handle paths with spaces
        const result = await runCommand(
            "docker",
            ["cp", `${containerId}:/project/build/${file}`, `"${destPath}"`],
            config.dockerBuildPath,
            env,
            log
        );

        if (!result.success) {
            await runCommand(
                "docker",
                ["stop", containerId],
                config.dockerBuildPath,
                env,
                log
            );
            throw new Error(`Failed to extract ${file}`);
        }

        // Log file info
        try {
            const stats = fs.statSync(destPath);
            log(`Extracted ${file}: ${stats.size} bytes`);
        } catch (err) {
            log(`Could not stat ${file}: ${(err as Error).message}`, "warning");
        }
    }

    await runCommand(
        "docker",
        ["stop", containerId],
        config.dockerBuildPath,
        env,
        log
    );

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    log(`Build files extracted successfully in ${duration}s!`, "success");
}

/**
 * Clean build directory
 */
export async function cleanBuild(
    config: BuildConfig,
    log: LogFunction
): Promise<void> {
    const startTime = Date.now();
    log("=== Clean Build Directory ===");

    const env = { PROJECT_VOLUME: config.dockerVolumeName };

    log("Removing build directory...");

    const result = await runCommand(
        "docker",
        ["compose", "run", "--rm", "emscripten-build", "rm", "-rf", "/project/build"],
        config.dockerBuildPath,
        env,
        log
    );

    if (!result.success) {
        throw new Error("Clean build failed");
    }

    // Reset incremental build state since build artifacts are gone
    lastProjectInfo = null;

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    log(`Build directory cleaned in ${duration}s!`, "success");
}

/**
 * Clean all (delete entire /project directory for fresh start)
 */
export async function cleanAll(
    config: BuildConfig,
    log: LogFunction
): Promise<void> {
    const startTime = Date.now();
    log("=== Clean All ===");

    const env = { PROJECT_VOLUME: config.dockerVolumeName };

    log("Removing all contents from /project directory...");

    const result = await runCommand(
        "docker",
        [
            "compose",
            "run",
            "--rm",
            "emscripten-build",
            "sh",
            "-c",
            '"rm -rf /project/* /project/.*[!.]*"'
        ],
        config.dockerBuildPath,
        env,
        log
    );

    if (!result.success) {
        throw new Error("Clean all failed");
    }

    // Reset incremental build state since everything is gone
    lastProjectInfo = null;

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    log(
        `Project directory cleaned in ${duration}s. Next build will start from scratch.`,
        "success"
    );
}
