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
    const lines = [
      `【記録${index + 1}】`,
      `日付：${dateLabel(record.date)}`,
    ];
    if (record.mowed === true) {
      lines.push("芝刈り：実施");
      const height = formatNumber(record.mowingHeight, "mm", 1, [0, 100]);
      if (height !== "記録なし") lines.push(`刈高：${height}`);
    }
    const fertilizer = formatNumber(record.fertilizer, "kg", 2, [0, 1000]);
    const watering = formatNumber(record.watering, "分", 0, [0, 1440]);
    const topdressing = formatNumber(record.topdressing, "L", 1, [0, 100000]);
    if (fertilizer !== "記録なし" && numeric(record.fertilizer) > 0) lines.push(`施肥量：${fertilizer}`);
    if (watering !== "記録なし" && numeric(record.watering) > 0) lines.push(`散水時間：${watering}`);
    if (topdressing !== "記録なし" && numeric(record.topdressing) > 0) lines.push(`目土量：${topdressing}`);
    if (record.spiking === true) lines.push("スパイキング：実施");
    if (record.thatching === true) lines.push("サッチング：実施");
    if (hasValue(record.memo) && String(record.memo).trim()) lines.push(`メモ：${String(record.memo).trim()}`);
    return lines.join("\n");
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
    const consultation = String(question || "").trim();
    const parts = [];
    if (consultation) parts.push("【相談したいこと】", consultation, "");
    parts.push(selected.map(recordBlock).join("\n\n"));
    return parts.join("\n");
  }

  return { numeric, formatNumber, recordBlock, intervals, generateReport };
});
