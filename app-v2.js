const STORAGE_KEY = "my-lawn-records-v1";
const SAFETY_KEY = "my-lawn-records-v1-safety-copy";
const DB_NAME = "my-lawn-photos-v1";
const DB_STORE = "photos";

const $ = (selector) => document.querySelector(selector);
const form = $("#recordForm");
const dateInput = $("#date");
const mowedInput = $("#mowed");
const mowingHeightInput = $("#mowingHeight");
const photosInput = $("#photos");
const recordsList = $("#recordsList");
const recordCount = $("#recordCount");
const daysSinceMowing = $("#daysSinceMowing");
const saveMessage = $("#saveMessage");
const consultCount = $("#consultCount");
const consultQuestion = $("#consultQuestion");
const makeReport = $("#makeReport");
const reportArea = $("#reportArea");
const reportOutput = $("#reportOutput");
const copyReport = $("#copyReport");
const shareReport = $("#shareReport");
const consultMessage = $("#consultMessage");
const summaryYear = $("#summaryYear");
const intervalCards = $("#intervalCards");
const annualSummary = $("#annualSummary");
const monthlySummary = $("#monthlySummary");
const yearComparison = $("#yearComparison");
const backupMessage = $("#backupMessage");

if (!localStorage.getItem(SAFETY_KEY) && localStorage.getItem(STORAGE_KEY)) {
  localStorage.setItem(SAFETY_KEY, localStorage.getItem(STORAGE_KEY));
}

function todayString() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function loadRecords() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(value) ? value : [];
  } catch { return []; }
}

function saveRecords(records) { localStorage.setItem(STORAGE_KEY, JSON.stringify(records)); }
function sortedRecords() {
  return loadRecords().sort((a, b) => b.date.localeCompare(a.date) || String(b.createdAt).localeCompare(String(a.createdAt)));
}

function openPhotoDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const store = request.result.createObjectStore(DB_STORE, { keyPath: "id" });
      store.createIndex("recordId", "recordId");
      store.createIndex("workDate", "workDate");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function dbRequest(mode, action) {
  const db = await openPhotoDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, mode);
    const request = action(tx.objectStore(DB_STORE));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}

const getAllPhotos = () => dbRequest("readonly", (store) => store.getAll());
const savePhoto = (photo) => dbRequest("readwrite", (store) => store.put(photo));
const clearPhotos = () => dbRequest("readwrite", (store) => store.clear());

async function photosForRecord(recordId) {
  return (await getAllPhotos()).filter((photo) => photo.recordId === recordId);
}

function displayDate(dateText) {
  const [year, month, day] = dateText.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  const weekday = new Intl.DateTimeFormat("ja-JP", { weekday: "short" }).format(date);
  return `${year}年${month}月${day}日（${weekday}）`;
}

function escapeHtml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function numberValue(value) { const n = Number(value); return value === "" || !Number.isFinite(n) ? 0 : n; }
function detail(label, value, unit) {
  if (value === "" || value == null) return "";
  return `<div><dt>${label}</dt><dd>${escapeHtml(value)} ${unit}</dd></div>`;
}

function recordSummary(record) {
  const lines = [`日付：${displayDate(record.date)}`, `芝刈り：${record.mowed ? "実施" : "なし"}`];
  if (record.mowed && record.mowingHeight !== "") lines.push(`刈高：${record.mowingHeight} mm`);
  if (record.fertilizer !== "") lines.push(`施肥量：${record.fertilizer} kg`);
  if (record.watering !== "") lines.push(`散水時間：${record.watering} 分`);
  if (record.topdressing !== "") lines.push(`目土量：${record.topdressing} L`);
  if (record.memo) lines.push(`作業メモ：${record.memo}`);
  return lines.join("\n");
}

function daysSince(dateText) {
  if (!dateText) return null;
  const today = new Date(`${todayString()}T00:00:00`);
  return Math.max(0, Math.round((today - new Date(`${dateText}T00:00:00`)) / 86400000));
}

function lastWorkDate(records, predicate) {
  return records.filter((r) => r.date <= todayString() && predicate(r)).sort((a, b) => b.date.localeCompare(a.date))[0]?.date || null;
}

