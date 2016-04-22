var remote = require('remote');
var fse = require('fs-extra');
var fs = require('fs');
var path = require('path');
var originalFs = require('original-fs');
var Promise = require('bluebird');
var app = remote.require('app');
var dialog = remote.require('dialog');
var BrowserWindow = remote.require('browser-window');
var utils = require('../core/utils.js');
var settings = require('../core/settings.js');
var Config = require('../core/config.js');

var mainWindow = remote.getCurrentWindow();
var buildURL = null;
var configuration = null;
var installationPath = './';

function askToUpdate() {
  return utils.askForConfirmation({
    lemma: 'There is a new version of the launcher. Do you want to install it?'
  });
}

function downloadPatch(params) {
  return new Promise(function(resolve, reject) {
    mainWindow.webContents.send('lockPlayButton', {
      locked: true
    });

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
        text: 'Installing...'
      });
    }

    function onFinishInstall(params) {
      mainWindow.webContents.send('progress', {
        id: 'overall',
        progress: 0.75,
        text: 'Configuring...'
      });
      resolve(params);
    }

    function onError(error) {
      reject(error);
    }

    var params = {
      url: buildURL,
      targetPath: null, //will be return the default on finish
      onProgress: onDownloadProgress,
      onDownloadComplete: onDownloadComplete,
      onFinish: onFinishInstall,
      onError: onError,
      fileNameToShow: 'My Game Launcher'
    };

    $('#overall_info').text('Downloading from server...');
    utils.downloadFile(params);
  });
}

function updateConfiguration() {
  configuration.launcherVersion = launcherLatest.number;
  return utils.writeJSON({
    filePath: installationPath + path.sep + settings.FILE.CONFIG_FILE,
    content: configuration
  });
}

function restartAndUpdate(params) {
  return new Promise(function(resolve, reject) {
    var cwd = app.getAppPath() + '/../../'; //settings.FILE.LAUNCHER_FOLDER;

    var gameFolder = settings.FILE.GAME_FOLDER;

    var toCopyPath = params.targetPath;

    //var exe = path.resolve(settings.FILE.LAUNCHER_EXE_COMMAND
    //  .replace('$installationPath', '../')
    //  .replace('$launcherFile', settings.FILE.LAUNCHER_FILE));
    var exe = app.getPath('exe');

    var command = '';

    if (settings.isWindows()) {
      //Remove-Item -recurse "$4\\*" -exclude "$1";
      cwd = path.resolve(cwd).replace(/\ /g, '` ') + '/';
      gameFolder = path.resolve(gameFolder).replace(/\ /g, '` ');
      toCopyPath = path.resolve(toCopyPath).replace(/\ /g, '` ') + path.sep;
      exe = exe.replace(/\ /g, '` ');
      command = 'powershell.exe Start-Sleep -s 3; Copy-Item -Path "$2\*/" -Destination "$4" -Recurse -Force; Start-Process -FilePath "$5"';
    } else {
      cwd = path.resolve(cwd) + '/';
      gameFolder = path.resolve(gameFolder);
      toCopyPath = path.resolve(toCopyPath) + path.sep;
      command = 'find "$4" ! -name "$1" -exec rm -r {} \\;; cp -r "$2" "$4"; $5';

      if (settings.isMac()) {
        exe = 'open ' + exe;
      } else {
        exe = './ ' + exe;
      }
    }
    command = command
      .replace('$1', gameFolder)
      .replace('$2', toCopyPath)
      .replace('$4', cwd)
      .replace('$4', cwd)
      .replace('$5', exe);
    console.log(command);

    utils.exec({
      exe: command,
      cwd: path.resolve(app.getAppPath() + '/../../'),
      callback: function(error) {
        resolve({});
      }
    });
    app.quit();
  });
}

function getLatest(params) {
  var releaseInfo = params.releaseInfo;
  return releaseInfo.latest;
}

function start(params) {
  configuration = params.config;

  var build = getLatest(params).builds
    .filter(function(build) {
      return build.os === settings.OS;
    })[0];

  buildURL = build.fullURL;
  askToUpdate()
    .then(downloadPatch)
    .then(restartAndUpdate)
    .catch(function(error) {
      alert('An error occured please contact support for more help');
      console.error(error);
    })
    .done();
}

function needsUpdate(params) {
  configuration = params.config;

  var currentVersion = configuration.launcherVersion;
  var newVersion = getLatest(params).number;
  console.log('currentVersion: ' + currentVersion);
  console.log('new version: ' + newVersion);
  return (utils.versionCompare(currentVersion, newVersion) === -1);
}

function getConfigPath() {
  return path.resolve(installationPath + path.sep +
    settings.FILE.CONFIG_FILE);
}

function cancel() {
  utils.askForCancel({
    request: downloader,
    questionLemma: 'Do you want to cancel update?',
    cancelLemma: 'Update cannot be aborted on this stage of progress'
  });
}
exports.cancel = cancel;
exports.start = start;
exports.needsUpdate = needsUpdate;
