const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');
const User = require('./models/User');
const Game = require('./models/Game'); // 引入 Game 模型

const app = express();
app.use(cors());
app.use(express.json());

// === MongoDB 连接 ===
mongoose.connect('mongodb://127.0.0.1:27017/avalon')
  .then(() => console.log('✅ MongoDB Connected'))
  .catch(err => console.error(err));

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// === 全局唯一的办公室房间 ===
const OFFICE_ROOM = {
    id: 'OFFICE_HALL',
    players: [], 
    status: 'waiting', 
    hostName: '', 
    firstSpeaker: ''
};

// === API ===
app.get('/api/users', async (req, res) => {
    try {
        const users = await User.find({}, 'nickname').sort({ lastActiveAt: -1 });
        res.json(users);
    } catch (e) {
        res.status(500).json([]);
    }
});

// === 角色配置 ===
const ROLES = {
    MERLIN: 'Merlin', PERCIVAL: 'Percival', LOYAL: 'Loyal',
    MORGANA: 'Morgana', ASSASSIN: 'Assassin', MINION: 'Minion',
    OBERON: 'Oberon', MORDRED: 'Mordred'
};
// 蓝方（好人）角色集合
const BLUE_TEAM = [ROLES.MERLIN, ROLES.PERCIVAL, ROLES.LOYAL];

const CONFIG = {
    5: [ROLES.MERLIN, ROLES.PERCIVAL, ROLES.LOYAL, ROLES.MORGANA, ROLES.ASSASSIN],
    6: [ROLES.MERLIN, ROLES.PERCIVAL, ROLES.LOYAL, ROLES.LOYAL, ROLES.MORGANA, ROLES.ASSASSIN],
    7: [ROLES.MERLIN, ROLES.PERCIVAL, ROLES.LOYAL, ROLES.LOYAL, ROLES.MORGANA, ROLES.ASSASSIN, ROLES.OBERON],
    8: [ROLES.MERLIN, ROLES.PERCIVAL, ROLES.LOYAL, ROLES.LOYAL, ROLES.LOYAL, ROLES.MORGANA, ROLES.ASSASSIN, ROLES.MINION],
    9: [ROLES.MERLIN, ROLES.PERCIVAL, ROLES.LOYAL, ROLES.LOYAL, ROLES.LOYAL, ROLES.LOYAL, ROLES.MORGANA, ROLES.ASSASSIN, ROLES.MORDRED],
    10: [ROLES.MERLIN, ROLES.PERCIVAL, ROLES.LOYAL, ROLES.LOYAL, ROLES.LOYAL, ROLES.LOYAL, ROLES.MORGANA, ROLES.ASSASSIN, ROLES.MORDRED, ROLES.OBERON]
};

