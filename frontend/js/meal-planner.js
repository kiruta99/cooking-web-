/**
 * CookWise — Meal Planner UI
 *
 * Sends settings to POST /api/meal-plans/generate (heuristic Knapsack algorithm).
 * Renders the response as interactive meal cards + a Chart.js macro doughnut.
 *
 * Algorithm recap (mirrors the Python implementation):
 *   - Randomly pick 1 item from each of: breakfast / lunch / dinner / snack
 *   - Sum calories
 *   - Accept if  |total - target| <= tolerance
 *   - Retry up to 2,000 times; fall back to best-effort on timeout
 */

'use strict';

/* ── State ──────────────────────────────────────────────── */
let selectedTolerance = 100;
let macroChart = null;       // Chart.js instance (destroy before redraw)
let currentPlanData = null;  // Store current plan to save

/* ── DOM refs ───────────────────────────────────────────── */
const sliderTarget   = document.getElementById('slider-target');
const targetDisplay  = document.getElementById('target-display');
const btnGenerate    = document.getElementById('btn-generate');
const btnLabel       = document.getElementById('btn-label');
const btnSpinner     = document.getElementById('btn-spinner');
const resultsPanel   = document.getElementById('results-panel');
const plannerEmpty   = document.getElementById('planner-empty');
const tdeePill       = document.getElementById('tdee-pill');
const tdeePillValue  = document.getElementById('tdee-pill-value');

/* ── Slider: live update display ────────────────────────── */
sliderTarget.addEventListener('input', () => {
    targetDisplay.textContent = parseInt(sliderTarget.value).toLocaleString();
});

/* ── Tolerance preset buttons ───────────────────────────── */
document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedTolerance = parseInt(btn.dataset.tol);
    });
});

/* ── Generate button ────────────────────────────────────── */
btnGenerate.addEventListener('click', generatePlan);

/* ── Load saved TDEE and Plan on page open ──────────────── */
document.addEventListener('DOMContentLoaded', async () => {
    // Wait for app.js checkAuth to resolve
    await window.authPromise;
    loadSavedTdee();
    loadSavedDailyPlan();
});

async function loadSavedTdee() {
    try {
        const res = await fetch(`${API_BASE_URL}/nutrition/profile`, { credentials: 'include' });
        if (!res.ok) return;
        const data = await res.json();
        if (data.profile && data.profile.tdee) {
            const tdee = data.profile.tdee;

            // Show the TDEE pill
            tdeePillValue.textContent = `${tdee.toLocaleString()} kcal`;
            tdeePill.classList.add('visible');

            // Clamp to slider range
            const clamped = Math.min(Math.max(tdee, 1200), 4000);
            sliderTarget.value        = clamped;
            targetDisplay.textContent = clamped.toLocaleString();
        }
    } catch (err) {
        console.error('Could not load TDEE for meal planner:', err);
    }
}

/* ── Core: call the backend generator ───────────────────── */
async function generatePlan() {
    const targetCalories = parseInt(sliderTarget.value);
    const tolerance      = selectedTolerance;

    // UI: loading state
    btnLabel.textContent  = 'Generating…';
    btnSpinner.style.display = 'inline-block';
    btnGenerate.disabled  = true;

    try {
        const res = await fetch(`${API_BASE_URL}/meal-plans/generate`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ targetCalories, tolerance })
        });

        const data = await res.json();

        if (!res.ok) {
            showError(data.error || 'Could not generate a meal plan. Please try again.');
            return;
        }

        currentPlanData = data;
        renderResults(data);

    } catch (err) {
        console.error('Meal plan generation network error:', err);
        showError('Network error. Please check your connection and try again.');
    } finally {
        btnLabel.textContent     = '✨ Regenerate Plan';
        btnSpinner.style.display = 'none';
        btnGenerate.disabled     = false;
    }
}

