var browserify = require("browserify");
var fs = require("fs");

var b = browserify({
    paths: ["./dist/"]
});

b.add("./dist/project-editor/webstudio.js");

var myFile = fs.createWriteStream("./dist/project-editor/webstudio-bundle.js");

b.bundle().pipe(myFile);