function intervalData(records) {
  return [
    ["芝刈り", lastWorkDate(records, (r) => r.mowed)],
    ["施肥", lastWorkDate(records, (r) => numberValue(r.fertilizer) > 0)],
    ["目土", lastWorkDate(records, (r) => numberValue(r.topdressing) > 0)],
    ["散水", lastWorkDate(records, (r) => numberValue(r.watering) > 0)],
  ].map(([label, date]) => ({ label, date, days: daysSince(date) }));
}

function yearStats(records, year) {
  const selected = records.filter((r) => Number(r.date.slice(0, 4)) === year);
  return {
    year,
    mowing: selected.filter((r) => r.mowed).length,
    fertilizer: selected.reduce((sum, r) => sum + numberValue(r.fertilizer), 0),
    topdressing: selected.reduce((sum, r) => sum + numberValue(r.topdressing), 0),
    watering: selected.filter((r) => numberValue(r.watering) > 0).length,
    monthly: Array.from({ length: 12 }, (_, index) => selected.filter((r) => Number(r.date.slice(5, 7)) === index + 1).length),
  };
}

async function photoHtml(photos) {
  if (!photos.length) return "";
  return `<div class="photo-strip">${photos.map((p) => `<figure><img src="${URL.createObjectURL(p.blob)}" alt="${escapeHtml(p.workDate)}の芝生写真"><figcaption class="photo-caption">撮影 ${displayDate(p.capturedAt.slice(0, 10))}</figcaption></figure>`).join("")}</div>`;
}

async function renderRecords() {
  const records = sortedRecords();
  const allPhotos = await getAllPhotos();
  recordCount.textContent = `${records.length}件`;
  const lastMowing = lastWorkDate(records, (r) => r.mowed);
  const mowingDays = daysSince(lastMowing);
  daysSinceMowing.textContent = mowingDays == null ? "まだ記録がありません" : mowingDays === 0 ? "今日、芝刈りしました" : `${mowingDays}日経過しています`;
  updateConsultChoices(records);
  renderDashboard(records);
  await renderComparison(records, allPhotos);

  if (!records.length) {
    recordsList.innerHTML = `<div class="empty-state"><strong>記録はまだありません</strong>最初のお手入れを上の欄から記録しましょう。</div>`;
    return;
  }
  const cards = [];
  for (const record of records) {
    const photos = allPhotos.filter((p) => p.recordId === record.id);
    cards.push(`<article class="record-card"><div class="record-card__top"><time datetime="${record.date}">${displayDate(record.date)}</time>${record.mowed ? '<span class="mowing-badge">✂ 芝刈り</span>' : ""}</div><dl class="record-details">${record.mowed ? detail("刈高", record.mowingHeight, "mm") : ""}${detail("施肥量", record.fertilizer, "kg")}${detail("散水時間", record.watering, "分")}${detail("目土量", record.topdressing, "L")}</dl>${record.memo ? `<p class="record-memo">${escapeHtml(record.memo)}</p>` : ""}${photos.length ? `<p class="record-photo-count">写真 ${photos.length}枚</p>${await photoHtml(photos)}` : ""}</article>`);
  }
  recordsList.innerHTML = cards.join("");
}

function updateConsultChoices(records) {
  makeReport.disabled = records.length === 0;
  if (!records.length) consultMessage.textContent = "先に1件以上の記録を追加してください。";
}

