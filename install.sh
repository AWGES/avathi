#!/bin/bash

# Instalador para sistema local (andar) ATHIVA
# Ainda não foi testado.
# Devem ser adicionados os requisitos do GPIO e permissões do noble.
# Deve ser verificada a instalaçõ do NVM e tentar evitar ter que relogar.

if [ ! $1 -eq c ]; then
	curl -o- https://raw.githubusercontent.com/creationix/nvm/v0.32.1/install.sh | bash
	echo "Deslogar, relogar e rodar o script com a opção -c para continuar."
	exit 0
fi

nvm install 6.9.0
nvm alias default 6.9.0
nvm use default

## GPIO ####################





## BLUETOOTH ###############

sudo apt-get install bluetooth bluez libbluetooth-dev libudev-dev
npm install noble
