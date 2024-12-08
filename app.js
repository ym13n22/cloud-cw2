'use strict';

const { CONNREFUSED } = require('dns');
//Set up express
const express = require('express');
const app = express();

//Setup socket.io
const https = require('https');
const server = require('http').Server(app);
const io = require('socket.io')(server);
const game_state_now="waiting";
let players=[];
let audience=[];
let currentStage='Auth';
let prompts=[];//一轮结束删
const promptsName=[];
let promptAndAnswers={};//一轮结束删
let addedQuestions=[];//一轮结束删
let roundNumber=0;
let promptSubmittedDisplay=[];
let promptAwaitingDisplay=[];
let answerSubmittedDisplay=[];//一轮结束删
let awaitingAnswer=[];
let votedDoneDisplay=[];

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
      console.log("username is: ",username);
      console.log("players.length: ",players.length);
      console.log('!players.includes(username)',!players.includes(username));
      console.log('!audience.includes(username)',!audience.includes(username));
      if(response_message=="OK"&&!players.includes(username)&&!audience.includes(username)){
        if(currentStage=='Auth'&&players.length<5){///要改成8
          players.push(username);
        }else{
          audience.push(username);
        }
        
      }
      console.log('currentStage is: ',currentStage);
      if(currentStage=='Voting'){
        io.emit('startVoting',promptAndAnswers);
      }
      if(currentStage=='RoundScores'){
        io.emit('sendScores',promptAndAnswers);
      }
      if(currentStage=='FinalScores'){
        const response=await fetchPodiumData();
        console.log('finalScore response',response);
        io.emit('FinalScore',response);
      }
      io.emit('register_response',{
        response_msg:response_message,
        username:username,
        currentStage:currentStage,
        hostName:players[0],
        players_now:players,
        audience_now:audience,
        roundNumber_now:roundNumber
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
      console.log("username is: ",username);
      console.log("players.length: ",players.length);
      
      if(response_message=="OK"&&!players.includes(username)&&!audience.includes(username)){
        if(currentStage=='Auth'&&players.length<3){///要改成8
          players.push(username);
        }else{
          audience.push(username)
        }
        
      }
      console.log("audience now: ",audience);
      console.log('currentStage is: ',currentStage);
      if(currentStage=='Voting'){
        io.emit('startVoting',promptAndAnswers);
        console.log('startVoting ',promptAndAnswers)
      }
      if(currentStage=='RoundScores'){
        io.emit('sendScores',promptAndAnswers);
        console.log('sendScores ',promptAndAnswers)
      }
      if(currentStage=='FinalScores'){
        const response=await fetchPodiumData();
        console.log('finalScore response',response);
        io.emit('FinalScore',response);
      }
      io.emit('register_response',{
        response_msg:response_message,
        username:username,
        currentStage:currentStage,
        hostName:players[0],
        players_now:players,
        audience_now:audience,
        roundNumber_now:roundNumber
      })
    }catch(error){
      console.error("login failed:", error);
    }

  })

  socket.on('gameStart',()=>{
    currentStage='PromptCollection';
    roundNumber=1;
    io.emit('gameStart',roundNumber);
    players.forEach(async p=>{
      const response=await handleFatchUpdate(p,1,0); 
      console.log('resposne for add one round is: ',response.msg);
    })
  })

  socket.on('prompt',async promptDetails=>{
    console.log(`prompt apply with ${JSON.stringify(promptDetails)}`);
    const{prompt,username}=promptDetails;
    
    const response=await handle_prompt(promptDetails);
    if(response=="OK"){
      prompts.push(prompt);
      promptsName.push(username);
      promptSubmittedDisplay.push(username);
    }
    io.emit('prompt_response',{
      response_context:response,
      username:username,
      promptSubDisplay:promptSubmittedDisplay
    });
    if(promptSubmittedDisplay.length==((players.length)+(audience.length))){
      currentStage='Answer';
      const language="en"
      const assigned=await assignPrompt(language);
      awaitingAnswer= [...players];
      io.emit('startToAnswer',{
        promptAssigned:assigned,
        answerAwaitingList:awaitingAnswer
      });
    }
  })

  socket.on('startToAnswer',async language=>{
    currentStage='Answer';
    const assigned=await assignPrompt(language);
    awaitingAnswer= [...players];
    io.emit('startToAnswer',{
      promptAssigned:assigned,
      answerAwaitingList:awaitingAnswer
    });
  })

  socket.on('answerSubmitted',answerDetails=>{
    const {username,question,answer}=answerDetails;
    const target=promptAndAnswers[question]
    if(!target){
      promptAndAnswers[question]=[];
      promptAndAnswers[question].push(username);
      promptAndAnswers[question].push(answer);
      //console.log("answerDetails saved with ",answerDetails);
    }else{
      promptAndAnswers[question].push(username);
      promptAndAnswers[question].push(answer);
      //console.log("answerDetails saved with ",answerDetails);
    }
   
  })

  socket.on('allAnswerSubmitted',allAnswerDoneName=>{
      answerSubmittedDisplay.push(allAnswerDoneName);
      const index = awaitingAnswer.indexOf(allAnswerDoneName);
      if (index !== -1) {
        awaitingAnswer.splice(index, 1);
      }
      console.log('awaitingAnswer',awaitingAnswer);
      io.emit('allAnswerSubmittedDisplay',{
        answerSubmittedList:answerSubmittedDisplay,
        answerAwaitingList:awaitingAnswer
      });
      if(awaitingAnswer.length==0){
        currentStage='Voting'
        console.log("promptAndAnswer: ",promptAndAnswers);
        io.emit('startVoting',promptAndAnswers);
      }
  })

  socket.on('startVoting',()=>{
    currentStage='Voting'
    console.log("promptAndAnswer: ",promptAndAnswers);
    io.emit('startVoting',promptAndAnswers);
  })

  socket.on('voted',votedDetails=>{
    const {question,answer,ansname,votname}=votedDetails;
    console.log('votedDetails: ',votedDetails);
    const ansAndNameList=promptAndAnswers[question];
    console.log('ansAndNameList: ',ansAndNameList);
    for (let i = 0; i < ansAndNameList.length; i++) {
      if (ansAndNameList[i] === ansname) {
        if(!Array.isArray(ansAndNameList[i+1])){
          promptAndAnswers[question].splice(i + 1, 0, [votname]);
        }
        else{
          if(!promptAndAnswers[question][i+1].includes(votname)){
            promptAndAnswers[question][i+1].push(votname);
          }
          
        }
        break;
      }
    }
    console.log('ansAndNameListNow: ',promptAndAnswers);
    io.emit('voteSaved',question);
  })

  socket.on('allVotesDone',voteDoneName=>{
    if(!votedDoneDisplay.includes(voteDoneName)){
      votedDoneDisplay.push(voteDoneName)
    }
    if(votedDoneDisplay.length==(players.length)+(audience.length)){
      currentStage='RoundScores';
      io.emit('sendScores',promptAndAnswers);
      console.log('snedScores with :',promptAndAnswers)
    }
  })

  socket.on('startScores',()=>{
    currentStage='RoundScores';
    io.emit('sendScores',promptAndAnswers);
    console.log('snedScores with :',promptAndAnswers)
  })

  socket.on('winScore',async(scoreWinDetails)=>{
    const{nameWin,nameLose,question}=scoreWinDetails
    console.log("scoreWinDetails is : ",scoreWinDetails);
    if(!addedQuestions.includes(question)){
      addedQuestions.push(question)
      if(nameWin!=''){
        const response=await handleFatchUpdate(nameWin,0,100*roundNumber); 
        console.log('resposne for store scores are: ',response.msg);
        if(nameLose!=''){
        const response=await handleFatchUpdate(nameLose,0,0); 
        console.log('resposne for store scores are: ',response.msg);
        }

      }
    }
    
  })

  socket.on('thisRoundEnd',async()=>{
    if(roundNumber<3){
      prompts=[];
      promptAndAnswers={};
      addedQuestions=[];
      roundNumber=roundNumber+1;
      promptSubmittedDisplay=[];
      answerSubmittedDisplay=[];
      awaitingAnswer=[];
      votedDoneDisplay=[];
      io.emit('gameStart',roundNumber);
    }else{
      currentStage='FinalScores';
      const response=await fetchPodiumData();
      console.log('finalScore response',response);
      io.emit('FinalScore',response);
    }
  })

  socket.on('newGameStart',async username=>{
    if(currentStage=='FinalScores'){
      currentStage='Auth';
      players=[];
      audience=[];
      promptSubmittedDisplay=[];
      answerSubmittedDisplay=[];
      awaitingAnswer=[];
      io.emit('newGameDisplay');
    }
    if(!players.includes(username)&&!audience.includes(username)){
      if(currentStage=='Auth'&&players.length<3&&username!=''){///要改成8
        players.push(username);
      }else{
        audience.push(username)
      }
      
    }
    console.log('currentStage is: ',currentStage);
      if(currentStage=='Voting'){
        io.emit('startVoting',promptAndAnswers);
      }
      if(currentStage=='RoundScores'){
        io.emit('sendScores',promptAndAnswers);
      }
      if(currentStage=='FinalScores'){
        const response=await fetchPodiumData();
        console.log('finalScore response',response);
        io.emit('FinalScore',response);
      }
    io.emit('register_response',{
      response_msg:"OK",
      username:username,
      currentStage:currentStage,
      hostName:players[0],
      players_now:players,
      audience_now: audience,
      roundNumber_now:roundNumber
    })
    console.log('newGameStart ',(
    username,
    currentStage,
    players[0],
    players,
    audience))
    
  })
});

