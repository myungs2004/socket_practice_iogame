const express = require('express'); 
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.use(express.static(__dirname));
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

let players = {};
let foods = [];
let bombs= [];
let gameOver = false;
let winnerId = null;
let playerCounter = 1;

function initGame() {
    foods = [];
    bombs = [];
    gameOver = false;
    winnerId = null;

    for (let i = 0; i < 30; i++) {
        foods.push({
            x: Math.random() * 580 + 10,
            y: Math.random() * 580 + 10,
            color: `hsl(${Math.random() * 360}, 70%, 50%)`
        });
    }

    for (let i = 0; i < 5; i++) {
        bombs.push({
            x: Math.random() * 500 + 50,
            y: Math.random() * 500 + 50,
            radius: 12
        });
    }

    for (let id in players) {
        players[id].x = 300;
        players[id].y = 300;
        players[id].score = 10;
    }
}

initGame();

function checkFoodCollision(player) {
    foods.forEach((food) => {
        const dx = player.x - food.x;
        const dy = player.y - food.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < player.score) {
            player.score += 1; 
            food.x = Math.random() * 580 + 10;
            food.y = Math.random() * 580 + 10;
        }
    });
}

function checkPlayerCollision(attackerId, attacker) {
    for (let targetId in players) {
        if (attackerId === targetId) continue; // 자기 자신은 제외

        const target = players[targetId];
        const dx = attacker.x - target.x;
        const dy = attacker.y - target.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        const maxScore = Math.max(attacker.score, target.score);

        if (distance < maxScore) {
            if(attacker.score > target.score){
                attacker.score += Math.floor(target.score / 2); // 상대 점수의 절반 흡수
            
                target.x = Math.random() * 500 + 50;
                target.y = Math.random() * 500 + 50;
                target.score = 10;

            }else if (target.score > attacker.score) {

                target.score += Math.floor(attacker.score / 2);
                attacker.x = Math.random() * 500 + 50;
                attacker.y = Math.random() * 500 + 50;
                attacker.score = 10;
        
            }
        }
    }
}

function checkBombCollision(player) {
    bombs.forEach((bomb) => {
        const dx = player.x - bomb.x;
        const dy = player.y - bomb.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < player.score + bomb.radius) {
            const playerCount = Object.keys(players).length;

            if (playerCount <= 1) {

                player.x = Math.random() * 500 + 50;
                player.y = Math.random() * 500 + 50;
                player.score = 10;

            } else {
                player.score = Math.max(10, Math.floor(player.score / 2));
            }

            bomb.x = Math.random() * 500 + 50;
            bomb.y = Math.random() * 500 + 50;
        }
    });
}

io.on('connection', (socket) => {
    const randomColor = `hsl(${Math.floor(Math.random() * 360)}, 80%, 50%)`;
    const name = `Player ${playerCounter++}`;

    players[socket.id] = { 
        x: 300, 
        y: 300, 
        score: 10,
        color: randomColor, 
        name: name
    };

    socket.on('move', (data) => {

        if (gameOver){
            return;
        }
        
        const player = players[socket.id];
        if (player) {

            const speedFactor = Math.max(0.2, 10/ player.score);
            player.x += data.dx*speedFactor;
            player.y += data.dy*speedFactor;

            player.x = Math.max(10, Math.min(590, player.x));
            player.y = Math.max(10, Math.min(590, player.y));

            checkFoodCollision(player);
            checkPlayerCollision(socket.id, player);
            checkBombCollision(player);
            
            for(let id in players){
                if(player[id].score > 150){
                    player[id].score = 150;
                    gameOver = true;
                    winnerId = id;
                    break;
                }

            }
        }
    });

    socket.on('restart', () => {
        initGame();
    });

    socket.on('disconnect', () => {
        delete players[socket.id];
    });
});

setInterval(() => {
    io.emit('state', { players, foods, bombs, gameOver, winnerId});
}, 1000 / 30); 

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));