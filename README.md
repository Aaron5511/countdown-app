# Weekly Countdown PWA

iPhone 上的週行事曆倒數計時 app。載入週循環排程，以週格表顯示整週活動，對進行中的活動倒數到結束時間，歸零時閃爍 + 嗶聲提醒。

## 技術方案

- **純前端 PWA**：HTML + CSS + Vanilla JS
- 零框架、零依賴、零建構工具（~1400 行 JS）
- Safari「加到主畫面」即可當 app 使用
- 開發環境：Windows（不需要 Mac 或 Xcode）

## 功能

| 功能 | 說明 |
|------|------|
| 週格表 | 縱軸=時間、橫軸=天數，橫向滑動 |
| 倒數計時 | 上方固定欄大字倒數 + 格表色塊內小字倒數 |
| 跨午夜活動 | 23:00-06:00 等跨日活動自動拆成兩段渲染，倒數正確計算 |
| 重疊佈局 | 同時段多活動自動並排分欄（Google Calendar 風格） |
| 提醒 | 歸零時：畫面閃爍 + Web Audio 嗶聲 |
| 批次編輯 | 編輯時可多選星期、一次套用到所有同名活動 |
| 匯入/匯出 | 雙向相容 schedulebuilder.org JSON 格式 |
| 設定 | 標題、顯示範圍、顯示天數、週起始日、12/24h、字體顏色等 |
| 離線 | Service Worker 快取（需 HTTPS） |

## 設定功能

點擊右上角齒輪按鈕開啟設定面板。所有設定存在 localStorage（`weeklyCountdown_settings`），與排程資料分開。

| 設定 | 說明 | 預設值 |
|------|------|--------|
| 標題 | 顯示在頂部 + 匯出 JSON 時附帶 | Weekly Countdown |
| 顯示範圍 | 格表顯示的時間區間（小時），留空=自動偵測 | 自動（依活動範圍） |
| 顯示天數 | 多選要顯示的星期幾 | 全部 7 天 |
| 週起始日 | 格表左邊第一天是週一或週日 | 週一 |
| 時間格式 | 12 小時制或 24 小時制 | 24 小時 |
| 色塊顯示時間 | 是否在活動色塊上顯示時間範圍 | 否 |
| 字體 | 全域字體（系統預設 / Arial / Georgia / Courier New） | 系統預設 |
| 文字顏色 | 全域文字顏色 | #1a1a2e |

## 資料儲存

- 線上版排程資料**只存在使用者裝置的 localStorage**
- 設定資料**同樣只存在 localStorage**（key: `weeklyCountdown_settings`）
- GitHub repo 和 GitHub Pages 上**不含任何排程資料或設定**（包含 git 歷史——2026-05-25 已重建歷史，清除初版誤上傳的排程，見 DECISIONS D-003）
- 首次使用需手動「匯入 JSON」一次，之後自動從 localStorage 讀取
- 本機 `data/` 資料夾可存放個人 JSON 備份（已被 `.gitignore` 排除，不會上 GitHub；但注意 GDrive 等同步工具可能會同步此資料夾）
- 「匯出」按鈕可隨時備份為 JSON 檔（含標題和匯出日期）

## 資料格式

### 匯入格式（相容 schedulebuilder.org）

```json
{
  "events": [
    {
      "colors": { "color": "#e0e2e9" },
      "timeRange": ["09:00", "10:30"],
      "title": "活動名稱",
      "description": "備註",
      "day": 0
    }
  ]
}
```

### Day mapping

| day | 星期 |
|-----|------|
| 0 | 一 |
| 1 | 二 |
| 2 | 三 |
| 3 | 四 |
| 4 | 五 |
| 5 | 六 |
| 6 | 日 |

**ISO 順序（0=週一），不是 JS 標準（0=週日）。**

### 跨午夜活動

當 `end` 時間早於 `start` 時間（如 `"start": "23:00", "end": "06:00"`），視為跨午夜活動。渲染時自動拆成兩段：
1. 起始日 23:00-24:00
2. 隔天 00:00-06:00（以 continuation 樣式顯示）

### 顏色→分類對映

| 匯入顏色 `colors.color` | 分類 | 用途 |
|--------------------------|------|------|
| `#e0e2e9` | work | 工作（透析/內科） |
| `#c9cacc` | life | 生活（休息/運動/通勤） |
| `#ffffff` | study | 讀書 |
| 其他 | life | 預設 |

### 內部格式（localStorage）

```json
[
  {
    "id": "unique_id",
    "day": 0,
    "start": "09:00",
    "end": "10:30",
    "title": "活動名稱",
    "desc": "備註",
    "cat": "work"
  }
]
```

## 啟動方式

### 本機開發

雙擊 `start.bat`（開 Python HTTP server + 自動開瀏覽器）。

### iPhone 使用

GitHub Pages：`https://aaron5511.github.io/countdown-app/`
Safari 打開 → 分享 →「加入主畫面螢幕」。

### 更新部署

```bash
cd "D:/Users/bob/GoogleDrive/obsidian2/02-Software/countdown-app"
git add -A
git commit -m "描述改了什麼"
git push
```

GitHub Pages 1-2 分鐘內自動更新。

## 已知限制

| 限制 | 原因 | 影響 |
|------|------|------|
| 背景不提醒 | iOS Safari PWA 切背景時 timer 暫停 | 回前景重算倒數，不補發嗶聲 |
| localStorage 可能遺失 | Safari 清資料、移除 app 等情況 | 定期用「匯出」備份 |
| LAN HTTP 無法註冊 SW | Service Worker 需要 HTTPS | 本機測試時無離線功能 |
| 震動不作用 | iOS Safari 不支援 Vibration API | 靜默 fail，不影響其他功能 |

## 檔案結構

```
countdown-app/
├── index.html          # 主頁面
├── style.css           # 樣式
├── app.js              # 主邏輯（匯入、格表、計時器、提醒）
├── sw.js               # Service Worker（離線快取）
├── manifest.json       # PWA manifest
├── start.bat           # 本機啟動腳本
├── .gitignore          # 排除 data/（隱私保護）
├── README.md           # 本文件
├── DECISIONS.md        # 架構決策紀錄
└── data/               # 可選，本機私有備份資料夾；repo 不含排程資料
    └── *.json          # 個人排程備份（.gitignore 排除，不會上傳 GitHub）
```
