/* ==========================================================================
   店舖設定檔 config.js
   --------------------------------------------------------------------------
   換成另一間店時，只需要修改這個檔案。

   修改小貼士：
   ・文字用雙引號 "" 包住；每一項後面記得加逗號 ,
   ・價錢一律填「整數」港幣，例如 38（不要填 38.5 或 "$38"）
   ・true ＝ 開啟，false ＝ 關閉
   ・儲存後重新整理網頁即可看到效果。如畫面出現「設定檔載入失敗」，
     多數是漏了逗號或引號：在電腦瀏覽器按 F12，打開「Console」可看到出錯位置。
   ========================================================================== */

window.SHOP_CONFIG = {
  /* ---------- 1. 基本資料 ---------- */

  // 店舖代號：只可用英文細楷、數字及 -，每間店不同（用來分開各店的購物清單暫存）
  id: "lanelight-coffee",

  // 示範模式：true 時頁尾顯示「示範作品・店名及內容純屬虛構」、訂單預覽提示號碼為虛構，
  // 並要求搜尋引擎不要收錄。真實客戶的網站請改為 false。
  demo: true,

  name: "巷光咖啡",
  nameEn: "Lanelight Coffee", // 英文名，可留空 ""
  kicker: "深水埗・自家烘焙", // 首屏店名上方的小字，可留空 ""
  tagline: "小巷裏的一盞燈，一杯慢慢沖好的咖啡。",
  // 搜尋引擎及分享時顯示的介紹（一兩句即可）
  description:
    "深水埗街坊咖啡店，每週自家烘焙咖啡豆，供應咖啡、港式特飲、輕食及甜品，可經 WhatsApp 預先落單。",

  about: {
    paragraphs: [
      "巷光咖啡開在深水埗一條安靜的小巷裏。每天清早，我們先把咖啡豆磨好、把多士烘香，等街坊上班前來帶走一杯。",
      "我們相信一杯好咖啡不必昂貴：用心選豆、準確萃取，再配一份自家製甜品，就是一天最好的開始。",
    ],
    highlights: ["每週自家烘焙", "街坊價錢", "歡迎寵物同行"],
  },

  /* ---------- 2. 顏色及字型 ---------- */
  theme: {
    brand: "#B23A1E", // 主色：按鈕及重點（請用深色，白字才清楚）
    accent: "#2E5E4E", // 輔助色：插圖門框、「營業中」標記等
    ink: "#2A1E17", // 文字及深色背景
    paper: "#F5EEE4", // 網頁底色
    webFont: true, // true ＝ 標題用 Google 網上字型（只下載頁面用到的字）；false ＝ 全用裝置內置字型
  },

  /* ---------- 3. 營業時間 ----------
     days：0 ＝ 星期日，1 ＝ 星期一 … 6 ＝ 星期六
     時間用 24 小時制 "HH:MM"。同一日如有午休，可分開兩行填寫；沒有列出的日子當作休息。
     客人只可選擇營業時間內的自取時間（關門時間本身不可選）。 */
  hours: [
    { label: "星期一至五", days: [1, 2, 3, 4, 5], open: "08:00", close: "18:00" },
    { label: "星期六、日", days: [6, 0], open: "09:00", close: "19:00" },
  ],
  hoursNote: "公眾假期照常營業；惡劣天氣下或會提早關門，請留意店舖公佈。",
  timeZone: "Asia/Hong_Kong",

  /* ---------- 4. 地址及聯絡 ---------- */
  contact: {
    address: "九龍深水埗示範街 1 號地舖",
    directions: "港鐵深水埗站 A2 出口，步行約 3 分鐘",
    // Google 地圖連結：在 Google 地圖找到店舖 →「分享」→「複製連結」，貼在這裏。
    // 留空 "" 的話，「Google 地圖導航」會改用下面 mapQuery 的文字導航。
    mapUrl: "",
    mapQuery: "深水埗站",
    // 電話及 WhatsApp：國際格式，852 開頭，只填數字（不要加 +、空格或 -）
    // 示範版用明顯的假號碼 852 0000 0000
    phone: "85200000000",
    whatsapp: "85200000000",
    instagram: "", // 例如 "https://www.instagram.com/你的帳號/"，留空則不顯示
    email: "", // 留空則不顯示
  },

  /* ---------- 5. WhatsApp 落單 ---------- */
  order: {
    enabled: true, // false ＝ 關閉整個落單功能，網站變回純展示網站
    pickup: true, // 提供「自取」
    dineIn: true, // 提供「堂食」（客人填寫枱號）
    leadMinutes: 20, // 自取時間最少要比現在晚多少分鐘
    advanceDays: 1, // 最多可預訂多少日後：0 ＝ 只限即日；1 ＝ 可訂至明日
    maxQty: 20, // 每項最多可點的數量
    notice: "訂單以店舖 WhatsApp 回覆確認為準，付款於取餐時進行。",
  },

  /* ---------- 6. 餐點選項 ----------
     每組選項有一個英文代號（例如 temp），在菜單項目的 options 填上代號即可使用。
     ・每組的第一個選項是預設選項
     ・price：加價（整數；0 ＝ 不加錢）
     ・placement: "prefix" ＝ 選項文字放在名稱前，例如「凍」＋「檸茶」＝「凍檸茶」；
       不填 ＝ 放在名稱後的括號內，例如「檸茶（少甜）」
     ・hideInOrder: true ＝ 選了這個選項時，訂單上不另外註明（適合「正常」一類的預設選項） */
  optionGroups: {
    temp: {
      title: "溫度",
      placement: "prefix",
      choices: [
        { label: "熱", price: 0 },
        { label: "凍", price: 3 },
      ],
    },
    sweet: {
      title: "甜度",
      choices: [
        { label: "正常", price: 0, hideInOrder: true },
        { label: "少甜", price: 0 },
        { label: "走甜", price: 0 },
      ],
    },
    milk: {
      title: "奶類",
      choices: [
        { label: "鮮奶", price: 0, hideInOrder: true },
        { label: "燕麥奶", price: 6 },
      ],
    },
    egg: {
      title: "加配",
      choices: [
        { label: "不用", price: 0, hideInOrder: true },
        { label: "加太陽蛋", price: 8 },
      ],
    },
  },

  /* ---------- 7. 菜單 ----------
     每項可填：
     ・name：名稱（同一份菜單內不要重複）
     ・price：價錢（整數）
     ・desc：簡短描述
     ・options：可選的選項組代號，例如 ["temp", "sweet"]
     ・soldOut: true ＝ 售罄（顯示「售罄」，不能加入）
     ・badge：小標籤，例如 "人氣"、"新品"（可不填）
     ・image：相片路徑，例如 "images/latte.jpg"（可不填） */
  menu: [
    {
      category: "咖啡",
      categoryEn: "Coffee",
      items: [
        { name: "美式咖啡", price: 30, desc: "自家烘焙拼配豆，帶焦糖與可可的甘香。", options: ["temp"] },
        { name: "鮮奶咖啡", price: 36, desc: "濃縮咖啡配綿滑鮮奶，街坊最常點的一杯。", options: ["temp", "milk"], badge: "人氣" },
        { name: "澳式白咖啡", price: 38, desc: "雙份濃縮配薄薄一層奶泡，咖啡味更突出。只供熱飲。", options: ["milk"] },
        { name: "手沖單品", price: 52, desc: "每日精選單品咖啡豆，產區請向店員查詢。", soldOut: true },
      ],
    },
    {
      category: "特飲",
      categoryEn: "Specials",
      items: [
        { name: "檸茶", price: 25, desc: "錫蘭紅茶配新鮮檸檬片，茶底濃而不澀。", options: ["temp", "sweet"], badge: "人氣" },
        { name: "奶茶", price: 25, desc: "港式絲襪奶茶，茶香厚、奶味滑。", options: ["temp", "sweet"] },
        { name: "鴛鴦", price: 27, desc: "咖啡三、奶茶七，香濃而不搶味。", options: ["temp", "sweet"] },
        { name: "抹茶鮮奶", price: 38, desc: "日本宇治抹茶粉，以微甜調配。", options: ["temp", "milk"] },
      ],
    },
    {
      category: "輕食",
      categoryEn: "Light Bites",
      items: [
        { name: "火腿芝士多士", price: 38, desc: "厚切白方包夾火腿和車打芝士，烘至金黃。", options: ["egg"] },
        { name: "牛油果酸種多士", price: 52, desc: "酸種麵包配牛油果蓉、溏心蛋及少許辣椒碎。", badge: "新品" },
        { name: "蛋沙律牛角包", price: 42, desc: "牛油牛角包夾自家製蛋沙律和芝麻菜。" },
        { name: "雞肉凱撒卷", price: 45, desc: "香烤雞胸、羅馬生菜配凱撒醬，以薄餅捲起。" },
      ],
    },
    {
      category: "甜品",
      categoryEn: "Desserts",
      items: [
        { name: "巴斯克芝士蛋糕", price: 42, desc: "表面烤至焦香，內裏濕潤綿密。" },
        { name: "檸檬撻", price: 36, desc: "牛油撻皮配酸甜檸檬忌廉，清新不膩。" },
        { name: "香蕉合桃蛋糕", price: 28, desc: "熟透香蕉與合桃一同烘焙，每日限量。", soldOut: true },
      ],
    },
  ],

  /* ---------- 8. 頁尾 ---------- */
  footer: {
    credit: "", // 例如 "網站製作：XXX"，留空則不顯示
    creditUrl: "", // 製作者連結，可留空
  },
};
