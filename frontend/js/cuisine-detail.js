/**
 * cuisine-detail.js
 * Handles the cuisine detail page (cuisine-detail.html?area=Chinese).
 * Reads the `area` query param, fetches recipes from TheMealDB for that cuisine,
 * and renders them using the shared createRecipeCard / getStableKcal from app.js.
 */

(function () {
    // ── Emoji map for cuisine areas ──────────────────────────────────────────
    const CUISINE_EMOJI = {
        Afghan: '🇦🇫', Albanian: '🇦🇱', Algerian: '🇩🇿', Andorran: '🇦🇩',
        Angolan: '🇦🇴', Argentine: '🇦🇷', Armenian: '🇦🇲', Australian: '🇦🇺',
        Austrian: '🇦🇹', Azerbaijani: '🇦🇿', Bangladeshi: '🇧🇩', Belgian: '🇧🇪',
        Bhutanese: '🇧🇹', Bolivian: '🇧🇴', Brazilian: '🇧🇷', British: '🇬🇧',
        Bulgarian: '🇧🇬', Cambodian: '🇰🇭', Canadian: '🇨🇦', Chilean: '🇨🇱',
        Chinese: '🇨🇳', Colombian: '🇨🇴', Croatian: '🇭🇷', Cuban: '🇨🇺',
        Czech: '🇨🇿', Danish: '🇩🇰', Dutch: '🇳🇱', Egyptian: '🇪🇬',
        Ethiopian: '🇪🇹', Filipino: '🇵🇭', Finnish: '🇫🇮', French: '🇫🇷',
        Georgian: '🇬🇪', German: '🇩🇪', Greek: '🇬🇷', Guatemalan: '🇬🇹',
        Hungarian: '🇭🇺', Indian: '🇮🇳', Indonesian: '🇮🇩', Iranian: '🇮🇷',
        Iraqi: '🇮🇶', Irish: '🇮🇪', Israeli: '🇮🇱', Italian: '🇮🇹',
        Jamaican: '🇯🇲', Japanese: '🇯🇵', Jordanian: '🇯🇴', Kazakh: '🇰🇿',
        Kenyan: '🇰🇪', Korean: '🇰🇷', Kuwaiti: '🇰🇼', Laotian: '🇱🇦',
        Lebanese: '🇱🇧', Libyan: '🇱🇾', Malaysian: '🇲🇾', Maltese: '🇲🇹',
        Mexican: '🇲🇽', Mongolian: '🇲🇳', Moroccan: '🇲🇦', Mozambican: '🇲🇿',
        Myanmar: '🇲🇲', Nepalese: '🇳🇵', Nigerian: '🇳🇬', Norwegian: '🇳🇴',
        Pakistani: '🇵🇰', Peruvian: '🇵🇪', Polish: '🇵🇱', Portuguese: '🇵🇹',
        Romanian: '🇷🇴', Russian: '🇷🇺', Saudi: '🇸🇦', Serbian: '🇷🇸',
        Singaporean: '🇸🇬', Slovak: '🇸🇰', Somali: '🇸🇴', South_African: '🇿🇦',
        Spanish: '🇪🇸', Sri_Lankan: '🇱🇰', Sudanese: '🇸🇩', Swedish: '🇸🇪',
        Swiss: '🇨🇭', Syrian: '🇸🇾', Taiwanese: '🇹🇼', Thai: '🇹🇭',
        Tunisian: '🇹🇳', Turkish: '🇹🇷', Ugandan: '🇺🇬', Ukrainian: '🇺🇦',
        Uruguayan: '🇺🇾', Venezuelan: '🇻🇪', Vietnamese: '🇻🇳', Yemeni: '🇾🇪',
        Zimbabwean: '🇿🇼',
        Unknown: '🌍',
    };

    // ── Helpers ───────────────────────────────────────────────────────────────
    function getEmoji(area) {
        return CUISINE_EMOJI[area] || CUISINE_EMOJI['Unknown'];
    }

    function showEl(id) { document.getElementById(id).style.display = ''; }
    function hideEl(id) { document.getElementById(id).style.display = 'none'; }

    // ── State ─────────────────────────────────────────────────────────────────
    let allMeals = [];  // full list after fetch
    let area = '';      // cuisine area string

    // ── DOM refs ──────────────────────────────────────────────────────────────
    const titleEl       = document.getElementById('cuisine-title');
    const subtitleEl    = document.getElementById('cuisine-subtitle');
    const filterBar     = document.getElementById('filter-bar');
    const searchInput   = document.getElementById('cuisine-search-input');
    const resultsCount  = document.getElementById('results-count');
    const recipesGrid   = document.getElementById('recipes-grid');
    const loadingState  = document.getElementById('loading-state');
    const errorState    = document.getElementById('error-state');
    const emptyState    = document.getElementById('empty-state');
    const emptyMsg      = document.getElementById('empty-state-msg');
    const retryBtn      = document.getElementById('btn-retry');

    // ── Init ──────────────────────────────────────────────────────────────────
    document.addEventListener('DOMContentLoaded', init);

    function init() {
        const params = new URLSearchParams(window.location.search);
        area = (params.get('area') || '').trim();

        if (!area) {
            // No cuisine specified — redirect back
            window.location.href = 'cuisines.html';
            return;
        }

        // Update page title and hero
        const emoji = getEmoji(area);
        document.title = `${area} Cuisine | CookWise`;
        titleEl.textContent = `${emoji} ${area} Cuisine`;
        subtitleEl.textContent = `Discover delicious ${area} recipes from around the globe.`;

        // Fetch recipes
        loadRecipes();

        // Retry button
        retryBtn.addEventListener('click', () => {
            hideEl('error-state');
            showEl('loading-state');
            loadRecipes();
        });

        // Live filter input
        searchInput.addEventListener('input', () => {
            filterAndRender(searchInput.value);
        });
    }

    // ── Fetch & render ────────────────────────────────────────────────────────
    async function loadRecipes() {
        try {
            // Step 1: Get list of meals for this area (returns idMeal, strMeal, strMealThumb only)
            const res = await fetch(`${MEALDB_BASE_URL}/filter.php?a=${encodeURIComponent(area)}`);

            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
            }

            const data = await res.json();

            if (!data.meals || data.meals.length === 0) {
                hideEl('loading-state');
                emptyMsg.textContent = `No recipes were found for ${area} cuisine.`;
                showEl('empty-state');
                return;
            }

            // Step 2: Enrich meals with full details (strArea, strCategory) so kcal logic works.
            // Fetch in batches to avoid rate-limiting — max 20 per page view keeps it fast.
            const slice = data.meals.slice(0, 20);
            const detailPromises = slice.map(m =>
                fetch(`${MEALDB_BASE_URL}/lookup.php?i=${m.idMeal}`)
                    .then(r => r.ok ? r.json() : null)
                    .then(d => (d && d.meals ? d.meals[0] : null))
                    .catch(() => null)
            );

            const results = await Promise.all(detailPromises);

            // Filter out any failed lookups, fall back to basic data if needed
            allMeals = results.map((full, i) => {
                if (full) return full;
                // Fallback: use basic meal data with area injected
                return { ...slice[i], strArea: area };
            });

            // Render
            hideEl('loading-state');
            recipesGrid.style.display = 'grid';
            filterBar.style.display = 'flex';
            filterAndRender('');

        } catch (err) {
            console.error('[CuisineDetail] Failed to load recipes:', err);
            hideEl('loading-state');
            showEl('error-state');
        }
    }

    // ── Live filter ───────────────────────────────────────────────────────────
    function filterAndRender(query) {
        const q = query.trim().toLowerCase();
        const filtered = q
            ? allMeals.filter(m => (m.strMeal || '').toLowerCase().includes(q))
            : allMeals;

        if (filtered.length === 0 && allMeals.length > 0) {
            // Query returned no matches within loaded recipes
            recipesGrid.innerHTML = `<div class="no-filter-match">No recipes match "<strong>${escapeHtml(query)}</strong>"</div>`;
            resultsCount.textContent = '';
        } else {
            recipesGrid.innerHTML = filtered.map(meal => createRecipeCard(meal)).join('');
            resultsCount.textContent = `${filtered.length} recipe${filtered.length !== 1 ? 's' : ''}`;
        }
    }

    function escapeHtml(str) {
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
})();
