/**
 * Lógica de inicialização do Blockly e definição dos blocos para o jogo de Labirinto.
 * * Define os geradores de código que chamam as funções reais do HTML (window.moveForward, window.turn, etc.).
 * * Implementa as funções globais de execução (executeProgram e stopProgram) que leem o workspace.
 * * NOTA: Este arquivo deve ser carregado APÓS o HTML, que define as funções globais de jogo.
 */

// Se estiver usando Electron (ambiente original) ou um fallback para o navegador
const { loadAssetsGroup } = window.electronAPI ? window.electronAPI.utils : { loadAssetsGroup: async () => {} };
let workspaceMaze = null;


// --- 1. DEFINIÇÃO DOS ASSETS DO BLOCKLY ---
const assetsToLoad = {
    blocklyCore: [
        {
            name: "blockly_min",
            type: "js",
            path: `${window.paths.blockly.core}blockly.min.js`,
        },
        {
            name: "javascript_compressed", 
            type: "js",
            path: `${window.paths.blockly.core}javascript_compressed.js`,
        },
    ],
    blocklyMsg: [
        { name: "pt-br", type: "js", path: `${window.paths.blockly.msg}pt-br.js` },
    ],
};


// --- 2. DEFINIÇÃO DOS BLOCOS CUSTOMIZADOS E GERADORES ---

