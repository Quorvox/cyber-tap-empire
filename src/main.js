import './style.css'

// премиум-магазин за внутриигровые $ (реальных платежей в демо нет)
const PRICES = { x2: 250000, mega: 40000, skin: 8000 }
const PREMIUM_NAMES = { x2:'X2 НАВСЕГДА', mega:'МЕГА БУСТ 10 МИН', skin:'СКИН ЯДРА' }
const SKINS = ['🧠', '🔥', '🐱', '💎', '👾']

window.buyPremium = (type) => {
  const price = PRICES[type]
  if(type==='x2' && state.hasX2) return toast('X2 уже куплен')
  if(state.balance < price) return toast(`Не хватает: нужно ${format(price)} $`)
  state.balance -= price
  if(type==='x2'){ state.hasX2 = true; toast('✅ X2 навсегда активирован!') }
  if(type==='mega'){
    // если буст ещё идёт — продлеваем
    const from = Math.max(Date.now(), state.boosts.megaUntil||0)
    state.boosts.megaUntil = from + 10*60*1000
    toast('⚡ МЕГА БУСТ x5 на 10 минут!')
  }
  if(type==='skin'){
    state.skin = ((state.skin||0) + 1) % SKINS.length
    applySkin()
    toast('🎨 Новый скин ядра!')
  }
  save(); renderAll()
}

function applySkin(){
  const el = document.querySelector('#tapCore .text-\\[52px\\]')
  if(el) el.textContent = SKINS[state.skin||0]
}

// GAME STATE
const BUILDINGS = [
  { id:'script', name:'Скрипт', icon:'💻', desc:'Пишет код за тебя', base:15, perSec:0.5 },
  { id:'botnet', name:'Ботнет', icon:'🤖', desc:'100 зомби-ПК', base:100, perSec:5 },
  { id:'gpu', name:'GPU Ферма', icon:'🎮', desc:'RTX 5090 x8', base:750, perSec:28 },
  { id:'datacenter', name:'Дата-Центр', icon:'🏢', desc:'Свой ЦОД', base:3200, perSec:140 },
  { id:'quantum', name:'Квантовый Кластер', icon:'⚛️', desc:'Кубиты майнят', base:15000, perSec:780 },
  { id:'aigod', name:'ИИ-Бог', icon:'🧬', desc:'Сингулярность', base:100000, perSec:4500 },
]

const ACHIEVS = [
  { id:'first', name:'Первый тап', icon:'👆', need:1, check: s=>s.clicks>=1 },
  { id:'hundred', name:'100 кликов', icon:'🔥', need:100, check: s=>s.clicks>=100 },
  { id:'thousand', name:'1,000 $', icon:'💰', need:1000, check: s=>s.totalEarned>=1000 },
  { id:'tenk', name:'10,000 $', icon:'💎', need:10000, check: s=>s.totalEarned>=10000 },
  { id:'shop3', name:'Магнат', icon:'🏦', need:3, check: s=> Object.values(s.owned).reduce((a,b)=>a+b,0)>=10 },
  { id:'prestige1', name:'Перепрошивка', icon:'🚀', need:1, check: s=>s.gems>=1 },
  { id:'offline', name:'Вернись!', icon:'🌙', need:1, check: s=> (Date.now()-s.lastSave)> 60*1000 },
  { id:'friend', name:'Реферал', icon:'👥', need:1, check: s=> s.referrals>=1 },
]

const PROMOS = {
  'QUOR': 2000,
  'START': 500,
  'CYBER': 1500,
  '2026': 2026,
  'TAP': 777,
}

let state = {
  balance: 0,
  totalEarned: 0,
  clicks: 0,
  level: 1,
  xp: 0,
  gems: 0,
  owned: {},
  clickMult: 1,
  globalMult: 1,
  lastSave: Date.now(),
  streak: 1,
  lastDaily: 0,
  referrals: 0,
  claimedOffline: false,
  boosts: { click2:false, auto:false, luck:false },
  usedPromos: [],
  achievements: {}
}
BUILDINGS.forEach(b=> state.owned[b.id]=0)

