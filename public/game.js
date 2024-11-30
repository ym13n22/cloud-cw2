var socket = null;

var app = new Vue({
    el: '#game',
    data: {
        connected: false,
        currentStage:'Auth',
        isHost:false,
        messages: [],
        chatmessage: '',
        username:'',
        password:'',
        statusMessage: '',
        statusMessageGameStart:'',
        promptMessage:'',
        hostName: '',
        players: [],
        audience:[],
        prompt:'',
        prompt_asked:'',
        promptSubmitted:false,
        language:"en",
        firstPrompt:'',
        secondPrompt:'',
        answer:'',
        answer1:'',
        answer2:'',
        answer1Name:'',
        answer2Name:'',
        promptAndAnswerLeft:{},
        allPromptAndAnswers:{},
        promptAndAnswerScoreLeft:{},
        AnswerSubmitted:false,
        AudienceWaiting:false,
        VoteSubmitted:false,
        VoteScoresDone:false,
        firstVotingQuestion:'',
        firstScoreQuestion:'',
        ScoreContentList1:[],
        ScoreContentList2:[]
        
    },
    mounted: function() {
        connect(); 
    },
    methods: {
        handleChat(message) {
            if(this.messages.length + 1 > 10) {
                this.messages.pop();
            }
            this.messages.unshift(message);
        },
        chat() {
            socket.emit('chat',this.chatmessage);
            this.chatmessage = '';
        },
        register(){
            socket.emit('register',{
                username: this.username,
                password:this.password
            })
        },
        login(){
            socket.emit('login',{
                username:this.username,
                password:this.password
            })
        },
        gameStart(){
            if(this.players.length<3){
                this.statusMessageGameStart='number of players must over three';
            }
            else{
                socket.emit('gameStart');
               
            }
        },
        prompt_submitted(){
            if(prompt!=''){
                socket.emit('prompt',{
                    prompt:this.prompt,
                    username:this.username
                });
                
            }
        },
        startToAnswer(){
            socket.emit('startToAnswer',this.language);

        },
        answer_submitted(){
            socket.emit('answerSubmitted',{
                username:this.username,
                question:this.firstPrompt,
                answer:this.answer
            });
            if(this.secondPrompt!=''){
                this.answer='';
                this.firstPrompt=this.secondPrompt;
                this.secondPrompt='';
            }else{
                this.AnswerSubmitted=true;
            }
        },
        startToVote(){
            socket.emit('startVoting')
        },
        answer1_voted(){
            socket.emit('voted',{
                question:this.firstVotingQuestion,
                answer:this.answer1,
                ansname:this.answer1Name,
                votname:this.username
            })
            if(!this.promptAndAnswerLeft=={}){
            const [firstQuestion, answers] = Object.entries(this.promptAndAnswerLeft)[0];
            
            this.firstVotingQuestion = firstQuestion;
            
            this.answer1 = answers[1]; // 第二个元素
            this.answer2 = answers[3]; // 第四个元素

            this.answer1Name=answers[0];
            this.answer2Name=answers[2];

            const remaining = { ...this.promptAndAnswerLeft };
            if(remaining[firstQuestion].length>4){
            remaining[firstQuestion] =remaining[firstQuestion].slice(4);
            }
            else{
                delete remaining[firstQuestion];
       
            }
            this.promptAndAnswerLeft = remaining;
            }else{
                this.VoteSubmitted=true;
            }
        },
        answer2_voted(){
            socket.emit('voted',{
                question:this.firstVotingQuestion,
                answer:this.answer2,
                ansname:this.answer2Name,
                votname:this.username
            })
            if(!this.promptAndAnswerLeft=={}){
                const [firstQuestion, answers] = Object.entries(this.promptAndAnswerLeft)[0];
                
                this.firstVotingQuestion = firstQuestion;
                
                this.answer1 = answers[1]; // 第二个元素
                this.answer2 = answers[3]; // 第四个元素
    
                this.answer1Name=answers[0];
                this.answer2Name=answers[2];
    
                const remaining = { ...this.promptAndAnswerLeft };
                if(remaining[firstQuestion].length>4){
                remaining[firstQuestion] =remaining[firstQuestion].slice(4);
                }
                else{
                    delete remaining[firstQuestion];
           
                }
                this.promptAndAnswerLeft = remaining;
                }else{
                    this.VoteSubmitted=true;
                }
            
        },
        getScores(){
            socket.emit('startScores');
        },
        thisRoundDone(){

        }
        
        ,
        thisScoreDone(){
            let winName='';
            console.log('ScoreContentList1[2]',this.ScoreContentList1[2]);
            console.log('ScoreContentList2[2]',this.ScoreContentList2[2]);
            const score1 = parseInt(this.ScoreContentList1[2]);
            const score2 = parseInt(this.ScoreContentList2[2]);
            console.log('score1 ',score1,'score2 ',score2);

            if (score1 > score2) {
                winName = this.ScoreContentList1[1];
                console.log('winName: ', winName);
            } else if (score1 < score2) {
                winName = this.ScoreContentList2[1];
                console.log('winName: ', winName);
            } else {
                console.log("It's a tie! No winner.");
            }
            socket.emit('winScore',{
                nameWin:winName,
                question:this.firstScoreQuestion
            });
           // console.log("this.promptAndAnswerScoreLeft is: ",this.promptAndAnswerScoreLeft=={});
            if(this.promptAndAnswerScoreLeft && Object.keys(this.promptAndAnswerScoreLeft).length !== 0){
                console.log('another score shows')
                this.ScoreContentList1=[];
                this.ScoreContentList2=[];
                const [firstQuestion, answers] = Object.entries(this.promptAndAnswerScoreLeft)[0];
                app.firstScoreQuestion=firstQuestion;
                const resultArray = [];
                console.log('answersare:',answers)

                console.log('answerLength',answers.length)
    
                if(answers.length == 4){
                    resultArray.push(answers[0]);
                    resultArray.push([]);
                    resultArray.push(answers[1]);
                    resultArray.push(answers[2]);
                    resultArray.push([]);
                    resultArray.push(answers[3]);
                }
                if(answers.length == 5){
                    if(Array.isArray(answers[1])){
                    resultArray.push(answers[0]);
                    resultArray.push(answers[1]);
                    resultArray.push(answers[2]);
                    resultArray.push(answers[3]);
                    resultArray.push([]);
                    resultArray.push(answers[4]);
                }else{
                    resultArray.push(answers[0]);
                    resultArray.push([]);
                    resultArray.push(answers[1]);
                    resultArray.push(answers[2]);
                    resultArray.push(answers[3]);
                    resultArray.push(answers[4]);

                    }
                }
                if(answers.length == 6){
                    resultArray=answers;
                }

                console.log("result is: ",resultArray);

                this.ScoreContentList1.push(resultArray[2]);
                this.ScoreContentList1.push(resultArray[0]);
                this.ScoreContentList1.push(resultArray[1].length);
                resultArray[1].forEach(p => {
                    this.ScoreContentList1.push(p);
                });

                console.log('ScoreContentList1',this.ScoreContentList1);


                this.ScoreContentList2.push(resultArray[5]);
                this.ScoreContentList2.push(resultArray[3]);
                console.log('resultArray[4]',resultArray[4]);
                this.ScoreContentList2.push(resultArray[4].length);
                resultArray[4].forEach(p => {
                    this.ScoreContentList2.push(p);
                });

                console.log('ScoreContentList2',this.ScoreContentList2)

                const remaining = { ...this.promptAndAnswerScoreLeft };
                delete remaining[this.firstScoreQuestion];
                this.promptAndAnswerScoreLeft=remaining;

            }else{
                this.VoteScoresDone=true;
            }
        }

    }
});

