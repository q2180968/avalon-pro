const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');
const User = require('./models/User');
const Game = require('./models/Game');

const app = express();
app.use(cors());
app.use(express.json());

mongoose.connect('mongodb://127.0.0.1:27017/avalon')
    .then(() => console.log('✅ MongoDB Connected'))
    .catch(err => console.error(err));

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// === 全局配置 ===
const ROLES = {
    MERLIN: 'Merlin', PERCIVAL: 'Percival', LOYAL: 'Loyal',
    MORGANA: 'Morgana', ASSASSIN: 'Assassin', MINION: 'Minion',
    OBERON: 'Oberon', MORDRED: 'Mordred'
};
const GOOD_ROLES = [ROLES.MERLIN, ROLES.PERCIVAL, ROLES.LOYAL];
const BAD_ROLES = [ROLES.MORGANA, ROLES.ASSASSIN, ROLES.MINION, ROLES.OBERON, ROLES.MORDRED];

const CONFIG = {
    5: [ROLES.MERLIN, ROLES.PERCIVAL, ROLES.LOYAL, ROLES.MORGANA, ROLES.ASSASSIN],
    6: [ROLES.MERLIN, ROLES.PERCIVAL, ROLES.LOYAL, ROLES.LOYAL, ROLES.MORGANA, ROLES.ASSASSIN],
    7: [ROLES.MERLIN, ROLES.PERCIVAL, ROLES.LOYAL, ROLES.LOYAL, ROLES.MORGANA, ROLES.ASSASSIN, ROLES.OBERON],
    8: [ROLES.MERLIN, ROLES.PERCIVAL, ROLES.LOYAL, ROLES.LOYAL, ROLES.LOYAL, ROLES.MORGANA, ROLES.ASSASSIN, ROLES.MINION],
    9: [ROLES.MERLIN, ROLES.PERCIVAL, ROLES.LOYAL, ROLES.LOYAL, ROLES.LOYAL, ROLES.LOYAL, ROLES.MORGANA, ROLES.ASSASSIN, ROLES.MORDRED],
    10: [ROLES.MERLIN, ROLES.PERCIVAL, ROLES.LOYAL, ROLES.LOYAL, ROLES.LOYAL, ROLES.LOYAL, ROLES.MORGANA, ROLES.ASSASSIN, ROLES.MORDRED, ROLES.OBERON]
};

// === 房间状态 ===
const OFFICE_ROOM = {
    id: 'OFFICE_HALL', players: [], status: 'waiting',
    hostName: '', firstSpeaker: '', startTime: null
};

// ===========================
//       统计 API
// ===========================

// 1. 全员战况
app.get('/api/stats/global', async (req, res) => {
    try {
        const games = await Game.find({ winner: { $in: ['blue', 'red'] } });
        const total = games.length;
        if (total === 0) return res.json({ total: 0 });

        const blueWins = games.filter(g => g.winner === 'blue').length;
        let totalMs = 0;
        const reasons = {};

        games.forEach(g => {
            if (g.startTime && g.endTime) totalMs += (new Date(g.endTime) - new Date(g.startTime));
            if (g.winReason) reasons[g.winReason] = (reasons[g.winReason] || 0) + 1;
        });

        const formatTime = ms => ms > 3600000 ? (ms / 3600000).toFixed(1) + '小时' : Math.floor(ms / 60000) + '分钟';

        res.json({
            total,
            blueRate: ((blueWins / total) * 100).toFixed(1),
            redRate: (((total - blueWins) / total) * 100).toFixed(1),
            totalTime: formatTime(totalMs),
            avgTime: formatTime(totalMs / total),
            reasons: Object.keys(reasons).map(k => ({ name: k, value: reasons[k] }))
        });
    } catch (e) { res.status(500).json({}); }
});