function load(){
  try{
    const saved = JSON.parse(localStorage.getItem('cyber_empire_v1')||'null')
    if(saved){ state = {...state, ...saved}; // merge
      BUILDINGS.forEach(b=> { if(state.owned[b.id]==null) state.owned[b.id]=0 })
    }
    // оффлайн доход
    const now = Date.now()
    const diffSec = Math.min(24*3600, Math.floor((now - (state.lastSave||now))/1000))
    // новый заход — снова можно удвоить
    state.claimedOffline = false
    state.offlineEarn = 0
    if(diffSec>5){
      const perSec = calcPerSec()
      const earn = Math.floor(perSec * diffSec)
      state.balance += earn
      state.totalEarned += earn
      state.offlineEarn = earn
      setTimeout(()=> {
        document.getElementById('offlineTime').textContent = formatTime(diffSec)
        document.getElementById('offlineEarn').textContent = format(earn)+' $'
      }, 100)
    }
    // рефералка
    const params = new URLSearchParams(location.search)
    const ref = params.get('ref')
    if(ref && !localStorage.getItem('ref_used')){
      localStorage.setItem('ref_used', ref)
      state.balance += 500
      state.referrals += 1
      toast(`🎉 Бонус по рефке ${ref}: +500 $`)
    }
    // level from totalEarned
    updateLevel()
  }catch(e){}
}
function save(){
  state.lastSave = Date.now()
  localStorage.setItem('cyber_empire_v1', JSON.stringify(state))
}
load()

function format(n){
  if(n>=1e9) return (n/1e9).toFixed(2)+'B'
  if(n>=1e6) return (n/1e6).toFixed(2)+'M'
  if(n>=1e3) return (n/1e3).toFixed(1)+'K'
  return Math.floor(n).toString()
}
function formatTime(s){
  if(s<60) return s+'с'
  if(s<3600) return Math.floor(s/60)+'м'
  return Math.floor(s/3600)+'ч '+Math.floor((s%3600)/60)+'м'
}
function calcPerSec(){
  let per = 0
  BUILDINGS.forEach(b=> per += b.perSec * state.owned[b.id])
  // глобальные множители: гемы + донат x2
  const gemMult = 1 + state.gems * 0.12
  const donateMult = state.hasX2 ? 2 : 1
  const prestigeMult = state.globalMult || 1
  let boostMult = 1
  if(state.boosts.luck) boostMult = 5
  if((state.boosts.megaUntil||0) > Date.now()) boostMult *= 5
  return per * gemMult * donateMult * prestigeMult * boostMult
}
function clickPower(){
  let base = 1
  // каждый 10 скриптов +1 к клику
  base += Math.floor(state.owned.script / 10)
  // каждый квант +5
  base += state.owned.quantum * 2
  base += state.owned.aigod * 10
  const gemMult = 1 + state.gems * 0.1
  const donateMult = state.hasX2 ? 2 : 1
  let b = base * gemMult * donateMult
  if(state.boosts.click2) b *= 2
  if(state.boosts.luck) b *= 5
  if((state.boosts.megaUntil||0) > Date.now()) b *= 5
  return Math.max(1, Math.floor(b))
}
function costOf(b, owned){
  return Math.floor(b.base * Math.pow(1.15, owned))
}
function updateLevel(){
  state.level = Math.floor(Math.sqrt(state.totalEarned / 400)) + 1
  state.xp = state.totalEarned % 1000
}

// UI REFS
const balanceEl = document.getElementById('balance')
const perSecEl = document.getElementById('perSec')
const gemsEl = document.getElementById('gems')
const levelEl = document.getElementById('level')
const xpBar = document.getElementById('xpBar')
const xpText = document.getElementById('xpText')
const statClicks = document.getElementById('statClicks')
const statEarned = document.getElementById('statEarned')
const multEl = document.getElementById('mult')
const prestigeBar = document.getElementById('prestigeBar')
const prestigePreview = document.getElementById('prestigePreview')
const prestigeBtn = document.getElementById('prestigeBtn')
const shopEl = document.getElementById('shop')
const core = document.getElementById('tapCore')
const particlesEl = document.getElementById('particles')
const clickPowerBadge = document.getElementById('clickPowerBadge')
const coreIncome = document.getElementById('coreIncome')

