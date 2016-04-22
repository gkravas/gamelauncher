var remote = require('remote');
var fse = require('fs-extra');
var fs = require('fs');
var path = require('path');
var ipc = require('ipc');
var shell = require('shell');
var Promise = require('bluebird');
var app = remote.require('app');
var dialog = remote.require('dialog');
var utils = require('../core/utils.js');
var settings = require('../core/settings.js');
var Config = require('../core/config.js');

var mainWindow = remote.getCurrentWindow();
var installationPath = settings.FILE.LAUNCHER_FOLDER;
var configuration = null;
var buildURL = null;
var downloader = null;
var gameLatest = null;

function askToUpdate() {
  return utils.askForConfirmation({
    lemma: 'There is a new version of the game. Do you want to update?'
  });
}

function downloadUpdate(params) {
  return new Promise(function(resolve, reject) {

    function onDownloadProgress(params) {
      mainWindow.webContents.send('progress', {
        id: 'overall',
        progress: params.progress * 0.5
      });

      mainWindow.webContents.send('progress', {
        id: 'download',
        progress: params.progress,
        text: 'Downloading ' + params.fileName + ' ' +
          '(' + utils.formatBytes(params.downloadedSize) + ' / ' +
          utils.formatBytes(params.fullSize) +
          ') @ ' + params.downloadSpeed
      });
    }

    function onDownloadComplete() {
      mainWindow.webContents.send('progress', {
        id: 'overall',
        progress: 0.5,
        text: 'Updating...'
      });
    }

    function onFinishInstall(params) {
      mainWindow.webContents.send('progress', {
        id: 'overall',
        progress: 0.75,
        text: 'Configuring...'
      });
      resolve({});
    }

    function onError(error) {
      reject(error);
    }

    var params = {
      url: buildURL,
      targetPath: path.normalize(installationPath +
        settings.FILE.GAME_FOLDER),
      onProgress: onDownloadProgress,
      onDownloadComplete: onDownloadComplete,
      onFinish: onFinishInstall,
      onError: onError,
      fileNameToShow: 'My Game'
    };

    $('#overall_info').text('Downloading from server...');
    downloader = utils.downloadFile(params);
  });
}
//This is for patching, beware it's not tested
function deleteUnneededFile(params) {
  return new Promise(function(resolve, reject) {
    var changes = new Config(path.resolve(settings.FILE.CHANGES_FULL_PATH));

    var files = changes.equal.filter(function(item) {
      return !item.isDirectory;
    });
    var folders = changes.equal.filter(function(item) {
      return item.isDirectory;
    });
    folders = folders.sort(function(entry1, entry2) {
      return entry1.path.split(path.sep).length <=
        entry2.path.split(path.sep).length;
    });

    var toBeDeleted = files.concat(folders);

    toBeDeleted.forEach(function(entry) {
      var filePath = path.normalize(installationPath + path.sep +
        params.target + entry.path);

      if (entry.isDirectory) {
        fs.rmdir(filePath, function(error) {
          if (error) {
            console.log('FOLDER NOT FOUND OR NOT EMPTY: ' +
              filePath);
          } else {
            console.log('FOLDER DELETED: ' + filePath);
          }
        });
      } else {
        fs.unlink(filePath, function(error) {
          if (error) {
            console.log('FILE NOT FOUND: ' + filePath);
          } else {
            console.log('FILE DELETED: ' + filePath);
          }
        });
      }
    });
  });
}

function deleteGameFiles() {
  return new Promise(function(resolve, reject) {
    mainWindow.webContents.send('lockPlayButton', {
      locked: true
    });
    var gamePath = path.normalize(installationPath +
      settings.FILE.GAME_FOLDER);
    utils.emptyDirectory({
      folderPath: gamePath,
      onFinish: function(error) {
        if (error) {
          reject(error);
        } else {
          resolve({});
        }
      }
    });
  });
}

function updateConfiguration() {
  configuration.gameVersion = gameLatest.number;

  return utils.writeJSON({
    filePath: path.normalize(installationPath +
      settings.FILE.CONFIG_FILE),
    content: configuration
  });
}

function informUserForCompletion() {
  mainWindow.webContents.send('progress', {
    id: 'overall',
    progress: 1,
    text: 'Updating complete. Press play to start...'
  });
  mainWindow.webContents.send('progress', {
    id: 'download',
    progress: 1,
    text: ''
  });
  mainWindow.webContents.send('lockPlayButton', {
    locked: false
  });
}

function start(params) {
  configuration = params.config;
  gameLatest = getLatest(params);
  var build = gameLatest.builds
    .filter(function(build) {
      return build.os === settings.OS;
    })[0];

  buildURL = build.fullURL;

  askToUpdate()
    .then(deleteGameFiles)
    .then(downloadUpdate)
    .then(updateConfiguration)
    .then(informUserForCompletion)
    .catch(function(error) {
      alert('An error occured please contact support for more help');
      console.error(error);
    })
    .done();
}

function getLatest(params) {
  var releaseInfo = params.releaseInfo;
  return releaseInfo.latest;
}

function needsUpdate(params) {
  configuration = params.config;

  var currentVersion = configuration.gameVersion;
  var newVersion = getLatest(params).number;
  console.log('currentVersion: ' + currentVersion);
  console.log('new version: ' + newVersion);
  return (utils.versionCompare(currentVersion, newVersion) === -1);
}

exports.start = start;
exports.needsUpdate = needsUpdate;
