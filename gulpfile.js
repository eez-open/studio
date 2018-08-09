const gulp = require("gulp");
const uglify = require("gulp-uglify-es").default;
const pump = require("pump");

function minify(folder, cb) {
    pump([gulp.src(folder + "/**/*.js"), uglify(), gulp.dest(folder)], cb);
}

gulp.task("minify", function(cb) {
    minify("src", cb);
});

gulp.task("default", gulp.series("minify"));
