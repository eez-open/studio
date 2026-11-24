const path = require('node:path');
const { app, ipcMain } = require('electron');

const root = path.resolve(__dirname, '../..');
const fixture = process.argv[process.argv.indexOf('--build-project') + 1];
const helper = path.join(__dirname, 'preview-assets.cjs');

async function runInRenderer(fixture, helper) {
    const { loadProjectEditor } = require('project-editor/project-editor-loader');
    const { ProjectStore } = require('project-editor/store');
    await loadProjectEditor();
    const store = ProjectStore.create({ type: 'project-editor' });
    await store.openFile(fixture);
    await require(helper).run(store, require('node:path').dirname(fixture));
}

app.setAppPath(root);
require(path.join(root, 'build/main/main.js'));

// Studio opens its normal hidden build window and signals when the renderer is
// ready. This test instance then runs the checks in that renderer.
ipcMain.removeAllListeners('open-command-line-project');
ipcMain.once('open-command-line-project', async ({ sender }) => {
    try {
        await sender.executeJavaScript(`(${runInRenderer})(${JSON.stringify(fixture)}, ${JSON.stringify(helper)})`);
        app.quit();
    } catch (error) {
        console.error(error);
        app.exit(1);
    }
});