// === Socket 逻辑 ===
io.on('connection', (socket) => {
    
    // 1. 登录
    socket.on('login', async ({ nickname }) => {
        socket.nickname = nickname;
        let dbUser = await User.findOne({ nickname });
        if (!dbUser) { await User.create({ nickname }); } 
        else { dbUser.lastActiveAt = new Date(); await dbUser.save(); }

        const player = OFFICE_ROOM.players.find(p => p.name === nickname);
        
        if (player && player.isOnline) {
            if (player.id === socket.id) handleLoginSuccess(socket, nickname);
            else socket.emit('login_conflict', { nickname });
        } else {
            handleLoginSuccess(socket, nickname);
        }
    });

    // 2. 强制登录
    socket.on('force_login', ({ nickname }) => {
        socket.nickname = nickname;
        const player = OFFICE_ROOM.players.find(p => p.name === nickname);
        if (player && player.isOnline && player.id !== socket.id) {
            io.to(player.id).emit('force_logout');
        }
        handleLoginSuccess(socket, nickname);
    });

    // 3. 加入游戏
    socket.on('join_game', ({ nickname }) => {
        if (!nickname) return;
        socket.nickname = nickname;
        const playerIndex = OFFICE_ROOM.players.findIndex(p => p.name === nickname);
        
        if (playerIndex !== -1) {
            OFFICE_ROOM.players[playerIndex].id = socket.id;
            OFFICE_ROOM.players[playerIndex].isOnline = true;
            socket.join(OFFICE_ROOM.id);
            if (OFFICE_ROOM.status === 'playing') {
                sendGameInfoToPlayer(OFFICE_ROOM.players[playerIndex]);
            }
        } else {
            if (OFFICE_ROOM.status === 'playing') {
                socket.emit('error_msg', '游戏进行中，无法加入');
                return;
            }
            if (OFFICE_ROOM.players.length === 0) {
                OFFICE_ROOM.hostName = nickname;
                io.emit('room_status_changed', { hasRoom: true });
            }
            OFFICE_ROOM.players.push({
                id: socket.id,
                name: nickname,
                role: null,
                isReady: false,
                isOnline: true
            });
            socket.join(OFFICE_ROOM.id);
        }
        broadcastRoomUpdate();
    });

    // 4. 准备
    socket.on('toggle_ready', () => {
        const player = OFFICE_ROOM.players.find(p => p.id === socket.id);
        if (player) {
            player.isReady = !player.isReady;
            broadcastRoomUpdate();
        }
    });

    // 5. 开始
    socket.on('start_game', () => {
        if (socket.nickname !== OFFICE_ROOM.hostName) return;
        const count = OFFICE_ROOM.players.length;
        if (!CONFIG[count]) return io.to(OFFICE_ROOM.id).emit('error_msg', `人数 ${count} 不对`);
        if (OFFICE_ROOM.players.some(p => !p.isReady)) return io.to(OFFICE_ROOM.id).emit('error_msg', '还有人未准备');

        console.log('🚀 游戏开始');
        OFFICE_ROOM.status = 'playing';
        const roles = [...CONFIG[count]].sort(() => Math.random() - 0.5);
        const firstIndex = Math.floor(Math.random() * count);
        OFFICE_ROOM.firstSpeaker = OFFICE_ROOM.players[firstIndex].name;
        OFFICE_ROOM.players.forEach((p, i) => p.role = roles[i]);
        OFFICE_ROOM.players.forEach(player => sendGameInfoToPlayer(player));
    });

    // 6. 【核心修改】结算并重置
    socket.on('reset_game', async ({ winner, winReason }) => {
        if (socket.nickname !== OFFICE_ROOM.hostName) return;
        
        // 只有正在进行中的游戏才记录数据库
        if (OFFICE_ROOM.status === 'playing' && winner) {
            try {
                const playerRecords = [];
                
                // 遍历每个玩家，更新个人数据并构建历史记录
                for (const p of OFFICE_ROOM.players) {
                    const isBlue = BLUE_TEAM.includes(p.role);
                    // 判断个人输赢: 蓝方赢且你是蓝方 OR 红方赢且你是红方
                    const isWin = (winner === 'blue' && isBlue) || (winner === 'red' && !isBlue);

                    // 1. 更新 User 表
                    const updateData = {
                        $inc: { 
                            'stats.totalGames': 1, 
                            'stats.wins': isWin ? 1 : 0,
                            [`stats.roleUsage.${p.role}`]: 1 // 记录角色使用次数
                        },
                        lastActiveAt: new Date()
                    };
                    await User.updateOne({ nickname: p.name }, updateData);

                    // 2. 准备 Game 表的数据
                    playerRecords.push({
                        nickname: p.name,
                        role: p.role,
                        isWin: isWin
                    });
                }

                // 3. 写入 Game 表 (历史战绩)
                await Game.create({
                    roomId: 'OFFICE',
                    hostName: OFFICE_ROOM.hostName,
                    winner,
                    winReason,
                    endTime: new Date(),
                    firstSpeaker: OFFICE_ROOM.firstSpeaker,
                    players: playerRecords,
                    isBackfill: false
                });

                console.log(`✅ 游戏结算完成: ${winner} 胜`);
                
                // 广播游戏结束消息 (带结果)
                io.to(OFFICE_ROOM.id).emit('game_over', { winner, winReason });

            } catch (error) {
                console.error('❌ 结算保存失败:', error);
                socket.emit('error_msg', '数据保存失败，请联系管理员');
            }
        } else {
             // 只是在大厅重置，或者异常结束
             io.to(OFFICE_ROOM.id).emit('game_over', { });
        }

        // 重置房间状态
        OFFICE_ROOM.status = 'waiting';
        OFFICE_ROOM.firstSpeaker = '';
        OFFICE_ROOM.players.forEach(p => { 
            p.role = null; 
            p.isReady = false; 
        });
        broadcastRoomUpdate();
    });

    // 7. 踢人
    socket.on('kick_player', (targetName) => {
        if (socket.nickname !== OFFICE_ROOM.hostName) return;
        const target = OFFICE_ROOM.players.find(p => p.name === targetName);
        if (target) io.to(target.id).emit('kicked_out');
        OFFICE_ROOM.players = OFFICE_ROOM.players.filter(p => p.name !== targetName);
        broadcastRoomUpdate();
    });

    socket.on('disconnect', () => {
        const player = OFFICE_ROOM.players.find(p => p.id === socket.id);
        if (player) {
            player.isOnline = false;
            broadcastRoomUpdate();
        }
    });
});

