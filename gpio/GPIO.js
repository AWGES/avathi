/*
	Projeto Athiva: arquivo para gerenciamento do hardware 
*/
var inherits = require('util').inherits; 
var EventEmitter = require('events').EventEmitter;

/********************************************************/
//Definicao dos pinos usados
var gpio_input = [5, 7, 8, 10, 11, 12, 13, 15, 16, 18];
var gpio_output = [19, 21, 22, 23, 24, 26, 29, 31, 33, 35];
var gpio_pwm = [36];
var gpio_emergency = 37;
/********************************************************/

var GNU_TEST       = 0; // variavel para testar sem RPI
var obj            = ""; // variavel de objeto para passar o emitter

var event          = false;
var LED            = 0;
var button         = 0;
var setLED         = 0;
var UUID           = "";

var blinkTimer 	   = 0;
var LEDPeriod 	   = 500;

var pubTimer  	   = 0;
var pubPeriod 	   = 5000;

var buzzerTimer    = 0;
var buzzerRSTTimer = 0;
var buzzerPeriod   = 100;
var buzzerRSTPeriod= 500;
var buzzerEM 	   = 50;
var buzzerSong	   = 0;
var buzzerSt 	   = 0;
var buzzerStCount  = 0;

var unique         = require('getmac');
var timeoutReqMQTT = 3000;
var mqttIPv4       = '127.0.0.1';
var mqtt           = require('mqtt');
var server         = mqtt.connect('mqtt:'+mqttIPv4);
var connected      = 0;
var unique_id      = 'undefined';
var snifferTopic   = '/nearBeacon/near';
var GPIOe		   = '/GPIOe';
var calls		   = '/calls';
var pubCalls	   = 0;

var emergency 	   = 0;
var emFlag		   = 0;


unique.getMac(function(err,mac_addr){
    if (err)
      throw err
    unique_id = mac_addr;
});

if(!GNU_TEST)
	var rpio = require('rpio'); 

module.exports = gpio;

function gpio(){
	if (! (this instanceof gpio)) 
		return new gpio();
	this._started = false;
	EventEmitter.call(this);
}

inherits(gpio, EventEmitter);

/********************************************************/
//funcoes hal (inicializacoes)
function setInput(){
	// inicializa entradas com PULL UP
	gpio_input.forEach(function(pin){
		if(!GNU_TEST)
			rpio.open(pin,rpio.INPUT,rpio.PULL_UP);
		else
			console.log("Input pin: " +pin);
	});
	if(!GNU_TEST)
		rpio.open(gpio_emergency,rpio.INPUT,rpio.PULL_UP);
	else
		console.log("Output pin: " +pin);
}

function setOutput(){
	// inicializa saidas com pulldown
	gpio_output.forEach(function(pin){
		if(!GNU_TEST)
		{
			rpio.open(pin,rpio.OUTPUT,rpio.PULL_DOWN);
			rpio.write(pin,rpio.LOW);
		}
		else
			console.log("Output pin: " +pin);
	});
}

function setPWM(){
	// inicializa PWMs
	gpio_pwm.forEach(function(pin){
		if(!GNU_TEST){
			rpio.open(pin,rpio.OUTPUT,rpio.PULL_DOWN);
			rpio.write(pin,rpio.LOW);
		}
		else
			console.log("PWM pin: " +pin);
	});
}

function attach_ISR(){
	//atribui interrupcao dos botoes
	if(!GNU_TEST){
		gpio_input.forEach(function(pin){
			rpio.poll(pin, gpio_cb, rpio.POLL_LOW);
		});
		rpio.poll(gpio_emergency, gpio_cb, rpio.POLL_BOTH);
	}
}
/********************************************************/

function lookIndex(v, value){
	//funcao para retornar qual led ligar
	var i = 0;
	v.every(function(element, index){
    	if (element == value)
    	{
    		i = index;
        	return false;
    	}
    	else 
    		return true;
	});
	return i;
}

