module.exports = Config;

function Config(params) {
  var that = this;
  this.gameVersion = params.gameVersion || '';
  this.launcherVersion = params.launcherVersion || '';
  this.installationPath = params.installationPath || '';

  this.toJSON = function() {
    return JSON.stringify({
          gameVersion: that.gameVersion,
          launcherVersion: that.launcherVersion,
          installationPath: that.installationPath
        });
  };
}
