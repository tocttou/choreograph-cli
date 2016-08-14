#!/usr/bin/env node
'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj; };

var vorpal = require('vorpal');
var request = require('superagent');

var yaml = require('js-yaml');
var Docker = require('dockerode');
var byline = require('byline');
var fs = require('fs');

var vcl = vorpal();
var chalk = vorpal().chalk;
var docker = new Docker({ socketPath: '/var/run/docker.sock' });
var path = require('path');
var Log = console.log;

vcl.delimiter(chalk.cyan('choreo$')).show().parse(process.argv);

// Commands

vcl.command('verify', 'Verifies the config file.').help(function (args) {
  Log('This command checks the .choreo.yml for integrity.');
}).action(function (args, callback) {
  try {
    var fileStats = fs.statSync(process.cwd() + '/.choreo.yml');
    try {
      var doc = yaml.load(fs.readFileSync(process.cwd() + '/.choreo.yml', 'utf-8'));
      Log(chalk.green('.choreo.yml is valid'));
    } catch (err) {
      Log(err.message);
      Log('Unable to parse .choreo.yml');
    }
  } catch (err) {
    Log('file not found: .choreo.yml');
  }
});

vcl.command('setup', 'Setup parent docker container').help(function (args) {
  Log('This command should be executed on the first run of Choreographer.');
}).action(function (args, callback) {
  Log(chalk.green('Connecting to Dockerhub'));

  docker.pull('tocttou/choreograph-redis', function (err, stream3) {

    if (err) {
      Log('Cannot create redis image. Error: ' + err);
      return null;
    }

    docker.modem.followProgress(stream3, onRedisFinished);

    byline(stream3).on('data', function (line) {
      if (JSON.parse(line).status === 'Downloading') {
        process.stdout.write('.');
      } else if (JSON.parse(line).status === 'Extracting') {
        process.stdout.write('+');
      }
    });

    function onRedisFinished() {
      docker.createContainer({
        Image: 'tocttou/choreograph-redis', name: 'choreograph-redis',
        ExposedPorts: { '6379/tcp': {} }, PortBindings: { '6379/tcp': [{ HostPort: '6004' }] },
        RestartPolicy: {
          MaximumRetryCount: 2,
          Name: 'always'
        }
      }, function (err, container) {
        if (container) {
          container.start(function (err, data) {
            if (err) {
              Log(chalk.red('\nCannot create redis container'));
              return null;
            }
            Log(chalk.green('\nRedis container created.'));
          });
        }

        Log(chalk.green('\nDownloading Child Image'));

        docker.pull('tocttou/choreograph-child', function (err, stream2) {

          if (err) {
            Log('Cannot create child image. Error: ' + err);
            return null;
          }

          docker.modem.followProgress(stream2, onChildFinished);

          byline(stream2).on('data', function (line) {
            if (JSON.parse(line).status === 'Downloading') {
              process.stdout.write('.');
            } else if (JSON.parse(line).status === 'Extracting') {
              process.stdout.write('+');
            }
          });

          function onChildFinished() {
            Log(chalk.green('\nChild Image created.'));
            Log(chalk.green('Downloading Parent Image'));

            docker.pull('tocttou/choreograph-parent', function (err, stream) {

              if (err) {
                Log('Cannot create parent image. Error: ' + err);
                return null;
              }

              docker.modem.followProgress(stream, onFinished);

              byline(stream).on('data', function (line) {
                if (JSON.parse(line).status === 'Downloading') {
                  process.stdout.write('.');
                } else if (JSON.parse(line).status === 'Extracting') {
                  process.stdout.write('+');
                }
              });

              function onFinished() {

                docker.createContainer({
                  Image: 'tocttou/choreograph-parent', name: 'choreograph-parent',
                  NetworkMode: 'host',
                  Binds: ['/var/run/docker.sock:/var/run/docker.sock', '/tmp:/tmp'],
                  RestartPolicy: {
                    MaximumRetryCount: 2,
                    Name: 'always'
                  }
                }, function (err, container) {
                  if (container) {
                    container.start(function (err, data) {
                      if (err) {
                        Log(chalk.red('\nCannot create parent container'));
                        return null;
                      }
                      Log(chalk.green('\nParent container created.'));
                      Log(chalk.green('\nSetup complete.'));
                    });
                  }
                });
              }
            });
          }
        });
      });
    }
  });
});

