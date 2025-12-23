<template>
  <div class="app-layout">
    <div class="nav-bar">
      <div class="nav-left">
        <span class="nav-title">🏰 办公室阿瓦隆</span>
        <span class="nav-help" @click="showRoleTips = true">❓配置</span>
      </div>
      <div class="nav-user" v-if="nickname">👤 {{ nickname }}</div>
    </div>

    <div class="content-area">
      <div v-if="step === 'login'" class="center-wrapper">
        <h2 class="page-title">身份登记</h2>
        <p class="sub-text">请确认身份以进入游戏</p>
        <el-select v-model="nickname" filterable allow-create default-first-option placeholder="选择或输入名字" size="large" class="full-width mb-20">
          <el-option v-for="u in userList" :key="u._id" :label="u.nickname" :value="u.nickname"/>
        </el-select>
        <el-button type="primary" size="large" round class="full-width" @click="handleLogin" :disabled="!nickname">进入</el-button>
      </div>

      <div v-if="step === 'action'" class="center-wrapper">
        <h2 class="page-title">👋 你好，{{ nickname }}</h2>
        <div v-if="hasRoom" class="action-card">
          <div class="status-badge pulse">🟢 进行中</div>
          <p>大家已在房间，点击加入</p>
          <el-button type="success" size="large" class="big-btn" @click="joinRoom">🚪 加入房间</el-button>
        </div>
        <div v-else class="action-card">
          <div class="status-badge gray">⚪ 空闲</div>
          <p>暂无房间，你可以创建</p>
          <el-button type="primary" size="large" class="big-btn" @click="createRoom">🏠 创建房间</el-button>
        </div>
      </div>

      <div v-if="step === 'lobby'" class="lobby-wrapper">
        <div class="room-header">
          <div class="room-title">🏠 {{ hostName }}的房间</div>
          <div class="room-config">{{ players.length }}人: {{ getRoleConfig(players.length) }}</div>
        </div>
        <div class="player-list">
          <div v-for="p in players" :key="p.name" class="player-row">
             <div class="p-left">
               <span class="p-name">{{ p.name }}</span>
               <span v-if="p.name === hostName" class="tag-host">房主</span>
             </div>
             <div class="p-right">
               <span v-if="p.isReady" class="ready-yes">✅</span>
               <span v-else class="ready-no">⏳</span>
               <el-button v-if="isHost && p.name !== nickname" type="danger" link size="small" class="kick-btn" @click="kickPlayer(p.name)">踢出</el-button>
             </div>
          </div>
        </div>
        <div class="lobby-footer">
          <el-button @click="toggleReady" :type="amIReady ? 'info' : 'warning'" size="large" class="full-width mb-10">
            {{ amIReady ? '取消准备' : '👋 我准备好了' }}
          </el-button>
          <template v-if="isHost">
            <el-button type="success" size="large" class="full-width" @click="startGame" :disabled="!isAllReady">
              🚀 开始发牌 {{ isAllReady ? '' : '(等全员准备)' }}
            </el-button>
          </template>
          <div v-else class="waiting-text">等待房主开始...</div>
        </div>
      </div>

      <div v-if="step === 'game'" class="game-wrapper">
        <div class="game-status-bar">
           <span>📢 首位: <strong>{{ firstSpeaker }}</strong></span>
           <span class="small-config" @click="showRoleTips = true">配置表 ></span>
        </div>
        <div class="card-area" @touchstart.prevent="isRevealed=true" @touchend.prevent="isRevealed=false" @mousedown="isRevealed=true" @mouseup="isRevealed=false">
           <div v-if="!isRevealed" class="card-face card-back">
              <div class="card-user-label">{{ nickname }}</div>
              <div class="card-center"><div class="logo">🛡️</div><p>长按查看身份</p></div>
              <div class="card-bottom">防窥模式</div>
           </div>
           <div v-else class="card-face card-front" :class="getRoleColor(myRole)">
              <div class="card-user-label">{{ nickname }} ({{ getTeamName(myRole) }})</div>
              <div class="card-center">
                <h1 class="role-name">{{ getRoleName(myRole) }}</h1>
                <p class="role-desc">{{ getRoleDesc(myRole) }}</p>
                <div v-if="viewInfo.length > 0" class="vision-box"><p>👁️ 你的视野:</p><div class="vision-tags"><span v-for="name in viewInfo" :key="name">{{ name }}</span></div></div>
                <div v-else class="vision-box"><p>👁️ 无特殊视野</p></div>
              </div>
           </div>
        </div>
        <div class="game-footer">
          <el-button v-if="isHost" type="danger" plain class="full-width" @click="showSettleDialog = true">🏁 结束本局 (结算)</el-button>
          <div v-else class="waiting-text">游戏进行中...</div>
        </div>
      </div>
    </div>

    <el-dialog v-model="showRoleTips" title="📜 配置表" width="90%" align-center>
      <div class="role-table">
        <div v-for="(desc, num) in CONFIG_DETAILS" :key="num" class="role-row" :class="{ highlight: players.length == num }">
          <div class="role-num">{{ num }}人</div><div class="role-desc-text">{{ desc }}</div>
        </div>
      </div>
    </el-dialog>

    <el-dialog v-model="showSettleDialog" title="🏆 本局结算" width="90%" align-center :close-on-click-modal="false">
      <div style="text-align: center; margin-bottom: 20px;">
        <p style="color: #666; margin-bottom: 10px;">请确认获胜方，系统将自动记录战绩</p>
        <el-radio-group v-model="settleWinner" size="large">
          <el-radio-button label="blue" class="blue-radio">🔵 好人胜</el-radio-button>
          <el-radio-button label="red" class="red-radio">🔴 坏人胜</el-radio-button>
        </el-radio-group>
      </div>

      <div style="margin-bottom: 20px;">
        <p style="margin-bottom: 5px; font-size: 14px;">胜利原因:</p>
        <el-select v-model="settleReason" placeholder="请选择" style="width: 100%">
          <template v-if="settleWinner === 'blue'">
            <el-option label="🛡️ 任务成功 (3胜)" value="Mission Success" />
            <el-option label="🔪 刺客刺杀失败" value="Assassination Failed" />
          </template>
          <template v-else>
            <el-option label="😈 任务失败 (3负)" value="Mission Failed" />
            <el-option label="🩸 刺杀梅林成功" value="Merlin Assassinated" />
          </template>
        </el-select>
      </div>
      
      <template #footer>
        <el-button @click="showSettleDialog = false">取消</el-button>
        <el-button type="primary" @click="confirmSettle">确认提交</el-button>
      </template>
    </el-dialog>

  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { io } from 'socket.io-client'