function defineMazeBlocksAndGenerators() {
    
    // --- BLOCO: Repetir Enquanto Caminho Livre (controls_while_path) ---
    Blockly.Blocks['controls_while_path'] = {
        init: function() {
            this.appendDummyInput()
                .appendField("repetir enquanto caminho")
                .appendField(new Blockly.FieldDropdown([
                    ["à frente", "FORWARD"],
                    ["à esquerda", "LEFT"],
                    ["à direita", "RIGHT"]
                ]), "DIRECTION")
                .appendField("livre");
            this.appendStatementInput("DO")
                .setCheck(null)
                .appendField("fazer");
            this.setPreviousStatement(true, null);
            this.setNextStatement(true, null);
            this.setColour(120); // Cor Verde (Controle)
            this.setTooltip("Repete a ação enquanto o caminho na direção especificada estiver livre.");
            this.setHelpUrl("");
        }
    };

    Blockly.JavaScript.forBlock['controls_while_path'] = function(block) {
        const direction = block.getFieldValue('DIRECTION');
        let branch = Blockly.JavaScript.statementToCode(block, 'DO') || '';
        
        if (branch.endsWith('\n')) branch = branch.slice(0, -1);

        const indented = branch.split('\n').map(line => line ? '  ' + line : '').join('\n');

        // Código JS usa 'await window.isPath' para checagem assíncrona
        const code = `while (window.isRunning && await window.isPath('${direction}')) {\n${indented}\n}\n`;
        return code;
    };


    // --- BLOCO: Se caminho... Senão... (controls_if_else_path) ---
    Blockly.Blocks['controls_if_else_path'] = {
        init: function() {
            this.appendDummyInput()
                .appendField("se caminho")
                .appendField(new Blockly.FieldDropdown([
                    ["à frente", "FORWARD"],
                    ["à esquerda", "LEFT"],
                    ["à direita", "RIGHT"]
                ]), "DIRECTION")
                .appendField("livre");
            this.appendStatementInput("DO")
                .setCheck(null)
                .appendField("fazer");
            this.appendStatementInput("ELSE")
                .setCheck(null)
                .appendField("senão fazer");
            this.setPreviousStatement(true, null);
            this.setNextStatement(true, null);
            this.setColour(120);
            this.setTooltip("Se o caminho na direção especificada estiver livre, executa a primeira ação, senão, executa a segunda.");
            this.setHelpUrl("");
        }
    };

    Blockly.JavaScript.forBlock['controls_if_else_path'] = function(block) {
        const direction = block.getFieldValue('DIRECTION');
        let branchIf = Blockly.JavaScript.statementToCode(block, 'DO') || '';
        let branchElse = Blockly.JavaScript.statementToCode(block, 'ELSE') || '';
        const indentedIf = branchIf.trim().split('\n').map(line => line ? '  ' + line : '').join('\n');
        const indentedElse = branchElse.trim().split('\n').map(line => line ? '  ' + line : '').join('\n');
        
        const code = `if (await window.isPath('${direction}')) {\n${indentedIf}\n} else {\n${indentedElse}\n}\n`;
        return code;
    };

    // --- BLOCO: Mover para frente (maze_moveForward) ---
    Blockly.Blocks['maze_moveForward'] = {
        init: function() {
            this.appendDummyInput()
                .appendField("mover para frente");
            this.setPreviousStatement(true, null);
            this.setNextStatement(true, null);
            this.setColour(300); // Cor de Movimento
            this.setTooltip("Move o Robô Zoy uma casa na direção atual.");
            this.setHelpUrl("");
        }
    };

    Blockly.JavaScript.forBlock['maze_moveForward'] = function(block) {
        const code = `await window.moveForward();\n`;
        return code;
    };

    // --- BLOCO: Virar (maze_turn) ---
    Blockly.Blocks['maze_turn'] = {
        init: function() {
            this.appendDummyInput()
                .appendField("virar")
                .appendField(new Blockly.FieldDropdown([
                    ["para direita", "RIGHT"],
                    ["para esquerda", "LEFT"]
                ]), "DIRECTION");
            this.setPreviousStatement(true, null);
            this.setNextStatement(true, null);
            this.setColour(300); // Cor de Movimento
            this.setTooltip("Gira o Robô Zoy para a direita ou esquerda.");
            this.setHelpUrl("");
        }
    };

    Blockly.JavaScript.forBlock['maze_turn'] = function(block) {
        const direction = block.getFieldValue('DIRECTION');
        const code = `await window.turn('${direction}');\n`;
        return code;
    };
    
    // --- BLOCO: Repetição simples (controls_repeat_simple) ---
    Blockly.Blocks['controls_repeat_simple'] = {
      init: function() {
        this.appendDummyInput()
            .appendField("repetir")
            .appendField(new Blockly.FieldNumber(4, 0), "TIMES")
            .appendField("vezes");
        this.appendStatementInput("DO")
            .setCheck(null);
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour(120);
        this.setTooltip("Repete o bloco de código por um número específico de vezes.");
        this.setHelpUrl("");
      }
    };

    Blockly.JavaScript.forBlock['controls_repeat_simple'] = function(block) {
        const repeats = Number(block.getFieldValue('TIMES')) || 0;
        let branch = Blockly.JavaScript.statementToCode(block, 'DO') || '';
        if (branch.endsWith('\n')) branch = branch.slice(0, -1);
        const indented = branch.split('\n').map(line => line ? '  ' + line : '').join('\n');
        const code = `for (let i = 0; i < ${repeats}; i++) {\n${indented}\n}\n`;
        return code;
    };

    
    // --- BLOCO: If com verificação de caminho (controls_if_path) ---
    Blockly.Blocks['controls_if_path'] = {
      init: function() {
        this.appendDummyInput()
            .appendField("se caminho")
            .appendField(new Blockly.FieldDropdown([
                ["à frente", "FORWARD"],
                ["à esquerda", "LEFT"],
                ["à direita", "RIGHT"]
            ]), "DIRECTION")
            .appendField("livre");
        this.appendStatementInput("DO")
            .setCheck(null)
            .appendField("fazer");
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour(120);
        this.setTooltip("Executa o bloco de código se o caminho na direção especificada estiver livre.");
        this.setHelpUrl("");
      }
    };

    Blockly.JavaScript.forBlock['controls_if_path'] = function(block) {
        const direction = block.getFieldValue('DIRECTION');
        let branch = Blockly.JavaScript.statementToCode(block, 'DO') || '';
        if (branch.endsWith('\n')) branch = branch.slice(0, -1);
        const indented = branch.split('\n').map(line => line ? '  ' + line : '').join('\n');
        const code = `if (await window.isPath('${direction}')) {\n${indented}\n}\n`;
        return code;
    };
    
}


