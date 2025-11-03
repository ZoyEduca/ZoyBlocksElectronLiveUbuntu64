// serial-services.js

const { SerialPort, ReadlineParser } = require('serialport');
const { BrowserWindow } = require('electron');

let serialPort = null;
let parser = null;

// ==== VARIÁVEIS PARA CONTROLE DE FLUXO (QUEUE) ====
const commandQueue = [];
let isWaitingForAck = false; // TRUE se estamos esperando PAUSA_FIM, SERVO_FIM, etc.
// ========================================================

// ==== PROMESSAS PENDENTES PARA RESPOSTAS DE SENSORES ====
let pendingResolvers = {}; // Ex: { ULTRASSOM: resolveFn, ANALOG_READ: resolveFn }
// ========================================================

function enviarStatusSerial(data) {
    const allWindows = BrowserWindow.getAllWindows();
    allWindows.forEach(win => {
        if (!win.isDestroyed()) {
            win.webContents.send('onStatusSerial', data);
        }
    });
}

function enviarDadosSerial(dados) {
    const allWindows = BrowserWindow.getAllWindows();
    allWindows.forEach(win => {
        if (!win.isDestroyed()) {
            win.webContents.send('onDadosSerial', dados);
            win.webContents.send('onRespostaSerial', dados);
        }
    });

    // ======== TRATAMENTO DE RESPOSTAS DE SENSOR ==========
    if (dados.startsWith("DISTANCIA:")) {
        const valor = parseFloat(dados.split(":")[1]);
        if (pendingResolvers["ULTRASSOM"]) {
            pendingResolvers["ULTRASSOM"](valor);
            delete pendingResolvers["ULTRASSOM"];
        }
    }

    if (dados.startsWith("ANALOG_VALOR:")) {
        const valor = parseInt(dados.split(":")[1]);
        if (pendingResolvers["ANALOG_READ"]) {
            pendingResolvers["ANALOG_READ"](valor);
            delete pendingResolvers["ANALOG_READ"];
        }
    }

    if (dados.startsWith("DIGITAL_VALOR:")) {
        const valor = parseInt(dados.split(":")[1]);
        if (pendingResolvers["DIGITAL_READ"]) {
            pendingResolvers["DIGITAL_READ"](valor);
            delete pendingResolvers["DIGITAL_READ"];
        }
    }
    
    // TRATAMENTO DE ACK/FIM DE AÇÃO DO ARDUINO
    if (dados === 'PAUSA_FIM' || dados === 'SERVO_FIM') {
        if (isWaitingForAck) {
            isWaitingForAck = false; // Libera o fluxo
            console.log(`[ACK] FIM de Ação Temporal (${dados}) recebido. Liberando a fila...`);
            process.nextTick(sendNextCommandFromQueue); // Tenta enviar o próximo
        }
    }
}

async function listarPortas() {
    try {
        const ports = await SerialPort.list();
        const portPaths = ports.map(port => port.path);
        console.log(`[INFO] Portas encontradas: ${portPaths.join(', ')}`);
        return portPaths;
    } catch (error) {
        console.error("Erro ao listar portas:", error);
        return [];
    }
}

async function conectarPorta(porta, baudRate) {
    try {
        if (serialPort && serialPort.isOpen) {
            await serialPort.close();
        }

        serialPort = new SerialPort({
            path: porta,
            baudRate: baudRate,
        });

        serialPort.on('open', () => {
            console.log(`[INFO] Conectado à porta ${porta} com baudrate ${baudRate}`);
            enviarStatusSerial({ mensagem: `Conectado à porta ${porta}` });
        });

        parser = serialPort.pipe(new ReadlineParser({ delimiter: '\r\n' }));
        parser.on('data', data => {
            const trimmedData = data.toString().trim();
            if (trimmedData) {
                enviarDadosSerial(trimmedData); // Chama a função que trata ACK
            }
        });

        serialPort.on('close', () => {
            console.log(`[INFO] Desconectado da porta ${porta}`);
            enviarStatusSerial({ mensagem: `Desconectado da porta ${porta}` });
        });

        serialPort.on('error', (err) => {
            console.error(`[ERRO] Erro na porta serial: ${err.message}`);
            enviarStatusSerial({ mensagem: `Erro na porta serial: ${err.message}` });
        });
        
        return { status: true, mensagem: `Conectado à porta ${porta}` };
    } catch (error) {
        console.error("Erro ao conectar na porta:", error);
        enviarStatusSerial({ mensagem: `Falha ao conectar: ${error.message}` });
        return { status: false, mensagem: `Erro ao conectar: ${error.message}` };
    }
}