import axios from 'axios'
import { ElMessage, ElMessageBox } from 'element-plus'

const socket = io('http://localhost:3000')

const step = ref('login')
const nickname = ref(localStorage.getItem('avalon_name') || '')
const userList = ref([])
const hasRoom = ref(false)
const hostName = ref('') 
const players = ref([])
const myRole = ref('')
const firstSpeaker = ref('')
const viewInfo = ref([])
const isRevealed = ref(false)
const showRoleTips = ref(false)

// 结算相关
const showSettleDialog = ref(false)
const settleWinner = ref('blue')
const settleReason = ref('')

const CONFIG_DETAILS = {
  5: '梅林, 派西维尔, 忠臣 | 莫甘娜, 刺客',
  6: '梅林, 派西维尔, 忠臣x2 | 莫甘娜, 刺客',
  7: '梅林, 派西维尔, 忠臣x2 | 莫甘娜, 刺客, 奥博伦',
  8: '梅林, 派西维尔, 忠臣x3 | 莫甘娜, 刺客, 爪牙',
  9: '梅林, 派西维尔, 忠臣x4 | 莫甘娜, 刺客, 莫德雷德',
  10: '梅林, 派西维尔, 忠臣x4 | 莫甘娜, 刺客, 莫德雷德, 奥博伦'
}
const getRoleConfig = (n) => { const map = {5:'3好2坏',6:'4好2坏',7:'4好3坏',8:'5好3坏',9:'6好3坏',10:'6好4坏'}; return map[n] || '人数不足' }

const isHost = computed(() => hostName.value === nickname.value)
const amIReady = computed(() => players.value.find(p => p.name === nickname.value)?.isReady)
const isAllReady = computed(() => players.value.length >= 5 && players.value.every(p => p.isReady))

onMounted(async () => {
  try {
    const res = await axios.get('http://localhost:3000/api/users')
    userList.value = res.data
  } catch (e) {}
})

const handleLogin = () => {
  if(!nickname.value) return ElMessage.warning('请输入名字')
  localStorage.setItem('avalon_name', nickname.value)
  socket.emit('login', { nickname: nickname.value })
}
const createRoom = () => { socket.emit('join_game', { nickname: nickname.value }) }
const joinRoom = () => { socket.emit('join_game', { nickname: nickname.value }) }
const toggleReady = () => socket.emit('toggle_ready')
const startGame = () => socket.emit('start_game')
const resetGame = () => { showSettleDialog.value = true } // 只有房主能点
const kickPlayer = (target) => {
  ElMessageBox.confirm(`踢出 ${target}?`, '提示', {confirmButtonText:'确定',cancelButtonText:'取消',type:'warning'}).then(() => socket.emit('kick_player', target))
}

