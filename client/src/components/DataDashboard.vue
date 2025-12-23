<template>
    <div class="dashboard-container">
      <div class="header">
        <div class="header-left">
          <h2>📊 战绩中心</h2>
          <span class="subtitle">数据驱动复盘</span>
        </div>
        <el-button @click="$emit('back')" circle icon="Close" />
      </div>
  
      <el-tabs v-model="activeTab" class="custom-tabs">
        
        <el-tab-pane label="全员战况" name="global">
          <div class="summary-cards">
            <div class="s-card">
              <div class="num">{{ globalStats.totalGames }}</div>
              <div class="label">总对局</div>
            </div>
            <div class="s-card">
              <div class="num">{{ globalStats.avgDuration }}</div>
              <div class="label">平均时长</div>
            </div>
            <div class="s-card">
              <div class="num">{{ globalStats.totalDuration }}</div>
              <div class="label">累计游戏</div>
            </div>
          </div>
  
          <div class="chart-box">
            <h4>⚖️ 阵营胜率</h4>
            <div ref="winRateChart" class="chart-container"></div>
          </div>
  
          <div class="chart-box">
            <h4>🏆 胜负原因分布</h4>
            <div ref="reasonChart" class="chart-container" style="height: 250px;"></div>
          </div>
        </el-tab-pane>
  
        <el-tab-pane label="风云榜" name="rank">
          <el-table :data="leaderboard" style="width: 100%" :default-sort="{ prop: 'winRate', order: 'descending' }" size="small">
            <el-table-column type="index" label="#" width="35" />
            <el-table-column prop="_id" label="玩家" width="70" show-overflow-tooltip />
            
            <el-table-column label="总胜率" prop="winRate" sortable width="85">
              <template #default="scope">
                <span class="rate-text" :class="getRateClass(scope.row.winRate)">
                  {{ scope.row.winRate.toFixed(0) }}%
                </span>
                <span class="sub-text">({{ scope.row.wins }})</span>
              </template>
            </el-table-column>
  
            <el-table-column label="好人" width="65">
              <template #default="scope">
                <span class="mini-rate blue">{{ scope.row.goodWinRate.toFixed(0) }}%</span>
                <div class="mini-count">{{ scope.row.goodTotal }}场</div>
              </template>
            </el-table-column>
  
            <el-table-column label="坏人" width="65">
              <template #default="scope">
                <span class="mini-rate red">{{ scope.row.badWinRate.toFixed(0) }}%</span>
                <div class="mini-count">{{ scope.row.badTotal }}场</div>
              </template>
            </el-table-column>
            
            <el-table-column label="梅林" width="60">
              <template #default="scope">
                <span v-if="scope.row.merlinTotal" class="mini-rate">{{ scope.row.merlinRate.toFixed(0) }}%</span>
                <span v-else class="mini-empty">-</span>
              </template>
            </el-table-column>
            
            <el-table-column label="刺客" width="60">
              <template #default="scope">
                 <span v-if="scope.row.assassinTotal" class="mini-rate">{{ scope.row.assassinRate.toFixed(0) }}%</span>
                 <span v-else class="mini-empty">-</span>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>
  
        <el-tab-pane label="个人画像" name="profile">
          <div class="profile-card">
            <div class="p-header">
              <div class="avatar">{{ nickname[0] }}</div>
              <div class="p-info">
                <div class="big-name">{{ nickname }}</div>
                <div class="tags">
                  <el-tag v-for="t in myProfile.titles" :key="t.text" :type="t.type" size="small" effect="dark">{{ t.text }}</el-tag>
                </div>
              </div>
            </div>
            
            <div ref="radarChart" class="radar-container"></div>
            
            <h4 class="sub-title">🎭 身份偏好</h4>
            <div ref="roleDistChart" class="chart-container" style="height: 200px;"></div>
          </div>
  
          <div class="history-section">
            <h4>📜 近期战绩</h4>
            <div class="history-list">
              <div v-for="game in historyList" :key="game._id" class="history-card" @click="viewMatch(game)">
                <div class="h-header">
                  <span class="h-date">{{ formatDate(game.endTime) }}</span>
                  <span class="h-result" :class="getMyResult(game) ? 'win' : 'lose'">
                    {{ getMyResult(game) ? '胜利' : '失败' }}
                  </span>
                </div>
                <div class="h-body">
                  <div class="h-role">
                    <span :class="getRoleColor(getMyRole(game))">{{ getRoleName(getMyRole(game)) }}</span>
                  </div>
                  <div class="h-reason">{{ formatReason(game.winReason) }}</div>
                </div>
              </div>
              
              <div class="load-more">
                <el-button v-if="hasMore" @click="loadMoreHistory" text bg>加载更多</el-button>
                <span v-else class="no-more">没有更多了</span>
              </div>
            </div>
          </div>
        </el-tab-pane>
  
      </el-tabs>
  
      <el-dialog v-model="showMatchDialog" title="📝 对局复盘" width="95%" class="match-dialog">
        <div v-if="currentMatch">
          <div class="match-banner" :class="currentMatch.winner === 'blue' ? 'bg-blue' : 'bg-red'">
            <div class="m-winner">{{ currentMatch.winner === 'blue' ? '🔵 好人胜利' : '🔴 坏人胜利' }}</div>
            <div class="m-reason">{{ formatReason(currentMatch.winReason) }}</div>
            <div class="m-time">时长: {{ calcDuration(currentMatch) }}</div>
          </div>
          
          <div class="player-grid">
            <div v-for="p in currentMatch.players" :key="p.nickname" class="p-card" :class="{ 'is-me': p.nickname === nickname }">
              <div class="p-role-icon">{{ getRoleIcon(p.role) }}</div>
              <div class="p-name">{{ p.nickname }}</div>
              <div class="p-role-name" :class="getRoleColor(p.role)">{{ getRoleName(p.role) }}</div>
              <div class="p-win-tag" v-if="p.isWin">🏆</div>
            </div>
          </div>
        </div>
      </el-dialog>
    </div>
  </template>
  
  <script setup>
  import { ref, onMounted, nextTick, watch } from 'vue'
  import axios from 'axios'
  import * as echarts from 'echarts'
  
  const props = defineProps(['nickname'])
  const emit = defineEmits(['back'])
  
  const activeTab = ref('global')
  const globalStats = ref({})
  const leaderboard = ref([])
  const myProfile = ref({ titles: [], radar: [], roleDist: [] })
  const historyList = ref([])
  const page = ref(1)
  const hasMore = ref(true)
  
  const winRateChart = ref(null)
  const reasonChart = ref(null)
  const radarChart = ref(null)
  const roleDistChart = ref(null) // 新图表引用
  
  const showMatchDialog = ref(false)
  const currentMatch = ref(null)
  
  onMounted(() => {
    loadGlobal()
    loadLeaderboard()
    loadProfile()
    loadMoreHistory()
  })
  
  watch(activeTab, (val) => {
    nextTick(() => {
      if (val === 'global') initGlobalCharts()
      if (val === 'profile') { initRadarChart(); initRoleDistChart(); }
    })
  })
  
  const loadGlobal = async () => {
    const res = await axios.get('http://localhost:3000/api/stats/global')
    globalStats.value = res.data
    nextTick(initGlobalCharts)
  }
  
  const loadLeaderboard = async () => {
    const res = await axios.get('http://localhost:3000/api/stats/leaderboard')
    leaderboard.value = res.data
  }
  
  const loadProfile = async () => {
    if (!props.nickname) return
    const res = await axios.get(`http://localhost:3000/api/stats/profile/${props.nickname}`)
    myProfile.value = res.data
  }
  
  const loadMoreHistory = async () => {
    const res = await axios.get('http://localhost:3000/api/stats/history', {
      params: { page: page.value, pageSize: 5, nickname: props.nickname }
    })
    if (res.data.length < 5) hasMore.value = false
    historyList.value.push(...res.data)
    page.value++
  }
  
  // === 图表绘制 ===
  const initGlobalCharts = () => {
    if (!winRateChart.value || !reasonChart.value) return
    
    // 1. 胜率饼图
    const pie = echarts.init(winRateChart.value)
    pie.setOption({
      tooltip: { trigger: 'item', formatter: '{b}: {c}%' },
      legend: { bottom: '0%' },
      color: ['#409eff', '#f56c6c'],
      series: [{
        name: '胜率', type: 'pie', radius: ['40%', '70%'],
        label: { show: true, formatter: '{b}\n{c}%' }, // 显示数字
        data: [
          { value: parseFloat(globalStats.value.blueRate), name: '好人' },
          { value: parseFloat(globalStats.value.redRate), name: '坏人' }
        ]
      }]
    })
  
    // 2. 胜因柱状图 (中文映射)
    const bar = echarts.init(reasonChart.value)
    const reasons = globalStats.value.reasonStats || []
    const reasonMap = { 
        'Mission Success': '做任务成功', 
        'Mission Failed': '做任务失败', 
        'Assassination Failed': '刺杀失败', 
        'Merlin Assassinated': '梅林被刺' 
    }
    
    bar.setOption({
      tooltip: { trigger: 'axis' },
      grid: { top: 10, bottom: 20, left: 10, right: 20, containLabel: true },
      xAxis: { type: 'value' },
      yAxis: { type: 'category', data: reasons.map(r => reasonMap[r.name] || r.name) },
      series: [{
        data: reasons.map(r => r.value),
        type: 'bar',
        label: { show: true, position: 'right' }, // 显示具体局数
        itemStyle: { color: '#67c23a', borderRadius: [0, 10, 10, 0] }
      }]
    })
  }
  
  const initRadarChart = () => {
    if (!radarChart.value || !myProfile.value.radar) return
    const radar = echarts.init(radarChart.value)
    radar.setOption({
      radar: {
        indicator: myProfile.value.radar.map(item => ({ name: item.name, max: item.max })),
        shape: 'circle',
        splitArea: { areaStyle: { color: ['#f8f9fa', '#fff'] } }
      },
      series: [{
        type: 'radar',
        data: [{
          value: myProfile.value.radar.map(item => item.value),
          name: '能力值',
          areaStyle: { color: 'rgba(64,158,255, 0.2)' },
          itemStyle: { color: '#409eff' }
        }]
      }]
    })
  }
  
  // 新增：身份分布饼图
  const initRoleDistChart = () => {
      if (!roleDistChart.value || !myProfile.value.roleDist) return
      const chart = echarts.init(roleDistChart.value)
      
      // 角色中文映射
      const roleMap = {'Merlin':'梅林','Percival':'派西维尔','Loyal':'忠臣','Morgana':'莫甘娜','Assassin':'刺客','Minion':'爪牙','Oberon':'奥博伦','Mordred':'莫德雷德'};
  
      chart.setOption({
          tooltip: { trigger: 'item' },
          series: [{
              name: '身份占比',
              type: 'pie',
              radius: '60%',
              data: myProfile.value.roleDist.map(item => ({
                  value: item.value,
                  name: roleMap[item.name] || item.name
              })),
              emphasis: { itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0, 0, 0, 0.5)' } }
          }]
      })
  }
  
  // === 辅助 ===
  const viewMatch = (game) => { currentMatch.value = game; showMatchDialog.value = true }
  const getMyRole = (game) => game.players.find(p => p.nickname === props.nickname)?.role
  const getMyResult = (game) => game.players.find(p => p.nickname === props.nickname)?.isWin
  const formatDate = (d) => { const date = new Date(d); return `${date.getMonth()+1}-${date.getDate()} ${date.getHours()}:${date.getMinutes()<10?'0':''}${date.getMinutes()}` }
  const calcDuration = (game) => {
    if(!game.startTime || !game.endTime) return '-'
    const min = Math.floor((new Date(game.endTime) - new Date(game.startTime))/60000)
    return min + '分钟'
  }
  const formatReason = (r) => ({'Mission Success':'做任务成功','Mission Failed':'做任务失败','Assassination Failed':'刺杀失败','Merlin Assassinated':'梅林被刺'}[r] || r)
  const getRoleName = (r) => ({'Merlin':'梅林','Percival':'派西维尔','Loyal':'忠臣','Morgana':'莫甘娜','Assassin':'刺客','Minion':'爪牙','Oberon':'奥博伦','Mordred':'莫德雷德'}[r] || r)
  const getRoleColor = (r) => ['Merlin','Percival','Loyal'].includes(r) ? 'color-blue' : 'color-red'
  const getRoleIcon = (r) => ['Merlin','Percival','Loyal'].includes(r) ? '🛡️' : '🗡️'
  const getRateClass = (rate) => rate >= 60 ? 'high' : (rate < 40 ? 'low' : 'mid')
  </script>
  
  <style scoped>
  /* 保持原有样式，增加微调 */
  .dashboard-container { padding: 15px; background: #f7f8fa; min-height: 100vh; font-family: -apple-system, sans-serif; }
  .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; }
  .header h2 { margin: 0; font-size: 20px; }
  .subtitle { font-size: 12px; color: #999; margin-left: 8px; }
  
  .summary-cards { display: flex; gap: 8px; margin-bottom: 15px; }
  .s-card { flex: 1; background: #fff; padding: 10px; border-radius: 8px; text-align: center; box-shadow: 0 2px 8px rgba(0,0,0,0.03); }
  .s-card .num { font-size: 16px; font-weight: bold; color: #333; }
  .s-card .label { font-size: 10px; color: #999; margin-top: 2px; }
  
  .chart-box { background: #fff; padding: 10px; border-radius: 8px; margin-bottom: 10px; }
  .chart-box h4 { margin: 0 0 10px 0; font-size: 14px; border-left: 3px solid #409eff; padding-left: 8px; }
  .chart-container { height: 180px; width: 100%; }
  
  /* 排行榜微调 */
  .rate-text { font-weight: bold; font-size: 13px; }
  .rate-text.high { color: #f56c6c; }
  .rate-text.mid { color: #e6a23c; }
  .rate-text.low { color: #909399; }
  .sub-text { font-size: 10px; color: #ccc; transform: scale(0.9); display: inline-block; }
  
  .mini-rate { font-size: 12px; font-weight: bold; }
  .mini-rate.blue { color: #409eff; }
  .mini-rate.red { color: #f56c6c; }
  .mini-count { font-size: 10px; color: #ccc; }
  .mini-empty { color: #eee; }
  
  /* 个人画像 */
  .profile-card { background: #fff; border-radius: 12px; padding: 15px; margin-bottom: 15px; }
  .p-header { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
  .avatar { width: 50px; height: 50px; border-radius: 50%; background: linear-gradient(135deg, #667eea, #764ba2); color: white; display: flex; justify-content: center; align-items: center; font-size: 20px; font-weight: bold; }
  .big-name { font-size: 18px; font-weight: bold; }
  .sub-title { margin: 10px 0; font-size: 14px; color: #666; text-align: center; }
  
  .history-card { background: #fff; border-radius: 8px; padding: 10px; margin-bottom: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
  .h-header { display: flex; justify-content: space-between; margin-bottom: 5px; font-size: 12px; color: #999; }
  .h-result { font-weight: bold; font-size: 13px; }
  .h-result.win { color: #f56c6c; }
  .h-result.lose { color: #909399; }
  .h-body { display: flex; justify-content: space-between; align-items: center; font-size: 13px; }
  .color-blue { color: #409eff; font-weight: bold; }
  .color-red { color: #f56c6c; font-weight: bold; }
  
  .match-banner { padding: 15px; color: white; text-align: center; border-radius: 8px 8px 0 0; margin: -20px -20px 15px -20px; }
  .bg-blue { background: linear-gradient(135deg, #3498db, #2980b9); }
  .bg-red { background: linear-gradient(135deg, #e74c3c, #c0392b); }
  .player-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
  .p-card { background: #f8f9fa; border-radius: 6px; padding: 8px; text-align: center; position: relative; font-size: 12px; }
  .p-card.is-me { border: 1px solid #409eff; background: #ecf5ff; }
  .p-role-icon { font-size: 20px; margin-bottom: 2px; }
  </style>