async function desconectarPorta() {
    if (serialPort && serialPort.isOpen) {
        try {
            // Limpa a fila e o estado de espera antes de fechar
            commandQueue.length = 0;
            isWaitingForAck = false; 
            
            await serialPort.close();
            console.log("[INFO] Desconectando...");
            return { status: true, mensagem: "Desconectado com sucesso." };
        } catch (error) {
            console.error("Erro ao desconectar:", error);
            return { status: false, mensagem: `Erro ao desconectar: ${error.message}` };
        }
    } else {
        return { status: false, mensagem: "Nenhum dispositivo conectado." };
    }
}

async function enviarComandoComRetorno(tag, comandoCompleto) {
    if (!serialPort || !serialPort.isOpen) {
        throw new Error("Dispositivo não conectado.");
    }

    return new Promise((resolve, reject) => {
        // Registra o "resolve" da promessa para este tipo de comando
        pendingResolvers[tag] = resolve;

        // Envia o comando imediatamente (sem fila, leitura direta)
        enviarComandoSerialImmediate(comandoCompleto, (err) => {
            if (err) {
                delete pendingResolvers[tag];
                reject(err);
            }
        });

        // Timeout de segurança caso não haja resposta
        setTimeout(() => {
            if (pendingResolvers[tag]) {
                delete pendingResolvers[tag];
                reject(new Error("Timeout aguardando resposta do sensor."));
            }
        }, 2000);
    });
}


// FUNÇÃO CHAVE: Usa callbacks para garantir que a escrita funciona (CORREÇÃO DE "NÃO CHEGA NADA")
function enviarComandoSerialImmediate(comando, callback) {
    if (!serialPort || !serialPort.isOpen) {
        return callback(new Error('Dispositivo não conectado.')); 
    }

    const comandoBuffer = Buffer.from(comando + '\n', 'utf-8');

    // Escreve os dados na porta
    serialPort.write(comandoBuffer, (err) => {
        if (err) {
            console.error(`[ERRO] Falha na escrita do comando: ${err.message}`);
            return callback(err); 
        }

        // Garante que o buffer foi totalmente esvaziado
        serialPort.drain((drainErr) => {
            if (drainErr) {
                console.error(`[ERRO] Falha no drain da serial: ${drainErr.message}`);
                return callback(drainErr);
            }
            console.log(`[INFO] Comando enviado: ${comando}`);
            callback(null); // Sucesso
        });
    });
}

// FUNÇÃO CHAVE: Envia o próximo comando da fila, usando o novo método de callback
function sendNextCommandFromQueue() {
    if (commandQueue.length === 0 || isWaitingForAck) {
        return; 
    }

    const nextCommand = commandQueue.shift();
    
    // 1. Verifica se o comando exige espera de ACK do Arduino
    const requiresAck = nextCommand.startsWith('<AGUARDA') || 
                        nextCommand.startsWith('<PAUSA') || 
                        nextCommand.startsWith('<A:') || 
                        nextCommand.startsWith('<C:');
    
    if (requiresAck) {
        isWaitingForAck = true; 
    }
    
    // 2. Envia o comando usando o método de callback
    enviarComandoSerialImmediate(nextCommand, (error) => {
        if (error) {
            console.error(`[ERRO] Falha ao enviar comando da fila: ${error.message}`);
            // Em caso de falha, libera a espera e tenta o próximo comando
            isWaitingForAck = false; 
            setTimeout(sendNextCommandFromQueue, 0);
            return;
        }
        
        // Se o envio foi BEM SUCEDIDO:
        
        // Se o comando NÃO exigia espera, envia o próximo imediatamente
        if (!isWaitingForAck) {
            setTimeout(sendNextCommandFromQueue, 0); 
        }
        // Se exigia espera, aguarda o ACK (PAUSA_FIM, etc.) para o próximo envio
    });
}

// Função pública para adicionar comandos à fila
async function adicionarComandoNaFila(comando) {
    if (!serialPort || !serialPort.isOpen) {
        return { status: false, mensagem: 'Dispositivo não conectado.' };
    }
    
    // Adiciona o comando à fila
    commandQueue.push(comando);
    
    // Inicia/Continua o processamento da fila
    if (!isWaitingForAck) {
        sendNextCommandFromQueue();
    }
    
    return { status: true, mensagem: `Comando adicionado à fila: ${comando}` };
}


module.exports = {
    listarPortas,
    conectarPorta,
    desconectarPorta,
    // Substitui a função de envio pela função que gerencia a fila
    enviarComandoSerial: adicionarComandoNaFila,
    enviarComandoComRetorno, // Função para comandos com retorno
};