/* ── Render ─────────────────────────────────────────────── */
function renderResults(data) {
    const { targetCalories, totalCalories, difference, macros, plan, attempts, fallback, tolerance } = data;

    // Accuracy
    const pct      = Math.round((totalCalories / targetCalories) * 100);
    const diffSign = difference >= 0 ? '+' : '';
    const hitTarget = Math.abs(difference) <= tolerance;

    // Clear previous results (keep empty state hidden)
    plannerEmpty.style.display = 'none';

    // Destroy old chart
    if (macroChart) { macroChart.destroy(); macroChart = null; }

    const html = `

        <!-- Summary bar -->
        <div class="summary-bar">
            <div class="s-group">
                <div class="s-value">${totalCalories.toLocaleString()}</div>
                <div class="s-label">Plan Total (kcal)</div>
            </div>
            <div class="s-group">
                <div class="s-value">${targetCalories.toLocaleString()}</div>
                <div class="s-label">Your Target (kcal)</div>
            </div>
            <div class="s-group">
                <div class="s-value">${diffSign}${difference}</div>
                <div class="s-label">Difference</div>
            </div>
            <div class="accuracy-badge">
                ${hitTarget ? '✅ Target Hit' : '⚠️ Best Effort'}
                &nbsp; ${pct}% of target
            </div>
        </div>

        ${fallback ? `
        <div class="planner-disclaimer" style="border-left-color:#F59E0B; background:#FFF7ED; color:#92400E;">
            ⚠️ The algorithm reached its attempt limit (2,000 tries) without finding an exact match within ±${tolerance} kcal.
            The closest possible combination is shown below. Try a larger tolerance or a different target.
        </div>
        ` : ''}

        <!-- Meal cards -->
        <div class="meals-grid" id="meals-grid">
            ${renderMealCard('breakfast', plan.breakfast)}
            ${renderMealCard('lunch',     plan.lunch)}
            ${renderMealCard('dinner',    plan.dinner)}
            ${renderMealCard('snack',     plan.snack)}
        </div>

        <!-- Macro chart -->
        <div class="chart-panel">
            <h3>Estimated Macro Breakdown</h3>
            <p class="sub">Based on the plan above · all values are estimates · not medical advice</p>
            <div class="chart-layout">
                <canvas id="macro-chart" width="200" height="200"></canvas>
                <div class="macro-legend">
                    <div class="legend-row">
                        <div class="legend-dot" style="background:#6366F1;"></div>
                        <div class="legend-label">Protein</div>
                        <div class="legend-value">${macros.protein}g</div>
                    </div>
                    <div class="legend-row">
                        <div class="legend-dot" style="background:#10B981;"></div>
                        <div class="legend-label">Carbohydrates</div>
                        <div class="legend-value">${macros.carbs}g</div>
                    </div>
                    <div class="legend-row">
                        <div class="legend-dot" style="background:#F59E0B;"></div>
                        <div class="legend-label">Fat</div>
                        <div class="legend-value">${macros.fat}g</div>
                    </div>
                    <div class="legend-row" style="border-top:1px solid var(--clr-border); padding-top:12px; margin-top:4px;">
                        <div class="legend-dot" style="background:var(--clr-accent);"></div>
                        <div class="legend-label" style="color:var(--clr-text-main); font-weight:600;">Total Calories</div>
                        <div class="legend-value" style="color:var(--clr-accent);">${totalCalories.toLocaleString()} kcal</div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Algorithm stats -->
        <div class="algo-stats">
            <div><strong>${attempts.toLocaleString()}</strong> attempts</div>
            <div><strong>±${tolerance} kcal</strong> tolerance</div>
            <div><strong>${hitTarget ? 'Exact match found' : 'Fallback (best-effort)'}</strong></div>
            <div>Algorithm: <strong>Heuristic Randomised Knapsack</strong></div>
        </div>

        <!-- Save Button -->
        <div style="margin-top: 16px;">
            <button class="btn btn-primary" onclick="savePlan()" style="padding:12px 28px; width:100%;" id="btn-save-plan">
                💾 Save Meal Plan
            </button>
            <div id="save-msg" style="margin-top:8px; font-size:14px; text-align:center; display:none;"></div>
        </div>

        <!-- Disclaimer -->
        <div class="planner-disclaimer">
            📋 <strong>Estimated Nutrition</strong> — All calorie and macro values are averages from a local nutritional database.
            They are not exact measurements and not a substitute for professional dietary advice.
            Individual values vary by brand, preparation method, and serving size.
        </div>
    `;

    resultsPanel.innerHTML = html;

    // Draw Chart.js doughnut
    const ctx = document.getElementById('macro-chart').getContext('2d');
    macroChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Protein', 'Carbohydrates', 'Fat'],
            datasets: [{
                data: [macros.protein * 4, macros.carbs * 4, macros.fat * 9], // convert g → kcal
                backgroundColor: ['#6366F1', '#10B981', '#F59E0B'],
                borderWidth: 0,
                hoverOffset: 6
            }]
        },
        options: {
            cutout: '70%',
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: ctx => ` ${ctx.label}: ${Math.round(ctx.raw)} kcal`
                    }
                }
            },
            animation: { duration: 800, easing: 'easeInOutQuart' }
        }
    });
}

