#!/usr/bin/env node

const dotenv = require('dotenv');
const fs = require('fs');
const envConfig = dotenv.parse(fs.readFileSync('.env'));
for (let k of Object.keys(envConfig)) {
  process.env[k] = envConfig[k];
}

const vorpal = require('vorpal');
const request = require('superagent');

const yaml = require('js-yaml');
const Docker = require('dockerode');
const byline = require('byline');

const vcl = vorpal();
const chalk = vorpal().chalk;
let io = require('socket.io-client');
const docker = new Docker({ socketPath: '/var/run/docker.sock' });
const path = require('path');
const Log = console.log;

import { makeDashboard, addLogData, addTimedOutContainerData,
  addLiveContainerData, addResourceUsageData, setStatus,
  removeLiveContainerData, addWebhookErrorData } from './dashboard';

vcl
  .delimiter(chalk.cyan('choreo$'))
  .show()
  .parse(process.argv);

// Commands

vcl
  .command('verify', 'Verifies the config file.')
  .help((args) => {
    Log('This command checks the .choreo.yml for integrity.');
  })
  .action((args, callback) => {
    try {
      const fileStats = fs.statSync(`${process.cwd()}/.choreo.yml`);
      try {
        const doc = yaml.load(fs.readFileSync(`${process.cwd()}/.choreo.yml`, 'utf-8'));
        Log(chalk.green('.choreo.yml is valid'));
      } catch (err) {
        Log(err.message);
        Log('Unable to parse .choreo.yml');
      }
    } catch (err) {
      Log('file not found: .choreo.yml');
    }
  });

