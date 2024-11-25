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
        AnswerSubmitted:false,
        AudienceWaiting:false,
        VoteSubmitted:false,
        firstVotingQuestion:false
        
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
               // this.currentStage='Voting';
               // socket.emit('startVoting');
            }
        },
        startToVote(){
            socket.emit('startVoting')
        },
        answer1_voted(){

        },
        answer2_voted(){
            
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
            if (promptAnswer[question].includes(username)) {
                delete promptAnswer[question];
            }
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
        

}