// 2. 高级排行榜 (核心修改：补全所有角色)
app.get('/api/stats/leaderboard', async (req, res) => {
    try {
        const list = await Game.aggregate([
            { $match: { winner: { $in: ['blue', 'red'] } } },
            { $unwind: "$players" },
            {
                $group: {
                    _id: "$players.nickname",
                    total: { $sum: 1 },
                    wins: { $sum: { $cond: ["$players.isWin", 1, 0] } },

                    // 阵营统计
                    goodTotal: { $sum: { $cond: [{ $in: ["$players.role", GOOD_ROLES] }, 1, 0] } },
                    goodWins: { $sum: { $cond: [{ $and: [{ $in: ["$players.role", GOOD_ROLES] }, "$players.isWin"] }, 1, 0] } },
                    badTotal: { $sum: { $cond: [{ $in: ["$players.role", BAD_ROLES] }, 1, 0] } },
                    badWins: { $sum: { $cond: [{ $and: [{ $in: ["$players.role", BAD_ROLES] }, "$players.isWin"] }, 1, 0] } },

                    // --- 角色详细统计 (补全这里) ---
                    merlinTotal: { $sum: { $cond: [{ $eq: ["$players.role", "Merlin"] }, 1, 0] } },
                    merlinWins: { $sum: { $cond: [{ $and: [{ $eq: ["$players.role", "Merlin"] }, "$players.isWin"] }, 1, 0] } },

                    percivalTotal: { $sum: { $cond: [{ $eq: ["$players.role", "Percival"] }, 1, 0] } },
                    percivalWins: { $sum: { $cond: [{ $and: [{ $eq: ["$players.role", "Percival"] }, "$players.isWin"] }, 1, 0] } },

                    loyalTotal: { $sum: { $cond: [{ $eq: ["$players.role", "Loyal"] }, 1, 0] } },
                    loyalWins: { $sum: { $cond: [{ $and: [{ $eq: ["$players.role", "Loyal"] }, "$players.isWin"] }, 1, 0] } },

                    morganaTotal: { $sum: { $cond: [{ $eq: ["$players.role", "Morgana"] }, 1, 0] } },
                    morganaWins: { $sum: { $cond: [{ $and: [{ $eq: ["$players.role", "Morgana"] }, "$players.isWin"] }, 1, 0] } },

                    assassinTotal: { $sum: { $cond: [{ $eq: ["$players.role", "Assassin"] }, 1, 0] } },
                    assassinWins: { $sum: { $cond: [{ $and: [{ $eq: ["$players.role", "Assassin"] }, "$players.isWin"] }, 1, 0] } },

                    mordredTotal: { $sum: { $cond: [{ $eq: ["$players.role", "Mordred"] }, 1, 0] } },
                    mordredWins: { $sum: { $cond: [{ $and: [{ $eq: ["$players.role", "Mordred"] }, "$players.isWin"] }, 1, 0] } },

                    oberonTotal: { $sum: { $cond: [{ $eq: ["$players.role", "Oberon"] }, 1, 0] } },
                    oberonWins: { $sum: { $cond: [{ $and: [{ $eq: ["$players.role", "Oberon"] }, "$players.isWin"] }, 1, 0] } },

                    minionTotal: { $sum: { $cond: [{ $eq: ["$players.role", "Minion"] }, 1, 0] } },
                    minionWins: { $sum: { $cond: [{ $and: [{ $eq: ["$players.role", "Minion"] }, "$players.isWin"] }, 1, 0] } },
                }
            },
            {
                $addFields: {
                    winRate: { $multiply: [{ $divide: ["$wins", "$total"] }, 100] },
                    goodRate: { $cond: ["$goodTotal", { $multiply: [{ $divide: ["$goodWins", "$goodTotal"] }, 100] }, 0] },
                    badRate: { $cond: ["$badTotal", { $multiply: [{ $divide: ["$badWins", "$badTotal"] }, 100] }, 0] },

                    // 计算角色胜率
                    merlinRate: { $cond: ["$merlinTotal", { $multiply: [{ $divide: ["$merlinWins", "$merlinTotal"] }, 100] }, 0] },
                    percivalRate: { $cond: ["$percivalTotal", { $multiply: [{ $divide: ["$percivalWins", "$percivalTotal"] }, 100] }, 0] },
                    loyalRate: { $cond: ["$loyalTotal", { $multiply: [{ $divide: ["$loyalWins", "$loyalTotal"] }, 100] }, 0] },
                    morganaRate: { $cond: ["$morganaTotal", { $multiply: [{ $divide: ["$morganaWins", "$morganaTotal"] }, 100] }, 0] },
                    assassinRate: { $cond: ["$assassinTotal", { $multiply: [{ $divide: ["$assassinWins", "$assassinTotal"] }, 100] }, 0] },
                    mordredRate: { $cond: ["$mordredTotal", { $multiply: [{ $divide: ["$mordredWins", "$mordredTotal"] }, 100] }, 0] },
                    oberonRate: { $cond: ["$oberonTotal", { $multiply: [{ $divide: ["$oberonWins", "$oberonTotal"] }, 100] }, 0] },
                    minionRate: { $cond: ["$minionTotal", { $multiply: [{ $divide: ["$minionWins", "$minionTotal"] }, 100] }, 0] },
                }
            },
            { $sort: { winRate: -1, total: -1 } }
        ]);
        res.json(list);
    } catch (e) { res.status(500).json([]); }
});

