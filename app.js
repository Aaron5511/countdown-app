// ============================================================
// Weekly Countdown PWA — app.js
// 週行事曆倒數計時：匯入 JSON 排程，顯示週格表，倒數提醒
// ============================================================

// --- 設定 ---
var HOUR_HEIGHT = 80;         // 每小時像素高度
var COL_WIDTH = 120;          // 每欄像素寬度
var GUTTER_WIDTH = 45;        // 左側時間軸寬度
var TIME_START = 5;           // 起始時間（小時）
var TIME_END = 22;            // 結束時間（小時）
var DAY_NAMES = ['一', '二', '三', '四', '五', '六', '日'];
var STORAGE_KEY = 'weeklyCountdown_events';
var SETTINGS_KEY = 'weeklyCountdown_settings';

// --- 設定值 ---
var settings = {
  title: 'Weekly Countdown',
  viewStart: null,
  viewEnd: null,
  visibleDays: [0, 1, 2, 3, 4, 5, 6],
  firstDay: 'monday',
  clockType: '24',
  showTimeInEvents: false,
  fontFamily: '',
  textColor: ''
};

// --- 狀態 ---
var events = [];              // 所有活動資料
var editingEventId = null;    // 正在編輯的活動 ID
var audioCtx = null;          // Web Audio context
var timerInterval = null;     // 計時器 interval ID
var previousActive = {};      // 上一秒的 active 狀態（用來偵測剛結束）

// ============================================================
// 初始化
// ============================================================

document.addEventListener('DOMContentLoaded', function() {
  loadSettings();
  buildGrid();
  setupEventListeners();
  loadEventsWithFallback(function() {
    renderEvents();
    startTimer();
    scrollToToday();
    scrollToNow();
  });
});

// --- 資料讀寫 ---

// 載入活動：從 localStorage 讀取（排程資料只存在本機）
function loadEventsWithFallback(callback) {
  var stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      events = JSON.parse(stored);
    } catch (e) {
      events = [];
    }
  }
  callback();
}

// 儲存活動到 localStorage
function saveEvents() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
}

// 產生唯一 ID
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ============================================================
// 設定管理
// ============================================================

function loadSettings() {
  var stored = localStorage.getItem(SETTINGS_KEY);
  if (stored) {
    try {
      var parsed = JSON.parse(stored);
      if (parsed.title) settings.title = parsed.title;
      if (typeof parsed.viewStart === 'number') settings.viewStart = parsed.viewStart;
      if (typeof parsed.viewEnd === 'number') settings.viewEnd = parsed.viewEnd;
      if (Array.isArray(parsed.visibleDays)) settings.visibleDays = parsed.visibleDays;
      if (parsed.firstDay === 'sunday') settings.firstDay = 'sunday';
      if (parsed.clockType === '12') settings.clockType = '12';
      if (parsed.showTimeInEvents === true) settings.showTimeInEvents = true;
      if (parsed.fontFamily) settings.fontFamily = parsed.fontFamily;
      if (parsed.textColor) settings.textColor = parsed.textColor;
    } catch (e) {
      // ignore
    }
  }
  applySettings();
}

function saveSettingsToStorage() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  applySettings();
}

function applySettings() {
  var titleEl = document.getElementById('headerTitle');
  if (titleEl) titleEl.textContent = settings.title;
  document.title = settings.title;

  if (settings.fontFamily) {
    document.body.style.fontFamily = settings.fontFamily;
  } else {
    document.body.style.fontFamily = '';
  }
  if (settings.textColor) {
    document.documentElement.style.setProperty('--text', settings.textColor);
  } else {
    document.documentElement.style.removeProperty('--text');
  }
}

function openSettingsModal() {
  document.getElementById('settingsTitle').value = settings.title;
  document.getElementById('settingsViewStart').value = (settings.viewStart !== null) ? settings.viewStart : '';
  document.getElementById('settingsViewEnd').value = (settings.viewEnd !== null) ? settings.viewEnd : '';

  var sDayBtns = document.querySelectorAll('.settings-day-btn');
  for (var i = 0; i < sDayBtns.length; i++) {
    var d = parseInt(sDayBtns[i].dataset.day, 10);
    if (settings.visibleDays.indexOf(d) >= 0) {
      sDayBtns[i].classList.add('selected');
    } else {
      sDayBtns[i].classList.remove('selected');
    }
  }

  var firstDayBtns = document.querySelectorAll('.first-day-btn');
  for (var j = 0; j < firstDayBtns.length; j++) {
    if (firstDayBtns[j].dataset.value === settings.firstDay) {
      firstDayBtns[j].classList.add('active');
    } else {
      firstDayBtns[j].classList.remove('active');
    }
  }

  var clockBtns = document.querySelectorAll('.clock-btn');
  for (var k = 0; k < clockBtns.length; k++) {
    if (clockBtns[k].dataset.value === settings.clockType) {
      clockBtns[k].classList.add('active');
    } else {
      clockBtns[k].classList.remove('active');
    }
  }

  var showTimeBtns = document.querySelectorAll('.show-time-btn');
  for (var l = 0; l < showTimeBtns.length; l++) {
    var isYes = showTimeBtns[l].dataset.value === 'yes';
    if ((isYes && settings.showTimeInEvents) || (!isYes && !settings.showTimeInEvents)) {
      showTimeBtns[l].classList.add('active');
    } else {
      showTimeBtns[l].classList.remove('active');
    }
  }

  document.getElementById('settingsFont').value = settings.fontFamily;
  document.getElementById('settingsTextColor').value = settings.textColor || '#1a1a2e';

  document.getElementById('settingsModal').hidden = false;
}

