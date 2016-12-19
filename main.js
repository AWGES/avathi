var beaconscan = require('./BeaconScan.js')
var gpio = new require('./GPIO.js')();


beaconscan.BEACON_InitScan();
gpio.start();

