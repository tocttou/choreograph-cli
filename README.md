# choreograph-cli
An OSS tool to orchestrate docker based workers. Comes with a web-UI and an API.

## Video Demo

VIDEO: https://www.youtube.com/watch?v=GzpasVWDx6g

## Setup Instructions

1. Install [docker](https://docs.docker.com/engine/installation/)
2. Install [nodejs, npm](https://github.com/creationix/nvm)
3. `npm i -g choreograph`
4. Run the command: `choreo` to enter choreograph-cli shell.

*For initial setup, run the command, `setup` after enter choreograph-cli shell.*

*This setup should be done on each node that is to be used.*

### Options:

  Commands:

    help [command...]  Provides help for a given command.
    exit               Exits application.
    verify             Verifies the config file.
    setup              Setup parent docker container
    run                Add a new job
    list               Lists all the running jobs and their services
    stop               Stop a job
    monitor            Displays a dashboard for the job
    
## Documentation:
 
Open `http://localhost:6003` to view the documentation for writing `.choreo.yml` file to configure services.
