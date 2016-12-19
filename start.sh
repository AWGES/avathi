#!/bin/bash


## Configurações ###########

export MQTT_ADDR="127.0.0.1"								# Endereço do broker MQTT
export MQTT_REQ_TIMEOUT=3000								# Tempo de reconexão com o broker
export MQTT_CALLS_SUB_TOPIC="/calls"						# Tópico para publicação das chamadas iniciadas pelo botão
export MQTT_GPIO_EVENT_SUB_TOPIC="/GPIOe"					# Tópico que envia requisição de beacon muito próximo
export MQTT_NEAR_BEACONS_SUB_TOPIC="/nearBeacon"			# Tópico para enviar todos os beacons próximos
export MQTT_NEAREST_BEACON_SUB_TOPIC="/nearBeacon/near"		# Tópico para resposta da requisição de beacon muito próximo


export BLE_NEAR_RSSI_THRESHOLD=-50				# Threshold de detecção geral do beacon
export BLE_NEAREST_RSSI_THRESHOLD=-15			# Threshold de detecção do beacon muito próximo
export BLE_REMOVE_FROM_LIST_AFTER_MS=5000		# Quanto tempo esperar até remover o beacon da lista de beacons recentes
export BLE_POOL_TIME_MS=1000					# De quanto em quanto tempo verificar a lista para executar remoções

export ATHIVA_LOG_DIR="/var/log/ATHIVA"			# Diretório onde salvar os LOGs do projeto
export BLE_LOG_FILE="bluetooth.log"				# Arquivo onde salvar o LOG do script de bluetooth/escaneamento de beacons
export GPIO_LOG_FILE="gpio.log"					# Arquivo onde salvar o LOG do script de leitura/escrita nos GPIOs (botões e sinalização)




## Operações antes de iniciar os scripts ##########

 export BLE_LOG_FULL="$ATHIVA_LOG_DIR/$BLE_LOG_FILE"
 export GPIO_LOG_FULL="$ATHIVA_LOG_DIR/$GPIO_LOG_FILE"

 # Testa se os arquivos de LOG existem, criando-os em caso contrário

  if [ ! -d $ATHIVA_LOG_DIR ]; then
	echo "Diretório não existe. Criando..."
        sudo mkdir $ATHIVA_LOG_DIR
        sudo chown pi:pi $ATHIVA_LOG_DIR
  fi


  if [ ! -f $BLE_LOG_FULL ]; then
	echo "Log BLE não existe. Criando..."
	sudo touch $BLE_LOG_FULL
	sudo chown pi:pi "$BLE_LOG_FULL"
  fi


  if [ ! -f $GPIO_LOG_FULL ]; then
	echo "Log GPIO não existe. Criando..."
        sudo touch $GPIO_LOG_FULL
        sudo chown pi:pi "$GPIO_LOG_FULL"
  fi


 # Indica início de uma nova execução dos crips nos LOGs
  echo `date +"%a %x %T"` >> $BLE_LOG_FULL
  echo "Iniciando sistema local - bluetooth" >> $BLE_LOG_FULL

  echo `date +"%a %x %T"` >> $GPIO_LOG_FULL
  echo "Iniciando sistema local - GPIO" >> $GPIO_LOG_FULL


## Inicialização dos scripts ##########

node bluetooth/main.js >> $BLE_LOG_FULL &
#node gpio/main.j >> $GPIO_LOG_FILE
