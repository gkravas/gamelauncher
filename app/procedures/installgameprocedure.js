var remote = require('remote');
var fse = require('fs-extra');
var fs = require('fs');
var fso = require('original-fs');
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
var releaseInfo = null;
var installationPath = null;
var buildURL = '';
var buildVersion = '';
var downloader = null;

function askToInstallGame() {
  return utils.askForConfirmation({
    lemma: 'Game is not installed. Do you want to install it?'
  });
}

function chooseFolderToInstall() {
  return new Promise(function(resolve, reject) {
    var currentWindow = remote.getCurrentWindow();

    function onClose(path) {
      if (path) {
        installationPath = path;
        resolve({
          path: path
        });
      } else {
        reject(null);
      }
    }

    dialog.showOpenDialog(currentWindow, {
      title: 'Choose Install Folder',
      properties: ['openDirectory'],
      defaultPath: path.resolve(settings.FILE.START_FOLDER_INSTALL_PATH)
    }, onClose);
  });
}

function downloadGame(params) {
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
      downloader = null;
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
      resolve({});
    }

    function onError(error) {
      reject(error);
    }

    var params = {
      url: buildURL,
      targetPath: path.normalize(installationPath +
        settings.FILE.BASE_INSTALL_FOLDER +
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

function copyLauncher() {
  return new Promise(function(resolve, reject) {
    console.log('EXE: ' + path.normalize(settings.FILE.LAUNCHER_FOLDER) +
      ' ' + path.normalize(
        installationPath +
        settings.FILE.BASE_INSTALL_FOLDER));

    fse.copy(path.normalize(settings.FILE.LAUNCHER_FOLDER),
      path.normalize(installationPath +
        settings.FILE.BASE_INSTALL_FOLDER),
      function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({});
        }
      }
    );
  });
}

function createConfiguration() {
  var config = new Config({
    gameVersion: buildVersion,
    launcherVersion: app.getVersion(),
    installationPath: installationPath
  });

  return utils.writeJSON({
    filePath: path.normalize(installationPath +
      settings.FILE.BASE_INSTALL_FOLDER +
      settings.FILE.CONFIG_FILE),
    content: config
  });
}

function createShortcuts() {
  return new Promise(function(resolve, reject) {
    if (!settings.isWindows()) {
      resolve({});
    } else {
      var ws = require('windows-shortcuts');
      console.log(path.normalize(app.getPath('userDesktop') + path.sep +
        settings.FILE.LAUNCHER_FILE_NAME +
        '.lnk'));
      console.log(path.normalize(settings.FILE.LAUNCHER_EXE_COMMAND
        .replace('$installationPath', installationPath)
        .replace('$launcherFile', settings.FILE.LAUNCHER_FILE)));
      ws.create(
        path.normalize(app.getPath('userDesktop') + path.sep + settings.FILE
          .LAUNCHER_FILE_NAME +
          '.lnk'), {
          target: path.normalize(settings.FILE.LAUNCHER_EXE_COMMAND
            .replace('$installationPath', installationPath)
            .replace('$launcherFile', settings.FILE.LAUNCHER_FILE))
        },
        function(error) {
          if (error) {
            reject(error);
          } else {
            resolve({});
          }
        });
    }
  });
}

function restartLauncherFromGameFolder() {
  //means that user didn't want to install
  if (!installationPath) {
    return;
  }

  utils.updateInfo({
    id: 'overall',
    progress: 1,
    text: 'Installation complete. Restating...'
  });
  setTimeout(function() {
    var exe = settings.FILE.LAUNCHER_FILE;

    console.log(path.normalize(settings.FILE.LAUNCHER_EXE_COMMAND
      .replace('$installationPath', installationPath)
      .replace('$launcherFile', exe)));

    shell.openItem(path.normalize(settings.FILE.LAUNCHER_EXE_COMMAND
      .replace('$installationPath', installationPath)
      .replace('$launcherFile', exe)));

    app.quit();
  }, 2000);
}

function start(params) {
  releaseInfo = params.releaseInfo;

  var build = releaseInfo.latest.builds
    .filter(function(build) {
      return build.os === settings.OS;
    })[0];
  buildVersion = releaseInfo.latest.number;
  buildURL = build.fullURL;

  askToInstallGame()
    .then(chooseFolderToInstall)
    .then(downloadGame)
    .then(copyLauncher)
    .then(createConfiguration)
    //.then(createShortcuts)
    .catch(function(error) {
      alert('An error occured please contact support for more help');
      console.error(error);
    })
    .finally(restartLauncherFromGameFolder)
    .done();
}

function installationExists() {
  return utils.fileExists({
    filePath: path.normalize(settings.FILE.LAUNCHER_FOLDER +
      settings.FILE.CONFIG_FILE)
  });
}

function cancel() {
  utils.askForCancel({
    request: downloader,
    questionLemma: 'Do you want to cancel installation?',
    cancelLemma: 'Installation cannot be aborted on this stage of progress'
  });
}

exports.cancel = cancel;
exports.start = start;
exports.installationExists = installationExists;
