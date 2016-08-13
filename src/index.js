import vorpal from 'vorpal';

const yaml = require('js-yaml');
const fs = require('fs');

const vcl = vorpal();
const chalk = vorpal().chalk;
const Log = console.log;

vcl
  .delimiter(chalk.cyan('choreo$'))
  .show()
  .parse(process.argv);

// Commands

vcl
  .command('verify', 'Verifies the config file.')
  .action((args, callback) => {
    try {
      const fileStats = fs.statSync(`${process.cwd()}/.choreo.yml`);
      try {
        const doc = yaml.load(fs.readFileSync(`${process.cwd()}/.choreo.yml`, 'utf-8'));
      } catch (err) {
        Log('Unable to parse .choreo.yml');
      }
    } catch (err) {
      Log('file not found: .choreo.yml');
    }

    Log(chalk.green('.choreo.yml is valid'));

  });
