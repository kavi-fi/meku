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
Populate demo users and start the project
```
$ cd scripts
$ node add-demo-users.js
$ npm start
```
Demo user is `kavi:kavi`
