# 架構決策紀錄（ADR）

每個決策紀錄：問題 → 選項 → 選擇 → 原因。
供未來維護者（人或 AI）理解「為什麼這樣做」。

---

## D-001：技術方案選擇 PWA

**問題**：在 iPhone 上運行的個人 app，開發環境是 Windows。

**選項**：
1. 原生 iOS app（Swift/SwiftUI）— 需要 Mac + Xcode + Apple Developer 帳號
2. React Native / Flutter — 需要 Mac 做 iOS build，或用 EAS Build
3. PWA（HTML/CSS/JS）— Safari 加到主畫面即可，Windows 開發

**選擇**：PWA

**原因**：
- 開發者（Aaron）用 Windows，沒有 Mac
- 功能單純（格表 + 計時器），不需要原生 API
- 零成本、零帳號、即時部署
- Safari 支援 PWA standalone 模式

**代價**：
- 背景執行受限（timer 暫停）
- 無法使用推播通知（除非加 Push API，複雜度高）
- localStorage 不如原生 app 穩定

---

## D-002：Vanilla JS，不用框架

**問題**：前端要用什麼技術？

**選項**：
1. React / Vue / Svelte — 元件化、狀態管理方便
2. Vanilla JS — 零依賴、零建構

**選擇**：Vanilla JS

**原因**：
- Aaron 是程式初學者，框架增加學習門檻
- 功能規模小（初版 ~900 行 JS，加入跨午夜／設定系統後現約 1420 行），不需要元件化
- 零建構工具 = 改完直接刷新，部署就是複製檔案
- 未來需要框架時可以遷移，但目前 YAGNI

---

## D-003：排程資料不上 GitHub

**問題**：初版把 `data/default-schedule.json`（含完整個人週行事曆）推到了 public GitHub repo。

**經過**：
1. 初版設計：app 啟動時 fetch `data/default-schedule.json` 作為預設排程
2. Codex review 指出「初始資料來源沒有可部署路徑」，建議加入 startup fallback
3. 實作了 fallback：localStorage 空時自動 fetch 預設排程
4. 推上 GitHub 後，Aaron 發現 repo 是 public 的 → 排程公開
5. 立即移除：`git rm --cached` + `.gitignore` + 改 app.js 移除自動 fetch

**最終選擇**：
- GitHub 上只有空殼程式碼，`data/` 在 `.gitignore`
- 排程資料只存在使用者裝置的 localStorage
- 首次使用需手動匯入一次
- 匯出功能作為備份手段

**教訓**：
- public repo + 個人資料 = 隱私風險，上線前必須確認
- 「方便開發」（自動載入預設資料）和「隱私保護」（資料不外洩）是衝突的
- 預設排程仍保留在本機 `data/` 資料夾，作為備份
- **`git rm --cached` 只移除當前檔案樹，不清除 git 歷史**——舊 commit 仍可用 `git show <sha>:data/...` 還原。2026-05-25 發現排程仍存在於 public 歷史（commit `52f6f8b`），以 orphan 分支重建乾淨歷史 + force push 徹底清除。教訓升級：敏感資料一旦 commit 過，光刪檔不夠，必須重寫歷史；最佳做法是上線前就 `.gitignore`，永遠不要 commit。

---

## D-004：Day mapping 用 ISO 順序

**問題**：`day` 欄位的 0 代表星期幾？

**背景**：
- JavaScript `Date.getDay()`：0=週日, 1=週一, ..., 6=週六
- ISO 8601：1=週一, ..., 7=週日
- 來源 JSON（schedulebuilder.org）的 `firstDayOfWeek: 6` 和 `day` 欄位的對應不明確

**選擇**：0=週一, 6=週日（接近 ISO，但 0-indexed）

**原因**：
- Aaron 確認 day=6 對應「Lord's table」（週日聚會）
- 轉換公式：`todayIndex = (jsGetDay() + 6) % 7`
- 匯入時 `day` 值直接使用，不需轉換

---

## D-005：重疊活動並排分欄

**問題**：同一天同時段有多個活動時如何顯示？

**選項**：
1. 後面的蓋住前面的（z-index 疊加）
2. 並排分欄（Google Calendar 風格）
3. 只顯示第一個，其餘收合

**選擇**：並排分欄

**演算法**：
1. 每天活動按開始時間排序
2. 找重疊群組（connected components）：時間有交集的歸為一組
3. 群組內用貪心法分配欄位：每個活動放入第一個不衝突的欄
4. 色塊寬度 = 欄寬 / 群組內總欄數

**原因**：
- 使用者明確要求「分成左右兩小欄」
- 不重疊的活動不受影響（佔滿整欄）
- 倒數計時各自獨立運作

---

## D-006：編輯 UI 參考 schedulebuilder.org

**問題**：編輯活動時如何處理多天重複的排程？

**來源**：Aaron 提供 schedulebuilder.org 的編輯截圖作為參考。

**實作**：
1. **Day picker**：7 個按鈕可多選（取代單選下拉）
2. **「套用到所有同名活動」開關**：
   - Yes：自動選取所有同名活動的天，批次更新/新增/刪除
   - No（預設）：只編輯這一筆
3. **詳情面板**：點擊色塊 → 底部面板含「編輯」「刪除」按鈕

