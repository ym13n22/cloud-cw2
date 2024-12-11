'use strict';

const { CONNREFUSED } = require('dns');
//Set up express
const express = require('express');
const app = express();

//Setup socket.io
const https = require('https');
const http=require('http');
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
let roundScoresRecord={};

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
        if(currentStage=='Auth'&&players.length<8){///要改成8
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
      let {response_message,username}=await login(loginDetails);
      console.log("login message is:",response_message);
      console.log("username is: ",username);
      console.log("players.length: ",players.length);
      if(response_message==''){
        response_message="OK";
      }
      
      if(response_message=="OK"&&!players.includes(username)&&!audience.includes(username)){
        if(currentStage=='Auth'&&players.length<8){///要改成8
          players.push(username);
        }else{
          audience.push(username)
        }
        
      }
      console.log("players now: ",players);
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
    console.log('answerDetails: ',answerDetails);
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
        console.log('players ',players);
        players.forEach(p => {
          if (roundScoresRecord[p] === undefined) {
            roundScoresRecord[p] = Number(0);  // 如果没有 p，初始化为 0
          }
        });
        console.log('roundScoresRecord: ',roundScoresRecord);
      }
  })

  socket.on('startVoting',()=>{
    currentStage='Voting'
    console.log("promptAndAnswer: ",promptAndAnswers);
    io.emit('startVoting',promptAndAnswers);
    console.log('players ',players);
    players.forEach(p => {
      if (roundScoresRecord[p] === undefined) {
        roundScoresRecord[p] = Number(0);  // 如果没有 p，初始化为 0
      }
    });
    console.log('roundScoresRecord: ',roundScoresRecord);
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
    
      let currentRoundRecord=Number(roundScoresRecord[nameWin]);
      let scoreNow=currentRoundRecord+100*roundNumber;
      roundScoresRecord[nameWin] = scoreNow;
  
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

  socket.on('allVoteScoresDone',()=>{
    io.emit('allVoteScoresDone',roundScoresRecord);
    console.log('roundScoresRecord ',roundScoresRecord);
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
      prompts=[];
      addedQuestions=[];
      currentStage='Auth';
      roundScoresRecord={};
      players=[];
      audience=[];
      promptAndAnswers={};
      promptSubmittedDisplay=[];
      answerSubmittedDisplay=[];
      awaitingAnswer=[];
      votedDoneDisplay=[];
      io.emit('newGameDisplay');
    }
    if(!players.includes(username)&&!audience.includes(username)){
      if(currentStage=='Auth'&&players.length<8&&username!=''){///要改成8
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
          const response = await handle_fatch('POST',"http://localhost:8181/player/register", username, password);
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
          const response = await sendGetRequestWithBody("http://localhost:8181/player/login", username, password);
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
      const response =await handleatchPrompt("http://localhost:8181/prompt/create",prompt,username);
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
  // 将 username 和 password 构造成 JSON 字符串（仿照 curl 的 -d 参数）
  const payload = JSON.stringify({ username, password });

  // 解析 URL 以确保可以正确使用 http.request
  const url = new URL(endpoint);

  const options = {
      hostname: url.hostname,
      port: url.port || 80, // 默认使用 80 端口
      path: url.pathname,
      method: 'GET', // 方法是 GET
      headers: {
          'Content-Type': 'application/json',
          'x-functions-key': 'jLncRoiYHvcqdgXVSKmMGKSpSpPSDRxgLS-WI5jJASR4AzFujfBAdQ==', // 必须正确无误
          'Content-Length': Buffer.byteLength(payload), // 设置正确的请求体长度
      },
  };

  return new Promise((resolve, reject) => {
      const req = http.request(options, (res) => {
          let data = '';

          console.log(`Response status: ${res.statusCode}`);

          // 收集数据
          res.on('data', (chunk) => {
              data += chunk;
          });

          // 请求完成时处理结果
          res.on('end', () => {
              try {
                  const jsonResponse = JSON.parse(data);
                  resolve(jsonResponse); // 成功返回 JSON 响应
              } catch (err) {
                  reject({ error: 'Failed to parse JSON response', details: err.message });
              }
          });
      });

      // 处理错误
      req.on('error', (err) => {
          console.error('Request error:', err.message);
          reject({ error: 'Request failed', details: err.message });
      });

      // 写入 payload 到请求体中
      req.write(payload);
      req.end(); // 结束请求
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

    let prompt_get=[];
    if (promptNumber / 2 > prompts.length) {
      for (const prompt of prompts) {
        if (!prompt_get.includes(prompt)) {
            prompt_get.push(prompt);
        }
    }
  
  } else {

      let getFromPrompt = Math.ceil(promptNumber / 2); 
      const getFromDB = promptNumber - getFromPrompt;
      console.log('getFromPrompt ', getFromPrompt);
      console.log('getFromDB ',getFromDB);   
  
     
      for (let i = 0; i < prompts.length && getFromPrompt > 0; i++) {
        if (!prompt_get.includes(prompts[i])) {
            prompt_get.push(prompts[i]);
            console.log('prompt_get.push',prompts[i])
            getFromPrompt--;
        }
    }
      
      
  }
  let promptLeft = promptNumber - prompt_get.length;

      for (let i = 0; i < promptsName.length&&promptLeft>0; i++) {

        const response = await sendGetPrompt(
          "http://localhost:8181/utils/get",
          promptsName[i],
          language
        );
        console.log('response ',response)

        for(let responseIndex=0;responseIndex<response.length;responseIndex++){
          const currentPrompt = response[responseIndex].text;
          console.log('currentPrompt',currentPrompt)
          if(!prompt_get.includes(currentPrompt)){
            prompt_get.push(currentPrompt);
            promptLeft--;
          }
        }
    
    }
    if(prompt_get.length>promptNumber){
      prompt_get = prompt_get.slice(0, promptNumber);
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



async function sendGetPrompt(endpoint, username, language) {
  /// 将 username 和 password 构造成 JSON 字符串（仿照 curl 的 -d 参数）
  const payload = JSON.stringify({players: [username],language:language });

  // 解析 URL 以确保可以正确使用 http.request
  const url = new URL(endpoint);

  const options = {
      hostname: url.hostname,
      port: url.port || 80, // 默认使用 80 端口
      path: url.pathname,
      method: 'GET', // 方法是 GET
      headers: {
          'Content-Type': 'application/json',
          'x-functions-key': 'jLncRoiYHvcqdgXVSKmMGKSpSpPSDRxgLS-WI5jJASR4AzFujfBAdQ==', // 必须正确无误
          'Content-Length': Buffer.byteLength(payload), // 设置正确的请求体长度
      },
  };

  return new Promise((resolve, reject) => {
      const req = http.request(options, (res) => {
          let data = '';

          console.log(`Response status: ${res.statusCode}`);

          // 收集数据
          res.on('data', (chunk) => {
              data += chunk;
          });

          // 请求完成时处理结果
          res.on('end', () => {
              try {
                  const jsonResponse = JSON.parse(data);
                  resolve(jsonResponse); // 成功返回 JSON 响应
              } catch (err) {
                  reject({ error: 'Failed to parse JSON response', details: err.message });
              }
          });
      });

      // 处理错误
      req.on('error', (err) => {
          console.error('Request error:', err.message);
          reject({ error: 'Request failed', details: err.message });
      });

      // 写入 payload 到请求体中
      req.write(payload);
      req.end(); // 结束请求
  });
}


async function handleFatchUpdate(username, addToGamesPlayed, addToScore) {
  const url = "http://localhost:8181/player/update";
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
  const url = "http://localhost:8181/utils/podium";
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