// --- 3. INICIALIZAÇÃO DO WORKSPACE ---
function initBlocklyMaze() {
    const blocklyDiv = document.getElementById('blocklyGameWorkspace');
    const toolbox = document.getElementById('toolboxMaze');

    const options = {
        toolbox: toolbox,
        // ** Manter scrollbars: true ** - O CSS no HTML esconde o elemento SVG, resolvendo o problema
        scrollbars: true, 
        horizontalLayout: false,
        media: `${window.paths.blockly.core}media/`, 
        rtl: false,
        renderer: 'zelos', 
        theme: Blockly.Themes.Classic,
    };
    
    window.workspaceMaze = Blockly.inject(blocklyDiv, options); 

    
    // Adiciona listener para atualizar o código gerado em tempo real
    window.workspaceMaze.addChangeListener(window.updateCodeDisplay);
    
    const onResize = () => {
        if (window.workspaceMaze) {
            Blockly.svgResize(window.workspaceMaze);
        }
    };
    
    // Adiciona o listener de resize padrão
    window.addEventListener('resize', onResize, false);
    
    // Chama imediatamente e depois com um pequeno atraso para garantir o dimensionamento correto
    onResize();
    setTimeout(onResize, 100); 
}


// --- 4. FUNÇÕES GLOBAIS DE EXECUÇÃO ---

/**
 * Função global que inicia a execução do código. Chamada pelo botão "Executar Programa" no HTML.
 */
window.executeProgram = async function() {
    if (!window.workspaceMaze) {
        window.updateStatus("ERRO: Workspace do Blockly não inicializado.", 'bg-red-200', 'text-red-900');
        return;
    }

    const runBtn = document.getElementById('btnExecutarPrograma');
    const stopBtn = document.getElementById('btnPararPrograma');
    
    window.resetGame(); // Garante que o jogo esteja no estado inicial
    
    // 1. Obtém o código final (chamando a função definida no HTML)
    const code = window.updateCodeDisplay(); 
    
    // Verifica se o código está vazio ou incompleto
    const isCodeEmpty = code.trim().length < 30;
    
    if (isCodeEmpty) {
        window.updateStatus("ERRO: Nenhum bloco conectado ao programa principal.", 'bg-yellow-200', 'text-yellow-800');
        return;
    }

    // 2. Prepara e Inicia a execução
    runBtn.disabled = true;
    stopBtn.disabled = false;
    window.isRunning = true;
    window.updateStatus("Executando programa...", 'bg-blue-200', 'text-blue-800');

    try {
        // 3. Executa o código gerado usando eval()
        // O código é envolvido em uma IIFE assíncrona no HTML, garantindo que 'await' funcione.
        await eval(code); 
        
        if (window.isRunning) {
             window.updateStatus("Programa concluído com sucesso!", 'bg-green-200', 'text-green-800');
        }
        
    } catch (error) {
        if (error.message !== 'Game Over' && error.message !== 'Collision or Game Over') {
            window.updateStatus(`FALHA DE EXECUÇÃO: ${error.message}`, 'bg-red-200', 'text-red-900');
            console.error("Erro na execução do programa Blockly:", error);
        }
    } finally {
        window.isRunning = false;
        runBtn.disabled = false;
        stopBtn.disabled = true;
    }
};

/**
 * Função global que interrompe a execução do código. Chamada pelo botão "Parar" no HTML.
 */
window.stopProgram = function() {
    window.isRunning = false; 
    window.updateStatus("Execução interrompida pelo usuário.", 'bg-gray-200', 'text-gray-700');
    document.getElementById('btnExecutarPrograma').disabled = false;
    document.getElementById('btnPararPrograma').disabled = true;
};


// --- 5. EXECUÇÃO DA INICIALIZAÇÃO ---

document.addEventListener("DOMContentLoaded", async () => {
    try {
        if (window.electronAPI) {
             // PASSO 1: Carrega os scripts do Blockly (Core e JavaScript Generator)
            await loadAssetsGroup(assetsToLoad.blocklyCore);
            
            // Cria a referência global ao gerador após o carregamento assíncrono.
            window.jsGenerator = Blockly.JavaScript;
            
            // PASSO 2: Registramos os blocos
            defineMazeBlocksAndGenerators(); 
            // PASSO 3: Carrega as mensagens de tradução (opcionalmente)
            await loadAssetsGroup(assetsToLoad.blocklyMsg);
        } else {
             // Fallback simples para ambiente de teste sem electron
             defineMazeBlocksAndGenerators(); 
             window.jsGenerator = Blockly.JavaScript; // Cria a referência
        }

        // PASSO 4: Inicializa o Workspace e injeta na DOM
        initBlocklyMaze();
        
        // PASSO 5: Chama a atualização do código
        window.updateCodeDisplay();

    } catch (error) {
        console.error("Erro durante a inicialização do Zoy Jogos:", error);
    }
});