const TIMES = [
    "06:00", "07:00", "08:00", "09:00",
    "10:00", "11:00", "12:00", "13:00",
    "14:00", "15:00", "16:00", "17:00",
    "18:00", "19:00", "20:00", "21:00",
    "22:00", "23:00"
];

const DAYS = ["Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag", "Lørdag", "Søndag"];
const VALID_ACTIVITIES = new Set(["study", "exercise", "gaming", "social", "other"]);

const scheduleBody = document.getElementById("schedule-body");
const activitySelector = document.getElementById("activity-selector");
const clearButton = document.getElementById("clear-all");
const statusElement = document.getElementById("autosave-status");
const editorPanel = document.getElementById("cell-editor");
const editorBody = document.getElementById("editor-body");
const editorEmptyState = document.getElementById("editor-empty");
const editorMeta = document.getElementById("editor-meta");
const editorText = document.getElementById("editor-text");
const editorActivity = document.getElementById("editor-activity");
const editorClearButton = document.getElementById("editor-clear");
const loginButton = document.getElementById("login-button");
const loginModal = document.getElementById("login-modal");
const loginForm = document.getElementById("login-form");
const loginClose = document.getElementById("login-close");
const loginUsername = document.getElementById("login-username");
const loginPassword = document.getElementById("login-password");
const loginError = document.getElementById("login-error");
const loginCallout = document.getElementById("login-callout");
const DEFAULT_STATUS_TEXT = (statusElement?.textContent || "Gemmes automatisk").trim();
const EDITOR_EMPTY_DEFAULT = (editorEmptyState?.textContent || "").trim();
const EDITOR_EMPTY_LOCKED_TEXT = "Log ind i admin-tilstand for at redigere skemaet.";
const SERVER_REQUIRED_TEXT = "Kør `npm start` lokalt for at redigere skemaet.";

let statusTimerId = null;
let loginCalloutTimerId = null;
let selectedCell = null;
let isAuthenticated = false;
let serverAvailable = false;
let authToken = null;
let scheduleData = {};

function storageKeyForCell(cell) {
    return `${cell.dataset.day}_${cell.dataset.time}`;
}

function syncAuthUI() {
    document.body?.classList.toggle("is-authenticated", isAuthenticated && serverAvailable);

    if (loginButton) {
        loginButton.disabled = !serverAvailable;
        if (!serverAvailable) {
            loginButton.textContent = "Kun visning";
            loginButton.setAttribute("aria-expanded", "false");
        } else {
            loginButton.textContent = isAuthenticated ? "Log ud" : "Log ind";
            loginButton.setAttribute("aria-expanded", String(isAuthenticated));
        }
    }

    if (statusElement) {
        const text = !serverAvailable
            ? "Kun visning"
            : isAuthenticated
                ? DEFAULT_STATUS_TEXT
                : "Login for at redigere";
        statusElement.textContent = text;
        statusElement.classList.remove("status-pill--active");
    }

    if (loginCallout) {
        loginCallout.textContent = serverAvailable
            ? "Log ind for at redigere skemaet."
            : SERVER_REQUIRED_TEXT;
    }

    refreshCellInteractivity();
}

function refreshCellInteractivity() {
    if (!scheduleBody) return;
    const cells = scheduleBody.querySelectorAll("td.slot");
    cells.forEach(cell => {
        const enabled = isAuthenticated && serverAvailable;
        cell.contentEditable = enabled ? "true" : "false";
        cell.tabIndex = enabled ? 0 : -1;
        cell.classList.toggle("slot--locked", !enabled);
    });
    if (!isAuthenticated || !serverAvailable) {
        clearSelection();
        if (editorBody && editorEmptyState) {
            editorBody.hidden = true;
            editorEmptyState.hidden = false;
            editorEmptyState.textContent = serverAvailable ? EDITOR_EMPTY_LOCKED_TEXT : SERVER_REQUIRED_TEXT;
        }
    }
}

function nudgeLoginCallout() {
    if (!loginCallout) return;
    loginCallout.classList.add("login-callout--active");
    clearTimeout(loginCalloutTimerId);
    loginCalloutTimerId = setTimeout(() => {
        loginCallout.classList.remove("login-callout--active");
    }, 900);
}

function requireAuth() {
    if (!serverAvailable) {
        nudgeLoginCallout();
        return false;
    }
    if (!isAuthenticated) {
        nudgeLoginCallout();
        return false;
    }
    return true;
}

function openLoginModal() {
    if (!loginModal || !serverAvailable) {
        nudgeLoginCallout();
        return;
    }
    loginModal.hidden = false;
    document.body?.classList.add("modal-open");
    loginError?.setAttribute("hidden", "");
    loginForm?.reset();
    setTimeout(() => loginUsername?.focus(), 50);
}

