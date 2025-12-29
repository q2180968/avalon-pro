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
            <div class="num">{{ globalStats.total }}</div>
            <div class="label">总对局</div>
          </div>
          <div class="s-card">
            <div class="num">{{ globalStats.avgTime }}</div>
            <div class="label">平均时长</div>
          </div>
          <div class="s-card">
            <div class="num">{{ globalStats.totalTime }}</div>
            <div class="label">累计游戏</div>
          </div>
        </div>

        <div class="charts-row">
          <div class="chart-box half">
            <h4>⚖️ 阵营胜率</h4>
            <div ref="winRateChart" class="chart-container"></div>
          </div>
          <div class="chart-box half">
            <h4>🏆 胜负原因</h4>
            <div ref="reasonChart" class="chart-container"></div>
          </div>
        </div>

        <div class="history-section">
          <h4>📜 全员历史战局</h4>
          <div class="history-list">
            <div v-for="game in globalHistoryList" :key="game._id" class="history-card" @click="viewMatch(game)">
              <div class="h-header">
                <span class="h-date">{{ formatDate(game.endTime) }}</span>
                <span class="h-result" :class="game.winner === 'blue' ? 'win-blue' : 'win-red'">
                  {{ game.winner === 'blue' ? '好人胜' : '坏人胜' }}
                </span>
              </div>
              <div class="h-body">
                <div class="h-info">房主: {{ game.hostName }} | {{ game.players.length }}人局 | {{ calcDuration(game) }}</div>
                <div class="h-reason">{{ formatReason(game.winReason) }}</div>
              </div>
            </div>
            
            <div class="load-more">
              <el-button v-if="globalHasMore" @click="loadGlobalHistory" text bg size="small">加载更多</el-button>
              <span v-else class="no-more">没有更多了</span>
            </div>
          </div>
        </div>
      </el-tab-pane>

      <el-tab-pane label="风云榜" name="rank">
        <el-table :data="leaderboard" style="width: 100%" :default-sort="{ prop: 'winRate', order: 'descending' }" size="small" stripe border>
          <el-table-column type="index" label="#" width="40" align="center" fixed />
          <el-table-column prop="_id" label="玩家" width="70" show-overflow-tooltip fixed />
          
          <el-table-column label="总胜率" prop="winRate" sortable width="100" align="center" fixed>
            <template #default="scope">
              <div class="cell-main" :class="getRateClass(scope.row.winRate)">{{ scope.row.winRate.toFixed(0) }}%</div>
              <div class="cell-sub">{{ scope.row.wins }}胜/{{ scope.row.total }}局</div>
            </template>
          </el-table-column>

          <el-table-column label="好人" width="80" align="center">
            <template #default="s"><div class="cell-main blue">{{ s.row.goodRate.toFixed(0) }}%</div><div class="cell-sub">{{ s.row.goodWins }}/{{ s.row.goodTotal }}</div></template>
          </el-table-column>
          <el-table-column label="坏人" width="80" align="center">
            <template #default="s"><div class="cell-main red">{{ s.row.badRate.toFixed(0) }}%</div><div class="cell-sub">{{ s.row.badWins }}/{{ s.row.badTotal }}</div></template>
          </el-table-column>
          
          <el-table-column label="梅林" width="75" align="center">
            <template #default="s"><div v-if="s.row.merlinTotal"><span class="mini-rate">{{ s.row.merlinRate.toFixed(0) }}%</span><div class="mini-sub">{{ s.row.merlinWins }}/{{ s.row.merlinTotal }}</div></div><span v-else class="mini-empty">-</span></template>
          </el-table-column>
          <el-table-column label="刺客" width="75" align="center">
            <template #default="s"><div v-if="s.row.assassinTotal"><span class="mini-rate">{{ s.row.assassinRate.toFixed(0) }}%</span><div class="mini-sub">{{ s.row.assassinWins }}/{{ s.row.assassinTotal }}</div></div><span v-else class="mini-empty">-</span></template>
          </el-table-column>
          <el-table-column label="派西" width="75" align="center">
            <template #default="s"><div v-if="s.row.percivalTotal"><span class="mini-rate">{{ s.row.percivalRate.toFixed(0) }}%</span><div class="mini-sub">{{ s.row.percivalWins }}/{{ s.row.percivalTotal }}</div></div><span v-else class="mini-empty">-</span></template>
          </el-table-column>
          <el-table-column label="莫甘娜" width="75" align="center">
            <template #default="s"><div v-if="s.row.morganaTotal"><span class="mini-rate">{{ s.row.morganaRate.toFixed(0) }}%</span><div class="mini-sub">{{ s.row.morganaWins }}/{{ s.row.morganaTotal }}</div></div><span v-else class="mini-empty">-</span></template>
          </el-table-column>
          <el-table-column label="莫德" width="75" align="center">
            <template #default="s"><div v-if="s.row.mordredTotal"><span class="mini-rate">{{ s.row.mordredRate.toFixed(0) }}%</span><div class="mini-sub">{{ s.row.mordredWins }}/{{ s.row.mordredTotal }}</div></div><span v-else class="mini-empty">-</span></template>
          </el-table-column>
          <el-table-column label="奥博" width="75" align="center">
            <template #default="s"><div v-if="s.row.oberonTotal"><span class="mini-rate">{{ s.row.oberonRate.toFixed(0) }}%</span><div class="mini-sub">{{ s.row.oberonWins }}/{{ s.row.oberonTotal }}</div></div><span v-else class="mini-empty">-</span></template>
          </el-table-column>
          <el-table-column label="忠臣" width="75" align="center">
            <template #default="s"><div v-if="s.row.loyalTotal"><span class="mini-rate">{{ s.row.loyalRate.toFixed(0) }}%</span><div class="mini-sub">{{ s.row.loyalWins }}/{{ s.row.loyalTotal }}</div></div><span v-else class="mini-empty">-</span></template>
          </el-table-column>
          <el-table-column label="爪牙" width="75" align="center">
            <template #default="s"><div v-if="s.row.minionTotal"><span class="mini-rate">{{ s.row.minionRate.toFixed(0) }}%</span><div class="mini-sub">{{ s.row.minionWins }}/{{ s.row.minionTotal }}</div></div><span v-else class="mini-empty">-</span></template>
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
            <el-button type="info" link icon="InfoFilled" @click="showRuleDialog = true">规则说明</el-button>
          </div>
          
          <div class="charts-row">
            <div class="chart-box half">
               <div ref="radarChart" class="chart-container" style="height: 220px;"></div>
            </div>
            <div class="chart-box half">
               <div ref="roleDistChart" class="chart-container" style="height: 220px;"></div>
            </div>
          </div>
        </div>

        <div class="history-section">
          <h4>📜 我的近期战绩</h4>
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
              <el-button v-if="hasMore" @click="loadMoreHistory" text bg size="small">加载更多</el-button>
              <span v-else class="no-more">没有更多了</span>
            </div>
          </div>
        </div>
      </el-tab-pane>

    </el-tabs>

    <el-dialog v-model="showRuleDialog" title="ℹ️ 统计规则说明" width="85%">
      <div class="rule-content">
        <h4>🎖️ 称号获取条件</h4>
        <ul>
          <li><strong>常胜将军</strong>：总场次>5 且 胜率>60%</li>
          <li><strong>慈善赌王</strong>：总场次>5 且 胜率&lt;40%</li>
          <li><strong>天生反骨</strong>：坏人场次>2 且 坏人胜率>70%</li>
          <li><strong>正道的光</strong>：好人场次>2 且 好人胜率>75%</li>
          <li><strong>全知全能</strong>：梅林场次>2 且 梅林胜率>70%</li>
        </ul>
        <h4>🕸️ 雷达图维度</h4>
        <ul>
          <li><strong>综合</strong>：个人总胜率</li>
          <li><strong>逻辑</strong>：拿好人牌时的胜率</li>
          <li><strong>欺诈</strong>：拿坏人牌时的胜率</li>
          <li><strong>带队</strong>：拿梅林牌时的胜率</li>
          <li><strong>活跃</strong>：参与场次活跃度 (20场封顶)</li>
        </ul>
      </div>
    </el-dialog>

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

