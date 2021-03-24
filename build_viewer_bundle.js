var browserify = require("browserify");
var fs = require("fs");

var b = browserify({
    paths: ["./dist/"]
});

b.add("./dist/project-editor/viewer.js");

var myFile = fs.createWriteStream("./dist/project-editor/viewer-bundle.js");

b.bundle().pipe(myFile);