function closeLoginModal() {
    if (!loginModal) return;
    loginModal.hidden = true;
    document.body?.classList.remove("modal-open");
    loginError?.setAttribute("hidden", "");
}

async function handleLoginSubmit(event) {
    event?.preventDefault();
    if (!loginForm || !serverAvailable) return;
    const username = loginUsername?.value.trim();
    const password = loginPassword?.value || "";

    try {
        const response = await fetch("/api/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password })
        });
        if (!response.ok) {
            throw new Error("Login mislykkedes");
        }
        const data = await response.json();
        authToken = data.token;
        isAuthenticated = true;
        closeLoginModal();
        syncAuthUI();
        flashStatus("Admin login aktiveret");
    } catch (error) {
        if (loginError) {
            loginError.removeAttribute("hidden");
            loginError.textContent = serverAvailable
                ? "Forkert brugernavn eller adgangskode."
                : "Serveren svarer ikke.";
        }
    }
}

async function handleLogout() {
    if (!isAuthenticated) return;
    try {
        await fetch("/api/logout", {
            method: "POST",
            headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined
        });
    } catch (error) {
        // ignore
    }
    authToken = null;
    isAuthenticated = false;
    syncAuthUI();
    flashStatus("Visning uden redigering");
}

function createTable() {
    if (!scheduleBody) return;
    const fragment = document.createDocumentFragment();

    TIMES.forEach(time => {
        const row = document.createElement("tr");
        const timeCell = document.createElement("th");
        timeCell.scope = "row";
        timeCell.className = "time-cell";
        timeCell.textContent = time;
        row.appendChild(timeCell);

        DAYS.forEach(day => {
            const cell = document.createElement("td");
            cell.className = "slot";
            cell.dataset.day = day;
            cell.dataset.time = time;
            cell.contentEditable = "false";
            cell.spellcheck = false;
            cell.tabIndex = -1;
            row.appendChild(cell);
        });

        fragment.appendChild(row);
    });

    scheduleBody.innerHTML = "";
    scheduleBody.appendChild(fragment);
}

function applyScheduleToCells() {
    if (!scheduleBody) return;
    const cells = scheduleBody.querySelectorAll("td.slot");
    cells.forEach(cell => {
        const key = storageKeyForCell(cell);
        const record = scheduleData[key];
        cell.textContent = record?.text || "";
        paintCell(cell, record?.activity || "", false);
    });
}

function clearSelection() {
    selectedCell?.classList.remove("slot--selected");
    selectedCell = null;
    updateEditorPanel(null);
}

function paintCell(cell, activity, updateRecord = true) {
    if (!cell) return;
    const value = activity && VALID_ACTIVITIES.has(activity) ? activity : "";
    cell.dataset.activity = value;
    const baseClass = "slot";
    cell.className = value ? `${baseClass} ${value}` : baseClass;
    if (!isAuthenticated || !serverAvailable) {
        cell.classList.add("slot--locked");
    }
    if (selectedCell === cell) {
        updateEditorPanel(cell);
    }
    if (updateRecord) {
        updateRecordFromCell(cell);
    }
}

function clearCell(cell) {
    if (!cell) return;
    cell.textContent = "";
    paintCell(cell, "");
}

function updateRecordFromCell(cell) {
    if (!cell) return;
    const key = storageKeyForCell(cell);
    const text = cell.textContent.trim();
    const activity = cell.dataset.activity || "";
    if (!text && !activity) {
        delete scheduleData[key];
    } else {
        scheduleData[key] = { text, activity };
    }
}

async function loadSchedule() {
    try {
        const response = await fetch(`schedule.json?cache=${Date.now()}`);
        if (!response.ok) {
            throw new Error("Kunne ikke hente schedule.json");
        }
        scheduleData = await response.json();
    } catch (error) {
        console.warn("Kunne ikke hente skemaet fra fil, bruger tomt skema", error);
        scheduleData = {};
    }
    applyScheduleToCells();
}