function closeSettingsModal() {
  document.getElementById('settingsModal').hidden = true;
}

function saveSettingsFromForm() {
  var title = document.getElementById('settingsTitle').value.trim();
  var viewStartStr = document.getElementById('settingsViewStart').value;
  var viewEndStr = document.getElementById('settingsViewEnd').value;

  settings.title = title || 'Weekly Countdown';

  if (viewStartStr !== '' && viewEndStr !== '') {
    var vs = parseInt(viewStartStr, 10);
    var ve = parseInt(viewEndStr, 10);
    if (vs >= 0 && vs <= 23 && ve >= 1 && ve <= 24 && ve > vs) {
      settings.viewStart = vs;
      settings.viewEnd = ve;
    } else {
      alert('時間範圍無效：起始需 0-23，結束需 1-24，且結束需大於起始');
      return;
    }
  } else {
    settings.viewStart = null;
    settings.viewEnd = null;
  }

  var visDays = [];
  var sDayBtns = document.querySelectorAll('.settings-day-btn.selected');
  for (var i = 0; i < sDayBtns.length; i++) {
    visDays.push(parseInt(sDayBtns[i].dataset.day, 10));
  }
  if (visDays.length === 0) {
    alert('請至少選擇一天');
    return;
  }
  settings.visibleDays = visDays;

  var activeFirstDay = document.querySelector('.first-day-btn.active');
  settings.firstDay = (activeFirstDay && activeFirstDay.dataset.value === 'sunday') ? 'sunday' : 'monday';

  var activeClock = document.querySelector('.clock-btn.active');
  settings.clockType = (activeClock && activeClock.dataset.value === '12') ? '12' : '24';

  var activeShowTime = document.querySelector('.show-time-btn.active');
  settings.showTimeInEvents = activeShowTime ? activeShowTime.dataset.value === 'yes' : false;

  settings.fontFamily = document.getElementById('settingsFont').value;
  settings.textColor = document.getElementById('settingsTextColor').value;

  saveSettingsToStorage();
  buildGrid();
  renderEvents();
  closeSettingsModal();
}

// ============================================================
// 匯入 JSON（相容 schedulebuilder 格式）
// ============================================================

// 將 schedulebuilder 的顏色轉換為分類
function colorToCategory(colorHex) {
  if (!colorHex) return 'life';
  var c = colorHex.toLowerCase();
  if (c === '#e0e2e9') return 'work';
  if (c === '#ffffff') return 'study';
  if (c === '#c9cacc') return 'life';
  return 'life';
}

// 將分類轉換為 schedulebuilder 的顏色
function categoryToColor(cat) {
  if (cat === 'work') return '#e0e2e9';
  if (cat === 'study') return '#ffffff';
  return '#c9cacc';
}

// 匯入 schedulebuilder 格式的 JSON
function importScheduleJSON(jsonData) {
  if (jsonData.title) {
    settings.title = jsonData.title;
    saveSettingsToStorage();
  }

  var imported = [];
  var evts = jsonData.events || jsonData;

  if (!Array.isArray(evts)) {
    alert('JSON 格式不正確：找不到 events 陣列');
    return;
  }

  for (var i = 0; i < evts.length; i++) {
    var e = evts[i];
    var cat = 'life';
    if (e.colors && e.colors.color) {
      cat = colorToCategory(e.colors.color);
    }
    if (e.category) {
      cat = e.category;
    }

    var start = '';
    var end = '';
    if (e.timeRange && e.timeRange.length === 2) {
      start = e.timeRange[0];
      end = e.timeRange[1];
    } else if (e.start && e.end) {
      start = e.start;
      end = e.end;
    }

    imported.push({
      id: generateId() + '_' + i,
      day: typeof e.day === 'number' ? e.day : 0,
      start: start,
      end: end,
      title: e.title || '(untitled)',
      desc: e.description || '',
      cat: cat
    });
  }

  events = imported;
  saveEvents();
  renderEvents();
}

// ============================================================
// 格表建構
// ============================================================

