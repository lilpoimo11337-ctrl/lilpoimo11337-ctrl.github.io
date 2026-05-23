(function () {
    const BOOK_OPEN_MS = 980;
    const TEXT_REVEAL_DELAY_MS = 60;

    let pageFlip = null;
    let flipReady = false;
    let isBusy = false;
    let isReading = false;

    const els = {
        app: document.getElementById("app"),
        bookInterior: document.getElementById("bookInterior"),
        readerScreen: document.getElementById("readerScreen"),
        mainBook: document.getElementById("mainBook"),
        bookOpeningView: document.getElementById("bookOpeningView"),
        coverBackFace: document.getElementById("coverBackFace"),
        bookCoverLeaf: document.getElementById("bookCoverLeaf"),
        pageFlipHost: document.getElementById("pageFlipHost"),
        btnRead: document.getElementById("btnRead"),
        btnBack: document.getElementById("btnBack"),
        btnDictionary: document.getElementById("btnDictionary"),
        btnDictionaryClose: document.getElementById("btnDictionaryClose"),
        dictionaryPanel: document.getElementById("dictionaryPanel"),
        dictionaryContent: document.getElementById("dictionaryContent"),
        btnPrev: document.getElementById("btnPrev"),
        btnNext: document.getElementById("btnNext")
    };

    function resetPageFlipHost() {
        const old = document.getElementById("pageFlipHost");
        if (old) old.remove();
        const host = document.createElement("div");
        host.id = "pageFlipHost";
        els.bookInterior.appendChild(host);
        els.pageFlipHost = host;
    }

    function destroyPageFlip() {
        if (pageFlip) {
            try {
                pageFlip.destroy();
            } catch (err) {
                console.warn("pageFlip destroy:", err);
            }
            pageFlip = null;
            flipReady = false;
        }
        resetPageFlipHost();
    }

    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    function getChapterImages(chapter) {
        if (chapter.images && chapter.images.length) return chapter.images;
        if (chapter.image) {
            return [{ src: chapter.image, caption: chapter.imageCaption || "" }];
        }
        return [];
    }

    function distributeSpreadImages(chapter) {
        const images = getChapterImages(chapter);
        if (chapter.splitImages && images.length >= 2) {
            return {
                leftImages: [images[0]],
                rightImages: images.slice(1)
            };
        }
        return { leftImages: [], rightImages: images };
    }

    function buildFiguresHtml(images, layout) {
        if (!images.length) return "";

        let layoutClass;
        if (layout === "inline") {
            layoutClass =
                images.length > 1
                    ? "spread-figures--inline"
                    : "spread-figures--inline spread-figures--inline-solo";
        } else if (layout === "hero-large") {
            layoutClass = "spread-figures--solo spread-figures--hero spread-figures--hero-large";
        } else if (layout === "hero") {
            layoutClass = "spread-figures--solo spread-figures--hero";
        } else {
            layoutClass = images.length > 1 ? "spread-figures--duo" : "spread-figures--solo";
        }

        let html = '<div class="spread-figures ' + layoutClass + '">';
        images.forEach(function (item) {
            html +=
                '<figure class="spread-figure">' +
                '<img src="' +
                escapeHtml(item.src) +
                '" alt="' +
                escapeHtml(item.caption || "") +
                '">' +
                (item.caption
                    ? "<figcaption>" + escapeHtml(item.caption) + "</figcaption>"
                    : "") +
                "</figure>";
        });
        html += "</div>";
        return html;
    }

    function clearOpeningPreview() {
        if (els.coverBackFace) els.coverBackFace.innerHTML = "";
    }

    function revealReaderText() {
        setTimeout(function () {
            els.mainBook.classList.add("is-text-visible");
        }, TEXT_REVEAL_DELAY_MS);
    }

    function getCurrentSpreadIndex() {
        if (!pageFlip || !flipReady || !isReading) return 0;
        return Math.min(
            Math.max(Math.floor(pageFlip.getCurrentPageIndex() / 2), 0),
            SPREAD_COUNT - 1
        );
    }

    function renderDictionaryPanel(spreadIndex) {
        if (!els.dictionaryContent) return;
        const index = Math.min(Math.max(spreadIndex, 0), SPREAD_COUNT - 1);
        const notes =
            typeof getHistoricalNotesForSpread === "function"
                ? getHistoricalNotesForSpread(index)
                : [];

        if (!notes.length) {
            els.dictionaryContent.innerHTML =
                '<p class="dictionary-sheet__hint">На этом развороте пока нет исторической справки.</p>';
            return;
        }

        let html = '<div class="historical-notes">';
        notes.forEach(function (note) {
            html += '<p class="historical-note">' + escapeHtml(note) + "</p>";
        });
        html += "</div>";
        els.dictionaryContent.innerHTML = html;
    }

    function buildQuestPages() {
        els.pageFlipHost.innerHTML = "";

        QUEST_PAGES.forEach(function (chapter, spreadIndex) {
            const art = distributeSpreadImages(chapter);
            const leftArtHtml = buildFiguresHtml(art.leftImages, "inline");
            let rightLayout = "page";
            if (art.rightImages.length === 1) {
                if (chapter.largeImage) rightLayout = "hero-large";
                else if (chapter.splitImages) rightLayout = "hero";
            }
            const rightArtHtml = buildFiguresHtml(art.rightImages, rightLayout);
            const entryCount = (chapter.html.match(/diary-lead/g) || []).length;
            let textClass = entryCount >= 2 ? " spread-text--dense" : "";
            if (leftArtHtml) textClass += " spread-text--with-art";

            const left = document.createElement("div");
            left.className = "page page-spread-left";
            left.dataset.spread = String(spreadIndex);

            left.innerHTML =
                '<div class="page-content texture-left">' +
                '<section class="spread-text' +
                textClass +
                '">' +
                "<h2>" +
                escapeHtml(chapter.title) +
                "</h2>" +
                '<div class="spread-text-body page-body">' +
                chapter.html +
                "</div>" +
                (leftArtHtml ? '<div class="spread-text-art">' + leftArtHtml + "</div>" : "") +
                "</section></div>";

            const right = document.createElement("div");
            right.className = "page page-spread-right";
            right.dataset.spread = String(spreadIndex);
            right.innerHTML =
                '<div class="page-content texture-right">' +
                '<section class="spread-media' +
                (rightArtHtml ? "" : leftArtHtml ? " spread-media--quiet" : " spread-media--empty") +
                '">' +
                (rightArtHtml ||
                    (leftArtHtml
                        ? ""
                        : '<figure class="spread-figure spread-figure--empty"><span class="spread-figure-placeholder">Здесь будет иллюстрация</span></figure>')) +
                "</section></div>";

            els.pageFlipHost.appendChild(left);
            els.pageFlipHost.appendChild(right);
        });
    }

    function canFlip() {
        return pageFlip && flipReady && !isBusy && pageFlip.getState() === "read";
    }

    function getFlipSettings() {
        return {
            width: 708,
            height: 976,
            size: "stretch",
            minWidth: 320,
            maxWidth: 900,
            minHeight: 440,
            maxHeight: 1240,
            drawShadow: true,
            maxShadowOpacity: 0.32,
            showCover: false,
            usePortrait: false,
            flippingTime: 1000,
            useMouseEvents: true,
            showPageCorners: true,
            mobileScrollSupport: window.innerWidth <= 800,
            clickEventForward: true,
            autoSize: true,
            startZIndex: 30,
            disableFlipByClick: false
        };
    }

    function waitFrames(count) {
        return new Promise(function (resolve) {
            let n = 0;
            function tick() {
                if (n >= count) resolve();
                else {
                    n++;
                    requestAnimationFrame(tick);
                }
            }
            requestAnimationFrame(tick);
        });
    }

    function recordSpreadVisit(spreadIndex) {
        const progress = getProgress();
        const spread = Math.min(Math.max(spreadIndex, 0), SPREAD_COUNT - 1);
        progress.lastSpread = spread;
        if (spread > progress.maxSpread) {
            progress.maxSpread = spread;
        }
        saveProgress(progress);
    }

    function saveReadingPositionBeforeClose() {
        if (!pageFlip || !flipReady || !isReading) return;
        recordSpreadVisit(Math.floor(pageFlip.getCurrentPageIndex() / 2));
    }

    function initPageFlip(initialSpread) {
        destroyPageFlip();
        buildQuestPages();

        pageFlip = new St.PageFlip(els.pageFlipHost, getFlipSettings());
        pageFlip.loadFromHTML(els.pageFlipHost.querySelectorAll(".page"));

        pageFlip.on("flip", function (e) {
            const spread = Math.floor(e.data / 2);
            recordSpreadVisit(spread);
            if (els.app.classList.contains("is-dictionary-open")) {
                renderDictionaryPanel(spread);
            }
        });

        pageFlip.on("changeState", function (e) {
            isBusy = e.data === "flipping";
            els.pageFlipHost.dataset.state = e.data;
        });

        const startSpread = Math.min(Math.max(initialSpread, 0), SPREAD_COUNT - 1);
        const pageIndex = startSpread * 2;

        return waitFrames(4).then(function () {
            pageFlip.update();
            pageFlip.turnToPage(pageIndex);
            recordSpreadVisit(startSpread);
            flipReady = true;
        });
    }

    function flipSpreadStep(delta) {
        if (!pageFlip || !flipReady) return;
        if (pageFlip.getState() !== "read") return;

        const current = Math.floor(pageFlip.getCurrentPageIndex() / 2);
        const target = current + delta;
        if (target < 0 || target >= SPREAD_COUNT) return;
        if (target === current) return;

        if (delta > 0) {
            pageFlip.flipNext("top");
        } else {
            pageFlip.flipPrev("top");
        }
    }

    function setBookOpenOriginFromHome() {
        const rect = els.mainBook.getBoundingClientRect();
        els.mainBook.style.setProperty("--book-origin-x", rect.left + rect.width / 2 + "px");
        els.mainBook.style.setProperty("--book-origin-y", rect.top + rect.height / 2 + "px");
        els.mainBook.style.setProperty("--book-origin-w", rect.width + "px");
        els.mainBook.style.setProperty("--book-origin-h", rect.height + "px");
    }

    function clearBookOpenOrigin() {
        els.mainBook.style.removeProperty("--book-origin-x");
        els.mainBook.style.removeProperty("--book-origin-y");
        els.mainBook.style.removeProperty("--book-origin-w");
        els.mainBook.style.removeProperty("--book-origin-h");
    }

    function resetBookOpenState() {
        els.mainBook.classList.remove(
            "is-opening",
            "is-open",
            "is-pages-visible",
            "is-text-visible"
        );
        els.app.classList.remove("is-dictionary-open");
        closeDictionary(false);
        clearBookOpenOrigin();
    }

    function closeDictionary(updateFlip) {
        els.app.classList.remove("is-dictionary-open");
        if (els.dictionaryPanel) {
            els.dictionaryPanel.setAttribute("aria-hidden", "true");
        }
        if (els.btnDictionary) {
            els.btnDictionary.setAttribute("aria-expanded", "false");
        }
        if (updateFlip !== false && pageFlip && flipReady) {
            requestAnimationFrame(function () {
                pageFlip.update();
            });
        }
    }

    function openDictionary() {
        if (!isReading) return;
        if (!els.mainBook.classList.contains("is-pages-visible")) return;
        els.app.classList.add("is-dictionary-open");
        if (els.dictionaryPanel) {
            els.dictionaryPanel.setAttribute("aria-hidden", "false");
        }
        if (els.btnDictionary) {
            els.btnDictionary.setAttribute("aria-expanded", "true");
        }
        renderDictionaryPanel(getCurrentSpreadIndex());
        if (pageFlip && flipReady) {
            requestAnimationFrame(function () {
                pageFlip.update();
            });
        }
    }

    function toggleDictionary() {
        if (!isReading) return;
        if (!els.mainBook.classList.contains("is-pages-visible")) return;
        if (els.app.classList.contains("is-dictionary-open")) {
            closeDictionary();
        } else {
            openDictionary();
        }
    }

    function playOpenOnSameBook() {
        return new Promise(function (resolve) {
            isBusy = true;
            isReading = true;
            if (els.btnRead) els.btnRead.disabled = true;

            resetBookOpenState();
            clearOpeningPreview();
            els.pageFlipHost.style.display = "none";
            setBookOpenOriginFromHome();
            els.app.classList.add("is-reading");
            els.readerScreen.classList.add("is-active");
            els.mainBook.classList.add("is-opening");

            requestAnimationFrame(function () {
                requestAnimationFrame(function () {
                    els.mainBook.classList.add("is-open");
                });
            });

            setTimeout(function () {
                function finishOpen() {
                    isBusy = false;
                    if (els.btnRead) els.btnRead.disabled = false;
                    resolve();
                }

                function afterPagesReady() {
                    els.mainBook.classList.remove("is-opening");
                    revealReaderText();
                    finishOpen();
                }

                els.mainBook.classList.add("is-pages-visible");

                try {
                    if (typeof St === "undefined" || !St.PageFlip) {
                        throw new Error(
                            "Библиотека PageFlip не загрузилась. Откройте сайт через локальный сервер."
                        );
                    }

                    els.pageFlipHost.style.display = "block";

                    const progress = getProgress();
                    const saved = typeof progress.lastSpread === "number" ? progress.lastSpread : 0;
                    const startSpread = Math.min(Math.max(saved, 0), SPREAD_COUNT - 1);

                    initPageFlip(startSpread).then(afterPagesReady).catch(function (err) {
                        console.error(err);
                        afterPagesReady();
                    });
                } catch (err) {
                    console.error(err);
                    afterPagesReady();
                }
            }, BOOK_OPEN_MS);
        });
    }

    function closeBook() {
        if (isBusy) return;
        isBusy = true;

        saveReadingPositionBeforeClose();
        els.pageFlipHost.style.display = "none";
        destroyPageFlip();

        els.readerScreen.classList.remove("is-active");
        els.app.classList.remove("is-reading", "is-dictionary-open");
        resetBookOpenState();

        isReading = false;
        isBusy = false;
    }

    function goSpread(delta) {
        if (!canFlip()) return;
        flipSpreadStep(delta);
    }

    function bindUi() {
        if (!els.btnRead) {
            console.error("Кнопка «Читать» не найдена в HTML");
            return;
        }

        els.btnRead.addEventListener("click", function () {
            if (isBusy) return;
            playOpenOnSameBook().catch(function (err) {
                console.error("open book:", err);
                isBusy = false;
                isReading = false;
                if (els.btnRead) els.btnRead.disabled = false;
                resetBookOpenState();
                els.app.classList.remove("is-reading");
                els.readerScreen.classList.remove("is-active");
            });
        });
    }

    bindUi();

    if (els.btnBack) {
        els.btnBack.addEventListener("click", function (e) {
            e.preventDefault();
            e.stopPropagation();
            closeBook();
        });
    }

    if (els.btnDictionary) {
        els.btnDictionary.addEventListener("click", function (e) {
            e.preventDefault();
            e.stopPropagation();
            toggleDictionary();
        });
    }

    if (els.btnDictionaryClose) {
        els.btnDictionaryClose.addEventListener("click", function (e) {
            e.preventDefault();
            e.stopPropagation();
            closeDictionary();
        });
    }

    if (els.btnPrev) {
        els.btnPrev.addEventListener("click", function () {
            goSpread(-1);
        });
    }

    if (els.btnNext) {
        els.btnNext.addEventListener("click", function () {
            goSpread(1);
        });
    }

    document.addEventListener("keydown", function (e) {
        if (!isReading) return;

        if (e.code === "Escape") {
            e.preventDefault();
            if (els.app.classList.contains("is-dictionary-open")) {
                closeDictionary();
            } else {
                closeBook();
            }
            return;
        }

        if (e.code === "ArrowRight" || e.code === "ArrowLeft") {
            e.preventDefault();
            if (document.activeElement && document.activeElement !== document.body) {
                document.activeElement.blur();
            }
            goSpread(e.code === "ArrowRight" ? 1 : -1);
        }
    });

    let resizeTimer;
    window.addEventListener("resize", function () {
        if (!flipReady || !isReading) return;
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(function () {
            if (!pageFlip || !flipReady || !isReading) return;
            pageFlip.update();
        }, 280);
    });
})();