const confirmSettle = () => {
  if (!settleReason.value) return ElMessage.warning('请选择胜利原因')
  socket.emit('reset_game', { winner: settleWinner.value, winReason: settleReason.value })
  showSettleDialog.value = false
  settleReason.value = '' // 重置原因，保留winner习惯
}

// --- 监听 ---
socket.on('login_success', (data) => {
  hasRoom.value = data.hasRoom
  if (data.isReconnecting) { step.value = 'action'; ElMessage.success(`欢迎回来 ${nickname.value}`) } 
  else { step.value = 'action' }
})

socket.on('login_conflict', () => {
  ElMessageBox.confirm(`账号 ${nickname.value} 当前已在线。是否强制登录？`, '冲突', { confirmButtonText: '强制登录', cancelButtonText: '取消', type: 'warning' })
  .then(() => socket.emit('force_login', { nickname: nickname.value }))
})

socket.on('force_logout', () => {
  ElMessageBox.alert('您的账号在其他设备登录，您已被强制下线。', '下线通知', { confirmButtonText: '好的', callback: () => location.reload() })
})

socket.on('kicked_out', () => {
    ElMessageBox.alert('您已被房主移出房间。', '提示', { confirmButtonText: '确定', callback: () => { step.value = 'action' } })
})

socket.on('room_update', (data) => {
  hostName.value = data.hostName
  players.value = data.players
  if ((step.value === 'action' || step.value === 'login') && players.value.some(p => p.name === nickname.value)) { step.value = 'lobby' }
  if (data.hostName) hasRoom.value = true
})

socket.on('room_status_changed', (data) => hasRoom.value = data.hasRoom)
socket.on('game_start', (data) => { myRole.value = data.myRole; viewInfo.value = data.viewInfo; firstSpeaker.value = data.firstSpeaker; step.value = 'game' })

// 游戏结束监听
socket.on('game_over', (data) => { 
  step.value = 'lobby'; 
  myRole.value = ''
  if (data.winner) {
    const text = data.winner === 'blue' ? '🔵 好人阵营胜利！' : '🔴 坏人阵营胜利！'
    ElMessage({ message: text, type: 'success', duration: 4000, showClose: true })
  }
})

socket.on('error_msg', (msg) => ElMessage.warning(msg))

// --- 辅助 ---
const getRoleName = (r) => ({'Merlin':'梅林','Percival':'派西维尔','Loyal':'忠臣','Morgana':'莫甘娜','Assassin':'刺客','Minion':'爪牙','Oberon':'奥博伦','Mordred':'莫德雷德'}[r] || r)
const getRoleColor = (r) => ['Merlin','Percival','Loyal'].includes(r) ? 'blue-bg' : 'red-bg'
const getTeamName = (r) => ['Merlin','Percival','Loyal'].includes(r) ? '好人' : '坏人'
const getRoleDesc = (r) => { if(r==='Merlin')return '你知道谁是坏人';if(r==='Percival')return '你需要保护梅林';if(r==='Assassin')return '结束时刺杀梅林';return '隐藏身份' }
</script>