function gpio_cb(cbpin){
	//funcao de cb do evento de botao
	if (!GNU_TEST)
	{ 
		//obj.emit('gpio', cbpin);
		if(cbpin == gpio_emergency)
		{
			var state = rpio.read(gpio_emergency) ? 1 : 0;

			if(!emergency && !emFlag && state){
				emergency = 1;
				emFlag = 1;
				setTimeout(function(){emFlag=0;}, 50);
				// console.log(emergency)

				gpio_output.forEach(function(pin){
						rpio.write(pin,rpio.LOW);
				});
				clearInterval(blinkTimer);
				clearTimeout(pubTimer);
				buzzerRST();
				blinkTimer = setInterval(LEDblink, LEDPeriod/5);
				event = 0;
				buzzerSong = 3;
				buzzerTimer = setInterval(buzzer, buzzerPeriod);
			}
			else if (emergency && !emFlag){
				emergency = 0;
				emFlag = 1;
				setTimeout(function(){emFlag=0;}, 50);
				// console.log(emergency)

				gpio_output.forEach(function(pin){
						rpio.write(pin,rpio.LOW);
				});
				clearInterval(blinkTimer);
				buzzerRST();
			}
			
		}
		if(!emergency && cbpin != gpio_emergency)
		{
			var index = lookIndex(gpio_input,cbpin);
			button = index + 1;
			if(event){
				if(LED != gpio_output[index]){
					rpio.write(LED,0);
					LED = gpio_output[index];
					setLED = 0;
					clearInterval(blinkTimer);
					clearTimeout(pubTimer);
					blinkTimer = setInterval(LEDblink, LEDPeriod);
					pubTimer = setTimeout(timeout_pub, pubPeriod);
				}
			}
			else
			{
				LED = gpio_output[index];
				setLED = 0;
				event = 1;
				if(connected){
					server.publish('/'+unique_id+GPIOe, "1");
				}
				blinkTimer = setInterval(LEDblink, LEDPeriod);
				pubTimer = setTimeout(timeout_pub, pubPeriod);
			}
			buzzerRST();
		}
	}
}

function LEDblink(){
	if(event){
		setLED = setLED ? 0 : 1;
		rpio.write(LED,setLED);
	}
	if(emergency)
	{
		setLED = setLED ? 0 : 1;
		gpio_output.forEach(function(pin){
			rpio.write(pin,setLED);
		});
	}
}
function buzzer(){
	switch (buzzerSong) {
	case 1:
			rpio.write(gpio_pwm[0], 1);
			break;
	case 2: 
			buzzerSt = buzzerSt ? 0 : 1;
			rpio.write(gpio_pwm[0],buzzerSt);
			break;
	case 3: 
			buzzerStCount++;
			if(buzzerStCount == 30){

				buzzerSt = 0;
				buzzerStCount = 0;
			}
			else if(buzzerStCount==10)
				buzzerSt = 1;
			
			rpio.write(gpio_pwm[0],buzzerSt);

			break;
	default:
			rpio.write(gpio_pwm[0],0);
			clearInterval(buzzerTimer);
			break;
	}
}
function buzzerRST(){
	rpio.write(gpio_pwm[0],0);
	clearInterval(buzzerTimer);
	clearTimeout(buzzerRSTTimer);
	buzzerSong = 0;
}
function timeout_pub(){

	if(pubCalls){
		//processo ok
		mqttPub();
		pubCalls = 0;
		buzzerSong = 1;
	}
	else
	{
		buzzerSong = 2;		
	}

	buzzerTimer = setInterval(buzzer, buzzerPeriod);
	buzzerRSTTimer = setTimeout(buzzerRST, buzzerRSTPeriod);
	
	clearInterval(blinkTimer);
	clearTimeout(pubTimer);
	
	if(LED)
		rpio.write(LED,0);
	event 	= 0;
	LED 	= 0;
	button 	= 0;
	setLED 	= 0;
	UUID 	= "";
	if(connected){
		server.publish('/'+unique_id+GPIOe, "0");
	}
}
/********************************************************/

/********************************************************/
// funcoes de MQTT

var reconMQTT = function(){
  console.log('[GPIO-MQTT] Tentando conectar ao broker IPv4:'+mqttIPv4);
  server.connect('mqtt:'+mqttIPv4);
};

server.on('message', function (topic, message){
  // console.log('[GPIO-MQTT] Recebido = Tópico: '+topic+' Publicação: '+message);
	if(event){
		UUID = message;
		pubCalls = 1;
		timeout_pub();
	}
});

server.on('connect', function (){
  console.log('[GPIO-MQTT] Conectado ao broker IPv4:'+mqttIPv4);
  connected = 1;
  if(connected){
  	server.subscribe('/'+unique_id+snifferTopic);
  }
});

server.on('close', function (){
  console.log('[GPIO-MQTT] Desconectado do broker IPv4:'+mqttIPv4);
  connected = 0;
  setTimeout(reconMQTT, timeoutReqMQTT);
});

function mqttPub(){
	// console.log(button + "TAG:" + UUID);
	if(connected){
		server.publish('/'+ unique_id + calls, "botao_" + button + "-UUID:" + UUID); 
	}
}

/********************************************************/
// funcoes para uso externo
gpio.prototype.start = function start(){ 
	var self = this;
	obj = this;

	if (self._started) 
		return;
	
	setOutput();
	setInput();
	attach_ISR();
	setPWM();

	emergency = rpio.read(gpio_emergency) ? 1 : 0;
	this._started = true;
}

gpio.prototype.stop = function stop(){ 	
	this._started = false;
	if(!GNU_TEST)
	{
		gpio_input.forEach(function(pin){
			rpio.poll(pin, null);
		});
		clearInterval(blinkTimer);
		clearTimeout(pubTimer);
	}
};
/********************************************************/
 	












