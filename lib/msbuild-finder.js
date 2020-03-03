'use strict';

var path = require('path');
var gutil = require('gulp-util');
var constants = require('./constants');
var fs = require('fs');
var PluginError = gutil.PluginError;
var child = require ('child_process');
var constants = require("./constants");
var childProcess = require("child_process");
var os = require("os");
var lsCache = {};

function* getExistingMSBuildDirectory(rootPath, subfolder) {
  try {
    var folderPath = path.join(rootPath, subfolder);
    fs.statSync(folderPath);
    yield folderPath;
  }
  catch (e) { }
}

function* detectMsBuildDirectories(pathRoot) {
  const rootPaths = [
    path.join(pathRoot, 'Microsoft Visual Studio', '2019'),
    path.join(pathRoot, 'Microsoft Visual Studio', '2017'),
  ];
  const possibleSubfolders = ['BuildTools', 'Enterprise', 'Professional', 'Community'];

  for (const rootPath of rootPaths) {
    for (const subfolder of possibleSubfolders) {
      yield* getExistingMSBuildDirectory(rootPath, subfolder);
   
    }
  }

  yield pathRoot;
}

// Use MSBuild over XBuild where possible
var detectMsBuildOverXBuild = function () {
  try {
    var output = child.spawnSync('which', ['msbuild'], {encoding: 'utf8'});
    if (output.stderr && output.stderr !== 0) {
      return 'xbuild';
    }
    return 'msbuild';
  } catch (e) {}
}

function lsR(folder) {
  if (lsCache[folder]) {
    return lsCache[folder];
  }
  return lsCache[folder] = fs.readdirSync(folder)
    .reduce((acc, cur) => {
      var fullPath = path.join(folder, cur);
      var st = fs.statSync(fullPath);
      if (st.isFile()) {
        acc.push(fullPath);
        return acc;
      }
      return acc.concat(lsR(fullPath));
    }, []);
}

function findMSBuildExecutablesUnderPath(folder) {
  return lsR(folder).filter(fpath => {
    const fileName = path.basename(fpath);
    return fileName.toLowerCase() === "msbuild.exe";
  });
}

function* getValidMsBuildExecutablesWithVersion(executables) {
  for (const exe of executables) {
    try {
      const proc = childProcess.spawnSync(exe, [ "/version" ], { encoding: "utf8" });
      const lines = proc.stdout.split(os.EOL);
      const thisVersion = lines[lines.length - 1];
      const verParts = thisVersion.split(".");
      const major = verParts[0];
      const shortVer = `${major}.0`; // not technically correct: I see msbuild 16.1 on my machine, but keeps in line with prior versioning
      const ver = parseFloat(shortVer);
      if (isNaN(ver) == false) {
        const ret = { ver: ver, exePath: exe};
        yield ret;
      }
    } catch (e) {
      console.warn(`Unable to query version of ${exe}: ${e}`);
    }
  };
}

function findMsBuildByToolVersion(pathRoot, toolsVersion) {
  const useLatestToolsVersion = typeof toolsVersion == null
    || toolsVersion === "auto";

  // Try to detect MSBuild 15.0+
  for (const msbuildPath of detectMsBuildDirectories(pathRoot)) {
    const msbuildHome = path.join(msbuildPath, "MSBuild");
    const msbuildExecutables = findMSBuildExecutablesUnderPath(msbuildHome);
    if (!msbuildExecutables.length)
      continue;
    for (const detected of getValidMsBuildExecutablesWithVersion(msbuildExecutables)) {
      if (useLatestToolsVersion || toolsVersion == detected.ver) {
        return { path: path.dirname(detected.exePath), ver: detected.ver };
      }
    }
  }

  return null;
};

module.exports.find = function (options) {
  if (options.platform.match(/linux|darwin/)) {
    var msbuildPath = detectMsBuildOverXBuild();
    if (msbuildPath) {
      return msbuildPath;
    }
    return 'xbuild';
  } else if (!options.platform.match(/^win/)) {
    return 'xbuild';
  }

  const is64Bit = options.architecture === 'x64';

  // On 64-bit systems msbuild is always under the x86 directory. If this
  // doesn't exist we are on a 32-bit system. See also:
  // https://blogs.msdn.microsoft.com/visualstudio/2013/07/24/msbuild-is-now-part-of-visual-studio/
  let pathRoot;
  if (is64Bit) {
    pathRoot = process.env['ProgramFiles(x86)'] || 'C:/Program Files (x86)';
  } else {
    pathRoot = process.env['ProgramFiles'] || 'C:/Program Files';
  }

  // auto-detection also registers higher msbuild versions which from 2017+
  const foundVersion = findMsBuildByToolVersion(pathRoot, options.toolsVersion);
  if (!foundVersion) {
    throw new PluginError(constants.PLUGIN_NAME, `Could not found MSBuild with toolsVersion '${options.toolsVersion}'`);
  }

  return path.join(foundVersion.path, "MSBuild.exe");
};