function buildGrid() {
  var container = document.getElementById('scheduleContainer');
  container.innerHTML = '';
  var totalHours = TIME_END - TIME_START;
  var gridHeight = totalHours * HOUR_HEIGHT;
  var displayDays = getDisplayDayOrder();

  var grid = document.createElement('div');
  grid.className = 'schedule-grid';
  grid.style.gridTemplateColumns = 'var(--gutter-width) repeat(' + displayDays.length + ', var(--col-width))';

  var corner = document.createElement('div');
  corner.className = 'day-header-corner';
  grid.appendChild(corner);

  var todayIndex = getTodayIndex();

  for (var d = 0; d < displayDays.length; d++) {
    var dayIdx = displayDays[d];
    var dh = document.createElement('div');
    dh.className = 'day-header';
    if (dayIdx === todayIndex) dh.classList.add('today');
    dh.textContent = DAY_NAMES[dayIdx];
    dh.dataset.day = dayIdx;
    grid.appendChild(dh);
  }

  var gutter = document.createElement('div');
  gutter.className = 'time-gutter';
  gutter.style.height = gridHeight + 'px';

  for (var h = TIME_START; h <= TIME_END; h++) {
    var label = document.createElement('div');
    label.className = 'time-label';
    label.style.top = ((h - TIME_START) * HOUR_HEIGHT) + 'px';
    label.textContent = formatTimeLabel(h);
    gutter.appendChild(label);
  }
  grid.appendChild(gutter);

  for (var d2 = 0; d2 < displayDays.length; d2++) {
    var dayIdx2 = displayDays[d2];
    var col = document.createElement('div');
    col.className = 'day-column';
    col.dataset.day = dayIdx2;
    col.style.height = gridHeight + 'px';
    if (dayIdx2 === todayIndex) col.classList.add('today');

    for (var h2 = 0; h2 < totalHours; h2++) {
      var hourLine = document.createElement('div');
      hourLine.className = 'hour-line';
      hourLine.style.top = (h2 * HOUR_HEIGHT) + 'px';
      col.appendChild(hourLine);

      var halfLine = document.createElement('div');
      halfLine.className = 'half-hour-line';
      halfLine.style.top = (h2 * HOUR_HEIGHT + HOUR_HEIGHT / 2) + 'px';
      col.appendChild(halfLine);
    }
    var lastLine = document.createElement('div');
    lastLine.className = 'hour-line';
    lastLine.style.top = (totalHours * HOUR_HEIGHT) + 'px';
    col.appendChild(lastLine);

    grid.appendChild(col);
  }

  container.appendChild(grid);
}

// ============================================================
// 活動渲染
// ============================================================

function renderEvents() {
  var oldStart = TIME_START;
  var oldEnd = TIME_END;
  computeGridRange();
  if (TIME_START !== oldStart || TIME_END !== oldEnd) {
    buildGrid();
  }

  var existing = document.querySelectorAll('.event-block');
  for (var i = 0; i < existing.length; i++) {
    existing[i].remove();
  }

  var nowLines = document.querySelectorAll('.now-line');
  for (var j = 0; j < nowLines.length; j++) {
    nowLines[j].remove();
  }

  var segments = createRenderSegments(events);

  for (var dayIdx = 0; dayIdx < 7; dayIdx++) {
    var col = document.querySelector('.day-column[data-day="' + dayIdx + '"]');
    if (!col) continue;

    var daySegments = segments.filter(function(seg) { return seg.day === dayIdx; });
    layoutOverlaps(daySegments);

    for (var k = 0; k < daySegments.length; k++) {
      var seg = daySegments[k];
      var top = minutesToPixels(seg.startMin);
      var height = minutesToPixels(seg.endMin) - top;
      if (height <= 0) continue;

      var block = document.createElement('div');
      block.className = 'event-block ' + (seg.evt.cat || 'life');
      block.dataset.id = seg.evt.id;
      if (seg.isContinuation) block.classList.add('continuation');
      if (isCrossMidnight(seg.evt) && !seg.isContinuation) block.classList.add('cross-midnight-start');
      block.style.top = top + 'px';
      block.style.height = height + 'px';

      var totalCols = seg._totalCols || 1;
      var colIdx = seg._col || 0;
      var padding = 2;
      var gap = 1;
      var availWidth = COL_WIDTH - padding * 2;
      var slotWidth = availWidth / totalCols;
      block.style.left = (padding + colIdx * slotWidth) + 'px';
      block.style.width = (slotWidth - gap) + 'px';
      block.style.right = 'auto';

      var titleSpan = document.createElement('div');
      titleSpan.className = 'event-title';
      titleSpan.textContent = seg.evt.title;
      block.appendChild(titleSpan);

      if (settings.showTimeInEvents) {
        var segStartStr = minutesToTimeStr(seg.startMin);
        var segEndStr = minutesToTimeStr(seg.endMin);
        var timeSpan = document.createElement('div');
        timeSpan.className = 'event-time';
        timeSpan.textContent = to12h(segStartStr) + '-' + to12h(segEndStr);
        block.appendChild(timeSpan);
      }

      var cdSpan = document.createElement('div');
      cdSpan.className = 'event-countdown';
      cdSpan.dataset.eventId = seg.evt.id;
      block.appendChild(cdSpan);

      block.addEventListener('click', createClickHandler(seg.evt));
      setupLongPress(block, seg.evt);

      col.appendChild(block);
    }
  }

  addNowLine();
}

// ============================================================
// 重疊佈局演算法
// 同一天的活動如果時間重疊，自動分成並排小欄
// ============================================================

function layoutOverlaps(segments) {
  if (segments.length === 0) return;

  // Step 1: sort by startMin
  segments.sort(function(a, b) {
    var diff = a.startMin - b.startMin;
    if (diff !== 0) return diff;
    return (b.endMin - b.startMin) - (a.endMin - a.startMin);
  });

  // Step 2: find overlap groups
  var groups = [];
  var currentGroup = [];
  var groupEnd = 0;

  for (var i = 0; i < segments.length; i++) {
    var seg = segments[i];

    if (currentGroup.length === 0 || seg.startMin < groupEnd) {
      currentGroup.push(seg);
      groupEnd = Math.max(groupEnd, seg.endMin);
    } else {
      groups.push(currentGroup);
      currentGroup = [seg];
      groupEnd = seg.endMin;
    }
  }
  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }

  // Step 3: assign columns within each group
  for (var g = 0; g < groups.length; g++) {
    var group = groups[g];

    if (group.length === 1) {
      group[0]._col = 0;
      group[0]._totalCols = 1;
      continue;
    }

    var colEnds = [];

    for (var j = 0; j < group.length; j++) {
      var seg2 = group[j];

      var placed = false;
      for (var c = 0; c < colEnds.length; c++) {
        if (seg2.startMin >= colEnds[c]) {
          colEnds[c] = seg2.endMin;
          seg2._col = c;
          placed = true;
          break;
        }
      }
      if (!placed) {
        seg2._col = colEnds.length;
        colEnds.push(seg2.endMin);
      }
    }

    var totalCols = colEnds.length;
    for (var k = 0; k < group.length; k++) {
      group[k]._totalCols = totalCols;
    }
  }
}

