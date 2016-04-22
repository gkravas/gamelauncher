var ipc = require('ipc');
var remote = require('remote');
var app = remote.require('app');
var path = remote.require('path');
var dialog = remote.require('dialog');
var BrowserWindow = remote.require('browser-window');
var Promise = require('bluebird');
var request = require('request');
var utils = require('./utils.js');
var settings = require('./settings.js');
var Config = require('./config.js');
var installGameProcedure = require('./../procedures/installgameprocedure.js');
var updateLauncherProcedure = require('./../procedures/updatelauncherprocedure.js');
var updateGameProcedure = require('./../procedures/updategameprocedure.js');
var mainWindow = remote.getCurrentWindow();

var config = require('../package.json');
var gameConfig = {
  gameVersion: '0.0.0.0'
};
var tulVersionData = null;
var gameVersionData = null;

function init() {
  var startAngle = -Math.PI * 0.5;
  $('#download_progress').circleProgress({
    startAngle: startAngle,
    animation: false,
    value: 0,
    size: 45,
    fill: {
      color: '#37E6DD'
    }
  });

  $('#overall_progress').circleProgress({
    startAngle: startAngle,
    animation: false,
    value: 0,
    size: 61,
    fill: {
      color: '#37E6DD'
    }
  });

  $('#overall_info').text('Welcome to My Game');

  ipc.on('online-status-changed', function(event, params) {
    var lemma = params.online ? '' : 'No internet connection available';
    $('#overall_info').text(lemma);
  });

  $('#version').text('Pre Alpha ' + config.version);

  loadGameConfig()
    .then(createGameConfig)
    .then(makeTULVersionAPICall)
    .then(saveTULVersions)
    .then(makeGameVersionAPICall)
    .then(saveGameVersions)
    .then(checkForInstall)
    .then(checkForLauncherUpdate)
    .then(checkForGameUpdate)
    .catch(function(error) {
      $('#overall_info').text('Welcome to My Game');
      mainWindow.webContents.send('lockPlayButton', {
        locked: false
      });
      console.error(error);
    })
    .done();
}

function loadGameConfig() {
  return new Promise(function(resolve, reject) {
    mainWindow.webContents.send('lockPlayButton', {
      locked: true
    });
    console.log('loadGameConfig');
    var configPath = path.resolve(settings.FILE.CONFIG_FILE);
    console.log(configPath);
    utils.readJSON(configPath)
      .then(function(content) {
        return resolve(content);
      })
      .catch(function(error) {
        return resolve(null);
      });
  });
}

function createGameConfig(configJSONText) {
  return new Promise(function(resolve, reject) {
    if (configJSONText == null) {
      return resolve({});
    }
    //every time we open tul we re set the verion. The reason is because of the update procedure of tul
    gameConfig = new Config(JSON.parse(configJSONText));
    gameConfig.launcherVersion = app.getVersion();
    console.log(gameConfig);
    utils.writeJSON({
        filePath: path.resolve(settings.FILE.CONFIG_FILE),
        content: gameConfig
      }).then(function(content) {
        return resolve({});
      })
      .catch(function(error) {
        return reject(error);
      });
  });
}

function getReleaseType() {
  config.test ? 'test' : 'release';
}

function makeTULVersionAPICall() {
  $('#overall_info').text('Contacting server...');
  return makeVerionAPICall(settings.PROJECTS.LAUNCHER, config.version, getReleaseType());
}

function saveTULVersions(data) {
  return new Promise(function(resolve, reject) {
    tulVersionData = data;
    console.log(tulVersionData);
    resolve({});
  });
}

function makeGameVersionAPICall() {
  return makeVerionAPICall(settings.PROJECTS.GAME, gameConfig.gameVersion,
    getReleaseType());
}

function saveGameVersions(data) {
  return new Promise(function(resolve, reject) {
    gameVersionData = data;
    console.log(gameVersionData);
    $('#overall_info').text('Welcome to My Game');
    resolve({});
  });
}

function makeVerionAPICall(project, version, type) {
  return new Promise(function(resolve, reject) {

    function callback(error, response, body) {
      if (!error && response.statusCode == 200) {
        //console.log(body);
        resolve(JSON.parse(body));
      } else {
        reject(error);
      }
    }
    request
      .defaults({
        headers: {
          'Content-Type': 'application/json'
        }
      })
      .get('http://my.versionapi.com:1337/version/after?' +
        'versionNumber=' + version +
        '&projectName=' + project +
        '&type=' + type + '&count=10', callback);
  });
}

function checkForInstall() {
  return new Promise(function(resolve, reject) {
    setTimeout(function() {
      if (installGameProcedure.installationExists()) {
        resolve({});
      } else {
        installGameProcedure.start({
          releaseInfo: gameVersionData
        });
        reject('Installing Game');
      }
    }, 1000);
  });
}

function checkForLauncherUpdate() {
  return new Promise(function(resolve, reject) {
    setTimeout(function() {
      var params = {
        releaseInfo: tulVersionData,
        config: gameConfig
      };
      if (!updateLauncherProcedure.needsUpdate(params)) {
        resolve({});
      } else {
        updateLauncherProcedure.start(params);
        reject('Updating Launcher');
      }
    }, 1000);
  });
}

function checkForGameUpdate() {
  return new Promise(function(resolve, reject) {
    var params = {
      releaseInfo: gameVersionData,
      config: gameConfig
    };
    setTimeout(function() {
      if (!updateGameProcedure.needsUpdate(params)) {
        resolve({});
      } else {
        updateGameProcedure.start(params);
        reject('Updating Game');
      }
    }, 1000);
  });
}
exports.start = init;
