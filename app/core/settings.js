var remote = require('remote');
var os = require('os');
var path = require('path');
var utils = require('./utils.js');
var app = remote.require('app');

var exeFile = app.getAppPath();

var gameName = 'My\ Game';
var baseInstallFolder = '/' + gameName + '/';
var gameFolder = 'game';
var configFile = 'config.json';
var launcherFile = gameName + '\ Launcher';
var gameFile = 'gameFileName';
var changesFullPath = exeFile + path.sep + gameFolder + path.sep +
  'changes.json';

var executablesPerPlatfrom = {
  'Darwin': '',
  'Linux': '.app',
  'Windows_NT': '.exe'
};

var launcherFolderPerPlatfrom = {
  'Darwin': '/../../../',
  'Linux': '',
  'Windows_NT': ''
};

var gameExeFolderPerPlatfrom = {
  'Darwin': '/../../../',
  'Linux': '',
  'Windows_NT': '/../../'
};

var resourcesFolderPerPlatfrom = {
  'Darwin': '/../Resources',
  'Linux': 'resources',
  'Windows_NT': 'resources'
};

var codeOSPerPlatfrom = {
  'Darwin': 'osx',
  'Linux': 'linux',
  'Windows_NT': 'win'
};

var launcherEXECommand = {
  'Darwin': '$installationPath' + baseInstallFolder +
    '$launcherFile.app/Contents/MacOS/Electron',

  'Linux': '/$installationPath' + baseInstallFolder + '$launcherFile',

  'Windows_NT': '$installationPath' + baseInstallFolder +
    '$launcherFile'
};

var gameEXECommand = {
  'Darwin': utils.removeFileFromPath(app.getPath('exe')) +
    launcherFolderPerPlatfrom[os.type()] + gameFolder + path.sep +
    '$launcherFile.app/Contents/MacOS/$launcherFile'.replace(
      /\$launcherFile/g, gameFile),

  'Linux': launcherFolderPerPlatfrom[os.type()] + gameFolder + path.sep +
    gameFile + executablesPerPlatfrom[os.type()],

  'Windows_NT': launcherFolderPerPlatfrom[os.type()] + gameFolder + path.sep +
    gameFile + executablesPerPlatfrom[os.type()]
};

var startFolderInstallPath = {
  'Darwin': app.getPath('home'),
  'Linux': app.getPath('home'),
  'Windows_NT': '/Program Files/'
};

exports.FILE = {
  BASE_INSTALL_FOLDER: baseInstallFolder,
  GAME_FOLDER: gameFolder,
  CONFIG_FILE: configFile,
  CHANGES_FULL_PATH: changesFullPath,
  LAUNCHER_FILE_NAME: launcherFile,
  LAUNCHER_FILE: launcherFile + executablesPerPlatfrom[os.type()],
  LAUNCHER_FOLDER: utils.removeFileFromPath(app.getPath('exe')) +
    launcherFolderPerPlatfrom[os.type()],

  RESOURCES_FOLDER: utils.removeFileFromPath(app.getPath('exe')) +
    resourcesFolderPerPlatfrom[os.type()],

  LAUNCHER_EXE_COMMAND: launcherEXECommand[os.type()],

  GAME_EXE_COMMAND: exeFile + gameExeFolderPerPlatfrom[os.type()] +
    gameFolder + path.sep +
    gameFile + executablesPerPlatfrom[os.type()],

  START_FOLDER_INSTALL_PATH: startFolderInstallPath[os.type()]
};

exports.PROJECTS = {
  LAUNCHER: 'launcher',
  GAME: 'game'
};

exports.OS = codeOSPerPlatfrom[os.type()];

exports.isMac = function() {
  return os.type() === 'Darwin';
};

exports.isWindows = function() {
  return os.type() === 'Windows_NT';
};

exports.isLinux = function() {
  return os.type() === 'Linux';
};
