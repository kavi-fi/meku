# meku
Taide- ja kulttuuriviraston Kuvaohjelmien luokittelu- ja valvontajärjestelmä.

## Setting up the development environment
Clone the repository and run the following commands. Note: The project runs well with `Node v16`.

### First time setup

Create and start the Mongo DB
```
$ docker run --name kavi-mongo -p 27017:27017 -d mongo:3.6.12
```

Populate demo users for the application
```
$ cd scripts && node add-demo-users.js && cd ..
```

### Starting the local development environment

Install dependencies
```
$ npm install
```

If `npm i` returns errors about `node-gyp`, you need to install some missing tools. This happened at least on Ubuntu 24.

```
sudo apt install python3-setuptools
sudo apt install build-essential
```

Start the Mongo DB (only needed if Mongo's been shutdown after creation)
```
docker start kavi-mongo
```

To start the project run the following command from the projects root folder
```
$ npm start
```

Demo user is `kavi:kavi`

## Making changes
1. Create a new branch for your changes
2. Make the changes
3. Create a pull request to `master` branch
4. Once it's been reviewed and accepted merge
5. Deploy to the training environment and make sure everything works
6. Deploy to production
7. Let the client know about the deployed changes

## Training environment

* Can be found from https://luokittelu-koulutus.kavi.fi/ / https://meku-training.herokuapp.com/
* Credentials: Ask a coworker to add you or create credentials for your self manually to the database

## Production environment
* Can be found from  https://luokittelu.kavi.fi / https://meku.herokuapp.com/
* Credentials: There should be no need for us to access the production environment

## Deployments

We can deploy to training and production environment at our own discretion.

First make sure everything is working as intended in the training environment and then deploy to production. Let the customer know about the deployment.

### Prerequisites
* [Install Heroku CLI](https://devcenter.heroku.com/articles/heroku-cli#install-the-heroku-cli)
  * Using homebrew on Mac: `brew tap heroku/brew && brew install heroku`
  * With npm: `npm install -g heroku`
* Login to your heroku account with the CLI
  * In the terminal run `heroku login`
* Add The heroku remotes to Git
  * To add the training environment run `heroku git:remote -a meku-training -r <remote-alias>`. Remote alias can be anything you want. E.g. `training` or `staging`
  * To add the production environment run `heroku git:remote -a meku -r <remote-alias>`. Remote alias can be anything you want. E.g. `production` or `prod`
* You should now have the remotes you added in your git remotes
  * Check with `git remote -v`

### Manual deployment steps
Login to Heroku first. See Prerequisites section.

In Meku the `master` branch is the one that should be used for deployments.

Run the following command to deploy the master branch to heroku
```
git push <remote-alias> master:main
```
Change `<remote-alias>` to the alias of the environment you want to deploy to. To check your aliases use `git remote -v`.

To deploy from another branch use
```
git push <remote-alias> mybranch:main
```