function handleLoginSuccess(socket, nickname) {
    const playerIndex = OFFICE_ROOM.players.findIndex(p => p.name === nickname);
    socket.emit('login_success', {
        hasRoom: OFFICE_ROOM.players.length > 0 || OFFICE_ROOM.hostName !== '',
        isReconnecting: playerIndex !== -1
    });
    if (playerIndex !== -1) {
         OFFICE_ROOM.players[playerIndex].id = socket.id;
         OFFICE_ROOM.players[playerIndex].isOnline = true;
         socket.join(OFFICE_ROOM.id);
         broadcastRoomUpdate();
         if (OFFICE_ROOM.status === 'playing') sendGameInfoToPlayer(OFFICE_ROOM.players[playerIndex]);
    }
}

function broadcastRoomUpdate() {
    io.to(OFFICE_ROOM.id).emit('room_update', {
        hostName: OFFICE_ROOM.hostName,
        players: OFFICE_ROOM.players,
        status: OFFICE_ROOM.status
    });
    io.emit('room_status_changed', { hasRoom: OFFICE_ROOM.players.length > 0 || OFFICE_ROOM.hostName !== '' });
}

function sendGameInfoToPlayer(player) {
    const all = OFFICE_ROOM.players;
    const mates = all.filter(p => [ROLES.MORGANA, ROLES.ASSASSIN, ROLES.MINION, ROLES.MORDRED].includes(p.role) && p.role !== ROLES.OBERON).map(p => p.name);
    const badsForMerlin = all.filter(p => [ROLES.MORGANA, ROLES.ASSASSIN, ROLES.MINION, ROLES.OBERON].includes(p.role)).map(p => p.name);
    const merlinMorgana = all.filter(p => [ROLES.MERLIN, ROLES.MORGANA].includes(p.role)).map(p => p.name);

    let viewInfo = [];
    if (player.role === ROLES.MERLIN) viewInfo = badsForMerlin;
    else if (player.role === ROLES.PERCIVAL) viewInfo = merlinMorgana;
    else if ([ROLES.MORGANA, ROLES.ASSASSIN, ROLES.MINION, ROLES.MORDRED].includes(player.role)) viewInfo = mates.filter(n => n !== player.name);

    io.to(player.id).emit('game_start', {
        myRole: player.role,
        viewInfo: viewInfo,
        firstSpeaker: OFFICE_ROOM.firstSpeaker
    });
}

server.listen(3000, () => console.log('🚀 Server running on 3000'));