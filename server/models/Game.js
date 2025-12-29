const mongoose = require('mongoose');

const GameSchema = new mongoose.Schema({
  // 房间号 (历史补录局可以统一叫 "HISTORY" 或日期)
  roomId: { type: String, default: "HISTORY" },

  // 游戏结束时间 (如果是补录，这个时间由管理员手动指定)
  endTime: { type: Date, required: true },
  // 游戏開始時間时间 (如果是补录，这个时间由管理员手动指定)
  startTime: { type: Date, required: true },

  // 是否为补录数据
  isBackfill: { type: Boolean, default: false },

  // 胜负信息
  winner: { type: String, enum: ['blue', 'red'], required: true }, // blue=好人, red=坏人
  winReason: { type: String }, // e.g. "mission_success", "merlin_assassinated"

  // 玩家阵容快照
  players: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // 关联用户表
    nickname: String, // 冗余存一份名字，方便不查表直接看
    role: String,     // e.g. "Merlin", "Assassin"
    isWin: Boolean    // 该玩家这局赢了吗？
  }],
  firstSpeaker: String// 新增


});

module.exports = mongoose.model('Game', GameSchema);