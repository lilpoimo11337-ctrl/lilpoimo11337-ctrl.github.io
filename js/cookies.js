const COOKIE_NAME = "dnevnik_ivan_grozny";
const COOKIE_DAYS = 365;

function getCookie(name) {
    const match = document.cookie.match(new RegExp("(?:^|; )" + name.replace(/[.$?*|{}()[\]\\/+^]/g, "\\$&") + "=([^;]*)"));
    return match ? decodeURIComponent(match[1]) : null;
}

function setCookie(name, value, days) {
    const maxAge = days * 24 * 60 * 60;
    document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

function resetAllProgress() {
    document.cookie =
        COOKIE_NAME + "=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax";
    try {
        localStorage.removeItem(COOKIE_NAME);
    } catch {
        /* недоступно в некоторых режимах */
    }
}

function getProgressDefault() {
    return {
        maxSpread: -1,
        lastSpread: 0
    };
}

function readStoredProgress() {
    const fromCookie = getCookie(COOKIE_NAME);
    if (fromCookie) return fromCookie;
    try {
        return localStorage.getItem(COOKIE_NAME);
    } catch {
        return null;
    }
}

function getProgress() {
    const raw = readStoredProgress();
    if (!raw) return getProgressDefault();
    try {
        const data = JSON.parse(raw);
        let maxSpread = -1;
        if (typeof data.maxSpread === "number") {
            maxSpread = data.maxSpread;
        } else if (typeof data.maxPage === "number") {
            maxSpread = data.maxPage >= 0 ? Math.floor(data.maxPage / 2) : -1;
        }
        let lastSpread = 0;
        if (typeof data.lastSpread === "number") {
            lastSpread = data.lastSpread;
        } else if (maxSpread >= 0) {
            lastSpread = maxSpread;
        }

        return {
            maxSpread,
            lastSpread
        };
    } catch {
        return getProgressDefault();
    }
}

function saveProgress(progress) {
    const payload = JSON.stringify(progress);
    setCookie(COOKIE_NAME, payload, COOKIE_DAYS);
    try {
        localStorage.setItem(COOKIE_NAME, payload);
    } catch {
        /* file:// или приватный режим */
    }
}

function syncSpreadProgress(flipPageIndex) {
    const spreadIndex = Math.floor(flipPageIndex / 2);
    const progress = getProgress();
    progress.lastSpread = spreadIndex;
    if (spreadIndex > progress.maxSpread) {
        progress.maxSpread = spreadIndex;
    }
    saveProgress(progress);
    return progress;
}

/** После F5 — с начала: разворот и прогресс чтения */
function resetProgressOnPageLoad() {
    saveProgress(getProgressDefault());
}

resetProgressOnPageLoad();