<style scoped>
/* 保持原有样式 */
.app-layout { height: 100vh; display: flex; flex-direction: column; background-color: #f0f2f5; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; overflow: hidden; }
.nav-bar { background: #fff; padding: 0 15px; height: 50px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 1px 4px rgba(0,0,0,0.05); flex-shrink: 0; z-index: 10; }
.nav-left { display: flex; align-items: center; gap: 10px; }
.nav-title { font-weight: bold; font-size: 16px; color: #333; }
.nav-help { font-size: 12px; color: #409eff; cursor: pointer; border: 1px solid #409eff; padding: 1px 6px; border-radius: 4px; }
.nav-user { background: #ecf5ff; color: #409eff; padding: 4px 10px; border-radius: 12px; font-size: 13px; font-weight: 500; }

.content-area { flex: 1; display: flex; flex-direction: column; padding: 15px; box-sizing: border-box; overflow: hidden; }
.center-wrapper { margin-top: 60px; text-align: center; }
.full-width { width: 100%; }
.mb-20 { margin-bottom: 20px; }
.mb-10 { margin-bottom: 10px; }
.page-title { margin-bottom: 5px; }
.sub-text { color: #999; margin-bottom: 25px; font-size: 14px; }

.action-card { background: #fff; padding: 30px 20px; border-radius: 12px; width: 100%; text-align: center; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
.big-btn { width: 100%; height: 50px; margin-top: 15px; font-size: 18px; }
.status-badge { display: inline-block; padding: 5px 12px; background: #e1f3d8; color: #67c23a; border-radius: 20px; font-weight: bold; margin-bottom: 10px; }
.status-badge.gray { background: #f4f4f5; color: #909399; }

.lobby-wrapper { display: flex; flex-direction: column; height: 100%; }
.room-header { background: #fff; padding: 15px; border-radius: 8px; margin-bottom: 10px; flex-shrink: 0; }
.room-title { font-size: 18px; font-weight: bold; margin-bottom: 5px; }
.room-config { font-size: 13px; color: #666; background: #f2f3f5; padding: 2px 6px; border-radius: 4px; display: inline-block; }

.player-list { flex: 1; overflow-y: auto; background: #fff; border-radius: 8px; padding: 5px 10px; margin-bottom: 15px; }
.player-row { display: flex; justify-content: space-between; padding: 12px 5px; border-bottom: 1px solid #f5f5f5; align-items: center; }
.p-left { display: flex; align-items: center; }
.p-right { display: flex; align-items: center; gap: 8px; }
.p-name { font-weight: 500; font-size: 15px; }
.tag-host { font-size: 10px; background: #E6A23C; color: white; padding: 1px 4px; border-radius: 3px; margin-left: 5px; }
.ready-yes { color: #67C23A; font-weight: bold; font-size: 14px; }
.ready-no { color: #909399; font-size: 14px; }
.kick-btn { padding: 0 !important; color: #F56C6C; margin-left: 5px; font-size: 12px; }

.lobby-footer { flex-shrink: 0; }
.waiting-text { text-align: center; color: #999; font-size: 13px; padding: 10px; }

.game-wrapper { display: flex; flex-direction: column; height: 100%; }
.game-status-bar { background: #fff; padding: 10px 15px; border-radius: 8px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center; font-size: 14px; flex-shrink: 0; }
.small-config { font-size: 12px; color: #409eff; cursor: pointer; }

.card-area { flex: 1; background: #333; border-radius: 16px; position: relative; overflow: hidden; box-shadow: 0 8px 20px rgba(0,0,0,0.3); margin-bottom: 15px; cursor: pointer; -webkit-tap-highlight-color: transparent; user-select: none; }
.card-face { position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: space-between; padding: 20px; box-sizing: border-box; }
.card-back { background: linear-gradient(135deg, #2c3e50, #1a1a1a); color: #ccc; }
.card-front.blue-bg { background: linear-gradient(135deg, #3498db, #2980b9); color: #fff; }
.card-front.red-bg { background: linear-gradient(135deg, #e74c3c, #c0392b); color: #fff; }
.card-user-label { font-size: 16px; opacity: 0.8; border-bottom: 1px solid rgba(255,255,255,0.2); padding-bottom: 8px; width: 100%; text-align: center; }
.card-center { flex: 1; display: flex; flex-direction: column; justify-content: center; align-items: center; width: 100%; }
.logo { font-size: 80px; margin-bottom: 10px; }
.role-name { font-size: 36px; margin: 0 0 10px 0; font-weight: bold; }
.role-desc { font-size: 16px; opacity: 0.9; text-align: center; }
.vision-box { background: rgba(0,0,0,0.25); padding: 10px; border-radius: 8px; margin-top: 20px; width: 100%; text-align: center; }
.vision-tags span { display: inline-block; background: rgba(255,255,255,0.25); margin: 4px; padding: 2px 8px; border-radius: 4px; font-weight: bold; }
.game-footer { flex-shrink: 0; }
.pulse { animation: pulse 2s infinite; }
@keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.7; } 100% { opacity: 1; } }

.role-table { max-height: 400px; overflow-y: auto; }
.role-row { display: flex; padding: 10px; border-bottom: 1px solid #eee; font-size: 13px; }
.role-row.highlight { background: #ecf5ff; font-weight: bold; color: #409eff; }
.role-num { width: 50px; font-weight: bold; flex-shrink: 0; }
.role-desc-text { flex: 1; line-height: 1.4; }

/* 结算弹窗样式优化 */
.blue-radio:deep(.el-radio-button__inner) { color: #409eff; }
.red-radio:deep(.el-radio-button__inner) { color: #f56c6c; }
.el-radio-group .is-active.blue-radio:deep(.el-radio-button__inner) { background-color: #409eff; border-color: #409eff; box-shadow: -1px 0 0 0 #409eff; color: white; }
.el-radio-group .is-active.red-radio:deep(.el-radio-button__inner) { background-color: #f56c6c; border-color: #f56c6c; box-shadow: -1px 0 0 0 #f56c6c; color: white; }
</style>