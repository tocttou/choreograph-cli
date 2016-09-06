# choreograph-cli [Walmart Labs hackathon submission]
An OSS tool to orchestrate docker based workers. Comes with a terminal UI and an http API.

## Walmart Labs Hackathon submission

Note: Repository updated to add new video link after my youtube link was removed because of length violation.

## Video Demo

VIDEO: https://www.youtube.com/watch?v=GzpasVWDx6g

Files used in the demo are given here.
            
[.choreo.yml](https://gist.github.com/tocttou/2c49c15b35a6bd47caf8e2d508fe1351)

[payload/file1.json](https://gist.github.com/tocttou/3ae4eed85fb911f9d819c82615c37dc4)
 
[payload/file2.txt](https://gist.github.com/tocttou/129039e181b4795fa47f12d2446001c7)
 
[payload/app.py](https://gist.github.com/tocttou/cd9c0ed3ea224d71662ea1ca5796785b) 


## Setup Instructions

1. Install [docker](https://docs.docker.com/engine/installation/)
2. Make sure your $USER is in `docker` group: `sudo groupadd docker` then `sudo usermod -aG docker $USER` then logout and login
3. Install [nodejs, npm](https://github.com/creationix/nvm)
4. `npm i -g choreograph`
5. Run the command: `choreo` to enter choreograph-cli shell.

**Note: Make sure the user deploying this application is in the "docker" group. That is, the user can use docker without sudo access.**

> sudo groupadd docker

> sudo usermod -aG docker $USER

Then logout and log back in.

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

## Link To Parent Container Repo

https://github.com/tocttou/choreograph-parent
