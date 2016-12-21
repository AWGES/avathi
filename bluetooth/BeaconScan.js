// ===== CONFIGURAÇÕES =====


// Tempo em milisegundos para tentar reconectar no broker MQTT.
var MQTT_ReqTimeout = process.env.MQTT_REQ_TIMEOUT;

// Endereço do broker MQTT local.
var MQTT_IPv4_addr  = process.env.MQTT_ADDR;



// Tópico onde serão observados eventos no GPIO
var MQTT_GPIO_Event_Topic       = process.env.MQTT_GPIO_EVENT_SUB_TOPIC;

// Tópico no qual publicar beacons próximos continuamente
var MQTT_NearBeacons_Topic      = process.env.MQTT_NEAR_BEACONS_SUB_TOPIC;

// Tópico no qual publicar o beacon mais próximo quando requisitado
var MQTT_NearBeacons_Near_Topic = process.env.MQTT_NEAREST_BEACON_SUB_TOPIC;

var MQTT_NearBeacons_PublishAll = process.env.MQTT_NEARBEACONS_PUBLISHALL;


// RSSI mínimo para publicar o beacon no tópico de leitura contínua
var BEACON_NearBeaconRSSIThreshold = process.env.BLE_NEAR_RSSI_THRESHOLD;

// RSSI mínimo para publicar o beacon no tópico de beacon mais próximo (Ativado pelo tópico GPIO Event)
var BEACON_NearestBeaconRSSIThreshold = process.env.BLE_NEAREST_RSSI_THRESHOLD;



// Tempo de vida de um beacon na lista de beacons recentes.
var BEACON_RemoveFromListAfterMs = process.env.BLE_REMOVE_FROM_LIST_AFTER_MS;

// Tempo para executar a tarefa de verificação e limpeza
var BEACON_PoolTimeMs = process.env.BLE_POOL_TIME_MS;




// ===== INÍCIO DO PROGRAMA =====

var exports         = module.exports = {};

var unique          = require('getmac');
var mqtt            = require('mqtt');
var noble           = require('noble');


var RASPI_Unique_id = 'undefined';                        			// Conterá o ID único utilizado nas publicações MQTT

var BEACON_Identifier = Buffer([0x4C, 0x00, 0x02, 0x15])			// Os primeiros 4 bytes identificam se é um iBeacon.
var BEACON_RecentBeaconList = [];					        		// Lista para armazenar beacons escaneados.
var BEACON_BeaconScanCounter = 0;

var MQTT_Server     = mqtt.connect('mqtt:' + MQTT_IPv4_addr);		// Objeto da conexão com o broker MQTT.
var MQTT_Connected  = false;                              			// Define se está conectado com o broker MQTT.
var MQTT_GPIOEvent_SendNear_Flag = false;							// Define se deve ser enviado o beacon mais próximo

// Armazena o nome completo dos tópicos
var MQTT_NearBeacons_FullTopic = '';
var MQTT_NearBeacons_Near_FullTopic = '';
var MQTT_GPIO_Event_FullTopic = '';



// ===================== RASPBERRY =====================


// Copia o MAC para utilizar como endereço único da Raspberry Pi
unique.getMac(function(err,mac_addr){
    if (err)
      throw err
    RASPI_unique_id = mac_addr;
});




// ===================== BEACON =====================


// BEACON_InitScan()
//   Inicia o processo de escaneamento de beacons.
//     Ex.: obj['uuid'] contém o UUID
//          obj['rssi'] contém o RSSI

