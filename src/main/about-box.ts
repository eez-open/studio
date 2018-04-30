import * as fs from 'fs';
import { dialog, BrowserWindow } from 'electron';

function showAboutBox() {
    var packageJSON = require('../../package.json');
    var version = packageJSON.version;
    
    var stats = fs.statSync(process.execPath);
    var mtime = new Date(stats.mtime);
    var buildDate = mtime.toString();
    
    dialog.showMessageBox(BrowserWindow.getFocusedWindow(), {
        type: 'info',
        title: 'EEZ Studio',
        message: "EEZ Studio",
        detail: `Version: ${version}\nBuild date: ${buildDate}`,
        buttons: []
    });
}

export default showAboutBox;