// RENDER SHOP
function renderShop(){
  shopEl.innerHTML = ''
  BUILDINGS.forEach(b=>{
    const owned = state.owned[b.id]
    const cost = costOf(b, owned)
    const can = state.balance >= cost
    const per = b.perSec
    const div = document.createElement('div')
    div.className = `shop-item card p-3 flex items-center gap-3 ${can?'affordable':''}`
    div.innerHTML = `
      <div class="w-11 h-11 rounded-xl grid place-items-center text-[20px] bg-white/10 border border-white/10">${b.icon}</div>
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2">
          <span class="font-black text-xs">${b.name}</span>
          <span class="text-[10px] px-1.5 py-0.5 rounded-full bg-white/10 mono">x${owned}</span>
          <span class="text-[10px] text-mint mono">+${per}/сек</span>
        </div>
        <div class="text-[11px] text-white/50 truncate">${b.desc}</div>
        <div class="text-[11px] mono font-bold ${can?'text-mint':'text-white/40'}">${format(cost)} $</div>
      </div>
      <button class="btn-primary px-3 py-2 text-xs font-black shrink-0">${can?'КУПИТЬ':'НЕТ $'}</button>
    `
    div.onclick = () => buy(b)
    shopEl.appendChild(div)
  })
}

function buy(b){
  const cost = costOf(b, state.owned[b.id])
  if(state.balance < cost){ toast('❌ Не хватает $'); shake(shopEl); return }
  state.balance -= cost
  state.owned[b.id]++
  // звук
  clickSound(600+ state.owned[b.id]*20)
  spawnParticle(`-${format(cost)} $`, '#ffd60a', 20)
  renderAll()
  checkAchieves()
}

// TAP LOGIC
let combo = 0, comboTimer=null
core.addEventListener('click', (e)=>{
  const rect = core.getBoundingClientRect()
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top
  doTap(x,y)
})
// touch для мобилок
core.addEventListener('touchstart', (e)=>{
  e.preventDefault()
  const t = e.touches[0]
  const rect = core.getBoundingClientRect()
  doTap(t.clientX-rect.left, t.clientY-rect.top)
},{passive:false})

function doTap(x,y){
  const power = clickPower()
  const isCrit = Math.random() < 0.07
  const gain = isCrit ? power * 10 : power
  state.balance += gain
  state.totalEarned += gain
  state.clicks++
  combo++
  clearTimeout(comboTimer)
  comboTimer = setTimeout(()=> combo=0, 1800)
  // xp
  updateLevel()
  // эффекты
  spawnParticle(`+${format(gain)}${isCrit?' CRIT!':''}`, isCrit?'#22ffaa':'#ffffff', x, y)
  if(isCrit){ core.classList.add('crit'); setTimeout(()=> core.classList.remove('crit'),300); clickSound(1200) } else { clickSound(400+Math.random()*200) }
  // тряска
  core.style.transform = `scale(.96) rotate(${ (Math.random()-.5)*4 }deg)`
  setTimeout(()=> core.style.transform='',80)
  // вибрация на мобилке
  if(navigator.vibrate) navigator.vibrate(isCrit?30:10)
  renderAll()
  checkAchieves()
  // автосейв каждые 5 кликов
  if(state.clicks%5===0) save()
}

function spawnParticle(text, color, x=160, y=80){
  const el = document.createElement('div')
  el.className='particle'
  el.textContent=text
  el.style.left = x+'px'
  el.style.top = y+'px'
  el.style.color=color
  el.style.fontSize = text.includes('CRIT')?'18px':'14px'
  particlesEl.appendChild(el)
  setTimeout(()=> el.remove(),800)
}

function shake(el){
  el.animate([{transform:'translateX(-4px)'},{transform:'translateX(4px)'},{transform:'translateX(0)'}],{duration:200})
}

// SOUND via WebAudio
let audioCtx=null
function clickSound(freq){
  try{
    if(!audioCtx) audioCtx = new (window.AudioContext||window.webkitAudioContext)()
    const o = audioCtx.createOscillator(), g=audioCtx.createGain()
    o.type='square'; o.frequency.value=freq; g.gain.value=0.08
    o.connect(g); g.connect(audioCtx.destination)
    o.start(); g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime+0.12)
    setTimeout(()=>o.stop(),130)
  }catch(e){}
}

