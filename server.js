// server.js
// where your node app starts

// init project
var express = require('express');
var app = express();
// http://expressjs.com/en/starter/static-files.html
app.use(express.static('public'))