function renderDashboard(records) {
  const years = [...new Set(records.map((r) => Number(r.date.slice(0, 4))))].sort((a, b) => b - a);
  const currentYear = new Date().getFullYear();
  if (!years.includes(currentYear)) years.unshift(currentYear);
  const selectedYear = Number(summaryYear.value) || currentYear;
  summaryYear.innerHTML = years.map((y) => `<option value="${y}" ${y === selectedYear ? "selected" : ""}>${y}年</option>`).join("");
  intervalCards.innerHTML = intervalData(records).map((x) => `<div class="summary-item"><span>前回${x.label}から</span><strong>${x.days == null ? "記録なし" : `${x.days}日`}</strong></div>`).join("");
  const stats = yearStats(records, selectedYear);
  annualSummary.innerHTML = `<div class="annual-stat"><strong>${stats.mowing}回</strong><span>芝刈り</span></div><div class="annual-stat"><strong>${stats.fertilizer.toFixed(2)}kg</strong><span>施肥量合計</span></div><div class="annual-stat"><strong>${stats.topdressing.toFixed(1)}L</strong><span>目土量合計</span></div><div class="annual-stat"><strong>${stats.watering}回</strong><span>散水</span></div>`;
  const max = Math.max(1, ...stats.monthly);
  monthlySummary.innerHTML = `<h3>月別の作業回数</h3>${stats.monthly.map((count, i) => `<div class="month-row"><span>${i + 1}月</span><span class="month-bar"><i style="width:${count / max * 100}%"></i></span><strong>${count}回</strong></div>`).join("")}`;
}

async function renderComparison(records, photos) {
  if (!records.length) { yearComparison.innerHTML = '<div class="empty-state">比較できる記録がありません。</div>'; return; }
  const current = records[0];
  const target = new Date(`${current.date}T00:00:00`); target.setFullYear(target.getFullYear() - 1);
  const previous = records.filter((r) => Number(r.date.slice(0, 4)) === target.getFullYear()).sort((a, b) => Math.abs(new Date(a.date) - target) - Math.abs(new Date(b.date) - target))[0];
  if (!previous) { yearComparison.innerHTML = `<div class="empty-state">${target.getFullYear()}年の近い時期の記録がまだありません。</div>`; return; }
  const fields = [["刈高", current.mowed ? `${current.mowingHeight || "—"} mm` : "なし", previous.mowed ? `${previous.mowingHeight || "—"} mm` : "なし"], ["施肥量", numberValue(current.fertilizer) ? `${current.fertilizer} kg` : "なし", numberValue(previous.fertilizer) ? `${previous.fertilizer} kg` : "なし"], ["散水", numberValue(current.watering) ? `${current.watering} 分` : "なし", numberValue(previous.watering) ? `${previous.watering} 分` : "なし"], ["目土", numberValue(current.topdressing) ? `${current.topdressing} L` : "なし", numberValue(previous.topdressing) ? `${previous.topdressing} L` : "なし"]];
  yearComparison.innerHTML = `<div class="comparison-grid"><div class="comparison-card"><h3>今回：${displayDate(current.date)}</h3>${await photoHtml(photos.filter((p) => p.recordId === current.id))}</div><div class="comparison-card"><h3>前年：${displayDate(previous.date)}</h3>${await photoHtml(photos.filter((p) => p.recordId === previous.id))}</div></div><table class="comparison-table"><thead><tr><th>項目</th><th>今回</th><th>前年</th></tr></thead><tbody>${fields.map((f) => `<tr><th>${f[0]}</th><td>${f[1]}</td><td>${f[2]}</td></tr>`).join("")}</tbody></table>`;
}

