const { src, dest, series, parallel, watch } = require('gulp');
const concat = require('gulp-concat');
const uglify = require('gulp-uglify');
const cleanCSS = require('gulp-clean-css');
const htmlmin = require('gulp-htmlmin');
const { deleteAsync } = require('del'); // Update to use deleteAsync
const browserSync = require('browser-sync').create();
const replace = require('gulp-replace');

// Clean dist folder
function clean() {
  return deleteAsync(['dist']); // Use deleteAsync instead of del
}

// Process JavaScript files - concatenate and minify
function scripts() {
// Order is important as specified in index.html
return src([
    // Libraries first
    'libraries/pd.js',
    'libraries/matter.min.js',
    'libraries/p5.min.js',
    // 'libraries/p5.sound-min.js',
    // Then game files
    'game/audio.js',
    'game/config.js',
    'game/core.js',
    'game/levels.js',
    'game/body.js',
    'game/player.js',
    'game/block.js',
    'game/run.js'
])
    .pipe(concat('game.js'))
    .pipe(uglify())
    .pipe(dest('dist'))
    .pipe(browserSync.stream());
}

// Process HTML files - minify and replace script references
function html() {
  return src('index.html')
    // Replace all script references with a single reference to game.js
    .pipe(replace(
      /<script src="libraries\/pd.js"><\/script>[\s\S]*?<script src="game\/run.js"><\/script>/,
      '<script src="game.js"></script>'
    ))
    .pipe(htmlmin({ collapseWhitespace: true, removeComments: true }))
    .pipe(dest('dist'))
    .pipe(browserSync.stream());
}

// Process CSS files - minify
function styles() {
return src('*.css')
    .pipe(cleanCSS())
    .pipe(dest('dist'))
    .pipe(browserSync.stream());
}

// Copy assets to dist
function assets() {
  // Copy MP3 files from root to dist
 return src(['*.txt'])
    .pipe(dest('dist'))
    .pipe(browserSync.stream());
}

// Development server with live reload
function serve() {
browserSync.init({
    server: {
    baseDir: './dist'
    }
});

// Watch for file changes
watch('*.js', scripts);
watch('game/**/*.js', scripts);
watch('libraries/**/*.js', scripts);
watch('*.html', html);
watch('*.css', styles);
watch('*.txt', assets);
}

// Export tasks
exports.clean = clean;
exports.scripts = scripts;
exports.html = html;
exports.styles = styles;
exports.assets = assets;  // Add the missing assets export

// Build task - runs all tasks in sequence
exports.build = series(
clean,
parallel(scripts, html, styles, assets)  // Add assets to the parallel tasks
);

// Watch task for development
exports.watch = series(
exports.build,
serve
);

// Default task
exports.default = exports.build;