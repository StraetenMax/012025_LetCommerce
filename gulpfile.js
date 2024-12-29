const gulp = require("gulp");
const rename = require("gulp-rename");
const pug = require("gulp-pug");
const through = require("through2");
const mjml = require("mjml");
const liveServer = require("live-server");

gulp.task("live-server", function(done){
    var params ={
        port: 8080,
        host: "127.0.0.1",
        root: "./html", // Set this to your HTML output directory
        open: true,
        file: "index.html",
        wait: 400,
        mount: [["/components", "./node_modules"]],
        logLevel: 2,
    };
    liveServer.start(params);
    done();
});

gulp.task("pug", function(){
    return gulp
    .src(["pug/**/*.pug", "!pug/**/_*.pug"])
    .pipe(
     pug({
        pretty: true,
     }),
    )
    .pipe(
        rename(function(path){
            path.extname = ".mjml";
        }),
    )
    .pipe(gulp.dest("./mjml"));
});

gulp.task("mjml", function(){
    return gulp
    .src(["mjml/**/*.mjml", "!mjml/**/_*.mjml"])
    .pipe(
        through.obj(function(file, enc, callback){
            const output = file.clone();
            const render = mjml(file.contents.toString(), {});
            output.contents = Buffer.from(render.html);
            this.push(output);
            return callback();
        }),
    )
    .pipe(
        rename(function(path){
            path.extname = ".html";
        }),
    )
    .pipe(
        gulp.dest("./html"));
});

gulp.task("watch", function(){
    gulp.watch("pug/**/*.pug", gulp.task("pug"));
    gulp.watch("mjml/**/*.mjml", gulp.task("mjml"));
});

gulp.task("dev", gulp.parallel("watch", "live-server"));
gulp.task("build", gulp.series("pug", "mjml"));