function renderMealCard(type, meal) {
    const typeLabel = type.charAt(0).toUpperCase() + type.slice(1);
    const timeMap   = { breakfast: '7\u20139 AM', lunch: '12\u20131 PM', dinner: '6\u20138 PM', snack: '3\u20134 PM' };

    // mealDbQuery comes from the generator; meal_id comes from saved plans
    const query   = meal.mealDbQuery || '';
    const mealId  = meal.meal_id || '';
    const safeName = (meal.name || '').replace(/'/g, "&apos;");

    return `
        <div class="meal-card meal-card-clickable"
             role="button"
             tabindex="0"
             aria-label="View recipe for ${safeName}"
             data-query="${encodeURIComponent(query)}"
             data-meal-id="${encodeURIComponent(mealId)}"
             data-meal-name="${encodeURIComponent(safeName)}"
             onclick="openMealRecipe(this)"
             onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openMealRecipe(this);}"
        >
            <div class="meal-type-badge">
                <div class="meal-type-dot dot-${type}"></div>
                ${typeLabel}
                <span style="margin-left:auto; font-weight:400;">${timeMap[type]}</span>
            </div>
            <div class="meal-emoji">${meal.emoji || '\ud83c\udf7d\ufe0f'}</div>
            <div class="meal-name">${meal.name}</div>
            <div class="meal-calories">
                \uD83D\uDD25 ${meal.calories} kcal
            </div>
            <div class="macro-pills">
                <span class="macro-pill pill-p">P: ${meal.protein}g</span>
                <span class="macro-pill pill-c">C: ${meal.carbs}g</span>
                <span class="macro-pill pill-f">F: ${meal.fat}g</span>
            </div>
            <div class="meal-note">Estimated nutrition \u00b7 values vary by preparation</div>
            <div class="meal-card-cta">View Recipe \u2192</div>
        </div>
    `;
}

function showError(message) {
    plannerEmpty.style.display = 'none';
    resultsPanel.innerHTML = `
        <div class="planner-empty">
            <div class="icon">⚠️</div>
            <h3>Could Not Generate Plan</h3>
            <p>${message}</p>
        </div>
    `;
}

/* ── openMealRecipe: searches TheMealDB and navigates to recipe details ── */
async function openMealRecipe(card) {
    // Prevent double-clicks
    if (card.dataset.loading === 'true') return;

    // If a real TheMealDB meal_id is stored (saved plans), go directly
    const rawId = decodeURIComponent(card.dataset.mealId || '');
    if (rawId && rawId !== 'local' && /^\d+$/.test(rawId)) {
        window.location.href = 'recipe-details.html?id=' + rawId;
        return;
    }

    const query = decodeURIComponent(card.dataset.query || '');
    const name  = decodeURIComponent(card.dataset.mealName || 'this recipe');

    if (!query) {
        alert('No search query available for this recipe.');
        return;
    }

    // Show loading state on the card
    card.dataset.loading = 'true';
    const ctaEl = card.querySelector('.meal-card-cta');
    const originalCta = ctaEl ? ctaEl.textContent : '';
    if (ctaEl) ctaEl.textContent = 'Searching\u2026';
    card.style.opacity = '0.7';
    card.style.pointerEvents = 'none';

    try {
        const res  = await fetch(`https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(query)}`);
        const data = await res.json();

        if (data.meals && data.meals.length > 0) {
            const meal = data.meals[0];
            window.location.href = 'recipe-details.html?id=' + meal.idMeal;
        } else {
            // Fallback: try just the first meaningful word of the name
            const fallbackWord = name.split(' ')[0];
            const res2  = await fetch(`https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(fallbackWord)}`);
            const data2 = await res2.json();
            if (data2.meals && data2.meals.length > 0) {
                window.location.href = 'recipe-details.html?id=' + data2.meals[0].idMeal;
            } else {
                alert('Could not find a matching recipe on TheMealDB. Try browsing recipes instead.');
                card.dataset.loading = '';
                if (ctaEl) ctaEl.textContent = originalCta;
                card.style.opacity = '';
                card.style.pointerEvents = '';
            }
        }
    } catch (err) {
        console.error('Recipe lookup failed:', err);
        alert('Network error. Could not look up this recipe.');
        card.dataset.loading = '';
        if (ctaEl) ctaEl.textContent = originalCta;
        card.style.opacity = '';
        card.style.pointerEvents = '';
    }
}

async function savePlan() {
    if (!currentPlanData || !currentPlanData.plan) return;

    const btn = document.getElementById('btn-save-plan');
    const msg = document.getElementById('save-msg');

    // Check auth before attempting — currentUser is set by app.js checkAuth()
    if (!currentUser) {
        msg.style.display = 'block';
        msg.style.color = 'var(--clr-danger)';
        msg.textContent = '🔐 Please log in to save your meal plan.';
        return;
    }

    // Disable button and show loading state
    btn.disabled = true;
    btn.textContent = 'Saving...';
    msg.style.display = 'none';

    // Build meals array — use 'local' as meal_id for generated (non-TheMealDB) meals
    const meals = Object.entries(currentPlanData.plan).map(([type, meal]) => ({
        meal_type: type.charAt(0).toUpperCase() + type.slice(1),
        meal_id: meal.meal_id || meal.id || 'local',
        recipe_name: meal.name,
        calories: meal.calories
    }));

    try {
        const res = await fetch(`${API_BASE_URL}/meal-plans/save-daily`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',           // ←← KEY FIX: sends session cookie
            body: JSON.stringify({
                plan_date: new Date().toISOString().split('T')[0],
                total_calories: currentPlanData.totalCalories,
                meals
            })
        });

        // Parse error body for helpful messages
        const data = await res.json().catch(() => ({}));

        if (res.ok) {
            msg.style.display = 'block';
            msg.style.color = 'var(--clr-primary)';
            msg.textContent = '✅ Meal plan saved successfully! View it on your Dashboard.';
            btn.textContent = '✓ Meal Plan Saved';
            // Keep disabled so user can't double-save the same plan
        } else {
            // Distinguish error types
            let errText;
            if (res.status === 401) {
                errText = '🔐 Please log in to save your meal plan.';
            } else if (res.status === 400) {
                errText = `❌ Bad request: ${data.error || 'Invalid plan data.'}`;
            } else if (res.status === 404) {
                errText = '❌ Save endpoint not found (404). Please report this bug.';
            } else if (res.status === 500) {
                errText = `❌ Server error: ${data.error || 'Database problem. Try again later.'}`;
            } else {
                errText = data.error || `Save failed (${res.status})`;
            }
            msg.style.display = 'block';
            msg.style.color = 'var(--clr-danger)';
            msg.textContent = errText;
            btn.disabled = false;
            btn.textContent = '💾 Save Meal Plan';
        }
    } catch (err) {
        // True network failure (server down, no connection)
        console.error('Save meal plan network error:', err);
        msg.style.display = 'block';
        msg.style.color = 'var(--clr-danger)';
        msg.textContent = '📶 Network error — could not reach the server. Is it running?';
        btn.disabled = false;
        btn.textContent = '💾 Save Meal Plan';
    }
}

