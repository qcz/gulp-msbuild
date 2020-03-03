'use strict';

var os = require('os');
var uuid = require('uuid');
var join = require('path').join;

module.exports = {
  PLUGIN_NAME: 'gulp-msbuild',
  
  DEFAULTS: {
    stdout: false,
    stderr: true,
    errorOnFail: false,
    logCommand: false,
    targets: ['Rebuild'],
    configuration: 'Release',
    toolsVersion: 4.0,
    properties: {},
    verbosity: 'normal',
    maxcpucount: 0,
    nologo: true,
    platform: process.platform,
    architecture: detectArchitecture(),
    windir: process.env.WINDIR,
    msbuildPath: '',
    fileLoggerParameters: undefined,
    consoleLoggerParameters: undefined,
    loggerParameters: undefined,
    nodeReuse: true,
    customArgs: [],
    emitEndEvent: false,
    solutionPlatform: null,
    emitPublishedFiles: false,
    deployDefaultTarget: 'WebPublish',
    webPublishMethod: 'FileSystem',
    deleteExistingFiles: 'true',
    findDependencies: 'true',
    publishDirectory: join(os.tmpdir(), uuid.v4())
  }
};

function detectArchitecture() {
  if (process.platform.match(/^win/)) {
    return process.env.hasOwnProperty('ProgramFiles(x86)') ? 'x64' : 'x86';
  }

  return os.arch();
}

