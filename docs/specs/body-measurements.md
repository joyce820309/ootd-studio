# 體態量測與趨勢

## 快照與固定資料

- `/me` 每次儲存新增一筆 `body_measurements` 當天完整快照，以最近一筆預填，不覆蓋舊快照；編輯歷史紀錄則更新指定快照。
- `body_profile` 每位使用者一筆，直接更新、不產生量測紀錄。身高、臂長、內長已搬至固定資料；舊快照欄位保留但不再寫入、不再顯示。
- migration 0019 新增 `high_waist_cm`、`navel_sitting_cm`、`time_of_day` 及固定資料欄位；migration 0020 新增 `waist_sitting_cm`。時段只是紀錄，不影響尺寸計算。
- `body_profile` 固定資料欄位：`height_cm`、`arm_length_cm`、`inseam_cm`、`seated_rise_cm`、`foot_width_left_cm`、`foot_width_right_cm`、`heel_width_cm`、`updated_at`。身高、臂長、內長從量測快照搬至固定資料；舊快照欄位保留但不再寫入、不再顯示。
- 腳部襪子三種狀態（五指襪／一般襪／裸腳）各記腳長、腳寬、前掌圍、腳背圍；表格採量較大的那隻腳。左右腳寬及腳跟寬放在 `body_profile`。

## 身體尺寸對照規則

- 一般褲頭若位於肚臍高度且無彈性：以站姿、坐姿肚臍圍較大值比較。
- 高腰褲：使用高腰圍；未填時退回腰圍。
- 褲腰：站姿與坐姿腰圍取較大值；若有肚臍圍資料，非高腰無彈性褲依肚臍圍規則。
- 鞋：使用左右腳較大的裸腳腳寬。
- 褲子：衣物平放「股上」對 `body_profile.seated_rise_cm`；若褲子尚無股上欄位，新增欄位時一併補齊。
- 踩雷尺寸對照取購買日前最近一次量測；衣物圍度以平放尺寸乘 2。

## 歷史紀錄

- 依日期與對照表檢視只列數字，不畫趨勢、不設目標、不用紅綠色評價增減。
- 相鄰紀錄比較：有變化顯示差值（燕麥底）、第一次紀錄顯示「第一次記」（霧藍）、數值相同顯示「—」。

## 趨勢（migration 0021）

- 路徑：`/me/measurements?view=trend`；偏好儲存在每人一筆 `measurement_trend_prefs`，切換後自動儲存，刪除設定即還原預設。
- 一次顯示 1～2 個相同單位的部位，體重只能單獨看；手機一次 1 個。
- 時間範圍為半年／一年／全部；可只看早上空腹、設定是否顯示體重（關閉時全頁不出現體重）。早上空腹點為實心，其他或未記時段為空心。
- Y 軸最小範圍：cm 類 10cm、體重 3kg。上升下降不分好壞、不畫目標線、不用評價字眼。
- 只有一筆的部位不畫線，顯示「只有 1 筆，還畫不出線」。系列色用 `trend-1`、`trend-2`，格線用 `chart-grid`。
- 趨勢資料由 `body_measurements` 計算；邏輯在 `src/lib/measurementTrend.ts`，圖表在 `components/profile/MeasurementTrend.tsx`。
