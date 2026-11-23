const gulp = require("gulp");
const terser = require("gulp-terser");
const pump = require("pump");

const SRC = "packages";
const DST = "build";

// copy all from SRC to DST, excluding: *.ts, *.tsx, *.less, ...
gulp.task("copy", function () {
    return gulp
        .src(
            [
                SRC + "/**/*.*",
                "!" + SRC + "/**/*.ts",
                "!" + SRC + "/**/*.tsx",
                "!" + SRC + "/**/*.less",
                "!" + SRC + "/tsconfig.json",
                "!" + SRC + "/tsconfig.dev.json"
            ],
            { encoding: false }
        )
        .pipe(gulp.dest(DST));
});

// minify all *.js files in DST
gulp.task("minify", function (cb) {
    pump([gulp.src(DST + "/**/*.js"), terser(), gulp.dest(DST)], cb);
});

// generate the expression parser from the grammar, so the app (or the VSCode
// webview) doesn't read and compile the grammar at runtime
gulp.task("expression-parser", function (cb) {
    const fs = require("fs");
    const peggy = require("peggy");

    const grammar = fs.readFileSync(
        "resources/expression-grammar.pegjs",
        "utf8"
    );

    const source = peggy.generate(grammar, {
        output: "source",
        format: "commonjs",
        allowedStartRules: ["Start", "Identifier"],
        cache: true
    });

    fs.writeFileSync(
        SRC + "/project-editor/flow/expression/expression-parser.js",
        source
    );

    cb();
});

gulp.task("release", gulp.series("expression-parser", "copy", "minify"));

gulp.task("debug", gulp.series("expression-parser", "copy"));
