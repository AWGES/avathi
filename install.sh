#!/bin/bash

# Instalador para sistema local (andar) ATHIVA
# Ainda não foi testado.
# Devem ser adicionados os requisitos do GPIO e permissões do noble.
# Deve ser verificada a instalaçõ do NVM e tentar evitar ter que relogar.



####### CONFIGURAÇÕES #######

# Scripts do projeto para rodar. Serão inseridos no start.sh.
BLE_EXEC="bluetooth/main.js"
GPIO_EXEC="gpio/main.js"

AVATHI_LOG_DIR="/var/log/avathi"	# Diretório onde salvar os LOGs do projeto
BLE_LOG_FILE="bluetooth.log"		# Arquivo onde salvar o LOG do script de bluetooth/escaneamento de beacons
GPIO_LOG_FILE="gpio.log"		# Arquivo onde salvar o LOG do script de leitura/escrita nos GPIOs (botões e sinalização)

#############################





# Obtém o diretório do projeto. O diretório do projeto é o diretório raiz onde se encontram
# os scripts start.sh, stop.sh e install.sh. O diretório do projeto NÃO É o local de onde o
# script " install.sh ' foi executado, mas sim onde ele efetivamente se encontra.
INST_SH_DIR="$(readlink -f $0)"
PROJECT_DIR="$(dirname $INST_SH_DIR)"

cd $PROJECT_DIR

{
 echo "== INSTALADOR UNIDADE REMOTA AVATHI =="
 date +"%a %x %T"

 echo "Diretório do projeto: $PROJECT_DIR"
 echo "Gerando script de inicialização"
} | tee -a install.log


######## Geração do script de inicialização ##############
cat << EOF > avathi_init
#!/bin/sh

START_SCRIPT = "$PROJECT_DIR/start.sh"

# Fecha o script se a interface de rede iniciada não for a wireless
if [ ! "\$IFACE" = wlan0 ]; then
        exit 0
fi
EOF
######## Fim da geração do script de inicialização #######




{
echo "Gerando start.sh"

# Copia esqueleto
cp install-src/start-skeleton ./start.sh

# Aplica configurações nos locais adequados
sed 's@## SKELETON: EXEC SCRIPTS ##@BLE_EXEC="'$BLE_EXEC'"\nGPIO_EXEC="'$GPIO_EXEC'"@' -i start.sh
sed 's@## SKELETON: LOG PATHS ##@AVATHI_LOG_DIR_LOG_DIR="'$AVATHI_LOG_DIR'"\nBLE_LOG_FILE="'$BLE_LOG_FILE'"\nGPIO_LOG_FILE="'$GPIO_LOG_FILE'"@' -i start.sh
sed 's@## SKELETON: AVATHI DIR ##@AVATHI_DIR="'$PROJECT_DIR'"@' -i start.sh

chmod +x start.sh



echo "Gerando stop.sh"

# Copia esqueleto
cp install-src/stop-skeleton ./stop.sh

sed -i 's@## SKELETON: EXEC SCRIPTS ##@BLE_EXEC="'$BLE_EXEC'"\nGPIO_EXEC="'$GPIO_EXEC'"@' stop.sh
sed -i 's@## SKELETON: AVATHI DIR ##@AVATHI_DIR="'$PROJECT_DIR'"@' stop.sh

chmod +x stop.sh





# Baixa e instala o NVM
curl -o- https://raw.githubusercontent.com/creationix/nvm/v0.32.1/install.sh | bash
# Recarrega o bashrc, que agora incluirá o NVM
source ~/.bashrc

# Instala node versão 7.2.1 e define como padrão
nvm install 7.2.1
nvm alias default 7.2.1
nvm use default

## GPIO ####################

# Instala pacotes necessários para a parte de GPIO




## BLUETOOTH ###############

# Instala pacotes necessários para a parte de bluetooth
sudo apt-get install bluetooth bluez libbluetooth-dev libudev-dev
npm install noble





} | tee -a install.log