function connect() {
    //Prepare web socket
    socket = io();

    //Connect
    socket.on('connect', function() {
        //Set connected state to true
        app.connected = true;
    });

    //Handle connection error
    socket.on('connect_error', function(message) {
        alert('Unable to connect: ' + message);
    });

    //Handle disconnection
    socket.on('disconnect', function() {
        alert('Disconnected');
        app.connected = false;
    });

    //Handle incoming chat message
    socket.on('chat', function(message) {
        app.handleChat(message);
    });
    socket.on('register_response',response =>{
        const{response_msg,username,currentStage,hostName,players_now}=response
        app.hostName=hostName;
        app.players=players_now;
        if(username==app.username){
            if(response_msg!="OK"){
                app.statusMessage=response_msg
            }else{
                if(currentStage=='Auth'){
                    app.currentStage='Waiting';
                    if(app.username==hostName){
                        app.isHost=true;
                    }
                }
            }
        }
        
       ;
    });
    socket.on('register_response_OK',response=>{
        app.currentStage='Waiting';
        const {hostName,players_now}=response;
        app.hostName=hostName;
        app.players=players_now;
        if(app.username==hostName){
            app.isHost=true;
        }
        
    });

    socket.on('gameStart',()=>{
        app.currentStage='PromptCollection';
    });

    socket.on('prompt_response',response=>{
        const{response_context,username}=response;
        if(username==app.username){
            if(response_context!="OK"){
                app.promptMessage=response.response_context;
            }
            else{
                app.promptMessage="";
                app.promptSubmitted=true;
            }
        } 
    });

    socket.on('startToAnswer',promptsForPlayers=>{
        app.currentStage='Answer';
        const target = promptsForPlayers[app.username];
        if(!target){
            AudienceWaiting=true;
            app.firstPrompt=("do not have the target under the username: ",this.username);
        }
        app.firstPrompt =target[0];
        if(target[1]){
            app.secondPrompt=target[1];
        }

    });

   
    socket.on('startVoting', (promptAnswer) => {
        app.currentStage = 'Voting';
        for (const question in promptAnswer) {
            if (promptAnswer[question].includes(app.username)) {
                delete promptAnswer[question];
            }
        }
        if (Object.keys(promptAnswer).length === 0) {
            app.firstVotingQuestion="sorry do not have the chance to vote"
            return;
        }
        app.allPromptAndAnswers=promptAnswer;
            
        const [firstQuestion, answers] = Object.entries(promptAnswer)[0];
            
        app.firstVotingQuestion = firstQuestion;
            
        app.answer1 = answers[1]; // 第二个元素
        app.answer2 = answers[3]; // 第四个元素

        app.answer1Name=answers[0];
        app.answer2Name=answers[2];

        const remaining = { ...promptAnswer };
        if(remaining[firstQuestion].length>4){
            remaining[firstQuestion] =remaining[firstQuestion].slice(4);
        }
        else{
            delete remaining[firstQuestion];
       
        }
        app.promptAndAnswerLeft = remaining;
        
    });
        

    socket.on('sendScores',(promptAndAnswers)=>{
        app.currentStage = 'ScoresShow';
        const [firstQuestion, answers] = Object.entries(promptAndAnswers)[0];
        app.firstScoreQuestion=firstQuestion;
        const resultArray = [];
        console.log('answersare:',answers)

        console.log('answerLength',answers.length)
    
        if(answers.length == 4){
            resultArray.push(answers[0]);
            resultArray.push([]);
            resultArray.push(answers[1]);
            resultArray.push(answers[2]);
            resultArray.push([]);
            resultArray.push(answers[3]);
        }
        if(answers.length == 5){
            if(Array.isArray(answers[1])){
                resultArray.push(answers[0]);
                resultArray.push(answers[1]);
                resultArray.push(answers[2]);
                resultArray.push(answers[3]);
                resultArray.push([]);
                resultArray.push(answers[4]);
            }else{
                resultArray.push(answers[0]);
                resultArray.push([]);
                resultArray.push(answers[1]);
                resultArray.push(answers[2]);
                resultArray.push(answers[3]);
                resultArray.push(answers[4]);

            }
        }
        if(answers.length == 6){
            resultArray=answers;
        }

        console.log("result is: ",resultArray);

        app.ScoreContentList1.push(resultArray[2]);
        app.ScoreContentList1.push(resultArray[0]);
        app.ScoreContentList1.push(resultArray[1].length);
        resultArray[1].forEach(p => {
            app.ScoreContentList1.push(p);
        });

        console.log('ScoreContentList1',app.ScoreContentList1);


        app.ScoreContentList2.push(resultArray[5]);
        app.ScoreContentList2.push(resultArray[3]);
        console.log('resultArray[4]',resultArray[4]);
        app.ScoreContentList2.push(resultArray[4].length);
        resultArray[4].forEach(p => {
            app.ScoreContentList2.push(p);
        });

        console.log('ScoreContentList2',app.ScoreContentList2)

        const remaining = { ...promptAndAnswers };
        delete remaining[app.firstScoreQuestion];
        app.promptAndAnswerScoreLeft=remaining;
        



        
    })

}
