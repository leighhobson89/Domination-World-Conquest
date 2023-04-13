const express = require('express');
const app = express();
const path = require('path');
const phpExpress = require('php-express')({
  binPath: 'C:\php', // Path to your PHP binary
  rootPath: path.join(__dirname), // Path to your PHP files directory
  phpIniPath: 'C:\php\php.ini' // Path to your PHP configuration file
});

app.engine('php', phpExpress.engine);
app.set('view engine', 'php');
app.all(/\.php$/, phpExpress.router);

// Serve default favicon
app.get('/favicon.ico', (req, res) => {
  res.sendFile(__dirname + '/default-favicon.ico');
});

app.use(express.static(__dirname));

app.get('/', function (req, res) {
  res.sendFile(__dirname + '/index.html');
});

app.listen(3000, function () {
  console.log('Example app listening on port 3000!');
});

