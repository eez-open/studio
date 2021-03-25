const gulp = require("gulp");
const uglify = require("gulp-uglify-es").default;
const pump = require("pump");

const SRC = "packages";
const DST = "dist";

// copy all from SRC to DST, excluding: *.ts, *.tsx, *.less, ...
gulp.task("copy", function () {
    return gulp
        .src([
            SRC + "/**/*.*",
            "!" + SRC + "/**/*.ts",
            "!" + SRC + "/**/*.tsx",
            "!" + SRC + "/**/*.less",
            "!" + SRC + "/tsconfig.json",
            "!" + SRC + "/tsconfig.dev.json",
            // SRC folder must not contain *.js or *.js.map anymore,
            // we add these two just in case there is some remains from
            // the past when *.js is outputed in SRC folder
            "!" + SRC + "/**/*.js",
            "!" + SRC + "/**/*.js.map"
        ])
        .pipe(gulp.dest(DST));
});

// minify all *.js files in DST
gulp.task("minify", function (cb) {
    pump([gulp.src(DST + "/**/*.js"), uglify(), gulp.dest(DST)], cb);
});

gulp.task("release", gulp.series("copy", "minify"));

gulp.task("debug", gulp.series("copy"));
