var gulp = require('gulp');
var exec = require('child_process').exec;
var execFile = require('child_process').execFile;
var fs = require('fs');
var glob = require('glob');
var mkdirp = require('mkdirp');

var protoc = process.env.PROTOC || '../src/protoc';

gulp.task('genproto_closure', function (cb) {
  execFile(protoc,
           ['--js_out=library=testproto_libs,binary:.', '-I', '../src', '-I', '.'].concat(glob.sync('*.proto'), '../src/google/protobuf/descriptor.proto'),
           function (err, stdout, stderr) {
    console.log(stdout);
    console.log(stderr);
    cb(err);
  });
});

gulp.task('genproto_commonjs', function (cb) {
  mkdirp('commonjs_out', function (err) {
    if (err) return cb(err);
    execFile(protoc,
             ['--js_out=import_style=commonjs,binary:commonjs_out', '-I', '../src', '-I', 'commonjs', '-I', '.'].concat(glob.sync('*.proto'), glob.sync('commonjs/test*/*.proto'), '../src/google/protobuf/descriptor.proto'),
             function (err, stdout, stderr) {
      console.log(stdout);
      console.log(stderr);
      cb(err);
    });
  });
});

gulp.task('dist', function (cb) {
  // TODO(haberman): minify this more aggressively.
  // Will require proper externs/exports.
  exec('python ./node_modules/google-closure-library/closure/bin/calcdeps.py -i message.js -i binary/reader.js -i binary/writer.js -i commonjs/export.js -p . -p node_modules/google-closure-library/closure -o compiled --compiler_jar node_modules/google-closure-compiler/compiler.jar > google-protobuf.js',
       function (err, stdout, stderr) {
    console.log(stdout);
    console.log(stderr);
    cb(err);
  });
});

gulp.task('commonjs_asserts', function (cb) {
  mkdirp('commonjs_out/test_node_modules', function (err) {
    if (err) return cb(err);
    exec('python ./node_modules/google-closure-library/closure/bin/calcdeps.py -i commonjs/export_asserts.js -p . -p node_modules/google-closure-library/closure -o compiled --compiler_jar node_modules/google-closure-compiler/compiler.jar > commonjs_out/test_node_modules/closure_asserts_commonjs.js',
         function (err, stdout, stderr) {
      console.log(stdout);
      console.log(stderr);
      cb(err);
    });
  });
});

gulp.task('commonjs_testdeps', function (cb) {
  mkdirp('commonjs_out/test_node_modules', function (err) {
    if (err) return cb(err);
    exec('python ./node_modules/google-closure-library/closure/bin/calcdeps.py -i commonjs/export_testdeps.js -p . -p node_modules/google-closure-library/closure -o compiled --compiler_jar node_modules/google-closure-compiler/compiler.jar > commonjs_out/test_node_modules/testdeps_commonjs.js',
         function (err, stdout, stderr) {
      console.log(stdout);
      console.log(stderr);
      cb(err);
    });
  });
});

gulp.task('make_commonjs_out', ['dist', 'genproto_commonjs', 'commonjs_asserts', 'commonjs_testdeps'], function (cb) {
  // TODO(haberman): minify this more aggressively.
  // Will require proper externs/exports.
  mkdirp('commonjs_out/binary', function (err) {
    if (err) return cb(err);
    mkdirp('commonjs_out/test_node_modules', function (err) {
      if (err) return cb(err);
      var cmd = '';
      function addTestFile(file) {
        cmd += 'node commonjs/rewrite_tests_for_commonjs.js < ' + file +
               ' > commonjs_out/' + file + '&& ';
      }

      glob.sync('*_test.js').forEach(addTestFile);
      glob.sync('binary/*_test.js').forEach(addTestFile);

      exec(cmd +
           'cp commonjs/jasmine.json commonjs_out/jasmine.json && ' +
           'cp google-protobuf.js commonjs_out/test_node_modules && ' +
           'cp commonjs/import_test.js commonjs_out/import_test.js',
           function (err, stdout, stderr) {
        console.log(stdout);
        console.log(stderr);
        cb(err);
      });
    });
  });
});

gulp.task('deps', ['genproto_closure'], function (cb) {
  execFile('python',
           ['./node_modules/google-closure-library/closure/bin/build/depswriter.py'].concat(glob.sync('*.js'), glob.sync('binary/*.js')),
           function (err, stdout, stderr) {
    if (err) return cb(err);
    fs.writeFile('deps.js', stdout, function (err) {
      cb(err);
    });
    console.log(stderr);
  });
});

gulp.task('test_closure', ['genproto_closure', 'deps'], function (cb) {
  var env = Object.create(process.env);
  env.JASMINE_CONFIG_PATH = 'jasmine.json';
  exec('"./node_modules/.bin/jasmine"',
       { env: env },
       function (err, stdout, stderr) {
    console.log(stdout);
    console.log(stderr);
    cb(err);
  });
});

gulp.task('test_commonjs', ['make_commonjs_out'], function (cb) {
  var env = Object.create(process.env);
  env.JASMINE_CONFIG_PATH = 'jasmine.json';
  env.NODE_PATH = 'test_node_modules';
  exec('"../node_modules/.bin/jasmine"',
       {
         cwd: 'commonjs_out',
         env: env
       },
       function (err, stdout, stderr) {
    console.log(stdout);
    console.log(stderr);
    cb(err);
  });
});

gulp.task('test', ['test_closure', 'test_commonjs'], function(cb) {
  cb();
});