**原因**：
- 週循環排程中，同一活動常出現在多天（如「脫水內科」週一到週六）
- 逐天編輯太痛苦，批次操作是必要功能
- Codex review 指出長按在 iOS 上不可靠，改為點擊 → 詳情面板 → 明確按鈕

> 註（2026-05-25 文件漂移修正）：`setupLongPress()`（app.js）並未移除，仍保留「長按 600ms／桌機右鍵 = 直接開編輯」作為點擊→詳情之外的捷徑。兩者並存、功能不衝突，但先前文件未記錄長按仍在。

---

## D-007：Codex review 回應

**問題**：Codex 審查計畫後提出 7 個問題（2 High, 3 Medium, 2 Low）。

| # | 嚴重度 | 問題 | 處理 |
|---|--------|------|------|
| 1 | High | LAN HTTP 無法驗證 SW | 降級：LAN 只驗 UI，SW 離線待 HTTPS |
| 2 | High | 初始資料無 fallback | 已加 startup fetch → 後因隱私移除（D-003） |
| 3 | Medium | 背景提醒限制未明寫 | 已在 README 已知限制中說明 |
| 4 | Medium | localStorage 太脆弱 | 匯出功能列為 MVP 必備 |
| 5 | Medium | 匯入 schema 不明確 | README 已寫明 `colors.color` + `timeRange` 格式 |
| 6 | Low | 長按不可靠 | 改為點擊 → 詳情面板 → 編輯/刪除按鈕 |
| 7 | Low | 零依賴 vs http-server | 措辭修正：app 零依賴，測試用 Python server |

---

## D-008：啟動與部署方式

**問題**：使用者（Aaron）如何在不同場景啟動 app？

**選擇**：雙軌並行

| 場景 | 方式 |
|------|------|
| 本機開發 | `start.bat`（Python HTTP server + 自動開瀏覽器） |
| iPhone 日常使用 | GitHub Pages（`https://aaron5511.github.io/countdown-app/`） |

**原因**：
- 本機開發需要即時刷新，`.bat` 一鍵啟動最方便
- iPhone 需要一個穩定的 HTTPS 網址（也是 SW 註冊的前提）
- GitHub Pages 免費、自動部署、HTTPS

**注意**：
- 初版指令用 `npx http-server`，但 Bash 環境無 Node.js → 改用 `python -m http.server`
- GitHub Pages 更新需 1-2 分鐘，不是即時的

---

## D-009：跨午夜活動支援

**問題**：活動時間跨越午夜（如睡覺 23:00-06:00）時，原本邏輯無法正確渲染和倒數。

**選項**：
1. 禁止跨午夜 — 要求使用者拆成兩筆活動手動輸入
2. 原生跨日支援 — 自動偵測 `end < start`，拆成兩個渲染段

**選擇**：原生跨日支援（segment splitting）

**實作**：
- `isCrossMidnight(evt)`：偵測 end 時間早於 start 時間
- `createRenderSegments()`：將跨日活動拆成兩段（start→24:00 + 00:00→end），各自放在對應的日欄
- CSS 視覺提示：起始段去掉底部圓角（`.cross-midnight-start`），延續段去掉頂部圓角（`.continuation`）
- 倒數計時：起始段的剩餘時間計算到隔天的真正結束時間
- 提醒：只在活動真正結束時觸發（第二段結束），起始段的午夜邊界不觸發 alert
- `computeGridRange()`：偵測到跨日活動時自動擴展格表範圍到 0-24

**原因**：
- 睡覺、值班等活動天然跨午夜，手動拆分不直覺
- 資料格式不變（仍用單筆 event 的 start/end），只在渲染層拆段

---

## D-010：設定系統

**問題**：齒輪按鈕存在但無功能，使用者需要自訂顯示偏好。

**參考**：Aaron 提供 schedulebuilder.org 的設定截圖（Layout / Time / Event / Font 四個分頁）。

**選擇**：整合為單一設定面板，8 個可調項目

**實作**：
1. **標題**：顯示在頂部標題列和瀏覽器 tab，匯出 JSON 時附帶
2. **顯示範圍**：手動設定格表起止時間（小時），留空=依活動範圍自動計算
3. **顯示天數**：多選按鈕，可隱藏不需要的星期
4. **週起始日**：週一（預設）或週日
5. **12/24 小時制**：影響時間軸標籤、色塊時間顯示、倒數欄時間範圍
6. **色塊顯示時間**：是否在活動色塊上顯示時間範圍文字
7. **字體**：系統預設 / Arial / Georgia / Courier New
8. **文字顏色**：透過 color picker 修改 CSS `--text` 變數

**儲存**：獨立 localStorage key（`weeklyCountdown_settings`），與排程資料分開。避免匯入 JSON 時覆蓋個人偏好設定。

**UI 模式**：
- 多選用 toggle 按鈕（顯示天數），獨佔選擇用 exclusive toggle group（週起始日、時間格式、顯示時間）
- 設定 modal 的 day-btn 用獨立 class（`.settings-day-btn`）避免與活動編輯 modal 的 `.day-btn` selector 衝突

**原因**：
- 排程固定後，最常調的是顯示偏好
- 睡覺時段佔格表很大空間，需要自訂顯示範圍
- 12 小時制對習慣 AM/PM 的使用者比較直覺
