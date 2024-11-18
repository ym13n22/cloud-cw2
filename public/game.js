var socket = null;

/////////////////不应该一个连接创造一个实例吗?????为什么分不开
//Prepare game
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
                this.currentStage='PromptCollection';//////////////////暂时的后面记得删@!!!!!!!!!!!
            }
            else{
                this.currentStage='PromptCollection';
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
        const {hostName,players_now,isHost}=response;
        app.hostName=hostName;
        app.players=players_now;
        app.isHost=isHost;
    });
}
