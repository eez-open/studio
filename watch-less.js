const watch = require("node-watch");
const { exec } = require("child_process");

watch("./src", { recursive: true }, function(evt, name) {
    if (name.endsWith(".less")) {
        console.log(name + " changed!");
        console.log("build-css started...");
        exec("npm run build-css", (err, stdout, stderr) => {
            console.log(`${stdout}${stderr}`);
            if (err) {
                console.log("build-css failed!");
            } else {
                console.log("build-css successfully finished!");
            }
        });
    }
});
