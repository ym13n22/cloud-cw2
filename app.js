'use strict';

//Set up express
const express = require('express');
const app = express();

//Setup socket.io
const https = require('https');
const server = require('http').Server(app);
const io = require('socket.io')(server);
const game_state_now="waiting";
const players=[];

//Setup static page handling
app.set('view engine', 'ejs');
app.use('/static', express.static('public'));

//Handle client interface on /
app.get('/', (req, res) => {
  res.render('client');
});
//Handle display interface on /display
app.get('/display', (req, res) => {
  res.render('display');
});

// URL of the backend API
const BACKEND_ENDPOINT = process.env.BACKEND || 'http://localhost:8181';

//Start the server
function startServer() {
    const PORT = process.env.PORT || 8080;
    server.listen(PORT, () => {
        console.log(`Server listening on port ${PORT}`);
    });
}

//Chat message
function handleChat(message) {
    console.log('Handling chat: ' + message); 
    io.emit('chat',message);
}

//Handle new connection
io.on('connection', socket => { 
  console.log('New connection');

  //Handle on chat message received
  socket.on('chat', message => {
    handleChat(message);
  });

  //Handle disconnection
  socket.on('disconnect', () => {
    console.log('Dropped connection');
  });

  socket.on('register', async registerDetails =>{
    console.log(`Register event with ${JSON.stringify(registerDetails)}`);
    try{
      const {response_message,username}=await register(registerDetails);
      console.log("Register message is:",response_message);
      console.log("username is: ",username)
      if(response_message=="OK"&&game_state_now=="waiting"&&players.length<8){
        players.push(username);
        io.emit('register_response_OK',{
          hostName:players[0],
          players_now:players
        });
      }
      io.emit('register_response',response_message)
    }catch(error){
      console.error("Registration failed:", error);
    }
  })

  socket.on('login', async loginDetails =>{
    console.log(`Login event with ${JSON.stringify(loginDetails)}`);
    try{
      const {response_message,username}=await login(loginDetails);
      console.log("login message is:",response_message);
      console.log("username is: ",username)
      if(response_message=="OK"&&game_state_now=="waiting"&&players.length<8){
        players.push(username);
        console.log("players :",players);
        io.emit('register_response_OK',{
          hostName:players[0],
          players_now:players
        });
      }
      io.emit('register_response',response_message)
    }catch(error){
      console.error("login failed:", error);
    }

  })
});

async function register(registerDetails) {
  const { username, password } = registerDetails;
  console.log("username :",username,"password :",password);
  if (username && password) {
      try {
          const response = await handle_fatch("https://cw111.azurewebsites.net/api/player/register", username, password);
          console.log("response is:", response.msg);
          return { response_message: response.msg, username };
      } catch (error) {
        console.error("An error occurred during registration:",error);
      }
  } else {
    return ("error")
  }
}
async function login(loginDetails) {
  console.log("loginDetails:",loginDetails);
  const { username, password } = loginDetails;
  console.log("username :",username,"password :",password);
  if (username && password) {
      try {
          const response = await sendGetRequestWithBody("https://cw111.azurewebsites.net/api/player/login", username, password);
          console.log("response is:", response.msg);
          return { response_message: response.msg, username };
      } catch (error) {
        console.error("An error occurred during login:",error);
      }
  } else {
    return ("error")
  }
}

async function handle_fatch(endpoint, username, password) {
  try {
      console.log('Sending request:', { endpoint, username, password });
      const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-functions-key': 'jLncRoiYHvcqdgXVSKmMGKSpSpPSDRxgLS-WI5jJASR4AzFujfBAdQ==', // 必须正确无误
        },
          body: JSON.stringify({ username, password }),
      });
      return await response.json();
     
  } catch (error) {
      console.error('Error in request:', error.message);
      throw error; // 将错误抛出给调用者
  }
}

function sendGetRequestWithBody(endpoint, username, password) {
  // Prepare the payload
  const payload = JSON.stringify({
      username: username,
      password: password
  });

  // Parse the URL to extract hostname and path
  const url = new URL(endpoint);

  // Define request options
  const options = {
      hostname: url.hostname,
      path: url.pathname,
      method: 'GET',
      headers: {
          'Content-Type': 'application/json',
          'x-functions-key': 'jLncRoiYHvcqdgXVSKmMGKSpSpPSDRxgLS-WI5jJASR4AzFujfBAdQ==',
          'Content-Length': Buffer.byteLength(payload)
      }
  };

  return new Promise((resolve, reject) => {
      console.log('Sending request with options:', options); // Log request details

      // Create the request
      const req = https.request(options, (res) => {
          let data = '';

          console.log(`Response status: ${res.statusCode}`); // Log status code

          // Collect response data
          res.on('data', (chunk) => {
              data += chunk;
          });

          // Resolve the promise on end
          res.on('end', () => {
              console.log('Raw response body:', data); // Log raw response

              if (res.statusCode === 200) {
                  try {
                      const jsonResponse = JSON.parse(data);
                      console.log('Parsed JSON response:', jsonResponse); // Log parsed JSON
                      resolve(jsonResponse);
                  } catch (e) {
                      console.error('Error parsing JSON response:', e.message); // Log JSON parsing error
                      reject({ error: 'Failed to parse JSON', details: e.message });
                  }
              } else {
                  console.error('Non-200 status received, response body:', data); // Log error details
                  reject({
                      error: `Request failed with status ${res.statusCode}`,
                      details: data
                  });
              }
          });
      });

      // Handle errors
      req.on('error', (e) => {
          console.error('Request error:', e.message); // Log request errors
          reject({ error: e.message });
      });

      // Write the payload to the request body
      req.write(payload);

      // End the request
      req.end();
  });
}




//Start server
if (module === require.main) {
  startServer();
}

module.exports = server;