async function loadSavedDailyPlan() {
    try {
        const res = await fetch(`${API_BASE_URL}/meal-plans/daily`, { credentials: 'include' });
        if (!res.ok) return;
        const data = await res.json();
        
        if (data.plan && data.meals && data.meals.length > 0) {
            const macros = { protein: 0, carbs: 0, fat: 0 };
            const plan = {};
            data.meals.forEach(m => {
                plan[m.meal_type.toLowerCase()] = {
                    meal_id:  m.meal_id,           // ← preserve for direct navigation
                    name:     m.recipe_name,
                    calories: m.calories,
                    emoji:    '\ud83c\udf7d\ufe0f',
                    protein: 0, carbs: 0, fat: 0,
                    mealDbQuery: m.recipe_name     // ← fallback: search by name
                };
            });
            
            const dummyData = {
                targetCalories: data.plan.total_calories,
                totalCalories:  data.plan.total_calories,
                difference:  0,
                macros,
                plan,
                attempts: 1,
                fallback: false,
                tolerance: 100
            };
            
            currentPlanData = dummyData;
            renderResults(dummyData);
            
            const btn = document.getElementById('btn-save-plan');
            if (btn) {
                btn.disabled = true;
                btn.textContent = '\u2713 Meal Plan Saved (Loaded from history)';
            }
        }
    } catch (err) {
        console.error('Could not load saved plan:', err);
    }
}