// 用閉包保留 evt 引用
function createClickHandler(evt) {
  return function(e) {
    e.stopPropagation();
    showDetail(evt);
  };
}

// 長按偵測
function setupLongPress(el, evt) {
  var timer = null;
  var didLongPress = false;

  el.addEventListener('touchstart', function(e) {
    didLongPress = false;
    timer = setTimeout(function() {
      didLongPress = true;
      openEditModal(evt);
    }, 600);
  }, { passive: true });

  el.addEventListener('touchend', function() {
    clearTimeout(timer);
  });

  el.addEventListener('touchmove', function() {
    clearTimeout(timer);
  });

  // 電腦版：右鍵
  el.addEventListener('contextmenu', function(e) {
    e.preventDefault();
    openEditModal(evt);
  });
}

// === 目前時間線 ===

function addNowLine() {
  var todayIndex = getTodayIndex();
  var col = document.querySelector('.day-column[data-day="' + todayIndex + '"]');
  if (!col) return;

  var now = new Date();
  var nowMin = now.getHours() * 60 + now.getMinutes();
  var top = minutesToPixels(nowMin);

  if (top < 0 || top > (TIME_END - TIME_START) * HOUR_HEIGHT) return;

  var line = document.createElement('div');
  line.className = 'now-line';
  line.style.top = top + 'px';
  col.appendChild(line);
}

function updateNowLine() {
  var existing = document.querySelector('.now-line');
  if (existing) existing.remove();
  addNowLine();
}

// ============================================================
// 計時器引擎
// ============================================================

function startTimer() {
  updateCountdowns();
  timerInterval = setInterval(updateCountdowns, 1000);
}

function updateCountdowns() {
  var now = new Date();
  var todayIndex = getTodayIndex();
  var nowMs = now.getTime();

  var activeEvents = [];
  var nextEvent = null;
  var nextEventDiff = Infinity;

  var segments = createRenderSegments(events);

  for (var i = 0; i < segments.length; i++) {
    var seg = segments[i];
    if (seg.day !== todayIndex) continue;

    var segStartMs = todayAtMinute(seg.startMin);
    var segEndMs = todayAtMinute(seg.endMin);

    // Find block in the correct day column
    var col = document.querySelector('.day-column[data-day="' + seg.day + '"]');
    var block = null;
    if (col) {
      block = col.querySelector('.event-block[data-id="' + seg.evt.id + '"]');
    }

    // Compute real end time for countdown display
    var realEndMs;
    if (seg.isContinuation) {
      realEndMs = segEndMs;
    } else if (isCrossMidnight(seg.evt)) {
      var tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      var endParts = seg.evt.end.split(':');
      realEndMs = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(),
        parseInt(endParts[0], 10), parseInt(endParts[1], 10), 0).getTime();
    } else {
      realEndMs = segEndMs;
    }

    if (nowMs >= segStartMs && nowMs < segEndMs) {
      var remaining = realEndMs - nowMs;
      activeEvents.push({ evt: seg.evt, remaining: remaining });
      if (block) {
        block.classList.add('active');
        block.classList.remove('done');
        var cdEl = block.querySelector('.event-countdown');
        if (cdEl) cdEl.textContent = formatMs(remaining);
      }
      previousActive[seg.evt.id] = true;
    } else if (nowMs >= segEndMs) {
      if (block) {
        block.classList.remove('active');
        block.classList.add('done');
        var cdEl2 = block.querySelector('.event-countdown');
        if (cdEl2) cdEl2.textContent = '';
      }

      // Alert only when the real event ends (not at midnight boundary)
      if (isCrossMidnight(seg.evt) && !seg.isContinuation) {
        // First segment of cross-midnight: event continues tomorrow, no alert
      } else if (previousActive[seg.evt.id]) {
        triggerAlert(seg.evt, block);
        delete previousActive[seg.evt.id];
      }
    } else {
      if (block) {
        block.classList.remove('active', 'done');
        var cdEl3 = block.querySelector('.event-countdown');
        if (cdEl3) cdEl3.textContent = '';
      }

      var diff = segStartMs - nowMs;
      if (diff < nextEventDiff) {
        nextEventDiff = diff;
        nextEvent = seg.evt;
      }
    }
  }

  updateCountdownBar(activeEvents, nextEvent, nextEventDiff);

  if (now.getSeconds() % 30 === 0) {
    updateNowLine();
  }
}

// --- 固定倒數欄 ---

