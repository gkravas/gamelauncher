module.exports = Desktop;

var ipc = require('ipc');
var path = require('path');
var remote = require('remote');
var shell = require('shell');
var app = remote.require('app');
var dialog = remote.require('dialog');
var BrowserWindow = remote.require('browser-window');
var settings = require('./settings');
var utils = require('./utils');
var init = require('./init.js');

var playerCanPressPlay = true;

function Desktop() {
  if (!(this instanceof Desktop)) {
    return new Desktop();
  }

  var window = remote.getCurrentWindow();

  function onClose(choice) {
    if (choice == 1) {
      app.quit();
    }
  }

  this.close = function() {
    var closeAnswers = ['No', 'Yes'];
    dialog.showMessageBox({
      type: 'none',
      buttons: closeAnswers,
      message: 'Are you sure you want to quit?'
    }, onClose);
  };

  this.toggleMusic = function() {

  };

  this.playGame = function() {
    if (!playerCanPressPlay) {
      return;
    }

    console.log('opening: ' + path.normalize(settings.FILE.GAME_EXE_COMMAND));
    shell.openItem(path.normalize(settings.FILE.GAME_EXE_COMMAND));
    app.quit();
  };

  this.redownload = function() {
    init.start();
  };

  this.repair = function() {

  };

  this.cancel = function() {

  };

  ipc.on('lockPlayButton', function(params) {
    playerCanPressPlay = !params.locked;
  });

  init.start();
}