async function register(registerDetails) {
  const { username, password } = registerDetails;
  console.log("username :",username,"password :",password);
  if (username && password) {
      try {
          const response = await handle_fatch('POST',"https://cw111.azurewebsites.net/api/player/register", username, password);
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

async function handle_fatch(method,endpoint, username, password) {
  try {
      console.log('Sending request:', { endpoint, username, password });
      const response = await fetch(endpoint, {
          method:method,
          //method: 'POST',
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
      for (const prompt of prompts) {
        if (!prompt_get.includes(prompt)) {
            prompt_get.push(prompt);
        }
    }
  
      const promptLeft = promptNumber - prompt_get.length;

      for (let i = 0; i < promptLeft; i++) {
        let responseIndex = 0; // 初始化 response 的索引
        let foundUniquePrompt = false; // 用于标记是否找到唯一的 prompt
    
        while (!foundUniquePrompt) {
            // 获取当前的 response
            const response = await sendGetPrompt(
                "https://cw111.azurewebsites.net/api/utils/get",
                promptsName[i],
                language
            );
    
            // 检查当前索引是否超出 response 数组范围
            if (responseIndex >= response.length) {
                // 如果超出范围，切换到下一个 prompt 名字
                if (i + 1 >= promptLeft) {
                    console.error("Error: No unique prompts found in the remaining prompts.");
                    break;
                }
                i++; // 跳到下一个 prompt
                responseIndex = 0; // 重置索引
                continue;
            }
    
            // 提取当前索引的文本
            const currentPrompt = response[responseIndex]?.text;
    
            if (currentPrompt && !prompt_get.includes(currentPrompt)) {
                // 如果当前 prompt 不在 prompt_get 中，添加到列表
                prompt_get.push(currentPrompt);
                foundUniquePrompt = true; // 结束当前循环
            } else {
                // 如果在 prompt_get 中，检查下一个 response
                responseIndex++;
            }
        }
    }
  } else {

      let getFromPrompt = Math.floor(promptNumber / 2); 
      const getFromDB = promptNumber - getFromPrompt;   
  
     
      for (let i = 0; i < prompts.length && getFromPrompt > 0; i++) {
        while (prompt_get.includes(prompts[i]) && i < prompts.length - 1) {
            i++;
        }
        if (!prompt_get.includes(prompts[i])) {
            prompt_get.push(prompts[i]);
            getFromPrompt--;
        }
    }
  
  
      for (let i = 0; i < getFromDB; i++) {
        let responseIndex = 0; // 初始化 response 的索引
        let foundUniquePrompt = false; // 用于标记是否找到唯一的 prompt
    
        while (!foundUniquePrompt) {
            // 获取当前的 response
            const response = await sendGetPrompt(
                "https://cw111.azurewebsites.net/api/utils/get",
                promptsName[i],
                language
            );
    
            // 检查当前索引是否超出 response 数组范围
            if (responseIndex >= response.length) {
                // 如果超出范围，切换到下一个 prompt 名字
                if (i + 1 >= getFromDB) {
                    console.error("Error: No unique prompts found in the remaining prompts.");
                    break;
                }
                i++; // 跳到下一个 prompt
                responseIndex = 0; // 重置索引
                continue;
            }
    
            // 提取当前索引的文本
            const currentPrompt = response[responseIndex]?.text;
    
            if (currentPrompt && !prompt_get.includes(currentPrompt)) {
                // 如果当前 prompt 不在 prompt_get 中，添加到列表
                prompt_get.push(currentPrompt);
                foundUniquePrompt = true; // 结束当前循环
            } else {
                // 如果在 prompt_get 中，检查下一个 response
                responseIndex++;
            }
        }
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


async function handleFatchUpdate(username, addToGamesPlayed, addToScore) {
  const url = "https://cw111.azurewebsites.net/api/player/update";
  const apiKey = "jLncRoiYHvcqdgXVSKmMGKSpSpPSDRxgLS-WI5jJASR4AzFujfBAdQ==";
  const payload = {
      username: username,
      add_to_games_played: addToGamesPlayed,
      add_to_score: addToScore,
  };

  try {
      const response = await fetch(url, {
          method: "PUT",
          headers: {
              "Content-Type": "application/json",
              "x-functions-key": apiKey,
          },
          body: JSON.stringify(payload),
      });
      if (!response.ok) {
        console.error("Failed to update player data. Status:", response.status);
        const errorData = await response.json();
        console.error("Error details:", errorData);
        return;
    }

      const responseData = await response.json();
      console.log("Player data updated successfully:", responseData);
      return responseData;
     
  } catch (error) {
      console.error("An error occurred while updating player data:", error);
  }
}


async function fetchPodiumData() {
  const url = "https://cw111.azurewebsites.net/api/utils/podium";
  const apiKey = "jLncRoiYHvcqdgXVSKmMGKSpSpPSDRxgLS-WI5jJASR4AzFujfBAdQ==";

  try {
      const response = await fetch(url, {
          method: "GET", // 请求方法
          headers: {
              "Content-Type": "application/json", // 指定内容类型
              "x-functions-key": apiKey // 添加 API 密钥
          }
      });

      // 检查响应是否成功
      if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
      }

      // 解析返回的 JSON 数据
      const data = await response.json();
      console.log("Podium Data:", data); // 打印返回的数据
      return data; // 返回数据，供调用者使用
  } catch (error) {
      console.error("Error fetching podium data:", error);
      return null; // 返回空值以防错误
  }
}






//Start server
if (module === require.main) {
  startServer();
}

module.exports = server;
