(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.LawnReportCore = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  function hasValue(value) {
    return value !== "" && value !== null && value !== undefined;
  }

  function numeric(value) {
    if (!hasValue(value)) return null;
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    const normalized = String(value).trim().replace(",", ".");
    if (!/^-?\d+(?:\.\d+)?$/.test(normalized)) return null;
    const number = Number(normalized);
    return Number.isFinite(number) ? number : null;
  }

  function formatNumber(value, unit, decimals, range) {
    const number = numeric(value);
    if (number === null) return "記録なし";
    if (range && (number < range[0] || number > range[1])) return "記録なし";
    const text = decimals === 0
      ? String(Math.round(number))
      : number.toFixed(decimals).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
    return `${text} ${unit}`;
  }

  function flag(record, key) {
    if (!Object.prototype.hasOwnProperty.call(record, key)) return "記録なし";
    return record[key] ? "実施" : "なし";
  }

  function dateLabel(dateText) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateText))) return String(dateText || "記録なし");
    const [year, month, day] = dateText.split("-").map(Number);
    const weekday = new Intl.DateTimeFormat("ja-JP", { weekday: "short" }).format(new Date(year, month - 1, day));
    return `${year}年${month}月${day}日（${weekday}）`;
  }

  function recordBlock(record, index) {
    return [
      `【記録${index + 1}】`,
      `日付：${dateLabel(record.date)}`,
      `芝刈り：${flag(record, "mowed")}`,
      `刈高：${record.mowed ? formatNumber(record.mowingHeight, "mm", 1, [0, 100]) : "なし"}`,
      `施肥量：${formatNumber(record.fertilizer, "kg", 2, [0, 1000])}`,
      `散水時間：${formatNumber(record.watering, "分", 0, [0, 1440])}`,
      `目土量：${formatNumber(record.topdressing, "L", 1, [0, 100000])}`,
      `スパイキング：${flag(record, "spiking")}`,
      `サッチング：${flag(record, "thatching")}`,
      `メモ：${hasValue(record.memo) ? String(record.memo).trim() || "記録なし" : "記録なし"}`,
    ].join("\n");
  }

  function daysBetween(todayText, dateText) {
    if (!dateText) return null;
    const days = Math.round((new Date(`${todayText}T00:00:00`) - new Date(`${dateText}T00:00:00`)) / 86400000);
    return Number.isFinite(days) ? Math.max(0, days) : null;
  }

  function lastDate(records, predicate) {
    return records.filter(predicate).map((record) => record.date).filter(Boolean).sort((a, b) => b.localeCompare(a))[0] || null;
  }

  function intervals(records, todayText) {
    const items = [
      ["前回芝刈りから", lastDate(records, (r) => r.mowed === true)],
      ["前回施肥から", lastDate(records, (r) => numeric(r.fertilizer) !== null && numeric(r.fertilizer) > 0)],
      ["前回散水から", lastDate(records, (r) => numeric(r.watering) !== null && numeric(r.watering) > 0)],
      ["前回目土から", lastDate(records, (r) => numeric(r.topdressing) !== null && numeric(r.topdressing) > 0)],
    ];
    return items.map(([label, date]) => {
      const days = daysBetween(todayText, date);
      return `・${label}：${days === null ? "記録なし" : `${days}日`}`;
    }).join("\n");
  }

  function generateReport(records, count, question, todayText) {
    const selected = records.slice(0, Math.max(1, Number(count) || 1));
    const consultation = String(question || "").trim() || "記載なし";
    return [
      "【相談内容】",
      consultation,
      "",
      "【芝生の基本情報】",
      "・芝種：高麗芝",
      "・面積：約80㎡",
      "",
      "【直近の記録】",
      "",
      selected.map(recordBlock).join("\n\n"),
      "",
      "【作業間隔】",
      intervals(records, todayText),
      "",
      "【ChatGPTへの依頼】",
      "以下の記録と添付写真を確認し、",
      "1. 現在の芝生の状態",
      "2. 考えられる問題",
      "3. 次に行う作業",
      "4. 作業を見送る条件",
      "5. 不明点や推測",
      "を整理して助言してください。",
    ].join("\n");
  }

  return { numeric, formatNumber, recordBlock, intervals, generateReport };
});