// 3. 个人画像
app.get('/api/stats/profile/:nickname', async (req, res) => {
    try {
        const { nickname } = req.params;
        const games = await Game.find({ "players.nickname": nickname, winner: { $in: ['blue', 'red'] } }).sort({ endTime: -1 });
        if (!games.length) return res.json({ total: 0 });

        let wins = 0;
        const roleStats = {};

        let goodG = 0, goodW = 0, badG = 0, badW = 0, leadG = 0, leadW = 0;

        games.forEach(g => {
            const p = g.players.find(pl => pl.nickname === nickname);
            if (p.isWin) wins++;
            roleStats[p.role] = (roleStats[p.role] || 0) + 1;

            if (GOOD_ROLES.includes(p.role)) { goodG++; if (p.isWin) goodW++; }
            if (BAD_ROLES.includes(p.role)) { badG++; if (p.isWin) badW++; }
            if (p.role === 'Merlin') { leadG++; if (p.isWin) leadW++; }
        });

        const winRate = (wins / games.length) * 100;
        const logic = goodG ? (goodW / goodG) * 100 : 50;
        const fraud = badG ? (badW / badG) * 100 : 50;
        const lead = leadG ? (leadW / leadG) * 100 : 50;
        const active = Math.min(games.length * 5, 100);

        // 称号
        const titles = [];
        if (winRate > 60 && games.length > 5) titles.push({ text: '常胜将军', type: 'danger' });
        else if (winRate < 40 && games.length > 5) titles.push({ text: '慈善赌王', type: 'info' });

        if (fraud > 70 && badG > 2) titles.push({ text: '天生反骨', type: 'warning' });
        if (lead > 70 && leadG > 2) titles.push({ text: '全知全能', type: 'primary' });

        if (titles.length === 0) titles.push({ text: '阿瓦隆新星', type: 'success' });

        res.json({
            total: games.length,
            winRate: winRate.toFixed(1),
            titles,
            radar: [
                { name: '综合', max: 100, value: winRate },
                { name: '逻辑', max: 100, value: logic },
                { name: '欺诈', max: 100, value: fraud },
                { name: '带队', max: 100, value: lead },
                { name: '活跃', max: 100, value: active }
            ],
            roleDist: Object.keys(roleStats).map(r => ({ name: r, value: roleStats[r] }))
        });
    } catch (e) { res.status(500).json({}); }
});

// 4. 历史记录
app.get('/api/stats/history', async (req, res) => {
    try {
        const { page = 1, pageSize = 10, nickname } = req.query;
        const query = { winner: { $in: ['blue', 'red'] } };
        if (nickname) query["players.nickname"] = nickname;
        const list = await Game.find(query).sort({ endTime: -1 }).skip((page - 1) * pageSize).limit(Number(pageSize));
        res.json(list);
    } catch (e) { res.status(500).json([]); }
});

// 5. 用户
app.get('/api/users', async (req, res) => {
    try {
        const users = await User.find({}, 'nickname').sort({ lastActiveAt: -1 });
        res.json(users);
    } catch (e) { res.status(500).json([]); }
});

