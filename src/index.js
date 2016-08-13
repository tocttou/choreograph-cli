import vorpal from 'vorpal';

const yaml = require('js-yaml');
const Docker = require('dockerode');
const byline = require('byline');
const fs = require('fs');

const vcl = vorpal();
const chalk = vorpal().chalk;
const docker = new Docker({ socketPath: '/var/run/docker.sock' });
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
    docker.buildImage(`${__dirname}/../docker/Root/Dockerfile.tar`,
      { t: 'choreographer/parent' }, (err, stream) => {

        if (err) {
          Log(`Cannot create image. Error: ${err}`);
          return null;
        }

        byline(stream).on('data', (line) => {
          process.stdout.write(JSON.parse(line).stream);
        });

        stream.on('end', () => {
          Log(chalk.green('Image created. Setup complete.'));
        });
      });
  });
