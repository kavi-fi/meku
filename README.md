# meku
Kansallinen audiovisuaalinen instituutti Kuvaohjelmien luokittelu- ja valvontajärjestelmä.

## Setting up the development environment
Clone the repository and run the following commands. Note: The project runs well with `Node v16`.
```
$ npm install
```
Create Mongo DB
```
$ docker run --name kavi-mongo -p 27017:27017 -d mongo:3.6.12
```
Populate demo users for the application
```
$ cd scripts
$ node add-demo-users.js
```
To start the project navigate to the main `/meku/` folder
```
$ npm start
```
Demo user is `kavi:kavi`