function updateCountdownBar(activeEvents, nextEvent, nextEventDiff) {
  var titleEl = document.getElementById('countdownTitle');
  var timerEl = document.getElementById('countdownTimer');
  var rangeEl = document.getElementById('countdownTimeRange');
  var bar = document.getElementById('countdownBar');

  if (activeEvents.length > 0) {
    // 顯示最快結束的
    activeEvents.sort(function(a, b) { return a.remaining - b.remaining; });
    var top = activeEvents[0];
    titleEl.textContent = top.evt.title;
    timerEl.textContent = formatMs(top.remaining);
    rangeEl.textContent = top.evt.start + ' → ' + top.evt.end + crossMidnightTag(top.evt);
    bar.classList.remove('no-active');

    if (activeEvents.length > 1) {
      rangeEl.textContent += ' (+' + (activeEvents.length - 1) + ')';
    }
  } else if (nextEvent) {
    titleEl.textContent = nextEvent.title;
    timerEl.textContent = formatMs(nextEventDiff) + ' 後';
    rangeEl.textContent = nextEvent.start + ' → ' + nextEvent.end + crossMidnightTag(nextEvent);
    bar.classList.add('no-active');
  } else {
    titleEl.textContent = '今日無活動';
    timerEl.textContent = '--:--';
    rangeEl.textContent = '';
    bar.classList.add('no-active');
  }
}

// ============================================================
// 提醒
// ============================================================

function triggerAlert(evt, block) {
  // 閃爍
  var bar = document.getElementById('countdownBar');
  bar.classList.remove('alerting');
  void bar.offsetWidth;
  bar.classList.add('alerting');
  setTimeout(function() { bar.classList.remove('alerting'); }, 3500);

  if (block) {
    block.classList.remove('alerting');
    void block.offsetWidth;
    block.classList.add('alerting');
    setTimeout(function() { block.classList.remove('alerting'); }, 3500);
  }

  // 嗶聲
  playBeep();

  // 震動（iOS 不支援會靜默 fail）
  if (navigator.vibrate) {
    navigator.vibrate([200, 100, 200, 100, 200]);
  }
}

function playBeep() {
  if (!audioCtx) return;

  var beepTimes = [0, 0.3, 0.6];
  for (var i = 0; i < beepTimes.length; i++) {
    var osc = audioCtx.createOscillator();
    var gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.frequency.value = 880;
    osc.type = 'square';
    gain.gain.value = 0.3;
    var t = audioCtx.currentTime + beepTimes[i];
    osc.start(t);
    osc.stop(t + 0.15);
  }
}

// 初始化 AudioContext（需要使用者互動）
function initAudio() {
  if (audioCtx) return;
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  } catch (e) {
    // 不支援 Web Audio
  }
}

// ============================================================
// UI 互動
// ============================================================

