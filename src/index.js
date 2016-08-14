import vorpal from 'vorpal';
import request from 'superagent';

const yaml = require('js-yaml');
const Docker = require('dockerode');
const byline = require('byline');
const fs = require('fs');

const vcl = vorpal();
const chalk = vorpal().chalk;
const docker = new Docker({ socketPath: '/var/run/docker.sock' });
const path = require('path');
const Log = console.log;

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

