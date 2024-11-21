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
        prompt:'',
        promptSubmitted:false,
        
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
    })

    socket.on('prompt_response',response=>{
        const{response_context,username}=response;
        if(username==app.username){
            if(response_context!="OK"){
                app.promptMessage=response;
            }
            else{
                app.promptSubmitted=true;
            }
        }
      
       
        
    });
}
