const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  // 昵称即ID，设为唯一索引
  nickname: { type: String, required: true, unique: true, trim: true },
  
  // 简单的PIN码 (可选，用于后续同名验证)
  pin: { type: String, default: null },

  // 统计缓存 (每次录入战绩后更新这里，读取极快)
  stats: {
    totalGames: { type: Number, default: 0 }, // 总场次
    wins: { type: Number, default: 0 },       // 胜场
    titles: [String],                         // 称号列表 e.g. ["影帝", "搅屎棍"]
    // 角色使用频率 (Map结构更灵活)
    roleUsage: { 
      type: Map, 
      of: Number, 
      default: {} 
    }
  },
  
  lastActiveAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', UserSchema);