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
const audience=[];
let currentStage='Auth';
const prompts=[];
const promptsName=[];
const promptAndAnswers={};

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
      // if(response_message=="OK"&&game_state_now=="waiting"&&players.length<8){
      //   players.push(username);
      //   if(players[0]==username){
      //     io.emit('register_response_OK',{
      //       hostName:players[0],
      //       players_now:players,
      //       isHost:true
      //     });
      //   }else{
      //     io.emit('register_response_OK',{
      //       hostName:players[0],
      //       players_now:players,
      //       isHost:false
      //     });

      //   }
        
      // }
      if(response_message=="OK"&&!players.includes(username)){
        players.push(username);
      }
      io.emit('register_response',{
        response_msg:response_message,
        username:username,
        currentStage:currentStage,
        hostName:players[0],
        players_now:players
      })
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
      // if(response_message=="OK"&&game_state_now=="waiting"&&players.length<8){
      //   players.push(username);
      //   console.log("players :",players);
      //   if(players[0]==username){
      //     io.emit('register_response_OK',{
      //       hostName:players[0],
      //       players_now:players,
      //     });
      //   }else{
      //     io.emit('register_response_OK',{
      //       hostName:players[0],
      //       players_now:players,
      //     });
      //   }
        
      // }
      if(response_message=="OK"&&!players.includes(username)){
        players.push(username);
      }
      io.emit('register_response',{
        response_msg:response_message,
        username:username,
        currentStage:currentStage,
        hostName:players[0],
        players_now:players
      })
    }catch(error){
      console.error("login failed:", error);
    }

  })

  socket.on('gameStart',()=>{
    currentStage='PromptCollection';
    io.emit('gameStart');
  })

  socket.on('prompt',async promptDetails=>{
    console.log(`prompt apply with ${JSON.stringify(promptDetails)}`);
    const{prompt,username}=promptDetails;
    prompts.push(prompt);
    promptsName.push(username);
    const response=await handle_prompt(promptDetails);
    io.emit('prompt_response',{
      response_context:response,
      username:username
    });
  })

  socket.on('startToAnswer',async language=>{
    currentStage='Answer';
    const assigned=await assignPrompt(language);
    io.emit('startToAnswer',assigned);
  })

  socket.on('answerSubmitted',answerDetails=>{
    const {username,question,answer}=answerDetails;
    promptAndAnswers[question]=[];
    promptAndAnswers[question].push(username);
    promptAndAnswers[question].push(answer);
    console.log("answerDetails saved with ",answerDetails);
  })

  socket.on('startVoting',()=>{
    io.emit('startVoting')
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

//////////////log in 的时候如果已经login如何处理
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

async function handle_prompt(promptDetails){
  const{prompt,username}=promptDetails;
  console.log("prompt : ",prompt,"username : ",username);
  if (username && prompt){
    try{
      const response =await handleatchPrompt("https://cw111.azurewebsites.net/api/prompt/create",prompt,username);
      console.log("response is: ",response.msg);
      return response.msg;
    }catch (error) {
      console.error("An error occurred during create prompt: ",error);
    }
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

async function handleatchPrompt(endpoint, text, username){
  const url = endpoint;
    const apiKey = "jLncRoiYHvcqdgXVSKmMGKSpSpPSDRxgLS-WI5jJASR4AzFujfBAdQ==";

    // 构造请求的 payload
    const payload = {
        text: text,        // 动态输入 text
        username: username // 动态输入 username
    };

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-functions-key": apiKey
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        console.log("Response received:", data);
        return data; // 返回响应结果
    } catch (error) {
        console.error("Error in handleFetch:", error);
        throw error; // 抛出错误以供外部处理
    }
}

async function getPrompts(language){
  console.log("start to get prompt")
  let promptNumber=0
  
    if(players.length%2==0){
      promptNumber=(players.length)/2;
    }else{
      promptNumber=players.length;
    }
  
    console.log("promptNumber is : ",promptNumber);

    const prompt_get=[];
    if (promptNumber / 2 > prompts.length) {
      prompt_get.push(...prompts);
  
      const promptLeft = promptNumber - prompt_get.length;

      for (let i = 0; i < promptLeft; i++) {
          const response =await sendGetPrompt("https://cw111.azurewebsites.net/api/utils/get", promptsName[i], language);
          const fstResponse=response[0];
          console.log("response now is: ",fstResponse.text);
          prompt_get.push(fstResponse.text);
          
      }
  } else {

      let getFromPrompt = Math.floor(promptNumber / 2); 
      const getFromDB = promptNumber - getFromPrompt;   
  
     
      for (let i = 0; i < prompts.length && getFromPrompt > 0; i++) {
          prompt_get.push(prompts[i]);
          getFromPrompt--;
      }
  
  
      for (let i = 0; i < getFromDB; i++) {
          const response =await sendGetPrompt("https://cw111.azurewebsites.net/api/utils/get", promptsName[i], language);
          const fstResponse=response[0];
          console.log("response now is: ",fstResponse.text);
          prompt_get.push(fstResponse.text);
          
      }
      
      
  }
  console.log("prompt_get : ",prompt_get);
  return prompt_get; 
    
}



async function assignPrompt(language) {
  const playerCount = players.length;
  const promptAssigned=await getPrompts(language);
  console.log("promptToAssign ",promptAssigned);
  const promptCount = promptAssigned.length;

 

  const allocation = {}; // 初始化空对象
  for (let i = 0; i < players.length; i++) {
    allocation[players[i]] = []; // 为每个玩家分配一个空数组
}

  console.log("initial allocation");

  if (playerCount % 2 === 0) {
      // Even number of players: 1 prompt per player
      for (let i = 0; i < playerCount; i++) {
          const assignedPrompt = promptAssigned[i % promptCount]; // Cycle through prompts
          allocation[players[i]].push(assignedPrompt);
      }
  } else {
      // Odd number of players: 2 prompts per player
      for (let i = 0; i < playerCount; i++) {
          // Assign the first prompt
          const firstPrompt = promptAssigned[i % promptCount];
          allocation[players[i]].push(firstPrompt);

          // Assign the second prompt (offset by one to avoid repetition)
          const secondPrompt = promptAssigned[(i + 1) % promptCount];
          allocation[players[i]].push(secondPrompt);
      }
  }
  console.log("allocation :",allocation);
  return allocation;
}



function sendGetPrompt(endpoint, username, language) {
  // Prepare the payload
  const payload = JSON.stringify({
    players: [username],
    language: language
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
