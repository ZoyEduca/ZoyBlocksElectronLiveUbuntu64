/* -----------------------------------------------------------
   ZOY DINO — CONTROLE COM 1 SENSOR (ULTRASSOM) 
   ----------------------------------------------------------- 
*/

// Variável única para a distância, unificada com a lógica do Pong
let sensorDistancia = 100.0; 

let player;
let ground; // 
let obstacles = [];

let score = 0;
let scoreText;

let isDucking = false;
let isPlayGame = false; // Indica se o jogo não foi iniciado ou personagem morto

// Velocidade base dos obstáculos (movimento horizontal)
const BASE_SPEED = -350; 

// ------------------------ LEITURA SERIAL IPC (ADOTADA DO PONG) ------------------------
if (window.electronAPI && window.electronAPI.onDadosSerial) {
    window.electronAPI.onDadosSerial((serialData) => {
        const dataString = serialData.toString().trim();
        // Regex busca por qualquer número (inteiro ou flutuante)
        const distanceMatch = dataString.match(/(\d+\.?\d*)/); 

        if (distanceMatch) {
            const distance = parseFloat(distanceMatch[1]);
            // Limites de 5 a 40 cm, conforme usado no Pong para estabilidade
            sensorDistancia = Phaser.Math.Clamp(distance, 5, 40); 
        }
    });
}


// ------------------------ CONFIG DO JOGO ------------------------
const GAME_WIDTH = 960;
const GAME_HEIGHT = 540;
const GROUND_Y = GAME_HEIGHT - 40; // Posição Y do chão

const config = {
    type: Phaser.AUTO,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    parent: "game-container",
    physics: {
        default: "arcade",
        // MUDANÇA: ATIVADO o debug para visualização das caixas de colisão
        arcade: { gravity: { y: 1500 }, debug: true } 
    },
    scene: { preload, create, update }
};

new Phaser.Game(config);


// ------------------------ PRELOAD ------------------------
function preload() {
    this.load.image("dino", "sprites/dino.png");
    this.load.image("dino_duck", "sprites/dino_duck.png");
    this.load.image("ground", "sprites/ground.png");
    this.load.image("cactus", "sprites/cactus.png");
}


// ------------------------ CREATE ------------------------
function create() {

    // Jogo iniciado
    isPlayGame = true;

    this.cameras.main.setBackgroundColor('#f7f7f7'); 
    
    // Chão
    ground = this.physics.add.staticImage(GAME_WIDTH / 2, GROUND_Y, "ground");
    ground.setScale(1).refreshBody();

    // Dino
    // MUDANÇA: Ajuste a posição Y para garantir que toque o chão corretamente
    player = this.physics.add.sprite(120, GAME_HEIGHT - 75, "dino"); 
    player.setCollideWorldBounds(true);
    player.body.setMass(100); 

    this.physics.add.collider(player, ground);

    scoreText = document.getElementById("scoreDisplay");

    // Spawn de obstáculos
    this.time.addEvent({
        delay: 1500,
        callback: spawnObstacle,
        callbackScope: this,
        loop: true
    });
}


// ------------------------ FUNÇÃO DE CRIAR CACTO ------------------------
function spawnObstacle() {
    const scene = player.scene;

    // Cacto nasce na altura correta (ajustada para tocar o chão)
    const cactus = scene.physics.add.image(GAME_WIDTH + 40, GAME_HEIGHT - 75, "cactus"); 
    
    cactus.body.setAllowGravity(false); 
    cactus.setVelocityX(BASE_SPEED);
    cactus.setImmovable(true);
    cactus.setCollideWorldBounds(false);

    obstacles.push(cactus);

    scene.physics.add.collider(player, cactus, gameOver, null, scene);
}


// ------------------------ UPDATE LOOP ------------------------
function update() {

    // 1. Pontuação
    if (isPlayGame) {
        score++;
        // Exibe a pontuação e também o valor do sensor
        scoreText.innerHTML = `Score: ${Math.floor(score / 10)} | Distância: ${sensorDistancia.toFixed(1)} cm`; 
    } else {
         scoreText.innerHTML = `Score: ${Math.floor(score / 10)} (PARADO) | Distância: ${sensorDistancia.toFixed(1)} cm`;
    }

    // 2. Controle do Dino

    // ------------------------ SALTO (dist < 10) ------------------------
    // Só pula se estiver tocando o chão, não estiver abaixado, e não estiver em PAUSAR
    if (sensorDistancia < 10 && player.body.touching.down && !isDucking && isPlayGame) {
        player.setVelocityY(-800); 
    }

    // ------------------------ ABAIXAR (20 <= dist <= 30) ------------------------
    // Só abaixa se estiver tocando o chão e não estiver em PAUSAR
    if (sensorDistancia >= 20 && sensorDistancia <= 30 && player.body.touching.down && isPlayGame) {

        if (!isDucking) {
            isDucking = true;
            player.setTexture("dino_duck");
            player.y += 20; // Move para baixo
            
            // CORREÇÃO ESSENCIAL: Redimensiona o corpo de física e o centraliza
            player.body.setSize(player.width, player.height, true); 
        }

    } else if (isDucking && (sensorDistancia < 20 || sensorDistancia > 30 || isPlayGame)) {
        isDucking = false;
        player.setTexture("dino");
        player.y -= 20; // Move para cima

        // CORREÇÃO ESSENCIAL: Redimensiona o corpo de física e o centraliza
        player.body.setSize(player.width, player.height, true);
    }


    // Remove cactos que saíram da tela - Limpeza de Memória
    obstacles = obstacles.filter(o => {
        if (o.x < -50) { 
            o.destroy();
            return false;
        }
        return true;
    });
}


// ------------------------ GAME OVER ------------------------
function gameOver() {
    location.reload();
}

function goBack() {
    if (window.electronAPI && window.electronAPI.goBack) {
    window.electronAPI.goBack();
    } else {
    window.location.href = 'zoy_jogos.html';
    }
}