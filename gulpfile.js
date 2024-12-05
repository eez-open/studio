const gulp = require("gulp");
const terser = require("gulp-terser");
const pump = require("pump");

const SRC = "packages";
const DST = "build";

// copy all from SRC to DST, excluding: *.ts, *.tsx, *.less, ...
gulp.task("copy", function () {
    return gulp
        .src([
            SRC + "/**/*.*",
            "!" + SRC + "/**/*.ts",
            "!" + SRC + "/**/*.tsx",
            "!" + SRC + "/**/*.less",
            "!" + SRC + "/tsconfig.json",
            "!" + SRC + "/tsconfig.dev.json"
        ])
        .pipe(gulp.dest(DST));
});

// minify all *.js files in DST
gulp.task("minify", function (cb) {
    pump([gulp.src(DST + "/**/*.js"), terser(), gulp.dest(DST)], cb);
});

gulp.task("release", gulp.series("copy", "minify"));

gulp.task("debug", gulp.series("copy"));