vcl
  .command('setup', 'Setup parent docker container')
  .help((args) => {
    Log('This command should be executed on the first run of Choreographer.');
  })
  .action((args, callback) => {
    Log(chalk.green('Connecting to Dockerhub'));

    docker.pull('tocttou/choreograph-redis', (err, stream3) => {

      if (err) {
        Log(`Cannot create redis image. Error: ${err}`);
        return null;
      }

      docker.modem.followProgress(stream3, onRedisFinished);

      byline(stream3).on('data', (line) => {
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
          },
        }, (err, container) => {
          if (container) {
            container.start((err, data) => {
              if (err) {
                Log(chalk.red('\nCannot create redis container'));
                return null;
              }
              Log(chalk.green('\nRedis container created.'));
            });
          }


          Log(chalk.green('\nDownloading Child Image'));

          docker.pull('tocttou/choreograph-child', (err, stream2) => {

            if (err) {
              Log(`Cannot create child image. Error: ${err}`);
              return null;
            }

            docker.modem.followProgress(stream2, onChildFinished);

            byline(stream2).on('data', (line) => {
              if (JSON.parse(line).status === 'Downloading') {
                process.stdout.write('.');
              } else if (JSON.parse(line).status === 'Extracting') {
                process.stdout.write('+');
              }
            });

            function onChildFinished() {
              Log(chalk.green('\nChild Image created.'));
              Log(chalk.green('Downloading Parent Image'));

              docker.pull('tocttou/choreograph-parent', (err, stream) => {

                if (err) {
                  Log(`Cannot create parent image. Error: ${err}`);
                  return null;
                }

                docker.modem.followProgress(stream, onFinished);

                byline(stream).on('data', (line) => {
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
                  }, (err, container) => {
                    if (container) {
                      container.start((err, data) => {
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

vcl
  .command('run', 'Add a new job')
  .help((args) => {
    Log('This command reads .choreo.yml to add a new job');
  })
  .action((args, callback) => {
    try {
      const fileStats = fs.statSync(`${process.cwd()}/.choreo.yml`);
      try {
        const doc = yaml.load(fs.readFileSync(`${process.cwd()}/.choreo.yml`, 'utf-8'));
        for (let service of Object.keys(doc)) {
          if (service !== 'job' && service !== 'nodes') {
            if (typeof doc[service].payload === 'object') {
              const objectToAdd = {};
              for (const filepath of doc[service].payload) {
                const filename = path.basename(filepath);
                objectToAdd[filename] = fs.readFileSync(filepath, 'utf-8');
              }
              doc[service].payload = objectToAdd;
            }
            if (typeof doc[service].exec !== 'undefined') {
              for (const execType of Object.keys(doc[service].exec)) {
                if (execType !== 'bash') {
                  if (typeof doc[service].exec[execType] === 'object') {
                    const objectToAdd = {};
                    for (const filepath of doc[service].exec[execType]) {
                      const filename = path.basename(filepath);
                      const filedata = fs.readFileSync(filepath);
                      objectToAdd[filename] = new Buffer(filedata).toString('base64');
                    }
                    doc[service].exec[execType] = objectToAdd;
                  }
                }
              }
            } else {
              Log(`Error => no 'exec' specified for service: ${service}`);
              return null;
            }
          }
        }

        if (typeof doc.nodes === 'undefined') {
          doc.nodes = ['local'];
        }

        for (const node of doc.nodes) {
          request
            .post(`http://${node === 'local' ? '0.0.0.0' : node}:6003/api/saveworker`)
            .send(doc)
            .set('Content-Type', 'application/json')
            .set('Accept', 'application/json')
            .end((err, res) => {
              if (err) {
                Log(`Error occured at node: ${node}, Error => ${err}`);
              }
              if (JSON.parse(res.text).err === true) {
                Log(`Error occured at node: ${node}, Error => ${JSON.parse(res.text).message}`);
              } else {
                Log(chalk.green(`Job added to node: ${node}`));
              }
            });
        }

      } catch (err) {
        Log(err.message);
        Log('Unable to parse .choreo.yml');
      }
    } catch (err) {
      Log('file not found: .choreo.yml');
    }
  });

vcl
  .command('list', 'Lists all the running jobs and their services')
  .action(function(args) {
    this.prompt({
      type: 'input',
      name: 'node',
      message: 'Enter the node IP (local for local): ',
    }, (result) => {
      request
        .get(`http://${result.node === 'local' ? '0.0.0.0' : result.node}:6003/api/getworkers`)
        .set('Accept', 'application/json')
        .end((err, res) => {
          if (err) {
            Log(`Error occured at node: ${result.node}, Error => ${err}`);
          }
          if (JSON.parse(res.text).err === true) {
            Log(`Error occured at node: ${result.node}, Error => ${JSON.parse(res.text).message}`);
          } else {
            for (const job of Object.keys(JSON.parse(res.text))) {
              let services = '';
              JSON.parse(res.text)[job].map((value) => services += `${value},`);
              services = services.slice(0, services.length - 1);
              Log(chalk.green(`${job} => ${services}`));
            }
          }
        });
    });
  });

vcl
  .command('stop', 'Stop a job')
  .action(function(args) {
    this.prompt({
      type: 'input',
      name: 'node',
      message: 'Enter the node IP (local for local): '
    }, (result) => {
      const node = result.node;
      this.prompt({
        type: 'input',
        name: 'jobname',
        message: 'Enter the job name to stop: '
      }, (result) => {
        request
          .post(`http://${node === 'local' ? '0.0.0.0' : node}:6003/api/removeworker`)
          .send({ job: result.jobname })
          .set('Content-Type', 'application/json')
          .set('Accept', 'application/json')
          .end((err, res) => {
            if (err) {
              Log(`Error occured at node: ${node}, Error => ${err}`);
            }
            if (JSON.parse(res.text).err === true) {
              Log(`Error occured at node: ${node}, Error => ${JSON.parse(res.text).message}`);
            } else {
              Log(chalk.green(`Removed job: ${result.jobname}`));
            }
          });
      });
    });
  });


vcl
  .command('monitor', 'Displays a dashboard for the job')
  .action(function(args) {
    this.prompt({
      type: 'input',
      name: 'node',
      message: 'Enter the node IP (local for local): '
    }, (result) => {
      const node = result.node;
      this.prompt({
        type: 'input',
        name: 'jobname',
        message: 'Enter the job name to monitor: '
      }, (result) => {
        const jobname = result.jobname;
        const socket = io.connect(`http://${node === 'local' ? '0.0.0.0' : node}:6003`, { reconnect: true });
        makeDashboard(node, jobname, () => {
          socket.emit('checkstatus', { jobname });
          socket.on('runstatus', (data) => {
            setStatus(data.status);
          });
          socket.on('inputStream', (data) => {
            if (data.jobname === jobname) {
              addLogData(`[${data.service}]: ${data.stream}`);
            }
          });
          socket.on('usagestats', (data) => {
            let currentDataObject = new Date();
            let currentHours = currentDataObject.getHours();
            let currentMinutes = currentDataObject.getMinutes();
            let currentTime = `${currentHours}:${currentMinutes}`;
            let dataToPut = [
              { x: currentTime, y: Math.round(data[0] * 100) },
              { x: currentTime, y: Math.round(data[1] * 100) }
            ];
            addResourceUsageData(dataToPut);
          });
          socket.on('containeradded', (data) => {
            if (data.jobname === jobname) {
              addLiveContainerData([data.containerid.slice(0, 12), data.service]);
            }
          });

          socket.on('containerexited', (data) => {
            removeLiveContainerData([data.containerid.slice(0, 12), data.service]);
          });

          socket.on('containertimedout', (data) => {
            if (data.jobname === jobname) {
              addTimedOutContainerData([data.containerid.slice(0, 12), data.service]);
            }
          });
          socket.on('webhookerror', (data) => {
            if (data.jobname === jobname) {
              addWebhookErrorData([data.service, data.type, data.errurl]);
            }
          });
        });
      });
    });
  });

