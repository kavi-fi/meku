# meku
Taide- ja kulttuuriviraston Kuvaohjelmien luokittelu- ja valvontajärjestelmä.

## Setting up the development environment
Clone the repository and run the following commands.

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

## Maintenance scripts

### Soft-delete zero-duration programs

`scripts/soft-delete-zero-duration-programs.js` deletes programs through the
existing authenticated `DELETE /programs/:id` endpoint.

1. Put the JSON export of programs in the repository root. The script reads
   the top-level `._id.$oid` value from every entry.
2. Set `EXPECTED_ID_COUNT` in
   `scripts/soft-delete-zero-duration-programs.js` to the number of program
   IDs in that export. The explicit confirmation flag must use the same number.
3. Run a dry run first; it validates the input and makes no HTTP requests or
   changes:

```
node scripts/soft-delete-zero-duration-programs.js --input programs-to-delete.json
```

To delete the programs, provide root-user credentials through environment
variables (the password is never accepted as a command argument) and confirm
the expected count:

```
MEKU_BASE_URL="https://luokittelu.kavi.fi" MEKU_USERNAME="root-user" MEKU_PASSWORD="..." \
  node scripts/soft-delete-zero-duration-programs.js --input programs-to-delete.json --execute --confirm-delete-<ID_COUNT>
```

Replace `<ID_COUNT>` with the same value as `EXPECTED_ID_COUNT`; for example,
`--confirm-delete-653`. The base URL must be the HTTPS production or training
hostname. The script sends deletions sequentially and stops at the first
failed deletion.

The maintenance script's Node unit tests run as part of `npm test` before the
Cypress workflow. Run them with coverage separately using:

```
npm run test:unit:coverage
```

### After updating Node.js

This project uses the Node.js version specified in `.nvmrc` (currently Node 22).
When changing Node.js versions, reinstall dependencies so native modules are
compiled for the active Node.js version:

```
$ nvm use
$ rm -rf node_modules
$ npm_config_ignore_scripts=false npm ci --foreground-scripts
```

If `node-expat` still reports a `NODE_MODULE_VERSION` mismatch, rebuild it:

```
$ npm rebuild node-expat --build-from-source
```

Run the test suite after reinstalling:

```
$ npm test
```

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
