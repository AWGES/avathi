var rpio = require('rpio');
var gpio_input = [7, 8, 10, 11, 12, 13, 15, 16, 18, 19];

var gpio_emergency = 21;

var gpio_output = [22, 23, 24, 26, 29, 31, 32, 33, 35, 36];
var gpio_pwm = [37];
var emFlag = 0;

function lookIndex(v, value){
	var i = 0;
	v.every(function(element, index){
		if (element == value){
			i = index;
			return false;
		}
		else
			return true;
	});
	return i;
}

//inputs
gpio_input.forEach(function(pin){
				rpio.open(pin,rpio.INPUT,rpio.PULL_UP);
				rpio.poll(pin, poll, rpio.POLL_LOW);
	console.log("Input pin: "+ pin);
});
rpio.open(gpio_emergency,rpio.INPUT,rpio.PULL_UP);
console.log("Input emergency pin: "+ gpio_emergency);
rpio.poll(gpio_emergency, poll, rpio.POLL_BOTH);

//outputs
gpio_output.forEach(function(pin){
				rpio.open(pin,rpio.OUTPUT,rpio.PULL_DOWN);
				rpio.write(pin, rpio.LOW);
	console.log("Output pin: " +pin);
});
rpio.open(gpio_pwm[0],rpio.OUTPUT,rpio.PULL_DOWN);
rpio.write(gpio_pwm[0], rpio.LOW);
console.log("Output buzzer pin: "+ gpio_emergency);

for (var i = 0; i < 5; i++){
        gpio_output.forEach(function(pin){
				rpio.write(pin, rpio.HIGH);
				console.log("PIN: " +pin +" HIGH");
				rpio.msleep(50);
		});
         gpio_output.forEach(function(pin){
				rpio.write(pin, rpio.LOW);
				console.log("PIN: " +pin +" LOW");
				rpio.msleep(50);
		});
        rpio.write(gpio_pwm[0], rpio.HIGH);
        rpio.msleep(10);
        rpio.write(gpio_pwm[0], rpio.LOW);
}

function poll(cbpin){
	var normal = (rpio.read(gpio_emergency) ? 0 : 1)
	
	if(normal && (cbpin != gpio_emergency)){
		var index = lookIndex(gpio_input,cbpin);
		console.log("Botao:" + (index+1));
		rpio.write(gpio_output[index],rpio.HIGH);
	}
	if(!normal && cbpin == gpio_emergency && emFlag == 0){
		emFlag = 1;
		setTimeout(function(){emFlag=0;}, 150);
		console.log("emergency: ativo");
		rpio.write(gpio_pwm,rpio.HIGH);
	}
	else if (normal && cbpin == gpio_emergency && emFlag == 0){
		console.log("emergency: desativo");
		rpio.write(gpio_pwm,rpio.LOW);
		emFlag = 1;
		setTimeout(function(){emFlag=0;}, 150);
	}
}
