var remote = require('remote');
var shell = require('shell');
var app = remote.require('app');
var dialog = remote.require('dialog');
var http = require('http');
var fs = require('fs');
var fse = require('fs-extra');
var originalFs = require('original-fs');
var zlib = require('zlib');
var spawn = require('child_process').spawn;
var exec = require('child_process').exec;
var Promise = require('bluebird');
var admZip = require('adm-zip');
var path = require('path');

function downloadFile(params) {
  var url = params.url;
  var pathToSave = params.pathToSave;
  var onProgress = params.onProgress;
  var onDownloadComplete = params.onDownloadComplete;
  var onFinish = params.onFinish;
  var onError = params.onError;
  var deleteTempFolder = params.deleteTempFolder || false;

  var fileNameToShow = params.fileNameToShow;
  var tempFileName = app.getPath('temp') +
    path.sep + String(new Date().getTime()) + '.zip';
  var tempFolderName = params.targetPath ||
    (app.getPath('temp') + path.sep + String(new Date().getTime()));
  console.log('tempFileName: ' + tempFileName);
  console.log('tempFolderName: ' + tempFolderName);

  var req = http.get(url);

  req.on('response', function(res) {
      var fullSize = res.headers['content-length']; //total byte length
      var downloadedSize = 0;
      var startTimestamp = new Date().getTime();
      var lastTimestamp = new Date().getTime();

      res.on('data', function(data) {
          fs.appendFileSync(tempFileName, data);
          downloadedSize += data.length;

          var currentTimestamp = new Date().getTime();

          var params = {
            startTime: startTimestamp,
            endTime: currentTimestamp,
            downloadedSize: downloadedSize,
            fullSize: fullSize
          };

          var result = {
            downloadedSize: downloadedSize,
            fullSize: fullSize,
            progress: downloadedSize / fullSize,
            downloadSpeed: calculateSpeed(params),
            elapsedTime: calculateElapsedTime(params),
            fileName: fileNameToShow
          };
          onProgress(result);
          lastTimestamp = currentTimestamp;
        })
        .on('end', function() {
          onDownloadComplete();
          unzip({
            compressedFilePath: tempFileName,
            uncompressedPath: tempFolderName,
            deleteZip: deleteTempFolder,
            callback: function(error) {
              onFinish({
                targetPath: tempFolderName
              });
            }
          });

        });
    })
    .on('error', function(error) {
      onError(error);
    });
  return req;
}

exports.downloadFile = downloadFile;

function calculateSpeed(params) {
  var results = [];
  results[3] = 0;
  results[2] = calculateBaseSpeed(params).toFixed(2);
  results[1] = (results[2] / 1024).toFixed(2);
  results[0] = (results[1] / 1024).toFixed(2);

  var resultLeemas = ['Mbps', 'Kbps', 'bps', 'bps'];

  var i = results.length - 1;
  results.every(function(element, index, array) {
    if (element > 0) {
      i = index;
      return false;
    }
  });

  return results[i] + resultLeemas[i];
}

function calculateElapsedTime(params) {
  var speed = calculateBaseSpeed(params);
  var elapsedSize = params.fullSize - params.downloadedSize;

  return elapsedSize / speed;
}

function calculateBaseSpeed(params) {
  var startTime = params.startTime;
  var endTime = params.endTime;
  var downloadedSize = params.downloadedSize;

  var duration = (endTime - startTime) / 1000;
  var bitsLoaded = downloadedSize * 8;

  return (bitsLoaded / duration);
}

function formatBytes(bytes, decimals) {
  if (bytes === 0) {
    return '0 Byte';
  }
  var k = 1000;
  var dm = decimals + 1 || 3;
  var sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  var i = Math.floor(Math.log(bytes) / Math.log(k));
  return (bytes / Math.pow(k, i)).toPrecision(dm) + ' ' + sizes[i];
}
exports.formatBytes = formatBytes;

function launch(args) {
  // {
  //	name: appName,
  //  publisher: publisher,
  //  exe: process.execPath,
  // 	cwd: process.cwd(),
  // 	argv: process.argv,
  //  debug: true
  // }
  //console.log('launching ' + args.exe)
  //console.log('  argv: ' + util.inspect(args.argv))
  //console.log('  cwd: ' + args.cwd)
  var child = spawn(args.exe, args.argv, {
    detached: true,
    cwd: args.cwd,
    stdio: ['ignore', 'ignore', 'ignore'] // out, err]
  });
  child.unref();
}
exports.launch = launch;

function execute(args) {
  var child = exec(args.exe, {
    detached: true,
    cwd: args.cwd,
    stdio: ['ignore', 'pipe', 'pipe']
  }, function(error, stdout, stderr) {
    console.log('stdout: ' + stdout);
    console.log('stderr: ' + stderr);
    if (error !== null) {
      console.log('exec error: ' + error);
    }
  });
}
exports.exec = execute;