function setupEventListeners() {
  // 首次互動解鎖 AudioContext
  document.addEventListener('touchstart', initAudio, { once: true });
  document.addEventListener('click', initAudio, { once: true });

  // 新增按鈕
  document.getElementById('addBtn').addEventListener('click', function() {
    openAddModal();
  });

  // 匯入 JSON
  document.getElementById('importInput').addEventListener('change', function(e) {
    var file = e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function(ev) {
      try {
        var data = JSON.parse(ev.target.result);
        importScheduleJSON(data);
        alert('匯入成功：' + events.length + ' 筆活動');
      } catch (err) {
        alert('匯入失敗：' + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  });

  // 匯出（schedulebuilder.org 相容格式）
  document.getElementById('exportBtn').addEventListener('click', function() {
    var exportEvents = [];
    for (var i = 0; i < events.length; i++) {
      var evt = events[i];
      exportEvents.push({
        title: evt.title,
        description: evt.desc || '',
        day: evt.day,
        timeRange: [evt.start, evt.end],
        colors: { color: categoryToColor(evt.cat) }
      });
    }
    var exportData = {
      title: settings.title,
      exportDate: new Date().toISOString(),
      events: exportEvents
    };
    var blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'weekly-schedule.json';
    a.click();
    URL.revokeObjectURL(url);
  });

  // Modal 取消
  document.getElementById('cancelBtn').addEventListener('click', closeModal);

  // Modal 刪除（支援批次）
  document.getElementById('deleteEventBtn').addEventListener('click', function() {
    if (!editingEventId) return;
    var evt = getEventById(editingEventId);
    if (!evt) return;

    if (isBatchMode()) {
      var count = events.filter(function(e) { return e.title === evt.title; }).length;
      if (confirm('刪除所有「' + evt.title + '」（共 ' + count + ' 筆）？')) {
        var titleToDelete = evt.title;
        events = events.filter(function(e) { return e.title !== titleToDelete; });
        saveEvents();
        renderEvents();
        closeModal();
      }
    } else {
      if (confirm('確定要刪除這個活動嗎？')) {
        events = events.filter(function(e) { return e.id !== editingEventId; });
        saveEvents();
        renderEvents();
        closeModal();
      }
    }
  });

  // Modal 表單送出
  document.getElementById('eventForm').addEventListener('submit', function(e) {
    e.preventDefault();
    saveEventFromForm();
  });

  // 點擊 detail popup 外面 → 關閉
  document.addEventListener('click', function(e) {
    var popup = document.getElementById('detailPopup');
    if (!popup.hidden && !popup.contains(e.target)) {
      popup.hidden = true;
    }
  });

  // Modal overlay 點擊外面 → 關閉
  document.getElementById('modal').addEventListener('click', function(e) {
    if (e.target === this) {
      closeModal();
    }
  });

  // Day picker：點擊切換選取
  var dayBtns = document.querySelectorAll('.day-btn');
  for (var i = 0; i < dayBtns.length; i++) {
    dayBtns[i].addEventListener('click', function() {
      this.classList.toggle('selected');
    });
  }

  // Batch toggle (scoped to #batchToggleGroup)
  var batchGroup = document.getElementById('batchToggleGroup');
  var batchBtns = batchGroup.querySelectorAll('.toggle-btn');
  for (var j = 0; j < batchBtns.length; j++) {
    batchBtns[j].addEventListener('click', function() {
      for (var k = 0; k < batchBtns.length; k++) {
        batchBtns[k].classList.remove('active');
      }
      this.classList.add('active');

      // Yes → 自動選取所有同名活動的天
      if (this.dataset.batch === 'yes') {
        selectDaysForSameTitle();
      }
    });
  }

  // Settings
  document.getElementById('settingsBtn').addEventListener('click', function(e) {
    e.stopPropagation();
    openSettingsModal();
  });
  document.getElementById('settingsCancelBtn').addEventListener('click', closeSettingsModal);
  document.getElementById('settingsForm').addEventListener('submit', function(e) {
    e.preventDefault();
    saveSettingsFromForm();
  });
  document.getElementById('resetRangeBtn').addEventListener('click', function() {
    document.getElementById('settingsViewStart').value = '';
    document.getElementById('settingsViewEnd').value = '';
  });
  document.getElementById('settingsModal').addEventListener('click', function(e) {
    if (e.target === this) closeSettingsModal();
  });

  var settingsDayBtns = document.querySelectorAll('.settings-day-btn');
  for (var sd = 0; sd < settingsDayBtns.length; sd++) {
    settingsDayBtns[sd].addEventListener('click', function() {
      this.classList.toggle('selected');
    });
  }

  var exclusiveGroups = ['.first-day-btn', '.clock-btn', '.show-time-btn'];
  for (var eg = 0; eg < exclusiveGroups.length; eg++) {
    (function(selector) {
      var btns = document.querySelectorAll(selector);
      for (var b = 0; b < btns.length; b++) {
        btns[b].addEventListener('click', function() {
          var siblings = document.querySelectorAll(selector);
          for (var s = 0; s < siblings.length; s++) {
            siblings[s].classList.remove('active');
          }
          this.classList.add('active');
        });
      }
    })(exclusiveGroups[eg]);
  }
}

// --- Modal ---

// 取得目前選取的天（day picker）
function getSelectedDays() {
  var days = [];
  var btns = document.querySelectorAll('.day-btn.selected');
  for (var i = 0; i < btns.length; i++) {
    days.push(parseInt(btns[i].dataset.day, 10));
  }
  return days;
}

// 設定 day picker 的選取狀態
function setSelectedDays(dayArray) {
  var btns = document.querySelectorAll('.day-btn');
  for (var i = 0; i < btns.length; i++) {
    var d = parseInt(btns[i].dataset.day, 10);
    if (dayArray.indexOf(d) >= 0) {
      btns[i].classList.add('selected');
    } else {
      btns[i].classList.remove('selected');
    }
  }
}

// 批次模式下，自動選取所有同名活動的天
function selectDaysForSameTitle() {
  var title = document.getElementById('eventName').value.trim();
  if (!title) return;
  var days = [];
  for (var i = 0; i < events.length; i++) {
    if (events[i].title === title && days.indexOf(events[i].day) < 0) {
      days.push(events[i].day);
    }
  }
  setSelectedDays(days);
}

// 是否為批次模式
function isBatchMode() {
  var btn = document.querySelector('#batchToggleGroup .toggle-btn.active');
  return btn && btn.dataset.batch === 'yes';
}

function openAddModal() {
  editingEventId = null;
  document.getElementById('modalTitle').textContent = '新增活動';
  document.getElementById('eventName').value = '';
  document.getElementById('eventStart').value = '';
  document.getElementById('eventEnd').value = '';
  document.getElementById('eventCategory').value = 'study';
  document.getElementById('eventDesc').value = '';
  document.getElementById('deleteEventBtn').hidden = true;
  document.getElementById('batchToggleGroup').hidden = true;
  setSelectedDays([getTodayIndex()]);
  document.getElementById('modal').hidden = false;
}

function openEditModal(evt) {
  editingEventId = evt.id;
  document.getElementById('modalTitle').textContent = '編輯活動';
  document.getElementById('eventName').value = evt.title;
  document.getElementById('eventStart').value = evt.start;
  document.getElementById('eventEnd').value = evt.end;
  document.getElementById('eventCategory').value = evt.cat || 'life';
  document.getElementById('eventDesc').value = evt.desc || '';
  document.getElementById('deleteEventBtn').hidden = false;

  // 顯示批次開關，預設 No（只編輯這一筆）
  document.getElementById('batchToggleGroup').hidden = false;
  var toggleBtns = document.querySelectorAll('.toggle-btn');
  for (var i = 0; i < toggleBtns.length; i++) {
    toggleBtns[i].classList.remove('active');
    if (toggleBtns[i].dataset.batch === 'no') {
      toggleBtns[i].classList.add('active');
    }
  }

  // 只選這一天
  setSelectedDays([evt.day]);

  document.getElementById('modal').hidden = false;
}

function closeModal() {
  document.getElementById('modal').hidden = true;
  editingEventId = null;
}

function saveEventFromForm() {
  var title = document.getElementById('eventName').value.trim();
  var start = document.getElementById('eventStart').value;
  var end = document.getElementById('eventEnd').value;
  var cat = document.getElementById('eventCategory').value;
  var desc = document.getElementById('eventDesc').value.trim();
  var selectedDays = getSelectedDays();

  if (!title || !start || !end) {
    alert('請填寫活動名稱、開始和結束時間');
    return;
  }
  if (selectedDays.length === 0) {
    alert('請至少選擇一天');
    return;
  }

  if (editingEventId && isBatchMode()) {
    // 批次模式：更新所有同名活動 + 處理天數增減
    var editingEvt = getEventById(editingEventId);
    var oldTitle = editingEvt ? editingEvt.title : '';

    // 找出所有同名活動的天
    var existingDays = {};
    for (var i = 0; i < events.length; i++) {
      if (events[i].title === oldTitle) {
        existingDays[events[i].day] = events[i].id;
      }
    }

    // 移除取消勾選的天
    var removeDays = [];
    for (var dayStr in existingDays) {
      var d = parseInt(dayStr, 10);
      if (selectedDays.indexOf(d) < 0) {
        removeDays.push(existingDays[d]);
      }
    }
    events = events.filter(function(e) { return removeDays.indexOf(e.id) < 0; });

    // 更新保留的 + 新增勾選但不存在的
    for (var j = 0; j < selectedDays.length; j++) {
      var sd = selectedDays[j];
      if (existingDays[sd]) {
        // 更新現有的
        for (var k = 0; k < events.length; k++) {
          if (events[k].id === existingDays[sd]) {
            events[k].title = title;
            events[k].start = start;
            events[k].end = end;
            events[k].cat = cat;
            events[k].desc = desc;
            break;
          }
        }
      } else {
        // 新增
        events.push({
          id: generateId(),
          day: sd,
          start: start,
          end: end,
          title: title,
          desc: desc,
          cat: cat
        });
      }
    }
  } else if (editingEventId) {
    // 單筆模式
    var originalDay = null;
    for (var m = 0; m < events.length; m++) {
      if (events[m].id === editingEventId) {
        originalDay = events[m].day;
        events[m].title = title;
        events[m].start = start;
        events[m].end = end;
        events[m].day = selectedDays[0];
        events[m].cat = cat;
        events[m].desc = desc;
        break;
      }
    }
    // 如果勾選了額外的天，建立副本
    for (var n = 1; n < selectedDays.length; n++) {
      events.push({
        id: generateId(),
        day: selectedDays[n],
        start: start,
        end: end,
        title: title,
        desc: desc,
        cat: cat
      });
    }
  } else {
    // 新增模式：每個選取的天各建立一筆
    for (var p = 0; p < selectedDays.length; p++) {
      events.push({
        id: generateId(),
        day: selectedDays[p],
        start: start,
        end: end,
        title: title,
        desc: desc,
        cat: cat
      });
    }
  }

  saveEvents();
  renderEvents();
  closeModal();
}

// --- 活動詳情 ---

function showDetail(evt) {
  var popup = document.getElementById('detailPopup');
  var content = document.getElementById('detailContent');
  content.innerHTML = '';

  var titleDiv = document.createElement('div');
  titleDiv.style.cssText = 'font-weight:600;font-size:16px;margin-bottom:4px;';
  titleDiv.textContent = evt.title;
  content.appendChild(titleDiv);

  var rangeDiv = document.createElement('div');
  rangeDiv.style.cssText = 'color:var(--text-secondary);font-size:13px;';
  rangeDiv.textContent = DAY_NAMES[evt.day] + ' ' + evt.start + ' → ' + evt.end + crossMidnightTag(evt);
  content.appendChild(rangeDiv);

  if (evt.desc) {
    var descDiv = document.createElement('div');
    descDiv.style.cssText = 'margin-top:8px;font-size:13px;';
    descDiv.textContent = evt.desc;
    content.appendChild(descDiv);
  }

  var btnRow = document.createElement('div');
  btnRow.style.cssText = 'margin-top:12px;display:flex;gap:8px;';

  var editBtn = document.createElement('button');
  editBtn.className = 'btn-secondary';
  editBtn.style.cssText = 'font-size:12px;padding:4px 12px;';
  editBtn.textContent = '編輯';
  editBtn.addEventListener('click', function() {
    openEditModal(evt);
    popup.hidden = true;
  });

  var deleteBtn = document.createElement('button');
  deleteBtn.className = 'btn-danger';
  deleteBtn.style.cssText = 'font-size:12px;padding:4px 12px;';
  deleteBtn.textContent = '刪除';
  deleteBtn.addEventListener('click', function() {
    if (confirm('確定要刪除這個活動嗎？')) {
      events = events.filter(function(e) { return e.id !== evt.id; });
      saveEvents();
      renderEvents();
      popup.hidden = true;
    }
  });

  btnRow.appendChild(editBtn);
  btnRow.appendChild(deleteBtn);
  content.appendChild(btnRow);
  popup.hidden = false;
}

function getEventById(id) {
  for (var i = 0; i < events.length; i++) {
    if (events[i].id === id) return events[i];
  }
  return null;
}


// ============================================================
// 滾動定位
// ============================================================

function scrollToToday() {
  var todayIndex = getTodayIndex();
  var displayOrder = getDisplayDayOrder();
  var displayPos = displayOrder.indexOf(todayIndex);
  if (displayPos < 0) return;
  var container = document.getElementById('scheduleContainer');
  var targetX = GUTTER_WIDTH + displayPos * COL_WIDTH - (container.clientWidth - GUTTER_WIDTH) / 2 + COL_WIDTH / 2;
  container.scrollLeft = Math.max(0, targetX);
}

function scrollToNow() {
  var now = new Date();
  var nowMin = now.getHours() * 60 + now.getMinutes();
  var container = document.getElementById('scheduleContainer');
  var targetY = minutesToPixels(nowMin) - container.clientHeight / 3;
  container.scrollTop = Math.max(0, targetY);
}

// ============================================================
// 工具函式
// ============================================================

// 今天是星期幾（ISO：0=一, 6=日）
function getTodayIndex() {
  var jsDay = new Date().getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  return (jsDay + 6) % 7;         // 轉成 0=Mon, ..., 6=Sun
}

// "HH:MM" → 從午夜起算的分鐘數
function timeToMinutes(timeStr) {
  if (!timeStr) return null;
  var parts = timeStr.split(':');
  if (parts.length < 2) return null;
  return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
}

// 分鐘數 → "HH:MM" 字串
function minutesToTimeStr(minutes) {
  var h = Math.floor(minutes / 60) % 24;
  var m = minutes % 60;
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}

// 分鐘數 → 格表上的像素位置
function minutesToPixels(minutes) {
  return (minutes - TIME_START * 60) / 60 * HOUR_HEIGHT;
}

// 今天的某個時間點 → Date 物件
function todayAtTime(timeStr) {
  var now = new Date();
  var parts = timeStr.split(':');
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(),
    parseInt(parts[0], 10), parseInt(parts[1], 10), 0);
}

// 毫秒 → "H:MM:SS" 或 "MM:SS"
function formatMs(ms) {
  var totalSec = Math.max(0, Math.floor(ms / 1000));
  var h = Math.floor(totalSec / 3600);
  var m = Math.floor((totalSec % 3600) / 60);
  var s = totalSec % 60;

  if (h > 0) {
    return h + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  }
  return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}

// HTML escape
function escapeHtml(str) {
  var div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ============================================================
// Cross-midnight helpers
// ============================================================

function isCrossMidnight(evt) {
  var s = timeToMinutes(evt.start);
  var e = timeToMinutes(evt.end);
  return s !== null && e !== null && e < s;
}

function crossMidnightTag(evt) {
  if (isCrossMidnight(evt)) return ' (跨日)';
  return '';
}

function getDisplayDayOrder() {
  var base;
  if (settings.firstDay === 'sunday') {
    base = [6, 0, 1, 2, 3, 4, 5];
  } else {
    base = [0, 1, 2, 3, 4, 5, 6];
  }
  return base.filter(function(d) {
    return settings.visibleDays.indexOf(d) >= 0;
  });
}

function formatTimeLabel(h) {
  if (settings.clockType === '12') {
    if (h === 0 || h === 24) return '12 AM';
    if (h === 12) return '12 PM';
    if (h < 12) return h + ' AM';
    return (h - 12) + ' PM';
  }
  return String(h).padStart(2, '0') + ':00';
}

function to12h(timeStr) {
  if (settings.clockType !== '12') return timeStr;
  var parts = timeStr.split(':');
  var h = parseInt(parts[0], 10);
  var m = parts[1];
  var period = h >= 12 ? 'PM' : 'AM';
  var h12 = h % 12 || 12;
  return h12 + ':' + m + ' ' + period;
}

function computeGridRange() {
  if (settings.viewStart !== null && settings.viewEnd !== null) {
    TIME_START = settings.viewStart;
    TIME_END = settings.viewEnd;
    return;
  }

  var minH = 5;
  var maxH = 22;
  for (var i = 0; i < events.length; i++) {
    var evt = events[i];
    var s = timeToMinutes(evt.start);
    var e = timeToMinutes(evt.end);
    if (s === null || e === null) continue;

    if (e < s) {
      maxH = 24;
      minH = 0;
    } else {
      var startH = Math.floor(s / 60);
      var endH = Math.ceil(e / 60);
      if (startH < minH) minH = startH;
      if (endH > maxH) maxH = endH;
    }
  }
  TIME_START = minH;
  TIME_END = maxH;
}

function createRenderSegments(eventsList) {
  var segments = [];
  for (var i = 0; i < eventsList.length; i++) {
    var evt = eventsList[i];
    var s = timeToMinutes(evt.start);
    var e = timeToMinutes(evt.end);
    if (s === null || e === null) continue;

    if (e < s) {
      segments.push({
        evt: evt, day: evt.day,
        startMin: s, endMin: 1440,
        isContinuation: false
      });
      segments.push({
        evt: evt, day: (evt.day + 1) % 7,
        startMin: 0, endMin: e,
        isContinuation: true
      });
    } else {
      segments.push({
        evt: evt, day: evt.day,
        startMin: s, endMin: e,
        isContinuation: false
      });
    }
  }
  return segments;
}

function todayAtMinute(minutes) {
  var now = new Date();
  var h = Math.floor(minutes / 60);
  var m = minutes % 60;
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0).getTime();
}

// ============================================================
// Service Worker 註冊
// ============================================================

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(function() {});
}
