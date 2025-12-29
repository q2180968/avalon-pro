const mongoose = require('mongoose');
const User = require('./models/User');
const Game = require('./models/Game');

const MONGO_URI = 'mongodb://127.0.0.1:27017/avalon';

// 玩家池 (增加到10人以满足最大局)
const PLAYER_NAMES = [
    "曹陈铭", "程丽娟", "郭海涛", "李成祥", 
    "芦伟", "武新颖", "徐强", "张宏涛", "张佳维", "路人甲"
];

const ROLES = {
    MERLIN: 'Merlin', PERCIVAL: 'Percival', LOYAL: 'Loyal',
    MORGANA: 'Morgana', ASSASSIN: 'Assassin', MINION: 'Minion',
    OBERON: 'Oberon', MORDRED: 'Mordred'
};
// 复制后端的配置表，确保准确
const CONFIG = {
    5: [ROLES.MERLIN, ROLES.PERCIVAL, ROLES.LOYAL, ROLES.MORGANA, ROLES.ASSASSIN],
    6: [ROLES.MERLIN, ROLES.PERCIVAL, ROLES.LOYAL, ROLES.LOYAL, ROLES.MORGANA, ROLES.ASSASSIN],
    7: [ROLES.MERLIN, ROLES.PERCIVAL, ROLES.LOYAL, ROLES.LOYAL, ROLES.MORGANA, ROLES.ASSASSIN, ROLES.OBERON],
    8: [ROLES.MERLIN, ROLES.PERCIVAL, ROLES.LOYAL, ROLES.LOYAL, ROLES.LOYAL, ROLES.MORGANA, ROLES.ASSASSIN, ROLES.MINION],
    9: [ROLES.MERLIN, ROLES.PERCIVAL, ROLES.LOYAL, ROLES.LOYAL, ROLES.LOYAL, ROLES.LOYAL, ROLES.MORGANA, ROLES.ASSASSIN, ROLES.MORDRED],
    10: [ROLES.MERLIN, ROLES.PERCIVAL, ROLES.LOYAL, ROLES.LOYAL, ROLES.LOYAL, ROLES.LOYAL, ROLES.MORGANA, ROLES.ASSASSIN, ROLES.MORDRED, ROLES.OBERON]
};

const GOOD_ROLES = [ROLES.MERLIN, ROLES.PERCIVAL, ROLES.LOYAL];
const BLUE_REASONS = ['Mission Success', 'Assassination Failed'];
const RED_REASONS = ['Mission Failed', 'Merlin Assassinated'];

function shuffle(array) {
    const newArr = [...array];
    for (let i = newArr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
    }
    return newArr;
}

async function seedData() {
    try {
        console.log('🔄 连接数据库...');
        await mongoose.connect(MONGO_URI);
        
        console.log('🗑️  清理旧数据...');
        await User.deleteMany({});
        await Game.deleteMany({});

        // 1. 创建用户
        console.log('bust 创建用户...');
        const userMap = {};
        for (const name of PLAYER_NAMES) {
            const user = await User.create({
                nickname: name,
                stats: { totalGames: 0, wins: 0, roleUsage: {} },
                lastActiveAt: new Date()
            });
            userMap[name] = user;
        }

        // 2. 模拟 25 局游戏 (涵盖不同人数)
        const TOTAL_GAMES = 25;
        console.log(`🎲 正在生成 ${TOTAL_GAMES} 局混合人数数据...`);

        // 内存统计缓冲
        const statsBuffer = {}; 
        PLAYER_NAMES.forEach(n => statsBuffer[n] = { total: 0, wins: 0, roles: {} });

        for (let i = 0; i < TOTAL_GAMES; i++) {
            // 随机人数 5-10
            const playerCount = Math.floor(Math.random() * 6) + 5; 
            
            // 挑选玩家和角色
            const currentPlayersNames = shuffle(PLAYER_NAMES).slice(0, playerCount);
            const currentRoles = shuffle(CONFIG[playerCount]);

            // 时间倒推
            const endTime = new Date();
            endTime.setDate(endTime.getDate() - (TOTAL_GAMES - i)); 
            const duration = 1000 * 60 * (20 + Math.floor(Math.random() * 30));
            const startTime = new Date(endTime.getTime() - duration);

            // 胜负
            const isBlueWin = Math.random() > 0.5;
            const winner = isBlueWin ? 'blue' : 'red';
            const winReason = isBlueWin 
                ? BLUE_REASONS[Math.floor(Math.random() * BLUE_REASONS.length)]
                : RED_REASONS[Math.floor(Math.random() * RED_REASONS.length)];

            const gamePlayersData = [];

            for (let j = 0; j < playerCount; j++) {
                const pName = currentPlayersNames[j];
                const pRole = currentRoles[j];
                const pUser = userMap[pName];

                const isGood = GOOD_ROLES.includes(pRole);
                const isWin = (isBlueWin && isGood) || (!isBlueWin && !isGood);

                gamePlayersData.push({
                    user: pUser._id,
                    nickname: pName,
                    role: pRole,
                    isWin: isWin
                });

                // 统计
                statsBuffer[pName].total++;
                if (isWin) statsBuffer[pName].wins++;
                statsBuffer[pName].roles[pRole] = (statsBuffer[pName].roles[pRole] || 0) + 1;
            }

            await Game.create({
                roomId: 'HISTORY',
                hostName: currentPlayersNames[0],
                firstSpeaker: currentPlayersNames[1],
                winner, winReason, startTime, endTime,
                players: gamePlayersData, isBackfill: true
            });
        }

        // 3. 更新 User 表
        console.log('💾 更新用户统计...');
        for (const name of PLAYER_NAMES) {
            const buf = statsBuffer[name];
            const user = userMap[name];
            user.stats.totalGames = buf.total;
            user.stats.wins = buf.wins;
            user.stats.roleUsage = buf.roles;
            await user.save();
        }

        console.log('✅ 数据生成完毕！');
        process.exit(0);

    } catch (e) { console.error('❌', e); process.exit(1); }
}

seedData();