function unzip(params) {
  var compressedFilePath = params.compressedFilePath;
  var uncompressedPath = params.uncompressedPath;
  var deleteZip = params.deleteZip;
  var callback = params.callback;
  var zip = new admZip(compressedFilePath);
  zip.extractAllToAsync(uncompressedPath, true,
    function(error) {
      if (error) {
        console.log('Failed to unzip ' + compressedFilePath);
      } else if (deleteZip) {
        deleteFile(compressedFilePath);
      }

      if (callback) {
        callback(error);
      }
    });
}
exports.unzip = unzip;

function deleteFile(filePath) {
  fs.unlink(filePath, function(err) {
    console.log('successfully deleted ' + filePath);
  });
}

function emptyDirectory(params) {
  var folderPath = params.folderPath;
  var onFinish = params.onFinish;
  fse.emptyDir(folderPath, onFinish);
}
exports.emptyDirectory = emptyDirectory;

function fileExists(params) {
  var filePath = params.filePath;
  try {
    return originalFs.statSync(filePath).isFile();
  } catch (ex) {
    return false;
  }
}

exports.fileExists = fileExists;

function removeFileFromPath(filePath) {
  return filePath.substring(0, filePath.lastIndexOf('/'));
}
exports.removeFileFromPath = removeFileFromPath;

function getLastComponentFromPath(filePath) {
  var last = filePath.split('/');
  return last.length > 0 ? last[last.length - 1] : '';
}
exports.getLastComponentFromPath = getLastComponentFromPath;

function updateInfo(params) {
  var id = params.id;
  var progress = params.progress;
  var text = params.text;

  if (!id) {
    return;
  }

  if (progress) {
    $('#' + id + '_progress').circleProgress('value', progress);
    $('#' + id + '_percent').text(parseInt(progress * 100) + '%');
  }

  if (text) {
    $('#' + id + '_info').text(text);
  }
}
exports.updateInfo = updateInfo;

function writeJSON(params) {
  return new Promise(function(resolve, reject) {
    var filePath = params.filePath;
    var content = params.content;
    fse.outputJson(filePath, content, function(err) {
      if (err) {
        reject(err);
      } else {
        resolve(params);
      }
    });
  });
}
exports.writeJSON = writeJSON;

function readJSON(filePath) {
  return new Promise(function(resolve, reject) {
    fse.readJson(filePath, function(err, content) {
      if (err) {
        reject(err);
      } else {
        resolve(content);
      }
    });
  });
}
exports.readJSON = readJSON;

function readJSONFromASAR(filePath) {
  return new Promise(function(resolve, reject) {
    fs.readFile('file', 'utf8', function(err, data) {
      if (err) {
        reject(err);
      } else {
        resolve(JSON.parse(data));
      }
    });
  });
}
exports.readJSONFromASAR = readJSONFromASAR;

function copyFile(source, target) {
  console.log('source: ' + source);
  console.log('target: ' + target);
  return new Promise(function(resolve, reject) {
    var rd = originalFs.createReadStream(source);
    rd.on('error', reject);
    var wr = originalFs.createWriteStream(target);
    wr.on('error', reject);
    wr.on('finish', resolve);
    rd.pipe(wr);
  });
}
exports.copyFile = copyFile;

/**
 * Simply compares two string version values.
 *
 * Example:
 * versionCompare('1.1', '1.2') => -1
 * versionCompare('1.1', '1.1') =>  0
 * versionCompare('1.2', '1.1') =>  1
 * versionCompare('2.23.3', '2.22.3') => 1
 */
function versionCompare(left, right) {
  if (typeof left + typeof right != 'stringstring') {
    return false;
  }

  var a = left.split('.');
  var b = right.split('.');
  var i = 0;
  var len = Math.max(a.length, b.length);

  for (; i < len; i++) {
    if ((a[i] && !b[i] && parseInt(a[i]) > 0) ||
      (parseInt(a[i]) > parseInt(b[i]))) {
      return 1;
    } else if ((b[i] && !a[i] && parseInt(b[i]) > 0) ||
      (parseInt(a[i]) < parseInt(b[i]))) {
      return -1;
    }
  }

  return 0;
}
exports.versionCompare = versionCompare;

function restart() {
  shell.openItem(app.getPath('exe'));
  app.quit();
}
exports.restart = restart;

function askForConfirmation(params) {
  return new Promise(function(resolve, reject) {
    var lemma = params.lemma;
    var answers = ['No', 'Yes'];

    function onClose(choice) {
      if (choice == 1) {
        resolve({});
      } else {
        reject(null);
      }
    }

    dialog.showMessageBox({
      type: 'none',
      buttons: answers,
      message: lemma
    }, onClose);
  });
}
exports.askForConfirmation = askForConfirmation;

function askTocancel(params) {
  var request = params.request;
  var questionLeema = params.questionLeema;
  var errorLeema = params.errorLeema;
  askForConfirmation({
      lemma: questionLeema
    })
    .then(function() {
      if (request) {
        request.abort();
      } else {
        alert(errorLeema);
      }
    });
}
exports.askTocancel = askTocancel;