async function persistSchedule(message = "Ændringer gemt") {
    if (!requireAuth()) {
        return;
    }
    try {
        const response = await fetch("/api/schedule", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${authToken}`
            },
            body: JSON.stringify(scheduleData)
        });
        if (!response.ok) {
            throw new Error("Gem fejlede");
        }
        flashStatus(message);
    } catch (error) {
        console.error("Kunne ikke gemme skemaet", error);
        flashStatus("Kunne ikke gemme (server)");
    }
}

function flashStatus(message) {
    if (!statusElement) return;
    statusElement.textContent = message;
    statusElement.classList.add("status-pill--active");
    clearTimeout(statusTimerId);
    statusTimerId = setTimeout(() => {
        const text = !serverAvailable
            ? "Kun visning"
            : isAuthenticated
                ? DEFAULT_STATUS_TEXT
                : "Login for at redigere";
        statusElement.textContent = text;
        statusElement.classList.remove("status-pill--active");
    }, 1800);
}

function handleCellClick(event) {
    const cell = event.target.closest("td.slot");
    if (!cell) return;
    if (!requireAuth()) {
        return;
    }

    selectCell(cell);

    if (event.altKey || event.metaKey) {
        clearCell(cell);
        persistSchedule("Felt ryddet");
        return;
    }

    const activity = activitySelector?.value;
    if (activity && VALID_ACTIVITIES.has(activity)) {
        paintCell(cell, activity);
        persistSchedule();
        return;
    }

    cell.focus();
}

function selectCell(cell) {
    if (!cell || !requireAuth()) return;
    if (selectedCell !== cell) {
        selectedCell?.classList.remove("slot--selected");
        selectedCell = cell;
    }
    cell.classList.add("slot--selected");
    updateEditorPanel(cell);
}

function updateEditorPanel(cell) {
    if (!editorPanel || !editorBody || !editorEmptyState) return;

    if (!serverAvailable) {
        editorBody.hidden = true;
        editorEmptyState.hidden = false;
        editorEmptyState.textContent = SERVER_REQUIRED_TEXT;
        return;
    }

    if (!isAuthenticated) {
        editorBody.hidden = true;
        editorEmptyState.hidden = false;
        editorEmptyState.textContent = EDITOR_EMPTY_LOCKED_TEXT;
        return;
    }

    editorEmptyState.textContent = EDITOR_EMPTY_DEFAULT;

    if (!cell) {
        editorBody.hidden = true;
        editorEmptyState.hidden = false;
        return;
    }

    editorBody.hidden = false;
    editorEmptyState.hidden = true;
    editorMeta.textContent = `${cell.dataset.day} kl. ${cell.dataset.time}`;
    editorText.value = cell.textContent || "";
    editorActivity.value = cell.dataset.activity || "";
}

function attachEvents() {
    if (!scheduleBody) return;

    scheduleBody.addEventListener("click", handleCellClick);

    scheduleBody.addEventListener("input", event => {
        if (!isAuthenticated || !serverAvailable) return;
        const cell = event.target.closest("td.slot");
        if (!cell) return;
        updateRecordFromCell(cell);
        persistSchedule();
    });

    scheduleBody.addEventListener("contextmenu", event => {
        const cell = event.target.closest("td.slot");
        if (!cell) return;
        event.preventDefault();
        if (!requireAuth()) return;
        selectCell(cell);
        clearCell(cell);
        persistSchedule("Felt ryddet");
    });

    scheduleBody.addEventListener("focusin", event => {
        const cell = event.target.closest("td.slot");
        if (cell && isAuthenticated && serverAvailable) {
            selectCell(cell);
        }
    });

    editorText?.addEventListener("input", () => {
        if (!selectedCell || !isAuthenticated || !serverAvailable) return;
        selectedCell.textContent = editorText.value;
        updateRecordFromCell(selectedCell);
        persistSchedule();
    });

    editorActivity?.addEventListener("change", () => {
        if (!selectedCell || !isAuthenticated || !serverAvailable) return;
        paintCell(selectedCell, editorActivity.value);
        persistSchedule();
    });

    editorClearButton?.addEventListener("click", () => {
        if (!selectedCell || !requireAuth()) return;
        clearCell(selectedCell);
        editorText.value = "";
        editorActivity.value = "";
        persistSchedule("Felt ryddet");
    });

    clearButton?.addEventListener("click", () => {
        if (!requireAuth()) return;
        if (!confirm("Vil du rydde hele skemaet?")) return;
        scheduleData = {};
        applyScheduleToCells();
        persistSchedule("Skema ryddet");
    });

    loginButton?.addEventListener("click", () => {
        if (!serverAvailable) {
            nudgeLoginCallout();
            return;
        }
        if (isAuthenticated) {
            handleLogout();
        } else {
            openLoginModal();
        }
    });

    loginClose?.addEventListener("click", closeLoginModal);
    loginModal?.addEventListener("click", event => {
        if (event.target === loginModal) {
            closeLoginModal();
        }
    });
    loginForm?.addEventListener("submit", handleLoginSubmit);
    document.addEventListener("keydown", event => {
        if (event.key === "Escape" && loginModal && !loginModal.hidden) {
            closeLoginModal();
        }
    });
}

async function checkServerAvailability() {
    try {
        const response = await fetch("/api/health", { headers: { Accept: "application/json" } });
        serverAvailable = response.ok;
    } catch (error) {
        serverAvailable = false;
    }
    syncAuthUI();
}

async function initPlanner() {
    await checkServerAvailability();
    createTable();
    await loadSchedule();
    applyScheduleToCells();
    refreshCellInteractivity();
    attachEvents();
}

initPlanner();
