"use strict";

var diveSync = require('diveSync'),
    fs = require('fs-extra'),
    readYaml = require('read-yaml'),
    _ = require('lodash'),
    Pattern = require('./lib/pattern'),
    events = require('events');

var Stylize = function() {

  this.path = '';

  this.config = function() {
    return readYaml.sync(this.path + '/config.yml');
  }

  this.plugins = [];

  this.register = function(name, plugin, settings) {
    this.plugins.push({name: name, plugin: plugin, settings: settings});
  }

  this._compile = function(pattern, cb) {
    _.forEach(this.plugins, function(n, key) {
      if (n.plugin.extend === '_compile') {
        var compiled = n.plugin.init(pattern);
        cb(compiled);
      }
    });
  };

  this.prePattern = function(pattern, cb) {
    _.forEach(this.plugins, function(n, key) {
      if (n.plugin.extend === 'prePattern') {
        n.plugin.init(pattern, function(e) {
          cb(e)
        });
      }
    });
    if (!_.has(this.plugins, 'prePattern')) {
      cb(pattern);
    }
  };

  this.preData = function(patternName, cb) {
    _.forEach(this.plugins, function(n, key) {
      if (n.plugin.extend === 'preData') {
        var patternData = n.plugin.init(patternName);
        cb(patternData);
      }
    });
  };

  this._export = function(pattern) {
    _.forEach(this.plugins, function(n, key) {
      if (n.plugin.extend === '_export') {
        n.plugin.init(pattern, function(e) {
          cb(e)
        });
      }
    });
    // if (!_.has(this.plugins, '_export')) {
    //   throw new Error('No export plugins found');
    // }
  };

  this.patterns = [];
  this.partials = {};
}

Stylize.prototype.data = function(patternName, context) {
  var data = readYaml.sync(this.path + this.config().data);

  this.preData(patternName, function(patternData) {
    data = _.assign({}, data, patternData);
  });

  if (context === 'export') {
    data = _.assign({}, data, readYaml.sync(this.config().exportData));
    // data = _.unescape(data);
  }

  return data;
};

Stylize.prototype.getPatterns = function(path, cb) {
  var _stylize = this;

  var rootPath = __dirname + '/../../';
  var headerPath = this.config().hasOwnProperty('headerPath') ? this.config().headerPath : rootPath + _.trim('src/partials/head.hbs'),
      footerPath = this.config().hasOwnProperty('footerPath') ? this.config().footerPath : rootPath + _.trim('src/partials/footer.hbs');

  diveSync(path + '/' + this.config().patternsRoot, function(err, file){

    if(err){
      console.log(err);
      return;
    }

    var pattern = new Pattern;

    // Pattern header/footer
    var headerTemplate = fs.readFileSync(headerPath, 'utf8');
    var footerTemplate = fs.readFileSync(footerPath, 'utf8');
    pattern.header = headerTemplate;
    pattern.footer = footerTemplate;

    // Naming
    var fileNameArr = file.split('/');
    var fileNames = _.takeRightWhile(fileNameArr, function(n) {
      return n != 'patterns';
    });

    pattern.name = _.last(fileNames).split('.')[0];
    pattern.fileName = _.last(fileNames);
    pattern.parents = fileNames.slice(0, -1);

    // Pattern file
    var currentPattern = fs.readFileSync(file, 'utf8');

    // Partials
    _stylize.partials[_.camelCase(pattern.name)] = currentPattern;

    // Push it
    pattern.template = currentPattern;

    // Future postprocessor of getPatterns()
    _stylize.prePattern(pattern, function(pattern) {
      _stylize.patterns.push(pattern);
    });

  });

  cb(_stylize.patterns);
};

Stylize.prototype.compile = function(template, partials, data, cb) {

  this._compile({template: template, partials: partials, data: data}, function(compiled) {
    cb(compiled);
  });

};

Stylize.prototype.build = function(dest, name, data) {
  fs.outputFileSync(dest + '/' + name, data);
};

Stylize.prototype.export = function(pattern) {
  this._export(pattern);
};

module.exports = Stylize;