mowedInput.addEventListener("change", () => { mowingHeightInput.disabled = !mowedInput.checked; if (!mowedInput.checked) mowingHeightInput.value = ""; });
summaryYear.addEventListener("change", () => renderDashboard(sortedRecords()));

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(form);
  const id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
  const record = { id, createdAt: new Date().toISOString(), date: data.get("date"), mowed: data.get("mowed") === "on", mowingHeight: data.get("mowingHeight"), fertilizer: data.get("fertilizer"), watering: data.get("watering"), topdressing: data.get("topdressing"), spiking: data.get("spiking") === "on", thatching: data.get("thatching") === "on", memo: data.get("memo").trim() };
  const records = loadRecords(); records.push(record); saveRecords(records);
  for (const file of [...photosInput.files]) await savePhoto({ id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`, recordId: id, name: file.name || "芝生写真.jpg", type: file.type || "image/jpeg", blob: file, capturedAt: new Date(file.lastModified || Date.now()).toISOString(), workDate: record.date, memo: record.memo });
  form.reset(); dateInput.value = todayString(); mowingHeightInput.disabled = true;
  saveMessage.textContent = "記録と写真をこの端末内に保存しました。";
  await renderRecords();
  setTimeout(() => { saveMessage.textContent = ""; }, 3500);
});

makeReport.addEventListener("click", () => {
  const records = sortedRecords();
  if (!records.length) return;
  reportOutput.value = LawnReportCore.generateReport(records, Number(consultCount.value), consultQuestion.value, todayString());
  reportArea.hidden = false;
  consultMessage.textContent = "報告文を作りました。内容を確認してコピーしてください。";
  reportOutput.scrollIntoView({ behavior: "smooth", block: "center" });
});

copyReport.addEventListener("click", async () => {
  try { await navigator.clipboard.writeText(reportOutput.value); consultMessage.textContent = "報告文をコピーしました。"; }
  catch { reportOutput.focus(); reportOutput.select(); consultMessage.textContent = "文章を選択しました。「コピー」を選んでください。"; }
});

shareReport.addEventListener("click", async () => {
  if (!reportOutput.value) return;
  try {
    if (navigator.share) {
      await navigator.share({ title: "芝生管理報告", text: reportOutput.value });
      consultMessage.textContent = "共有画面を開きました。写真はChatGPT側で添付してください。";
    } else {
      await navigator.clipboard.writeText(reportOutput.value);
      consultMessage.textContent = "この端末では共有画面を開けないため、報告文をコピーしました。";
    }
  } catch (error) {
    if (error.name !== "AbortError") consultMessage.textContent = "共有できませんでした。報告文をコピーしてお使いください。";
  }
});

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = filename; link.click(); setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(",")[1]); reader.onerror = reject; reader.readAsDataURL(blob); });
}

function base64ToBlob(base64, type) {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)); return new Blob([bytes], { type });
}

$("#exportJson").addEventListener("click", async () => {
  const photos = await getAllPhotos();
  const payload = { format: "shibafu-note-backup", version: 2, exportedAt: new Date().toISOString(), records: loadRecords(), photos: await Promise.all(photos.map(async (p) => ({ ...p, blob: undefined, base64: await blobToBase64(p.blob) }))) };
  downloadBlob(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }), `芝生帳バックアップ-${todayString()}.json`);
  backupMessage.textContent = "写真込みのバックアップを書き出しました。";
});

$("#exportCsv").addEventListener("click", () => {
  const rows = [["日付", "芝刈り", "刈高mm", "施肥量kg", "散水時間分", "目土量L", "作業メモ"], ...sortedRecords().map((r) => [r.date, r.mowed ? "実施" : "なし", r.mowingHeight, r.fertilizer, r.watering, r.topdressing, r.memo])];
  const csv = "\uFEFF" + rows.map((row) => row.map((v) => `"${String(v ?? "").replaceAll('"', '""')}"`).join(",")).join("\r\n");
  downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), `芝生帳記録-${todayString()}.csv`);
  backupMessage.textContent = "記録のCSVを書き出しました。";
});

$("#restoreJson").addEventListener("change", async (event) => {
  const file = event.target.files[0]; if (!file) return;
  if (!window.confirm("現在の記録と写真を安全コピーした後、選んだバックアップの内容に置き換えます。復元してよろしいですか？")) {
    event.target.value = "";
    return;
  }
  try {
    const data = JSON.parse(await file.text());
    if (data.format !== "shibafu-note-backup" || !Array.isArray(data.records)) throw new Error("形式が違います");
    localStorage.setItem(`${SAFETY_KEY}-${Date.now()}`, localStorage.getItem(STORAGE_KEY) || "[]");
    saveRecords(data.records); await clearPhotos();
    for (const p of data.photos || []) await savePhoto({ ...p, blob: base64ToBlob(p.base64, p.type), base64: undefined });
    await renderRecords(); backupMessage.textContent = "バックアップから復元しました。";
  } catch { backupMessage.textContent = "復元できませんでした。芝生帳のJSONファイルを選んでください。"; }
  event.target.value = "";
});

dateInput.value = todayString();
renderRecords().catch(() => { saveMessage.textContent = "写真の保存領域を開けませんでした。Safariを開き直してください。"; });
if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js"));