// RENDER ALL
function renderAll(){
  const per = calcPerSec()
  balanceEl.textContent = format(state.balance)
  perSecEl.textContent = format(per)+' /сек'
  gemsEl.textContent = state.gems
  levelEl.textContent = state.level
  xpBar.style.width = (state.xp/1000*100)+'%'
  xpText.textContent = `${Math.floor(state.xp)} / 1000`
  statClicks.textContent = format(state.clicks)
  statEarned.textContent = format(state.totalEarned)+' $'
  const gemMult = (1+state.gems*0.12).toFixed(2)
  multEl.textContent = 'x'+gemMult + (state.hasX2?' • x2 PREMIUM':'')
  clickPowerBadge.textContent = '+'+clickPower()
  coreIncome.textContent = `+${format(per)} /сек внутри`

  // престиж
  const progress = Math.min(100, (state.totalEarned / 50000)*100)
  prestigeBar.style.width = progress+'%'
  const preview = Math.floor(Math.sqrt(state.totalEarned/50000))
  prestigePreview.textContent = preview+' ♦'
  if(state.totalEarned >= 50000 && preview>0){
    prestigeBtn.disabled=false
    prestigeBtn.classList.remove('opacity-50')
    prestigeBtn.classList.add('btn-primary')
    prestigeBtn.textContent = `ПЕРЕПРОШИВКА +${preview} ♦`
  } else {
    prestigeBtn.disabled=true
    prestigeBtn.classList.add('opacity-50')
    prestigeBtn.classList.remove('btn-primary')
  }

  renderShop()
  renderAchieves()
}

function renderAchieves(){
  const el = document.getElementById('achievements')
  el.innerHTML=''
  let done=0
  ACHIEVS.forEach(a=>{
    const unlocked = a.check(state) || state.achievements[a.id]
    if(unlocked) done++
    const d=document.createElement('div')
    d.className=`card p-2 text-center ${unlocked?'border-mint/40 bg-mint/10':'opacity-40'}`
    d.innerHTML=`<div class="text-[18px]">${a.icon}</div><div class="text-[8px] font-black leading-tight mt-1">${a.name}</div>`
    d.title = a.name
    el.appendChild(d)
  })
  document.getElementById('achProgress').textContent = done+'/'+ACHIEVS.length
}

function checkAchieves(){
  ACHIEVS.forEach(a=>{
    if(!state.achievements[a.id] && a.check(state)){
      state.achievements[a.id]=true
      toast(`🏆 Ачивка: ${a.name}`)
      clickSound(900)
    }
  })
}

// LEADERBOARD MOCK
function renderLeaderboard(){
  const board = document.getElementById('leaderboard')
  const names = ['xX_Neo_Xx','КиберКот','Аня_Tap','Vladimir_P','CryptoMom','SchoolBoy1337','RocketFox']
  const leaders = names.map((n,i)=> ({name:n, score: Math.floor(500000/(i+1) + Math.random()*50000)}))
  leaders.push({name:'ТЫ', score: state.totalEarned, me:true})
  leaders.sort((a,b)=> b.score-a.score)
  const myIdx = leaders.findIndex(l=>l.me)
  document.getElementById('myRank').textContent='#'+(myIdx+1)
  board.innerHTML=''
  leaders.slice(0,7).forEach((l,idx)=>{
    const div=document.createElement('div')
    div.className=`flex items-center gap-2 px-2 py-1.5 rounded-lg ${l.me?'bg-neon/20 border border-neon/30':'bg-white/5'}`
    div.innerHTML=`<span class="mono font-black text-[11px] w-5">#${idx+1}</span><span class="flex-1 font-bold truncate ${l.me?'text-neon':''}">${l.name}</span><span class="mono text-xs font-black">${format(l.score)}</span>`
    board.appendChild(div)
  })
}

