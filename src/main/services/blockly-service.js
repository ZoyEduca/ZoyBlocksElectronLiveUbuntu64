const serialService = require('./serial-services'); // Renomeado para service

async function executarCodigo(codigoPython) {
    const logs = [];
    // Removida a array 'comandosEnviados' e o 'Promise.all'

    const regex = /(\w+)\((.*?)\)/g;
    let match;

    logs.push(`[INFO] Código recebido:\n${codigoPython}`);

    // Loop para extrair e enviar comandos sequencialmente
    while ((match = regex.exec(codigoPython)) !== null) {
        const funcao = match[1];
        const argsString = match[2];
        const args = argsString
            .split(',')
            .map(arg => arg.trim().replace(/^['"]|['"]$/g, ''));

        const comando = args[0];
        const argumentos_comando = args.slice(1).join(',');
        let comandoSerial = null;

        //  === Funções enviadas dos blocos do Blockly para os dispositivos via serial ===
        try {
            switch (funcao) {
                case 'led_pisca_n':
                case 'led_left':
                case 'led_right':
                case 'pausa':       // Comandos temporais agora gerenciados pela fila do serialService
                case 'som_nota':
                case 'motor_esquerdo_frente':
                case 'motor_direito_frente':
                case 'motor_esquerdo_tras':
                case 'motor_direito_tras':
                case 'set_pin_mode':
                case 'digital_write':
                case 'definir_pino_digital':
                case 'analog_write':
                case 'ler_ultrassom':
                case 'servo':       // Comandos temporais agora gerenciados pela fila do serialService
                case 'servo360':
                case 'mover_frente':
                case 'mover_tras':
                case 'parar_motor':
                case 'iniciar_zoy':
                    comandoSerial = `<${comando}:${argumentos_comando}>`;
                    break;
                default:
                    logs.push(`[AVISO] Função desconhecida: ${funcao}`);
            }

            if (comandoSerial) {
                logs.push(`[INFO] Traduzido para: ${comandoSerial}`);
                
                // === PONTO CRÍTICO DE MUDANÇA ===
                // Chamamos o serviço serial. Ele adiciona o comando à fila interna
                // e retorna UMA PROMESSA que resolve IMEDIATAMENTE.
                const resultadoEnvio = await serialService.enviarComandoSerial(comandoSerial);
                
                if (!resultadoEnvio.status) {
                    logs.push(`[ERRO] Falha ao adicionar à fila: ${resultadoEnvio.mensagem}`);
                    // O erro aqui significa que a porta não estava aberta, por exemplo.
                    // Podemos optar por quebrar a execução ou continuar. Vamos quebrar:
                    throw new Error(`Falha de conexão: ${resultadoEnvio.mensagem}`);
                }
                // Se o resultado for status: true, o comando foi colocado na fila com sucesso.
                // A execução da fila é tratada internamente pelo serialService.
                // Não há necessidade de 'await' para a *conclusão* da ação aqui, apenas para a *aceitação* da fila.

            } else {
                logs.push(`[AVISO] Comando serial não gerado para: ${funcao}`);
            }

        } catch (err) {
            logs.push(`[ERRO] Erro ao processar ${funcao}: ${err.message}`);
            // Se houver um erro, paramos a execução do código de alto nível.
            return { status: false, mensagem: "Erro ao processar/enviar comandos", logs };
        }
    }
    
    // NOTA: O fluxo de execução do código de alto nível (Blockly) agora terminou.
    // Os comandos ainda podem estar sendo executados na fila do serialService.
    
    logs.push(`[SUCESSO] Todos os comandos foram adicionados à fila de execução com sucesso.`);
    return { status: true, mensagem: "Execução (Adição à fila) concluída", logs };
}

module.exports = { executarCodigo };