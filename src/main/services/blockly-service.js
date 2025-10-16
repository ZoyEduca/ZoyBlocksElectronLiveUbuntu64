const serialService = require('./serial-services');

async function executarCodigo(codigoPython) {
    const logs = [];
    const comandosEnviados = [];

    const regex = /(\w+)\((.*?)\)/g;
    let match;

    logs.push(`[INFO] Código recebido:\n${codigoPython}`);

    while ((match = regex.exec(codigoPython)) !== null) {
        const funcao = match[1];
        const argsString = match[2];
        const args = argsString
            .split(',')
            .map(arg => arg.trim().replace(/^['"]|['"]$/g, ''));

        let comandoSerial = null;

        try {
            switch (funcao) {
                case 'iniciar_zoy':
                    comandoSerial = `<INICIAR_ZOY>`;
                    break;
                case 'pausa':
                    comandoSerial = `<PAUSA:${args[0]}>`;
                    break;
                case 'som_nota':
                    comandoSerial = `<SOM_NOTA:${args[0]},${args[1]}>`;
                    break;
                case 'motor_esquerdo_frente':
                    comandoSerial = `<MOTOR_ESQUERDO_FRENTE:150>`;
                    break;
                case 'motor_direito_frente':
                    comandoSerial = `<MOTOR_DIREITO_FRENTE:150>`;
                    break;
                case 'motor_esquerdo_tras':
                    comandoSerial = `<MOTOR_ESQUERDO_TRAS:150>`;
                    break;
                case 'motor_direito_tras':
                    comandoSerial = `<MOTOR_DIREITO_TRAS:150>`;
                    break;
                case 'set_pin_mode':
                    comandoSerial = `<SET_PIN_MODE:${args[0]},${args[1]}>`;
                    break;
                case 'digital_write':
                    comandoSerial = `<DIGITAL_WRITE:${args[0]},${args[1]}>`;
                    break;
                // case 'definir_pino_digital': {
                //     const pino = args[0]; // D13
                //     const estado = args[1]; // HIGH
                //     comandoSerial = `<DIGITAL_WRITE:${pino},${estado}>`;
                //     break;
                // }
                case 'definir_pino_digital': {
                    comandoSerial = `<DIGITAL_WRITE:13,HIGH>`;
                    break;
                }
                case 'analog_write':
                    comandoSerial = `<ANALOG_WRITE:${args[0]},${args[1]}>`;
                    break;
                case 'ler_ultrassom':
                    comandoSerial = `<ULTRASSOM:${args[0]},${args[1]}>`;
                    break;
                case 'servo':
                    comandoSerial = `<SERVO_ANGULO:${args[0]},${args[1]}>`;
                    break;
                case 'servo360':
                    comandoSerial = `<SERVO_360:${args[0]},${args[1]}>`;
                    break;

                // Se quiser permitir comandos genéricos:
                case 'mover_frente':
                case 'mover_tras':
                case 'led_pisca_n':
                    if (args.length >= 2) {
                        comandoSerial = `<${args[0]}:${args[1]}>`;
                    }
                    break;

                default:
                    logs.push(`[AVISO] Função desconhecida: ${funcao}`);
            }

            if (comandoSerial) {
                logs.push(`[INFO] Traduzido para: ${comandoSerial}`);
                comandosEnviados.push(serialService.enviarComandoSerial(comandoSerial));
            } else {
                logs.push(`[AVISO] Comando serial não gerado para: ${funcao}`);
            }

        } catch (err) {
            logs.push(`[ERRO] Erro ao processar ${funcao}: ${err.message}`);
        }
    }

    try {
        await Promise.all(comandosEnviados);
        logs.push(`[SUCESSO] Todos os comandos enviados com sucesso.`);
        return { status: true, mensagem: "Execução concluída", logs };
    } catch (error) {
        logs.push(`[ERRO] Falha no envio serial: ${error.message}`);
        return { status: false, mensagem: "Erro ao executar comandos", logs };
    }
}

module.exports = { executarCodigo };