// BOOSTS
document.getElementById('boostClick').onclick = function(){
  if(this.dataset.cd) return
  state.boosts.click2=true
  toast('⚡ КЛИК x2 на 30 сек!')
  clickSound(800)
  renderAll()
  this.classList.add('opacity-50')
  setTimeout(()=>{ state.boosts.click2=false; this.classList.remove('opacity-50'); toast('x2 закончился') ; renderAll()},30000)
  cooldown(this,60)
}
document.getElementById('autoclickBtn').onclick = function(){
  if(this.dataset.cd) return
  toast('🤖 Авто-тап 10 сек!')
  let t=0
  const iv=setInterval(()=>{ doTap(160+Math.random()*40-20, 120+Math.random()*40-20); if(++t>=20) clearInterval(iv)},500)
  cooldown(this,90)
}
document.getElementById('luckBtn').onclick = function(){
  if(this.dataset.cd) return
  state.boosts.luck=true
  toast('🎰 УДАЧА x5 на 5 сек! ТАПАЙ!')
  core.style.boxShadow='0 0 60px #22ffaa'
  setTimeout(()=>{ state.boosts.luck=false; core.style.boxShadow=''; renderAll()},5000)
  cooldown(this,45)
  renderAll()
}
function cooldown(btn, sec){
  btn.dataset.cd=1
  const orig = btn.innerHTML
  let s=sec
  btn.innerHTML=`<span class="mono font-black">${s}с</span>`
  const iv=setInterval(()=>{
    s--
    if(s<=0){ clearInterval(iv); btn.innerHTML=orig; delete btn.dataset.cd }
    else btn.innerHTML=`<span class="mono font-black">${s}с</span>`
  },1000)
}

// DAILY
document.getElementById('dailyBtn').onclick = ()=>{
  const now=Date.now()
  if(now - state.lastDaily < 20*3600*1000){ toast('🎁 Бонус уже получен! Приходи завтра'); return }
  const reward = 500 * state.streak
  state.balance+=reward
  state.totalEarned+=reward
  state.lastDaily=now
  state.streak++
  toast(`🎁 Ежедневный бонус +${reward} $ (стрик x${state.streak})`)
  save(); renderAll()
}

// PRESTIGE
prestigeBtn.onclick = ()=>{
  const gems = Math.floor(Math.sqrt(state.totalEarned/50000))
  if(gems<=0) return
  if(!confirm(`Перепрошивка даст +${gems} ♦ и сбросит всё кроме ♦. Продолжить?`)) return
  state.gems += gems
  state.balance=0
  state.totalEarned=0
  BUILDINGS.forEach(b=> state.owned[b.id]=0)
  state.globalMult = 1 + state.gems*0.05
  toast(`🚀 Перепрошивка! +${gems} ♦`)
  save(); renderAll(); renderLeaderboard()
}

// SHOP EXTRAS
document.getElementById('buyMax').onclick = ()=>{
  let bought=0
  // покупаем самый дешевый доступный по кругу
  for(let i=0;i<50;i++){
    let cheapest=null, cheapestCost=Infinity
    BUILDINGS.forEach(b=>{
      const c=costOf(b, state.owned[b.id])
      if(c<cheapestCost && state.balance>=c){ cheapest=b; cheapestCost=c }
    })
    if(!cheapest) break
    state.balance-=cheapestCost
    state.owned[cheapest.id]++
    bought++
  }
  if(bought) { toast(`🛒 Куплено ${bought} майнеров`); renderAll()}
  else toast('❌ Не хватает $')
}
let autoBuy=false, autoBuyIv=null
document.getElementById('autoBuyToggle').onclick = function(){
  autoBuy=!autoBuy
  this.textContent = autoBuy ? '🤖 Авто-покупка ON' : '🤖 Авто-покупка OFF'
  this.classList.toggle('bg-mint/20', autoBuy)
  if(autoBuy){
    autoBuyIv=setInterval(()=>{
      BUILDINGS.forEach(b=>{
        const c=costOf(b, state.owned[b.id])
        if(state.balance>=c){ state.balance-=c; state.owned[b.id]++; renderAll() }
      })
    },800)
  } else clearInterval(autoBuyIv)
}
// дроп раз в 2 мин, иначе можно печатать деньги кликом
const DROP_CD = 2*60*1000
document.getElementById('watchAd').onclick = function(){
  const left = (state.lastDrop||0) + DROP_CD - Date.now()
  if(left > 0) return toast(`⏳ Следующий дроп через ${Math.ceil(left/1000)} сек`)
  const reward = 500 * (1+state.gems*0.1)
  state.balance+=reward; state.totalEarned+=reward
  state.lastDrop = Date.now()
  toast(`🎰 +${format(reward)} $!`)
  save(); renderAll()
}
document.getElementById('claimOffline').onclick = function(){
  // удвоить оффлайн можно 1 раз за заход
  if(state.claimedOffline) return toast('Уже удвоено, вернись позже')
  // берём сырое число, а не текст (там 1.2K и т.п.)
  const val = state.offlineEarn||0
  if(val>0){
    state.balance+=val
    state.totalEarned+=val
    state.claimedOffline = true
    toast(`⚡ Удвоено! +${format(val)} $`)
    save(); renderAll()
  } else toast('Пока нечего удваивать — вернись позже')
}