vcl.command('run', 'Add a new job').help(function (args) {
  Log('This command reads .choreo.yml to add a new job');
}).action(function (args, callback) {
  try {
    var fileStats = fs.statSync(process.cwd() + '/.choreo.yml');
    try {
      var doc = yaml.load(fs.readFileSync(process.cwd() + '/.choreo.yml', 'utf-8'));
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;
      var _iteratorError = undefined;

      try {
        for (var _iterator = Object.keys(doc)[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
          var service = _step.value;

          if (service !== 'job' && service !== 'nodes') {
            if (_typeof(doc[service].payload) === 'object') {
              var objectToAdd = {};
              var _iteratorNormalCompletion3 = true;
              var _didIteratorError3 = false;
              var _iteratorError3 = undefined;

              try {
                for (var _iterator3 = doc[service].payload[Symbol.iterator](), _step3; !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
                  var filepath = _step3.value;

                  var filename = path.basename(filepath);
                  objectToAdd[filename] = fs.readFileSync(filepath, 'utf-8');
                }
              } catch (err) {
                _didIteratorError3 = true;
                _iteratorError3 = err;
              } finally {
                try {
                  if (!_iteratorNormalCompletion3 && _iterator3.return) {
                    _iterator3.return();
                  }
                } finally {
                  if (_didIteratorError3) {
                    throw _iteratorError3;
                  }
                }
              }

              doc[service].payload = objectToAdd;
            }
            if (typeof doc[service].exec !== 'undefined') {
              var _iteratorNormalCompletion4 = true;
              var _didIteratorError4 = false;
              var _iteratorError4 = undefined;

              try {
                for (var _iterator4 = Object.keys(doc[service].exec)[Symbol.iterator](), _step4; !(_iteratorNormalCompletion4 = (_step4 = _iterator4.next()).done); _iteratorNormalCompletion4 = true) {
                  var execType = _step4.value;

                  if (execType !== 'bash') {
                    if (_typeof(doc[service].exec[execType]) === 'object') {
                      var _objectToAdd = {};
                      var _iteratorNormalCompletion5 = true;
                      var _didIteratorError5 = false;
                      var _iteratorError5 = undefined;

                      try {
                        for (var _iterator5 = doc[service].exec[execType][Symbol.iterator](), _step5; !(_iteratorNormalCompletion5 = (_step5 = _iterator5.next()).done); _iteratorNormalCompletion5 = true) {
                          var _filepath = _step5.value;

                          var _filename = path.basename(_filepath);
                          var filedata = fs.readFileSync(_filepath);
                          _objectToAdd[_filename] = new Buffer(filedata).toString('base64');
                        }
                      } catch (err) {
                        _didIteratorError5 = true;
                        _iteratorError5 = err;
                      } finally {
                        try {
                          if (!_iteratorNormalCompletion5 && _iterator5.return) {
                            _iterator5.return();
                          }
                        } finally {
                          if (_didIteratorError5) {
                            throw _iteratorError5;
                          }
                        }
                      }

                      doc[service].exec[execType] = _objectToAdd;
                    }
                  }
                }
              } catch (err) {
                _didIteratorError4 = true;
                _iteratorError4 = err;
              } finally {
                try {
                  if (!_iteratorNormalCompletion4 && _iterator4.return) {
                    _iterator4.return();
                  }
                } finally {
                  if (_didIteratorError4) {
                    throw _iteratorError4;
                  }
                }
              }
            } else {
              Log('Error => no \'exec\' specified for service: ' + service);
              return null;
            }
          }
        }
      } catch (err) {
        _didIteratorError = true;
        _iteratorError = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion && _iterator.return) {
            _iterator.return();
          }
        } finally {
          if (_didIteratorError) {
            throw _iteratorError;
          }
        }
      }

      if (typeof doc.nodes === 'undefined') {
        doc.nodes = ['local'];
      }

      var _iteratorNormalCompletion2 = true;
      var _didIteratorError2 = false;
      var _iteratorError2 = undefined;

      try {
        var _loop = function _loop() {
          var node = _step2.value;

          request.post('http://' + (node === 'local' ? '0.0.0.0' : node) + ':6003/api/saveworker').send(doc).set('Content-Type', 'application/json').set('Accept', 'application/json').end(function (err, res) {
            if (err) {
              Log('Error occured at node: ' + node + ', Error => ' + err);
            }
            if (JSON.parse(res.text).err === true) {
              Log('Error occured at node: ' + node + ', Error => ' + JSON.parse(res.text).message);
            } else {
              Log(chalk.green('Job added to node: ' + node));
            }
          });
        };

        for (var _iterator2 = doc.nodes[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
          _loop();
        }
      } catch (err) {
        _didIteratorError2 = true;
        _iteratorError2 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion2 && _iterator2.return) {
            _iterator2.return();
          }
        } finally {
          if (_didIteratorError2) {
            throw _iteratorError2;
          }
        }
      }
    } catch (err) {
      Log(err.message);
      Log('Unable to parse .choreo.yml');
    }
  } catch (err) {
    Log('file not found: .choreo.yml');
  }
});

