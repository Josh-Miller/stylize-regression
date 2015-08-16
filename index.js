'use strict';

var webshot = require('webshot'),
    fs = require('fs-extra'),
    _ = require('lodash'),
    chalk = require('chalk'),
    resemble = require('node-resemble-js'),
    Stylize = require('stylize');

var StylizeRegression = function() {
  this.path = process.cwd();
  this.mismatchTolerance = 0.05;
}

StylizeRegression.prototype.get = function(cb) {
  var _stylize = new Stylize;
  var path = process.cwd();
  _stylize.path = path;

  _.forEach(_stylize.config().plugins, function(n, key) {
    var settings = {};

    var plugin = require(path + '/node_modules/' + key);
    if (n) {
      settings = n;
    }

    _stylize.register(key, plugin, settings);
  });

  _stylize.getPatterns(path, function(patterns) {
  var patternsLength = patterns.length - 1;
    _.forEach(patterns, function(pattern, key) {

      // Compile patterns
      _stylize.compile(pattern.template, _stylize.partials, _stylize.data(pattern.name), function(compiled) {
        pattern.compiled = compiled;

        if (key === patternsLength) {
          cb(patterns);
        }
      });
    });
  });
}

StylizeRegression.prototype.takeScreenshot = function(patterns) {

  var _stylizeRegression = this,
      errorCount = 0,
      passCount = 0;

  fs.open(this.path + '/regression-tests/baseline', 'r', function(err) {

    if (err) {
      console.log(chalk.cyan('Creating baseline images'));

      _.forEach(patterns, function(pattern, key) {

        webshot(pattern.compiled, './regression-tests/baseline/' + pattern.name + '.png', {siteType:'html'}, function(err) {
            if(err){
              console.log(err);
              return;
            }
        });

      });
    } else {
      console.log(chalk.cyan('Diffing images'));

      _.forEach(patterns, function(pattern, key) {

        webshot(pattern.compiled, './regression-tests/compare/' + pattern.name + '.png', {siteType:'html'}, function(err) {

          if(err){
            console.log(err);
            return;
          }

          var baselineImg = fs.readFileSync(_stylizeRegression.path + '/regression-tests/baseline/' + pattern.name + '.png');

          var comparisonImg = fs.readFileSync(_stylizeRegression.path + '/regression-tests/compare/' + pattern.name + '.png');

          var diff = resemble(comparisonImg).compareTo(baselineImg).ignoreColors().onComplete(function(data){

            if (parseInt(data.misMatchPercentage) > _stylizeRegression.mismatchTolerance) {
              console.log(chalk.red('Diff failed: ' + pattern.name + ' by ' + data.misMatchPercentage + '% misMatchPercentage'));

              errorCount++;

              data.getDiffImage().pack().pipe(fs.createWriteStream(_stylizeRegression.path + '/regression-tests/diff/' + pattern.name + '--diff.png'));
            } else {
              passCount++;
            }
            if ((patterns.length - 1) === key) {
              console.log(chalk.cyan('Diff complete, ') + chalk.green(passCount + ' passed ') + chalk.red(errorCount + ' failed'));
            }
          });
        });
      });
    }

  });

  // return screenshot;
}

module.exports = new StylizeRegression;
