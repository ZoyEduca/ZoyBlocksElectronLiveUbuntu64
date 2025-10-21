const { SerialPort, ReadlineParser } = require('serialport');
const { BrowserWindow } = require('electron');

let serialPort = null;
let parser = null;

// ==== NOVAS VARIÁVEIS PARA CONTROLE DE FLUXO (QUEUE) ====
const commandQueue = [];
let isWaitingForAck = false; // TRUE se estamos esperando PAUSA_FIM, SERVO_FIM, etc.
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
    
    // NOVO: TRATAMENTO DE ACK/FIM DE AÇÃO DO ARDUINO
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

// NOVO: Função interna para enviar comandos, sem gerenciar a fila
async function enviarComandoSerialImmediate(comando) {
    if (!serialPort || !serialPort.isOpen) {
        throw new Error('Dispositivo não conectado.');
    }

    const comandoBuffer = Buffer.from(comando + '\n', 'utf-8');

    await new Promise((resolve, reject) => {
        serialPort.write(comandoBuffer, (err) => {
            if (err) {
                return reject(err);
            }

            serialPort.drain((drainErr) => {
                if (drainErr) {
                    return reject(drainErr);
                }
                console.log(`[INFO] Comando enviado: ${comando}`);
                resolve();
            });
        });
    });

    return { status: true, mensagem: `Comando enviado: ${comando}` };
}

// NOVO: Função que verifica o estado e envia o próximo comando da fila
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
    
    // 2. Envia o comando
    enviarComandoSerialImmediate(nextCommand).then(() => {
        // Se o comando não exigia espera (isWaitingForAck é FALSE), envia o próximo imediatamente
        if (!isWaitingForAck) {
            // Usa setTimeout(0) para garantir que a pilha de chamadas não estoure com muitos comandos
            setTimeout(sendNextCommandFromQueue, 0); 
        }
        // Se exigia espera, o sendNextCommandFromQueue será chamado por 'PAUSA_FIM' ou 'SERVO_FIM'
    }).catch(error => {
        console.error(`[ERRO] Falha ao enviar comando da fila: ${error.message}`);
        
        // Em caso de falha no envio, libera a espera e tenta o próximo comando
        isWaitingForAck = false;
        setTimeout(sendNextCommandFromQueue, 0);
    });
}

// NOVO: Função pública para adicionar comandos à fila
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
};