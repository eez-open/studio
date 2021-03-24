var browserify = require("browserify");

var b = browserify({
    paths: ["./dist/"]
});
b.add("./dist/project-editor/viewer.js");
b.bundle().pipe(process.stdout);