// SHARE & PROMO & REF
document.getElementById('shareBtn').onclick = async ()=>{
  const url = location.origin + location.pathname + '?ref=' + (localStorage.getItem('my_ref') || (localStorage.setItem('my_ref', 'id_'+Math.random().toString(36).slice(2,7)), localStorage.getItem('my_ref')))
  if(navigator.share){ try{ await navigator.share({title:'CYBER TAP EMPIRE', text:'Я уже нафармил '+format(state.totalEarned)+'! Обгони меня!', url})}catch(e){} }
  await navigator.clipboard.writeText(url)
  document.getElementById('refLink').value=url
  toast('🔗 Реф-ссылка скопирована! +10% другу и тебе')
}
document.getElementById('copyRef').onclick = ()=>{
  const inp=document.getElementById('refLink')
  inp.select(); navigator.clipboard.writeText(inp.value); toast('✅ Скопировано')
}
document.getElementById('promoBtn').onclick = ()=> document.getElementById('promoModal').classList.remove('hidden')
window.closePromo = ()=> document.getElementById('promoModal').classList.add('hidden')
window.applyPromo = ()=>{
  const code = document.getElementById('promoInput').value.trim().toUpperCase()
  const msg=document.getElementById('promoMsg')
  if(state.usedPromos.includes(code)){ msg.textContent='❌ Уже использован'; msg.className='mt-2 text-xs font-bold text-red-400'; return }
  if(PROMOS[code]){
    const reward=PROMOS[code]
    state.balance+=reward; state.totalEarned+=reward
    state.usedPromos.push(code)
    msg.textContent=`✅ +${reward} $ начислено!`; msg.className='mt-2 text-xs font-bold text-mint'
    toast(`🎁 Промокод ${code}: +${reward} $`)
    renderAll(); save()
  } else { msg.textContent='❌ Неверный код'; msg.className='mt-2 text-xs font-bold text-red-400' }
}

// TOAST
function toast(t){
  const el=document.getElementById('toast')
  document.getElementById('toastText').textContent=t
  el.classList.remove('hidden')
  clearTimeout(el._t)
  el._t=setTimeout(()=> el.classList.add('hidden'),2200)
}

// LOOP
setInterval(()=>{
  const per=calcPerSec()
  if(per>0){
    // плавный доход каждую секунду с дробной частью
    state.balance += per/10
    state.totalEarned += per/10
    // раз в секунду обновляем UI полностью, иначе только баланс
    if(Date.now()%1000<120) renderAll()
    else { balanceEl.textContent=format(state.balance); perSecEl.textContent=format(per)+' /сек' }
  }
},100)

setInterval(save, 2000)
setInterval(renderLeaderboard, 5000)

// init
renderAll()
applySkin()
renderLeaderboard()
// случайный ID для рефки
if(!localStorage.getItem('my_ref')) localStorage.setItem('my_ref','emp_'+Math.random().toString(36).slice(2,7))
document.getElementById('refLink').value = location.origin+location.pathname+'?ref='+localStorage.getItem('my_ref')

// внутри телеги разворачиваем на весь экран
if(window.Telegram?.WebApp){ Telegram.WebApp.ready(); Telegram.WebApp.expand() }

// easter egg: Konami
let konami=[]
window.addEventListener('keydown',e=>{
  konami.push(e.key); konami=konami.slice(-10)
  if(konami.join(',').includes('ArrowUp,ArrowUp,ArrowDown,ArrowDown')){
    state.balance+=10000; toast('🎮 KONAMI +10,000 $'); renderAll()
  }
})

console.log('%c CYBER TAP EMPIRE %c Прибыль: подключи РСЯ и Stars → первые деньги через 48 часов ','background:#3b82f6;color:white;padding:6px 12px;border-radius:8px 0 0 8px;font-weight:900','background:#22ffaa;color:black;padding:6px 12px;border-radius:0 8px 8px 0;font-weight:800')
