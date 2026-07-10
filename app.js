const STORAGE_KEY = "my-lawn-records-v1";

const form = document.querySelector("#recordForm");
const dateInput = document.querySelector("#date");
const mowedInput = document.querySelector("#mowed");
const mowingHeightInput = document.querySelector("#mowingHeight");
const recordsList = document.querySelector("#recordsList");
const recordCount = document.querySelector("#recordCount");
const daysSinceMowing = document.querySelector("#daysSinceMowing");
const saveMessage = document.querySelector("#saveMessage");
const consultRecord = document.querySelector("#consultRecord");
const consultPhotos = document.querySelector("#consultPhotos");
const consultQuestion = document.querySelector("#consultQuestion");
const shareConsultation = document.querySelector("#shareConsultation");
const consultMessage = document.querySelector("#consultMessage");

function todayString() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function loadRecords() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function saveRecords(records) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

function displayDate(dateText) {
  const [year, month, day] = dateText.split("-");
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  const weekday = new Intl.DateTimeFormat("ja-JP", { weekday: "short" }).format(date);
  return `${year}年${Number(month)}月${Number(day)}日（${weekday}）`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function detail(label, value, unit) {
  if (value === "" || value === null || value === undefined) return "";
  return `<div><dt>${label}</dt><dd>${escapeHtml(value)} ${unit}</dd></div>`;
}

function recordSummary(record) {
  const lines = [
    `日付：${displayDate(record.date)}`,
    `芝刈り：${record.mowed ? "実施" : "なし"}`,
  ];
  if (record.mowed && record.mowingHeight !== "") lines.push(`刈高：${record.mowingHeight} mm`);
  if (record.fertilizer !== "") lines.push(`施肥量：${record.fertilizer} kg`);
  if (record.watering !== "") lines.push(`散水時間：${record.watering} 分`);
  if (record.topdressing !== "") lines.push(`目土量：${record.topdressing} L`);
  if (record.memo) lines.push(`作業メモ：${record.memo}`);
  return lines.join("\n");
}

function updateConsultChoices(records) {
  const currentValue = consultRecord.value;
  const options = ['<option value="recent">直近5件の記録</option>'];
  records.forEach((record) => {
    const mowing = record.mowed ? "・芝刈り" : "";
    options.push(`<option value="${escapeHtml(record.id)}">${displayDate(record.date)}${mowing}</option>`);
  });
  consultRecord.innerHTML = options.join("");
  if ([...consultRecord.options].some((option) => option.value === currentValue)) {
    consultRecord.value = currentValue;
  }
  shareConsultation.disabled = records.length === 0;
  if (records.length === 0) consultMessage.textContent = "先に1件以上の記録を追加してください。";
  else if (consultMessage.textContent.includes("先に1件")) consultMessage.textContent = "";
}

function updateMowingStatus(records) {
  const mowingRecords = records
    .filter((record) => record.mowed && record.date <= todayString())
    .sort((a, b) => b.date.localeCompare(a.date));

  if (!mowingRecords.length) {
    daysSinceMowing.textContent = "まだ記録がありません";
    return;
  }

  const last = new Date(`${mowingRecords[0].date}T00:00:00`);
  const today = new Date(`${todayString()}T00:00:00`);
  const days = Math.max(0, Math.round((today - last) / 86400000));
  daysSinceMowing.textContent = days === 0 ? "今日、芝刈りしました" : `${days}日経過しています`;
}

function renderRecords() {
  const records = loadRecords().sort((a, b) =>
    b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)
  );

  recordCount.textContent = `${records.length}件`;
  updateMowingStatus(records);
  updateConsultChoices(records);

  if (!records.length) {
    recordsList.innerHTML = `
      <div class="empty-state">
        <strong>記録はまだありません</strong>
        最初の芝生のお手入れを、上の欄から記録してみましょう。
      </div>`;
    return;
  }

  recordsList.innerHTML = records.map((record) => `
    <article class="record-card">
      <div class="record-card__top">
        <time datetime="${escapeHtml(record.date)}">${displayDate(record.date)}</time>
        ${record.mowed ? '<span class="mowing-badge">✂ 芝刈り</span>' : ""}
      </div>
      <dl class="record-details">
        ${record.mowed ? detail("刈高", record.mowingHeight, "mm") : ""}
        ${detail("施肥量", record.fertilizer, "kg")}
        ${detail("散水時間", record.watering, "分")}
        ${detail("目土量", record.topdressing, "L")}
      </dl>
      ${record.memo ? `<p class="record-memo">${escapeHtml(record.memo)}</p>` : ""}
    </article>
  `).join("");
}

mowedInput.addEventListener("change", () => {
  mowingHeightInput.disabled = !mowedInput.checked;
  if (!mowedInput.checked) mowingHeightInput.value = "";
});

shareConsultation.addEventListener("click", async () => {
  const records = loadRecords().sort((a, b) =>
    b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)
  );
  const selected = consultRecord.value === "recent"
    ? records.slice(0, 5)
    : records.filter((record) => record.id === consultRecord.value);
  if (!selected.length) return;

  const question = consultQuestion.value.trim() || "この記録と写真から芝生の状態を見て、次に行うとよい手入れを初心者向けに教えてください。";
  const text = [
    "自宅の芝生管理について相談です。",
    "",
    "【これまでの記録】",
    selected.map(recordSummary).join("\n\n"),
    "",
    "【相談したいこと】",
    question,
    "",
    "写真も参考に、考えられる原因と次の作業を優先順に教えてください。薬剤などを勧める場合は、安全上の注意も添えてください。",
  ].join("\n");
  const files = [...consultPhotos.files];
  const shareData = { title: "芝生管理の相談", text };
  if (files.length && navigator.canShare?.({ files })) shareData.files = files;

  try {
    if (navigator.share) {
      await navigator.share(shareData);
      consultMessage.textContent = files.length && !shareData.files
        ? "記録を共有しました。写真はChatGPT側で追加してください。"
        : "共有画面を開きました。ChatGPTを選んでください。";
    } else {
      await navigator.clipboard.writeText(text);
      window.open("https://chatgpt.com/", "_blank", "noopener");
      consultMessage.textContent = "相談文をコピーしました。ChatGPTに貼り付け、写真を追加してください。";
    }
  } catch (error) {
    if (error.name !== "AbortError") {
      try {
        await navigator.clipboard.writeText(text);
        consultMessage.textContent = "相談文をコピーしました。ChatGPTを開いて貼り付け、写真を追加してください。";
      } catch {
        consultMessage.textContent = "共有できませんでした。もう一度お試しください。";
      }
    }
  }
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(form);
  const record = {
    id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    createdAt: new Date().toISOString(),
    date: data.get("date"),
    mowed: data.get("mowed") === "on",
    mowingHeight: data.get("mowingHeight"),
    fertilizer: data.get("fertilizer"),
    watering: data.get("watering"),
    topdressing: data.get("topdressing"),
    memo: data.get("memo").trim(),
  };

  const records = loadRecords();
  records.push(record);
  saveRecords(records);
  renderRecords();

  form.reset();
  dateInput.value = todayString();
  mowingHeightInput.disabled = true;
  saveMessage.textContent = "記録しました。Mac内に保存されています。";
  window.setTimeout(() => { saveMessage.textContent = ""; }, 3500);
  document.querySelector("#recordsTitle").scrollIntoView({ behavior: "smooth", block: "start" });
});

dateInput.value = todayString();
renderRecords();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js"));
}
