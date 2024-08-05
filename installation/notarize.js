require("dotenv").config();
const { notarize } = require("@electron/notarize");

exports.default = async function notarizing(context) {
    const { electronPlatformName, appOutDir } = context;
    if (electronPlatformName !== "darwin") {
        return;
    }

    const appName = context.packager.appInfo.productFilename;

    console.log('Apple id: "' + process.env.APPLEID + '"');
    console.log('Apple pass: "' + process.env.APPLEIDPASS + '"');

    return await notarize({
        appBundleId: "eu.envox.eez-studio",
        appPath: `${appOutDir}/${appName}.app`,
        appleId: process.env.APPLEID,
        appleIdPassword: process.env.APPLEIDPASS,
        teamId: "TG2466LDSJ"
    });
};