vcl.command('list', 'Lists all the running jobs and their services').action(function (args) {
  this.prompt({
    type: 'input',
    name: 'node',
    message: 'Enter the node IP (local for local): '
  }, function (result) {
    request.get('http://' + (result.node === 'local' ? '0.0.0.0' : result.node) + ':6003/api/getworkers').set('Accept', 'application/json').end(function (err, res) {
      if (err) {
        Log('Error occured at node: ' + result.node + ', Error => ' + err);
      }
      if (JSON.parse(res.text).err === true) {
        Log('Error occured at node: ' + result.node + ', Error => ' + JSON.parse(res.text).message);
      } else {
        var _iteratorNormalCompletion6 = true;
        var _didIteratorError6 = false;
        var _iteratorError6 = undefined;

        try {
          for (var _iterator6 = Object.keys(JSON.parse(res.text))[Symbol.iterator](), _step6; !(_iteratorNormalCompletion6 = (_step6 = _iterator6.next()).done); _iteratorNormalCompletion6 = true) {
            var job = _step6.value;

            var services = '';
            JSON.parse(res.text)[job].map(function (value) {
              return services += value + ',';
            });
            services = services.slice(0, services.length - 1);
            Log(chalk.green(job + ' => ' + services));
          }
        } catch (err) {
          _didIteratorError6 = true;
          _iteratorError6 = err;
        } finally {
          try {
            if (!_iteratorNormalCompletion6 && _iterator6.return) {
              _iterator6.return();
            }
          } finally {
            if (_didIteratorError6) {
              throw _iteratorError6;
            }
          }
        }
      }
    });
  });
});

vcl.command('stop', 'Stop a job').action(function (args) {
  var _this = this;

  this.prompt({
    type: 'input',
    name: 'node',
    message: 'Enter the node IP (local for local): '
  }, function (result) {
    var node = result.node;
    _this.prompt({
      type: 'input',
      name: 'jobname',
      message: 'Enter the job name to stop: '
    }, function (result) {
      request.post('http://' + (node === 'local' ? '0.0.0.0' : node) + ':6003/api/removeworker').send({ job: result.jobname }).set('Content-Type', 'application/json').set('Accept', 'application/json').end(function (err, res) {
        if (err) {
          Log('Error occured at node: ' + node + ', Error => ' + err);
        }
        if (JSON.parse(res.text).err === true) {
          Log('Error occured at node: ' + node + ', Error => ' + JSON.parse(res.text).message);
        } else {
          Log(chalk.green('Removed job: ' + result.jobname));
        }
      });
    });
  });
});