var BEACON_InitScan = function(){



	noble.on('stateChange', function(state) {
		if (state === 'poweredOn') {
			noble.startScanning([], true);
			console.log("[BLE ] NOBLE iniciou escaneamento");
			setInterval(BEACON_PoolRecentBeaconList, BEACON_PoolTimeMs);
		} else {
			noble.stopScanning();
			console.log("[BLE ] NOBLE parou escaneamento");
		}
	});


	noble.on('discover', function(peripheral) {

		uuid = 0;
		beaconType=0;

		if (peripheral.advertisement.manufacturerData && !peripheral.advertisement.serviceData.length && peripheral.advertisement.manufacturerData.slice(0, 4).compare(BEACON_Identifier)==0) {
			// iBeacon
			uuid = peripheral.advertisement.manufacturerData.slice(8, 24);
			// Como a ideia é utilizar um UUID por aplicação e identificar
			// beacons únicos com Minor e Major, foram cortados os 4 primeiros
			// bytes do UUID do iBeacon e concatenados os 4 bytes de minor e major.
			beaconType="ibeacon";
		}
		
		if(peripheral.advertisement.serviceData.length && !peripheral.advertisement.manufacturerData) {
			// Eddystone
			uuid = peripheral.advertisement.serviceData[0]['data'].slice(2, 18);
			// Como a ideia é utilizar um UUID único por beacon, o UUID
			// não foi cortado e permanece sendo o valor original.
			beaconType="eddystone";
		}
		
		
		// Se for um iBeacon ou Eddystone
		if( beaconType!=0 ){
		
			if(peripheral.rssi > BEACON_NearBeaconRSSIThreshold){

				console.log('[BLE ] - ' + beaconType+'-'+uuid.slice(12, 16).toString('hex'));

				//Somente para não abusar do log, conta de 5 em 5 leituras para avisar que está lendo beacons
				BEACON_BeaconScanCounter++;
				if(BEACON_BeaconScanCounter>=10){
					BEACON_BeaconScanCounter=0;
					console.log('[BLE ] Escaneando Beacons...');
				}

				var data = peripheral.advertisement.manufacturerData;

				var beacon = {};
				beacon['uuid'] = uuid.toString('hex');
				beacon['rssi'] = peripheral.rssi;
				beacon['time'] = Date.now();

				// Se estiver conectado ao broker MQTT
				if(MQTT_Connected){

					MQTT_Server.publish(MQTT_NearBeacons_PublishAll, JSON.stringify(beacon));

					// Testa se o beacon já foi enviado faz pouco tempo. Caso contrário, adiciona à lista de recentes e envia a publicação.
					BEACON_RecentBeaconList_QueryAndPush(beacon, function(){
						MQTT_Server.publish(MQTT_NearBeacons_FullTopic, JSON.stringify(beacon));
					});

					// Se estiver dentro do tempo de envio do beacon mais próximo e o beacon estiver dentro do threshold
					if(MQTT_GPIOEvent_SendNear_Flag && (peripheral.rssi > BEACON_NearestBeaconRSSIThreshold)){

						// Envia o UUID do beacon para o tópico do beacon mais próximo e trava a flag
						MQTT_Server.publish(MQTT_NearBeacons_Near_FullTopic, beacon['uuid']);
						MQTT_GPIOEvent_SendNear_Flag = false;

						console.log('[MQTT] Reportando beacon mais próximo (' + beacon['uuid'] + ')');
					}
				}
			}
		}
	});
}

// BEACON_RecentBeaconList_QueryAndPush( beacon, callback )
//  Insere ou atualiza beacons na lista de beacons recentes.
//  Em caso de inserção, executa o callback sem nenhum argumento.
var BEACON_RecentBeaconList_QueryAndPush = function(beacon, callback){
	
	// Flag que será setada se o beacon for atualizado na lista
	var updated = false;
	
	for(var i = 0; i < BEACON_RecentBeaconList.length; i++){
		if(BEACON_RecentBeaconList[i]['uuid'] == beacon['uuid']){
			BEACON_RecentBeaconList[i] = beacon;
			updated = true;
		}
	}
	
	// Se o beacon não for atualizado, precisa ser adicionado
	if(!updated){
		BEACON_RecentBeaconList.push(beacon);
		
		// Ao adicionar o beacon, chamamos o callback
		callback();
	}
}

// BEACON_PoolRecentBeaconList()
//  Remove beacons antigos da lista de beacons recentes
var BEACON_PoolRecentBeaconList = function(){
	
	for (var i = BEACON_RecentBeaconList.length; i; i--) {
		if((Date.now() - BEACON_RecentBeaconList[i-1]['time']) > BEACON_RemoveFromListAfterMs){
			BEACON_RecentBeaconList.splice(i-1, 1);
		}
	}
}


//============================== MQTT ================================


 // Tenta reconectar no broker MQTT
 var MQTT_Reconnect = function(){
   console.log('[MQTT] Tentando conectar ao broker IPv4:'+MQTT_IPv4_addr);
   MQTT_Server = mqtt.connect('mqtt:' + MQTT_IPv4_addr);
 };


 // Atua ao receber uma publicação
MQTT_Server.on('message', function (topic, message) {

	// Evento de GPIO. Devemos enviar o beacon com menor RSSI e dentro do threshold.
	if(topic == MQTT_GPIO_Event_FullTopic){

		if( message == "1" ){
			MQTT_GPIOEvent_SendNear_Flag = true;
			console.log('[MQTT] Requisição do beacon mais próximo recebida.');
		}

		if( message == "0" ){
			MQTT_GPIOEvent_SendNear_Flag = false;
			console.log('[MQTT] Requisição do beacon mais próximo terminada.');
		}
	}
});


MQTT_Server.on('connect', function () {
	console.log('[MQTT] Conectado ao broker IPv4:' + MQTT_IPv4_addr);
	MQTT_Connected = true;

	// Completa os nomes dos tópicos
	MQTT_NearBeacons_FullTopic      = '/' + RASPI_unique_id + MQTT_NearBeacons_Topic;
	MQTT_GPIO_Event_FullTopic       = '/' + RASPI_unique_id + MQTT_GPIO_Event_Topic;
	MQTT_NearBeacons_Near_FullTopic = '/' + RASPI_unique_id + MQTT_NearBeacons_Near_Topic;


	// Se inscreve no tópico de eventos de GPIO.
	MQTT_Server.subscribe(MQTT_GPIO_Event_FullTopic);
});


 MQTT_Server.on('close', function () {
   console.log('[MQTT] Desconectado do broker IPv4:' + MQTT_IPv4_addr);
   MQTT_Connected = false;
   setTimeout(MQTT_Reconnect, MQTT_ReqTimeout);
 });

 exports.BEACON_InitScan = BEACON_InitScan;