// === Socket 逻辑 ===
io.on('connection', (socket) => {
    socket.on('login', async ({ nickname }) => {
        socket.nickname = nickname;
        let user = await User.findOne({ nickname });
        if (!user) await User.create({ nickname });
        else await User.updateOne({ nickname }, { lastActiveAt: new Date() });

        const player = OFFICE_ROOM.players.find(p => p.name === nickname);
        if (player && player.isOnline && player.id !== socket.id) socket.emit('login_conflict', { nickname });
        else handleLoginSuccess(socket, nickname);
    });

    socket.on('force_login', ({ nickname }) => {
        const player = OFFICE_ROOM.players.find(p => p.name === nickname);
        if (player) io.to(player.id).emit('force_logout');
        handleLoginSuccess(socket, nickname);
    });

    socket.on('join_game', ({ nickname }) => {
        socket.nickname = nickname;
        const existing = OFFICE_ROOM.players.find(p => p.name === nickname);
        if (existing) {
            existing.id = socket.id;
            existing.isOnline = true;
            socket.join(OFFICE_ROOM.id);
            if (OFFICE_ROOM.status === 'playing') sendGameInfo(existing);
        } else {
            if (OFFICE_ROOM.status === 'playing') return socket.emit('error_msg', '游戏进行中');
            if (OFFICE_ROOM.players.length === 0) { OFFICE_ROOM.hostName = nickname; io.emit('room_status_changed', { hasRoom: true }); }
            OFFICE_ROOM.players.push({ id: socket.id, name: nickname, role: null, isReady: false, isOnline: true });
            socket.join(OFFICE_ROOM.id);
        }
        broadcastRoom();
    });

    socket.on('toggle_ready', () => {
        const p = OFFICE_ROOM.players.find(x => x.id === socket.id);
        if (p) { p.isReady = !p.isReady; broadcastRoom(); }
    });

    // 5. 开始游戏
    socket.on('start_game', () => {
        if (socket.nickname !== OFFICE_ROOM.hostName) return;

        // 校验人数
        const count = OFFICE_ROOM.players.length;
        if (!CONFIG[count]) return io.to(OFFICE_ROOM.id).emit('error_msg', `人数 ${count} 不对`);

        // 校验准备状态
        if (OFFICE_ROOM.players.some(p => !p.isReady)) return io.to(OFFICE_ROOM.id).emit('error_msg', '还有人未准备');

        console.log('🚀 游戏开始');
        OFFICE_ROOM.status = 'playing';
        OFFICE_ROOM.startTime = new Date(); // 记录时间

        // 洗牌
        // 1. 获取原始角色列表
        const roles = [...CONFIG[count]];

        // 2. 使用 Fisher-Yates 算法进行真正的“彻底洗牌”
        for (let i = roles.length - 1; i > 0; i--) {
            // 生成一个 0 到 i 之间的随机整数
            const j = Math.floor(Math.random() * (i + 1));
            // 交换位置
            [roles[i], roles[j]] = [roles[j], roles[i]];
        }

        // 随机首位发言人
        OFFICE_ROOM.firstSpeaker = OFFICE_ROOM.players[Math.floor(Math.random() * count)].name;

        // 【关键修复】步骤1：先给所有人分配身份
        OFFICE_ROOM.players.forEach((p, i) => {
            p.role = roles[i];
        });

        // 【关键修复】步骤2：所有人都有身份后，再发送视野信息
        OFFICE_ROOM.players.forEach(player => {
            sendGameInfo(player);
        });
    });


    // === 补丁 1：新增作废游戏监听 (插在 reset_game 后面) ===
    socket.on('abort_game', () => {
        if (socket.nickname !== OFFICE_ROOM.hostName) return;

        console.log('⚠️ 房主作废了当前对局');

        // 重置房间状态
        OFFICE_ROOM.status = 'waiting';
        OFFICE_ROOM.startTime = null;
        OFFICE_ROOM.players.forEach(p => {
            p.role = null;
            p.isReady = false;
        });

        // 通知所有人，带上 aborted 标记
        io.to(OFFICE_ROOM.id).emit('game_over', { aborted: true });
        broadcastRoom();
    });





    socket.on('reset_game', async ({ winner, winReason }) => {
        if (socket.nickname !== OFFICE_ROOM.hostName) return;
        if (OFFICE_ROOM.status === 'playing' && winner) {
            const endTime = new Date();
            const startTime = OFFICE_ROOM.startTime || endTime;
            const playerRecords = [];
            for (const p of OFFICE_ROOM.players) {
                const isBlue = GOOD_ROLES.includes(p.role);
                const isWin = (winner === 'blue' && isBlue) || (winner === 'red' && !isBlue);
                playerRecords.push({ nickname: p.name, role: p.role, isWin });
                await User.updateOne({ nickname: p.name }, {
                    $inc: { 'stats.totalGames': 1, 'stats.wins': isWin ? 1 : 0, [`stats.roleUsage.${p.role}`]: 1 },
                    lastActiveAt: endTime
                });
            }
            await Game.create({
                roomId: 'OFFICE', hostName: OFFICE_ROOM.hostName,
                winner, winReason, startTime, endTime,
                firstSpeaker: OFFICE_ROOM.firstSpeaker, players: playerRecords
            });
            io.to(OFFICE_ROOM.id).emit('game_over', { winner, winReason });
        } else {
            io.to(OFFICE_ROOM.id).emit('game_over', {});
        }
        OFFICE_ROOM.status = 'waiting';
        OFFICE_ROOM.startTime = null;
        OFFICE_ROOM.players.forEach(p => { p.role = null; p.isReady = false; });
        broadcastRoom();
    });



    socket.on('kick_player', (target) => {
        if (socket.nickname !== OFFICE_ROOM.hostName) return;
        const p = OFFICE_ROOM.players.find(x => x.name === target);
        if (p) io.to(p.id).emit('kicked_out');
        OFFICE_ROOM.players = OFFICE_ROOM.players.filter(x => x.name !== target);
        broadcastRoom();
    });

    socket.on('disconnect', () => {
        const p = OFFICE_ROOM.players.find(x => x.id === socket.id);
        if (p) { p.isOnline = false; broadcastRoom(); }
    });
});