// 个人历史
const historyList = ref([])
const page = ref(1)
const hasMore = ref(true)

// 全员历史
const globalHistoryList = ref([])
const globalPage = ref(1)
const globalHasMore = ref(true)

const winRateChart = ref(null)
const reasonChart = ref(null)
const radarChart = ref(null)
const roleDistChart = ref(null)

const showMatchDialog = ref(false)
const showRuleDialog = ref(false)
const currentMatch = ref(null)

const ROLE_MAP = {'Merlin':'梅林','Percival':'派西维尔','Loyal':'忠臣','Morgana':'莫甘娜','Assassin':'刺客','Minion':'爪牙','Oberon':'奥博伦','Mordred':'莫德雷德'};
const REASON_MAP = {'Mission Success':'任务成功','Mission Failed':'任务失败','Assassination Failed':'刺杀失败','Merlin Assassinated':'梅林被刺'};

onMounted(() => {
  loadGlobal()
  loadLeaderboard()
  loadProfile()
  loadMoreHistory()
  loadGlobalHistory()
})

watch(activeTab, (val) => {
  nextTick(() => {
    if (val === 'global') initGlobalCharts()
    if (val === 'profile') { initRadarChart(); initRoleDistChart(); }
  })
})

const loadGlobal = async () => {
  const res = await axios.get('http://localhost:31111/api/stats/global')
  globalStats.value = res.data
  nextTick(initGlobalCharts)
}

