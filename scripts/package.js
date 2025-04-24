const fs = require('fs');
const archiver = require('archiver');
const path = require('path');

// Create output directory if it doesn't exist
const outputDir = path.resolve(__dirname, '../');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Create a file to stream archive data to
const output = fs.createWriteStream(path.join(outputDir, 'platformer-game.zip'));
const archive = archiver('zip', {
  zlib: { level: 9 } // Sets the compression level
});

// Listen for all archive data to be written
output.on('close', function() {
  console.log(`Archive created: ${archive.pointer()} total bytes`);
  console.log('Packaging complete!');
});

// Handle warnings and errors
archive.on('warning', function(err) {
  if (err.code === 'ENOENT') {
    console.warn(err);
  } else {
    throw err;
  }
});
archive.on('error', function(err) {
  throw err;
});

// Pipe archive data to the file
archive.pipe(output);

// Append the dist directory contents
archive.directory('dist/', false);

// Finalize the archive
archive.finalize();