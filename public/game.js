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
        hostName: '',
        players: [],
        prompt:'',
        prompt_submitted:false,
        
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
                this.currentStage='PromptCollection';
            }
            
        },
        prompt_submitted(){
            if(prompt!=''){
                socket.emit('prompt',this.prompt);
                this.prompt_submitted=true;
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
        app.statusMessage=response;
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
}
