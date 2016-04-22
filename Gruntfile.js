var zlib = require('zlib');
var path = require('path');
var moment = require('moment');
var fse = require('fs-extra');

module.exports = function(grunt) {
  var packageJSONPath = './app/package.json';
  var packageJSON = null;
  var buildFolderPath = grunt.option('buildPath').replace(/\'/g, '');
  var bucket = grunt.option('bucket').replace(/\'/g, '');
  var isTest = grunt.option('isTest');

  if (!buildFolderPath) {
    console.error('no buildPath parameter');
    process.exit(1);
  }

  if (!bucket) {
    console.error('no bucket parameter');
    process.exit(1);
  }

  if (!isTest) {
    console.error('no isTest parameter');
    process.exit(1);
  }

  packageJSON = fse.readJSONSync(packageJSONPath);
  if (!packageJSON) {
    console.log('packageJSON  not found at "' + packageJSONPath + '"');
    process.exit(1);
  }

  packageJSON.version = packageJSON.version
    .replace('*', moment().utc(0).format('YYMMDDHHmm'));

  var writeJSONSyncError = fse.writeJSONSync(packageJSONPath, packageJSON);
  if (writeJSONSyncError) {
    console.log(writeJSONSyncError);
    process.exit(1);
  }
  console.log('Version is ' + packageJSON.version);
  var version = packageJSON.version.replace(/\./g, '_');
  buildFolderPath += version;
  fse.outputFile('version.txt', 'BUILD_VERSION: ' + version);

  var postData = {
    projectName: 'tul',
    version: packageJSON.version,
    type: isTest ? 'test' : 'release',
    oss: ['win', 'osx', 'linux'],
    hasPatch: false
  };

  grunt.initConfig({
    electron: {
      osxBuild: {
        options: {
          name: 'My Game Launcher',
          dir: 'app',
          out: path.resolve(buildFolderPath + '/osx/'),
          version: '0.30.4',
          platform: 'darwin',
          arch: 'x64',
          asar: true
        }
      },
      winBuild: {
        options: {
          name: 'My Game Launcher',
          dir: 'app',
          out: path.resolve(buildFolderPath + '/win/'),
          version: '0.30.4',
          platform: 'win32',
          arch: 'x64',
          asar: true
        }
      },
      linuxBuild: {
        options: {
          name: 'My Game Launcher',
          dir: 'app',
          out: path.resolve(buildFolderPath + '/linux/'),
          version: '0.30.4',
          platform: 'linux',
          arch: 'x64',
          asar: true
        }
      }
    },
    compress: {
      osxZip: {
        options: {
          mode: 'zip',
          zlib: {
            level: zlib.Z_BEST_COMPRESSION
          },
          archive: path.resolve(buildFolderPath + '/osx/full.zip')
        },
        expand: true,
        cwd: path.resolve(buildFolderPath +
          '/osx/My Game Launcher-darwin-x64/'),
        src: ['**/*']
      },
      linuxZip: {
        options: {
          mode: 'zip',
          zlib: {
            level: zlib.Z_BEST_COMPRESSION
          },
          archive: path.resolve(buildFolderPath + '/linux/full.zip')
        },
        expand: true,
        cwd: path.resolve(buildFolderPath +
          '/linux/My Game Launcher-linux-x64/'),
        src: ['**/*']
      },
    },
    aws_s3: {
      options: {
        accessKeyId: 'accessKeyId', // Use the variables
        secretAccessKey: 'secretAccessKey', // You can also use env variables
        region: 'us-west-2',
        uploadConcurrency: 3,
        access: 'private'
      },
      testtul: {
        options: {
          bucket: bucket,
        },
        files: [{
          expand: true,
          cwd: path.resolve(buildFolderPath + '/linux/'),
          src: 'full.zip',
          dest: '/' + version + '/linux/',
          action: 'upload'
        }, {
          expand: true,
          cwd: path.resolve(buildFolderPath + '/win/'),
          src: 'full.zip',
          dest: '/' + version + '/win/',
          action: 'upload'
        }, {
          expand: true,
          cwd: path.resolve(buildFolderPath + '/osx/'),
          src: 'full.zip',
          dest: '/' + version + '/osx/',
          action: 'upload'
        }, ]
      }
    },
    curl: {
      'releaseAPI': {
        src: {
          url: 'http://my.deployapi.com/version/deploy',
          method: 'POST',
          body: JSON.stringify(postData)
        },
        dest: 'ouput.js'
      }
    },
    clean: {
      build: [buildFolderPath],
      options: {
        force: true
      }
    },
  });
  grunt.loadNpmTasks('grunt-electron');
  grunt.loadNpmTasks('grunt-contrib-compress');
  grunt.loadNpmTasks('grunt-aws-s3');
  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-curl');
  // Default task(s).
  grunt.registerTask('default', ['electron', 'compress', 'aws_s3', 'curl']);
};