const loadLeaderboard = async () => {
  const res = await axios.get('http://localhost:31111/api/stats/leaderboard')
  leaderboard.value = res.data
}

const loadProfile = async () => {
  if (!props.nickname) return
  const res = await axios.get(`http://localhost:31111/api/stats/profile/${props.nickname}`)
  myProfile.value = res.data
}

const loadMoreHistory = async () => {
  const res = await axios.get('http://localhost:31111/api/stats/history', {
    params: { page: page.value, pageSize: 5, nickname: props.nickname }
  })
  if (res.data.length < 5) hasMore.value = false
  historyList.value.push(...res.data)
  page.value++
}

const loadGlobalHistory = async () => {
  const res = await axios.get('http://localhost:31111/api/stats/history', {
    params: { page: globalPage.value, pageSize: 5 }
  })
  if (res.data.length < 5) globalHasMore.value = false
  globalHistoryList.value.push(...res.data)
  globalPage.value++
}

// === 图表绘制 ===
const initGlobalCharts = () => {
  if (!winRateChart.value || !reasonChart.value) return
  
  const pie = echarts.init(winRateChart.value)
  pie.setOption({
    tooltip: { trigger: 'item', formatter: '{b}: {c}%' },
    legend: { bottom: '0%' },
    color: ['#409eff', '#f56c6c'],
    series: [{
      name: '胜率', type: 'pie', radius: ['40%', '65%'],
      label: { show: true, formatter: '{b}\n{c}%' },
      data: [
        { value: parseFloat(globalStats.value.blueRate), name: '好人' },
        { value: parseFloat(globalStats.value.redRate), name: '坏人' }
      ]
    }]
  })

  const bar = echarts.init(reasonChart.value)
  const reasons = globalStats.value.reasons || []
  
  bar.setOption({
    tooltip: { trigger: 'axis' },
    grid: { top: 10, bottom: 20, left: 10, right: 30, containLabel: true },
    xAxis: { type: 'value' },
    yAxis: { type: 'category', data: reasons.map(r => REASON_MAP[r.name] || r.name) },
    series: [{
      data: reasons.map(r => r.value),
      type: 'bar',
      label: { show: true, position: 'right' },
      itemStyle: { color: '#67c23a', borderRadius: [0, 5, 5, 0] }
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

const initRoleDistChart = () => {
    if (!roleDistChart.value || !myProfile.value.roleDist) return
    const chart = echarts.init(roleDistChart.value)
    chart.setOption({
        tooltip: { trigger: 'item' },
        series: [{
            name: '身份占比', type: 'pie', radius: '60%',
            data: myProfile.value.roleDist.map(item => ({
                value: item.value, name: ROLE_MAP[item.name] || item.name
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
const formatReason = (r) => REASON_MAP[r] || r
const getRoleName = (r) => ROLE_MAP[r] || r
const getRoleColor = (r) => ['Merlin','Percival','Loyal'].includes(r) ? 'color-blue' : 'color-red'
const getRoleIcon = (r) => ['Merlin','Percival','Loyal'].includes(r) ? '🛡️' : '🗡️'
const getRateClass = (rate) => rate >= 60 ? 'high' : (rate < 40 ? 'low' : 'mid')
</script>

<style scoped>
.dashboard-container { padding: 15px; background: #f7f8fa; min-height: 100vh; font-family: -apple-system, sans-serif; overflow-y: auto; }
.header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; }
.header h2 { margin: 0; font-size: 20px; }
.subtitle { font-size: 12px; color: #999; margin-left: 8px; }

.summary-cards { display: flex; gap: 8px; margin-bottom: 15px; }
.s-card { flex: 1; background: #fff; padding: 10px; border-radius: 8px; text-align: center; box-shadow: 0 2px 8px rgba(0,0,0,0.03); }
.s-card .num { font-size: 16px; font-weight: bold; color: #333; }
.s-card .label { font-size: 10px; color: #999; margin-top: 2px; }

.charts-row { display: flex; gap: 10px; margin-bottom: 15px; }
.chart-box { background: #fff; padding: 10px; border-radius: 8px; flex: 1; box-shadow: 0 2px 8px rgba(0,0,0,0.03); }
.chart-box h4 { margin: 0 0 10px 0; font-size: 14px; border-left: 3px solid #409eff; padding-left: 8px; }
.chart-container { height: 180px; width: 100%; }

/* 排行榜 */
.cell-main { font-weight: bold; font-size: 13px; line-height: 1.2; }
.cell-main.blue { color: #409eff; }
.cell-main.red { color: #f56c6c; }
.cell-main.high { color: #f56c6c; }
.cell-main.mid { color: #e6a23c; }
.cell-main.low { color: #909399; }
.cell-sub { font-size: 10px; color: #999; transform: scale(0.9); }

.mini-rate { font-weight: bold; font-size: 12px; margin-right: 2px; }
.mini-sub { font-size: 10px; color: #aaa; transform: scale(0.9); display: inline-block; }
.mini-empty { color: #eee; font-size: 12px; }

/* 个人画像 */
.profile-card { background: #fff; border-radius: 12px; padding: 15px; margin-bottom: 15px; }
.p-header { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
.avatar { width: 50px; height: 50px; border-radius: 50%; background: linear-gradient(135deg, #667eea, #764ba2); color: white; display: flex; justify-content: center; align-items: center; font-size: 20px; font-weight: bold; }
.big-name { font-size: 18px; font-weight: bold; }
.tags { margin-left: auto; display: flex; gap: 5px; flex-wrap: wrap; }

.history-card { background: #fff; border-radius: 8px; padding: 10px; margin-bottom: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); cursor: pointer; }
.h-header { display: flex; justify-content: space-between; margin-bottom: 5px; font-size: 12px; color: #999; }
.h-result { font-weight: bold; font-size: 13px; }
.h-result.win { color: #f56c6c; }
.h-result.lose { color: #909399; }
.win-blue { color: #409eff; font-weight: bold; }
.win-red { color: #f56c6c; font-weight: bold; }
.h-body { display: flex; justify-content: space-between; align-items: center; font-size: 13px; }
.h-info { font-size: 12px; color: #666; }
.color-blue { color: #409eff; font-weight: bold; }
.color-red { color: #f56c6c; font-weight: bold; }

.match-banner { padding: 15px; color: white; text-align: center; border-radius: 8px 8px 0 0; margin: -20px -20px 15px -20px; }
.bg-blue { background: linear-gradient(135deg, #3498db, #2980b9); }
.bg-red { background: linear-gradient(135deg, #e74c3c, #c0392b); }
.player-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.p-card { background: #f8f9fa; border-radius: 6px; padding: 8px; text-align: center; position: relative; font-size: 12px; }
.p-card.is-me { border: 1px solid #409eff; background: #ecf5ff; }
.p-role-icon { font-size: 20px; margin-bottom: 2px; }
.load-more { text-align: center; padding-bottom: 20px; }
.no-more { font-size: 12px; color: #ccc; }

.rule-content ul { padding-left: 20px; margin: 5px 0; font-size: 13px; line-height: 1.6; color: #555; }
.rule-content h4 { margin: 10px 0 5px; color: #333; }
</style>