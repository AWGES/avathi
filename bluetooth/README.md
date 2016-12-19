Escaneamento de Beacons e envio por MQTT
========================================


O script em `BeaconScan.js` implementa a leitura de *beacons* BLE e envio dos mesmos por MQTT.

### Funcionamento

Somente *beacons* cujo RSSI é superior à um *threshold* são levados em consideração. Este *threshold* é configurável.

Uma lista de *beacons* recentes é mantida e utilizada para evitar sobrecarga do servidor.
A lista mantém um *timestamp* local de quando o *beacon* foi escaneado por último.
Quando a diferença de tempo entre o *timestamp* e o tempo atual é superior à um valor configurável, o *beacon* é removido da lista.
Se um *beacon* for escaneado e não estiver presente na lista, o mesmo é enviado via MQTT e adicionado à mesma.
A lista, portanto, atua como um *debounce*, evitando múltiplos envios do mesmo *beacon* em uma curta janela de tempo.

O script também recebe publicações em um tópico MQTT configurável para responder com um *beacon* próximo.
Ao receber a mensagem **1** neste tópico, uma flag é setada. Ao receber **0**, esta flag é resetada.
Ao receber um *beacon* dentro do *threshold* geral, o script verifica a flag.
Se ela estiver setada, o RSSI do *beacon* é verificado novamente, desta ver com um *threshold* maior ainda.
Isto indicaria um *beacon* muito próximo. O script então envia este beacon e reseta a flag.


## Configurações

Podem ser configurados através de variáveis de ambiente:

+ Endereço do broker MQTT
+ Tempo entre cada tentativa de reconexão com o broker
+ Tópico de envio de *beacons*
+ Tópico de requisição de *beacon* muito próximo
+ Tópico de resposta de *beacon* muito próximo

+ Threshold geral de detecção de *beacons*
+ Threshold de detecção de *beacon* muito próximo
+ Tempo de vida do *beacon* na lista de *beacons* recentes
+ Tempo entre cada verificação da lista (para remoção)