function handleLoginSuccess(socket, nickname) {
    const p = OFFICE_ROOM.players.find(x => x.name === nickname);
    socket.emit('login_success', { hasRoom: OFFICE_ROOM.players.length > 0, isReconnecting: !!p });
    if (p) {
        p.id = socket.id; p.isOnline = true;
        socket.join(OFFICE_ROOM.id);
        broadcastRoom();
        if (OFFICE_ROOM.status === 'playing') sendGameInfo(p);
    }
}

function broadcastRoom() {
    io.to(OFFICE_ROOM.id).emit('room_update', { hostName: OFFICE_ROOM.hostName, players: OFFICE_ROOM.players, status: OFFICE_ROOM.status });
    io.emit('room_status_changed', { hasRoom: OFFICE_ROOM.players.length > 0 });
}

// === 修改后的 sendGameInfo 函数 ===
function sendGameInfo(p) {
    const all = OFFICE_ROOM.players;

    // 1. 坏人队友逻辑：现在不仅仅传名字，还要传 role (身份)
    // 排除奥伯伦 (Oberon看不到队友，队友也看不到他)
    const mates = all
        .filter(x => BAD_ROLES.includes(x.role) && x.role !== ROLES.OBERON)
        .map(x => ({
            nickname: x.name,
            role: x.role, // 这里把身份传回去
            isMe: x.name === p.name
        }));

    // 2. 梅林视野：只能看到谁是坏人，但不知道具体身份 (莫德雷德除外)
    const merlinSee = all
        .filter(x => [ROLES.MORGANA, ROLES.ASSASSIN, ROLES.MINION, ROLES.OBERON].includes(x.role))
        .map(x => ({ nickname: x.name, role: '坏人' })); // 梅林只知道那是坏人

    // 3. 派西维尔视野：看到梅林和莫甘娜 (不知道谁是谁)
    const perciSee = all
        .filter(x => [ROLES.MERLIN, ROLES.MORGANA].includes(x.role))
        .map(x => ({ nickname: x.name, role: '梅林/莫甘娜' }));

    let viewInfo = [];

    // 根据角色分发视野
    if (p.role === ROLES.MERLIN) viewInfo = merlinSee;
    else if (p.role === ROLES.PERCIVAL) viewInfo = perciSee;
    else if (BAD_ROLES.includes(p.role) && p.role !== ROLES.OBERON) {
        // 坏人可以看到队友的具体身份，过滤掉自己
        viewInfo = mates.filter(m => !m.isMe);
    }

    // 发送给前端
    io.to(p.id).emit('game_start', {
        myRole: p.role,
        viewInfo, // 这里现在的结构是 [{nickname: '张三', role: 'Morgana'}, ...]
        firstSpeaker: OFFICE_ROOM.firstSpeaker
    });
}

server.listen(31111, () => console.log('🚀 Server running on 31111'));