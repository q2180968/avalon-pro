const mongoose = require('mongoose');
const User = require('./models/User');
const Game = require('./models/Game');

// === 1. 数据库连接配置 ===
const MONGO_URI = 'mongodb://127.0.0.1:27017/avalon';

// === 2. 真实玩家名单 (来自图片) ===
const PLAYER_NAMES = [
    "曹陈铭", "程丽娟", "郭海涛", "李成祥", 
    "芦伟", "武新颖", "徐强", "张宏涛", "张佳维"
];

// === 3. 游戏规则配置 (9人局) ===
const ROLES_CONFIG = [
    'Merlin', 'Percival', 'Loyal', 'Loyal', 'Loyal', 'Loyal', // 6个好人
    'Morgana', 'Assassin', 'Mordred' // 3个坏人
];
const GOOD_ROLES = ['Merlin', 'Percival', 'Loyal'];

const BLUE_REASONS = ['Mission Success', 'Assassination Failed'];
const RED_REASONS = ['Mission Failed', 'Merlin Assassinated'];

// 辅助：打乱数组
function shuffle(array) {
    const newArr = [...array];
    for (let i = newArr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
    }
    return newArr;
}

// === 主脚本逻辑 ===
async function seedData() {
    try {
        console.log('🚀 开始执行历史数据注入脚本...');
        await mongoose.connect(MONGO_URI);
        console.log('✅ MongoDB 连接成功');

        // --- 第一步：彻底清理旧数据 ---
        console.log('🗑️  正在清空 Game 和 User 表...');
        await Game.deleteMany({});
        await User.deleteMany({});
        console.log('✨ 旧数据已清空');

        // --- 第二步：创建基础用户 ---
        console.log('bust 正在创建 9 位玩家账号...');
        const userMap = {}; // 用于内存中临时记录统计，减少数据库读写
        
        for (const name of PLAYER_NAMES) {
            // 初始化 User，各项数据归零
            const user = await User.create({
                nickname: name,
                stats: { totalGames: 0, wins: 0, roleUsage: {} },
                lastActiveAt: new Date()
            });
            // 在内存里也存一份，方便脚本里累加
            userMap[name] = { 
                dbId: user._id, 
                totalGames: 0, 
                wins: 0, 
                roleUsage: {} 
            };
        }
        console.log('✅ 玩家账号创建完毕');

        // --- 第三步：模拟 12 局历史战绩 ---
        const TOTAL_GAMES = 12; // 图片里大概记录了12行
        console.log(`🎲 正在生成 ${TOTAL_GAMES} 局对战记录...`);

        for (let i = 0; i < TOTAL_GAMES; i++) {
            // 1. 模拟时间：从12天前开始，每天一局
            const dayOffset = TOTAL_GAMES - i;
            const endTime = new Date();
            endTime.setDate(endTime.getDate() - dayOffset);
            // 每局时长随机 30-50 分钟
            const duration = 1000 * 60 * (30 + Math.floor(Math.random() * 20)); 
            const startTime = new Date(endTime.getTime() - duration);

            // 2. 分配角色 (打乱)
            const currentRoles = shuffle(ROLES_CONFIG);
            // 玩家顺序也打乱一下，模拟随机座位
            const currentPlayersName = shuffle(PLAYER_NAMES);

            // 3. 随机胜负
            const isBlueWin = Math.random() > 0.5; // 50% 概率
            const winner = isBlueWin ? 'blue' : 'red';
            const winReason = isBlueWin 
                ? BLUE_REASONS[Math.floor(Math.random() * BLUE_REASONS.length)]
                : RED_REASONS[Math.floor(Math.random() * RED_REASONS.length)];

            // 4. 构建本局的 players 数据，并同步更新 User 统计
            const gamePlayers = [];

            for (let j = 0; j < 9; j++) {
                const pName = currentPlayersName[j];
                const pRole = currentRoles[j];
                const isGood = GOOD_ROLES.includes(pRole);
                const isWin = (isBlueWin && isGood) || (!isBlueWin && !isGood);

                // 记录到 Game 表的数据结构
                gamePlayers.push({
                    nickname: pName,
                    role: pRole,
                    isWin: isWin
                });

                // === 关键：同步更新内存中的 User 统计 ===
                userMap[pName].totalGames += 1;
                if (isWin) userMap[pName].wins += 1;
                userMap[pName].roleUsage[pRole] = (userMap[pName].roleUsage[pRole] || 0) + 1;
            }

            // 5. 写入 Game 表
            await Game.create({
                roomId: 'OFFICE_HISTORY',
                hostName: shuffle(PLAYER_NAMES)[0], // 随机房主
                winner,
                winReason,
                startTime,
                endTime,
                firstSpeaker: shuffle(PLAYER_NAMES)[0],
                players: gamePlayers,
                isBackfill: true
            });
        }

        // --- 第四步：将累计的统计数据一次性写回 User 表 ---
        console.log('💾 正在同步更新 User 统计数据...');
        for (const name of PLAYER_NAMES) {
            const data = userMap[name];
            await User.updateOne(
                { _id: data.dbId },
                { 
                    $set: { 
                        "stats.totalGames": data.totalGames,
                        "stats.wins": data.wins,
                        "stats.roleUsage": data.roleUsage
                    }
                }
            );
        }

        console.log('🎉 脚本执行成功！历史数据已完美注入。');
        process.exit(0);

    } catch (err) {
        console.error('❌ 脚本执行出错:', err);
        process.exit(1);
    }
}

seedData();