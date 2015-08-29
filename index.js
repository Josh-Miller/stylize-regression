'use strict';

var webshot = require('webshot'),
    fs = require('fs-extra'),
    _ = require('lodash'),
    chalk = require('chalk'),
    resemble = require('node-resemble-js'),
    Stylize = require('stylize-core');

var StylizeRegression = function() {
  this.path = process.cwd();
  this.mismatchTolerance = 0.05;
}

StylizeRegression.prototype.get = function(cmdPath, cb) {
  var _stylize = new Stylize;
  _stylize.path = cmdPath;

  _.forEach(_stylize.config().plugins, function(n, key) {
    var settings = {};

    var plugin = require(cmdPath + '/node_modules/' + key);
    if (n) {
      settings = n;
    }

    _stylize.register(key, plugin, settings);
  });

  _stylize.getPatterns(cmdPath, function(patterns) {
  var patternsLength = patterns.length - 1;
    _.forEach(patterns, function(pattern, key) {

      // Compile patterns
      _stylize.compile(pattern.template, _stylize.partials, _stylize.data(pattern.name), function(compiled) {
        pattern.compiled = compiled;

        // Compile header
        _stylize.compile(pattern.header, '', _stylize.data(), function(compiled) {
          pattern.header = compiled;

          // Compile footer
          _stylize.compile(pattern.footer, '', _stylize.data(), function(compiled) {
            pattern.footer = compiled;

            if (key === patternsLength) {
              cb(_stylize.patterns);
            }
          });
        });
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
      var loopCount = 1;

      _.forEach(patterns, function(pattern, key) {

        webshot(pattern.compiled, './regression-tests/compare/' + pattern.name + '.png', {siteType:'html'}, function(err) {

          if(err){
            console.log(err);
            return;
          }

          var baselineImg = fs.readFileSync(_stylizeRegression.path + '/regression-tests/baseline/' + pattern.name + '.png');

          var comparisonImg = fs.readFileSync(_stylizeRegression.path + '/regression-tests/compare/' + pattern.name + '.png');

          var diff = resemble(comparisonImg).compareTo(baselineImg).ignoreColors().onComplete(function(data){
// console.log(pattern.name, data);
            if (parseInt(data.misMatchPercentage) > _stylizeRegression.mismatchTolerance) {
              console.log(chalk.red('Diff failed: ' + pattern.name + ' by ' + data.misMatchPercentage + '% misMatchPercentage'));

              errorCount++;

              fs.open(_stylizeRegression.path + '/regression-tests/diff', 'r', function(err) {
                if (err) {
                  fs.mkdirSync(_stylizeRegression.path + '/regression-tests/diff');
                }

                data.getDiffImage().pack().pipe(fs.createWriteStream(_stylizeRegression.path + '/regression-tests/diff/' + pattern.name + '--diff.png'));
              });


            } else {
              passCount++;
            }

            if (patterns.length === loopCount) {
              console.log(chalk.cyan('Diff complete, ') + chalk.green(passCount + ' passed ') + chalk.red(errorCount + ' failed'));
            }
            loopCount++;
          });
        });
      });
    }

  });

  // return screenshot;
}

module.exports = new StylizeRegression;
