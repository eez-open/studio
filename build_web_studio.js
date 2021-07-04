var browserify = require("browserify");
var fs = require("fs");

var b = browserify({
    paths: ["./build/"]
});

b.add("./build/project-editor/webstudio.js");

var myFile = fs.createWriteStream("./build/project-editor/webstudio-bundle.js");

b.bundle().pipe(myFile);
