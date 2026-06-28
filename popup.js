const PROBLEM_SETS_PATH = "/wiki/Problem_sets";
const completedOnlyEl = document.getElementById("completedOnly");
const pickBtn = document.getElementById("pick");
const statusEl = document.getElementById("status");
const resultEl = document.getElementById("result");
const resultLinkEl = document.getElementById("resultLink");
const store = chrome.storage && chrome.storage.local;

//Restore saved toggle state
if (store) {
  store.get({ completedOnly: false }, ({ completedOnly }) => {
    completedOnlyEl.checked = completedOnly;
  });
}

completedOnlyEl.addEventListener("change", () => {
  if (store) store.set({ completedOnly: completedOnlyEl.checked });
});

pickBtn.addEventListener("click", pickRandom);

function setStatus(msg, isError = false) {
  statusEl.textContent = msg;
  statusEl.classList.toggle("error", isError);
}

function showResult(problem) {
  resultLinkEl.textContent = problem.name;
  resultLinkEl.href = problem.url;
  resultEl.hidden = false;
}

//Scrapes problems using page context; reads live, logged-in DOM so completion icons are rendered; returns icon info for each position
function scrapeProblems() {
  return [...document.querySelectorAll("a.vlgstat_link")].map((a) => {
    const icon = a.querySelector(".hdlbits-stat-icon");
    return {
      name: a.getAttribute("title") || a.textContent.trim(),
      url: a.href,
      iconClass: icon ? icon.className : "",
      statusText: icon ? icon.getAttribute("title") || "" : "",
    };
  });
}

//HDLBits marks solved problems with a check icon and a title in the format
  // "name: Complete". "Not attempted" / "Attempted" are not completed
function isCompleted(p) {
  if (p.iconClass.toLowerCase().includes("fa-check")) return true;
  const t = p.statusText.toLowerCase();
  const status = t.includes(":") ? t.split(":").pop().trim() : t;
  return /complete|solved|correct/.test(status);
}

async function pickRandom() {
  pickBtn.disabled = true;
  resultEl.hidden = true;
  setStatus("Reading problem list…");

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab || !tab.url || !tab.url.includes(PROBLEM_SETS_PATH)) {
      setStatus(
        "Open the HDLBits Problem sets page first, then click again.",
        true
      );
      return;
    }

    const [{ result: problems } = {}] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: scrapeProblems,
    });

    if (!problems || problems.length === 0) {
      throw new Error("No problems found on this page.");
    }

    let pool = problems;
    if (completedOnlyEl.checked) {
      pool = problems.filter(isCompleted);
      if (pool.length === 0) {
        setStatus(
          "No completed problems found. Make sure you're logged in, or turn the toggle off.",
          true
        );
        return;
      }
    }

    const choice = pool[Math.floor(Math.random() * pool.length)];
    showResult(choice);
    setStatus(`Chosen from ${pool.length} problem${pool.length === 1 ? "" : "s"}.`);
  } catch (err) {
    setStatus(`Couldn't read problems: ${err.message}`, true);
  } finally {
    pickBtn.disabled = false;
  }
}
