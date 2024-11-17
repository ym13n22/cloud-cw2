'use strict';

//Set up express
const express = require('express');
const axios = require('axios');
const app = express();

//Setup socket.io
const server = require('http').Server(app);
const io = require('socket.io')(server);

let players = [];
const maxPlayer=8;
const minPlayer=3;
const game_state_now="waiting";

const BACKEND_API_URL = 'https://cw111.azurewebsites.net/api';
const FUNCTION_KEY = 'jLncRoiYHvcqdgXVSKmMGKSpSpPSDRxgLS-WI5jJASR4AzFujfBAdQ==';

//Setup static page handling
app.set('view engine', 'ejs');
app.use('/static', express.static('public'));

app.use(express.json());

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
      const {response_message,username}=await register(registerDetails)
      console.log("Register message is:",response_message);
      if(response_message==OK&&game_state_now=="waiting"&&players.length<8){
        io.emit('register_response',response_message)
       // waiting_room(username)
      }
      io.emit('register_response',response_message)
    }catch(error){
      console.error("Registration failed:", error);
    }
  })
});

async function register(registerDetails) {
  const { username, password } = registerDetails;
  console.log("username :",username,"password :",password);
  if (username && password) {
      try {
          const response = await authenticate_register("https://cw111.azurewebsites.net/api/player/register", username, password);
          console.log("response is:", response.msg);
          return {
            msg: "Registration failed",
            username: username
        };
      } catch (error) {
        console.error("An error occurred during registration:",error);
      }
  } else {
    return ("error")
  }
}
async function login() {
  if (this.username && this.password) {
      console.log('Initial statusMessage:', this.statusMessage); 
      this.statusMessage = 'Logging in...';
      try {
          const response = await authenticate('/player/login', this.username, this.password);
          this.statusMessage = response.msg;
      } catch (error) {
          this.statusMessage = 'An error occurred during login.';
      }
  } else {
      this.statusMessage = 'Username and password are required.';
  }
}

async function authenticate_register(endpoint, username, password) {
  try {
      console.log('Sending registration request:', { endpoint, username, password });
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
      console.error('Error in authenticate_register:', error.message);
      throw error; // 将错误抛出给调用者
  }
}


async function waiting_room(username){
   players.push(username);
   console.log("going to the waiting room with player list:",players);
   io.emit('to_waiting_room',players)
}

//Start server
if (module === require.main) {
  startServer();
}

module.exports = server;
