const express = require('express');
const app = express();


// Serve default favicon
app.get('/favicon.ico', (req, res) => {
  res.sendFile(__dirname + '/default-favicon.ico');
});

app.use(express.static(__dirname));

app.get('/', function(req, res) {
  res.sendFile(__dirname + '/index.html');
});

app.listen(3000, function() {
  console.log('Example app listening on port 3000!');
});