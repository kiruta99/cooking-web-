document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('id');
    
    if (id) {
        fetchRecipe(id);
    } else {
        document.getElementById('recipe-container').innerHTML = '<div class="empty-state"><h3>Recipe Not Found</h3><p>No ID provided.</p></div>';
    }
});

let currentMeal = null;
let baseServings = 2;
let currentServings = 2;
let cookingSteps = [];
let currentStepIndex = 0;
let allIngredients = [];

// Timer state
let timerInterval = null;
let timerSeconds = 0;
let timerRunning = false;
let timerFinished = false;

function getRecipeIngredients(meal) {
    const ingredients = [];
    for (let i = 1; i <= 20; i++) {
        const ingredient = meal[`strIngredient${i}`];
        const measure = meal[`strMeasure${i}`];
        if (ingredient && ingredient.trim()) {
            ingredients.push({
                name: ingredient.trim(),
                measure: measure ? measure.trim() : ""
            });
        }
    }
    return ingredients;
}

async function fetchRecipe(id) {
    try {
        const res = await fetch(`${MEALDB_BASE_URL}/lookup.php?i=${id}`);
        if (res.ok) {
            const data = await res.json();
            if (data.meals && data.meals.length > 0) {
                currentMeal = data.meals[0];
                currentMeal.kcal = getStableKcal(currentMeal);
                allIngredients = getRecipeIngredients(currentMeal);
                renderRecipe();
                return;
            }
        }
        document.getElementById('recipe-container').innerHTML = '<div class="empty-state"><h3>Recipe Not Found</h3></div>';
    } catch (err) {
        console.error(err);
        document.getElementById('recipe-container').innerHTML = '<div class="empty-state"><h3>Network Error</h3></div>';
    }
}

function renderRecipe() {
    const container = document.getElementById('recipe-container');
    const ingredients = getRecipeIngredients(currentMeal);
    
    cookingSteps = currentMeal.strInstructions
        .split(/\r?\n/)
        .filter(step => step.trim().length > 10);

    if (cookingSteps.length === 0) {
        cookingSteps = [currentMeal.strInstructions];
    }

    const html = `
        <div class="details-hero mt-4">
            <img src="${currentMeal.strMealThumb}" alt="${currentMeal.strMeal}">
            <div class="details-hero-overlay">
                <div class="details-meta-tags">
                    <span class="badge">&#127758; ${currentMeal.strArea || 'Unknown'}</span>
                    <span class="badge">&#127374; ${currentMeal.strCategory || 'Unknown'}</span>
                </div>
                <h1>${currentMeal.strMeal}</h1>
            </div>
        </div>

        <div class="action-bar">
            <button class="btn btn-primary" onclick="startCookingMode()">&#127859; Start Cooking</button>
            <button class="btn btn-outline" data-id="${currentMeal.idMeal}" data-name="${currentMeal.strMeal}" data-thumb="${currentMeal.strMealThumb}" onclick="saveRecipe(this)">&#10084; Save Recipe</button>
            <button class="btn btn-outline" onclick="printRecipe()">&#128424; Print Recipe</button>
        </div>

        <div class="layout-grid">
            <div class="main-content">
                <div class="panel">
                    <h3>Instructions</h3>
                    <div class="instructions">
                        ${cookingSteps.map((step, i) => `<p><strong>Step ${i + 1}:</strong> ${step}</p>`).join('')}
                    </div>
                </div>
            </div>
            
            <div class="sidebar">
                <div class="panel">
                    <h3>Ingredients</h3>
                    <div class="servings-control">
                        <button class="servings-btn" onclick="updateServings(-1)">-</button>
                        <span class="servings-num" id="servings-display">${currentServings}</span>
                        <button class="servings-btn" onclick="updateServings(1)">+</button>
                        <span style="font-size:14px; color:var(--clr-text-muted); margin-left: 8px;">Servings</span>
                    </div>
                    <ul class="ingredients-list" id="ingredients-list-render">
                        ${renderIngredientsList(ingredients)}
                    </ul>
                </div>
                
                <div class="panel">
                    <h3>Estimated Nutrition</h3>
                    <p style="color: var(--clr-text-muted); font-size: 14px; margin-bottom: 16px;">
                        Based on standard ingredient measurements.
                    </p>
                    <ul class="ingredients-list">
                        <li>
                            <span>&#128293; Calories</span> 
                            <span>${currentMeal.kcal} kcal</span>
                        </li>
                    </ul>
                </div>
            </div>
        </div>
    `;

    container.innerHTML = html;
}

function parseMeasure(measureStr) {
    const match = measureStr.match(/^([\d.,\s\/-]+)(.*)$/);
    if (!match) return { num: null, rest: measureStr };
    let numPart = match[1].trim();
    let value = parseFloat(numPart);
    if (isNaN(value)) return { num: null, rest: measureStr };
    return { num: value, rest: match[2] };
}

function renderIngredientsList(ingredients) {
    return ingredients.map(ing => {
        let displayMeasure = ing.measure;
        const parsed = parseMeasure(ing.measure);
        if (parsed.num !== null) {
            const scaled = (parsed.num / baseServings) * currentServings;
            displayMeasure = `${Math.round(scaled * 10) / 10} ${parsed.rest}`;
        }
        return `<li><span>${ing.name}</span> <strong>${displayMeasure}</strong></li>`;
    }).join('');
}

window.updateServings = function(delta) {
    const newS = currentServings + delta;
    if (newS >= 1 && newS <= 12) {
        currentServings = newS;
        document.getElementById('servings-display').innerText = currentServings;
        const ingredients = getRecipeIngredients(currentMeal);
        document.getElementById('ingredients-list-render').innerHTML = renderIngredientsList(ingredients);
    }
}

// ===========================================================================
//  COOKING MODE
// ===========================================================================

window.startCookingMode = function() {
    if (!cookingSteps || cookingSteps.length === 0) {
        showCookingEmptyState();
        document.getElementById('cooking-mode').style.display = 'flex';
        return;
    }

    currentStepIndex = 0;

    const nameEl = document.getElementById('ck-recipe-name');
    if (nameEl && currentMeal) nameEl.textContent = 'Cooking: ' + currentMeal.strMeal;

    const imgWrap = document.getElementById('ck-recipe-img-wrap');
    const img = document.getElementById('ck-recipe-img');
    if (img && currentMeal && currentMeal.strMealThumb) {
        img.src = currentMeal.strMealThumb;
        img.alt = currentMeal.strMeal;
        if (imgWrap) imgWrap.style.display = '';
    } else if (imgWrap) {
        imgWrap.style.display = 'none';
    }

    buildStepDots();

    const sub = document.getElementById('ck-complete-subtitle');
    if (sub && currentMeal) sub.textContent = 'Great job! Your ' + currentMeal.strMeal + ' is ready to serve.';

    const viewBtn = document.getElementById('ck-btn-view-recipe');
    if (viewBtn) viewBtn.onclick = exitCookingMode;

    resetTimer();
    setScreenState('cooking');
    updateCookingUI(false);

    document.getElementById('cooking-mode').style.display = 'flex';

    if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
        Notification.requestPermission();
    }
}

function buildStepDots() {
    const dotsContainer = document.getElementById('ck-step-dots');
    if (!dotsContainer) return;
    dotsContainer.innerHTML = '';
    const maxDots = Math.min(cookingSteps.length, 20);
    for (let i = 0; i < maxDots; i++) {
        const dot = document.createElement('span');
        dot.className = 'ck-dot';
        dot.dataset.index = i;
        dotsContainer.appendChild(dot);
    }
}

function updateDots() {
    const dots = document.querySelectorAll('.ck-dot');
    dots.forEach((dot, i) => {
        dot.classList.remove('done', 'active');
        if (i < currentStepIndex) dot.classList.add('done');
        if (i === currentStepIndex) dot.classList.add('active');
    });
}

function updateIngredientContext(stepText) {
    const contextEl = document.getElementById('ck-ingredient-context');
    const chipsEl = document.getElementById('ck-ingredient-chips');
    if (!contextEl || !chipsEl || !allIngredients.length) return;

    const lowerStep = stepText.toLowerCase();
    const matched = allIngredients.filter(ing =>
        ing.name.split(' ').some(word => word.length > 2 && lowerStep.includes(word.toLowerCase()))
    );

    if (matched.length > 0) {
        chipsEl.innerHTML = matched.map(ing =>
            '<span class="ck-chip">' + ing.name + (ing.measure ? ' &middot; ' + ing.measure : '') + '</span>'
        ).join('');
        contextEl.style.display = '';
    } else {
        contextEl.style.display = 'none';
    }
}

function setScreenState(state) {
    const cookingBody    = document.getElementById('ck-cooking-body');
    const progressBar    = document.getElementById('ck-progress-bar');
    const completeScreen = document.getElementById('ck-complete-screen');
    const footer         = document.getElementById('ck-footer');

    if (state === 'cooking') {
        if (cookingBody)    cookingBody.style.display    = 'flex';
        if (progressBar)    progressBar.style.display    = '';
        if (completeScreen) completeScreen.style.display = 'none';
        if (footer)         footer.style.display         = 'flex';
    } else if (state === 'complete') {
        if (cookingBody)    cookingBody.style.display    = 'none';
        if (progressBar)    progressBar.style.display    = 'none';
        if (completeScreen) {
            completeScreen.style.display = 'flex';
            const icon = document.getElementById('ck-complete-icon');
            if (icon) {
                icon.classList.remove('animate');
                void icon.offsetWidth;
                icon.classList.add('animate');
            }
        }
        if (footer) footer.style.display = 'none';
    }
}

function showCookingEmptyState() {
    const body = document.getElementById('ck-cooking-body');
    if (!body) return;
    body.innerHTML = '<div class="ck-empty-state">'
        + '<div class="ck-empty-icon">&#129368;</div>'
        + '<div class="ck-empty-title">No steps available</div>'
        + '<div class="ck-empty-sub">No cooking steps are available for this recipe.</div>'
        + '<button class="ck-complete-btn ck-complete-btn-outline" onclick="exitCookingMode()" style="margin-top:8px;">'
        + '&larr; Back to Recipe</button></div>';
    const pb = document.getElementById('ck-progress-bar');
    const ft = document.getElementById('ck-footer');
    if (pb) pb.style.display = 'none';
    if (ft) ft.style.display = 'none';
}

function updateCookingUI(animate) {
    if (animate === undefined) animate = true;
    const total   = cookingSteps.length;
    const stepNum = currentStepIndex + 1;
    const isFirst = currentStepIndex === 0;
    const isLast  = currentStepIndex === total - 1;
    const pct     = Math.round((stepNum / total) * 100);

    const counterEl = document.getElementById('cooking-step-counter');
    if (counterEl) counterEl.textContent = 'STEP ' + stepNum + ' OF ' + total;

    const pctEl = document.getElementById('ck-pct');
    if (pctEl) pctEl.textContent = pct + '%';

    const fillEl = document.getElementById('ck-progress-fill');
    if (fillEl) fillEl.style.width = pct + '%';

    const pbRole = document.getElementById('ck-progressbar-role');
    if (pbRole) pbRole.setAttribute('aria-valuenow', pct);

    updateDots();

    const stepLabelEl = document.getElementById('ck-step-number-label');
    if (stepLabelEl) stepLabelEl.textContent = 'Step ' + stepNum + ' of ' + total;

    const textEl = document.getElementById('cooking-instruction-text');
    if (textEl) {
        const stepText = cookingSteps[currentStepIndex];
        if (animate) {
            textEl.classList.remove('ck-step-animate');
            void textEl.offsetWidth;
            textEl.classList.add('ck-step-animate');
        }
        textEl.textContent = stepText;
        updateIngredientContext(stepText);
    }

    const prevBtn   = document.getElementById('btn-cook-prev');
    const nextBtn   = document.getElementById('btn-cook-next');
    const finishBtn = document.getElementById('btn-cook-finish');

    if (prevBtn) prevBtn.disabled = isFirst;

    if (isLast) {
        if (nextBtn)   nextBtn.style.display   = 'none';
        if (finishBtn) finishBtn.style.display = 'inline-flex';
    } else {
        if (nextBtn)   nextBtn.style.display   = 'inline-flex';
        if (finishBtn) finishBtn.style.display = 'none';
    }
}

function exitCookingMode() {
    document.getElementById('cooking-mode').style.display = 'none';
    resetTimer();
    setScreenState('cooking');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function finishCooking() {
    resetTimer();
    setScreenState('complete');
}

document.getElementById('btn-exit-cooking').addEventListener('click', exitCookingMode);

document.getElementById('btn-cook-prev').addEventListener('click', function() {
    if (currentStepIndex > 0) {
        currentStepIndex--;
        updateCookingUI();
    }
});

document.getElementById('btn-cook-next').addEventListener('click', function() {
    if (currentStepIndex < cookingSteps.length - 1) {
        currentStepIndex++;
        updateCookingUI();
    }
});

document.getElementById('btn-cook-finish').addEventListener('click', finishCooking);

// ===========================================================================
//  TIMER
// ===========================================================================

function formatTimer(sec) {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return m + ':' + s;
}

function updateTimerDisplay() {
    const el = document.getElementById('cooking-timer');
    if (el) el.textContent = formatTimer(timerSeconds);
}

function setTimerColorState(state) {
    const display = document.getElementById('cooking-timer');
    const wrap    = document.getElementById('ck-timer-wrap');
    if (!display) return;
    display.classList.remove('running', 'finished');
    if (wrap) wrap.classList.remove('running');
    if (state === 'running') {
        display.classList.add('running');
        if (wrap) wrap.classList.add('running');
    } else if (state === 'finished') {
        display.classList.add('finished');
    }
}

function setTimerToggleState(state) {
    const btn = document.getElementById('btn-timer-toggle');
    if (!btn) return;
    btn.classList.remove('paused');
    if (state === 'idle') {
        btn.innerHTML = '&#9654; Start';
        btn.setAttribute('aria-label', 'Start timer');
    } else if (state === 'running') {
        btn.innerHTML = '&#9208; Pause';
        btn.setAttribute('aria-label', 'Pause timer');
    } else if (state === 'paused') {
        btn.innerHTML = '&#9654; Resume';
        btn.setAttribute('aria-label', 'Resume timer');
        btn.classList.add('paused');
    }
}

function showTimerComplete(show) {
    const banner = document.getElementById('ck-timer-complete');
    if (!banner) return;
    if (show) {
        banner.classList.add('visible');
    } else {
        banner.classList.remove('visible');
    }
}

// + 1 minute
document.getElementById('btn-timer-start').addEventListener('click', function() {
    timerSeconds = Math.max(0, timerSeconds + 60);
    timerFinished = false;
    showTimerComplete(false);
    if (!timerRunning) setTimerColorState('idle');
    updateTimerDisplay();
});

// - 1 minute
document.getElementById('btn-timer-minus').addEventListener('click', function() {
    timerSeconds = Math.max(0, timerSeconds - 60);
    updateTimerDisplay();
});

// Reset
document.getElementById('btn-timer-reset').addEventListener('click', resetTimer);

// Start / Pause / Resume toggle
document.getElementById('btn-timer-toggle').addEventListener('click', function() {
    if (timerRunning) {
        clearInterval(timerInterval);
        timerInterval = null;
        timerRunning = false;
        setTimerToggleState('paused');
        setTimerColorState('idle');
    } else {
        if (timerSeconds <= 0) return;
        timerRunning  = true;
        timerFinished = false;
        showTimerComplete(false);
        setTimerToggleState('running');
        setTimerColorState('running');

        timerInterval = setInterval(function() {
            timerSeconds--;
            updateTimerDisplay();
            if (timerSeconds <= 0) {
                clearInterval(timerInterval);
                timerInterval = null;
                timerRunning  = false;
                timerFinished = true;
                setTimerToggleState('idle');
                setTimerColorState('finished');
                showTimerComplete(true);
                if (Notification.permission === 'granted') {
                    new Notification('CookWise Timer', { body: 'Your cooking timer has finished!' });
                }
            }
        }, 1000);
    }
});

function resetTimer() {
    clearInterval(timerInterval);
    timerInterval = null;
    timerRunning  = false;
    timerFinished = false;
    timerSeconds  = 0;
    updateTimerDisplay();
    setTimerToggleState('idle');
    setTimerColorState('idle');
    showTimerComplete(false);
}

window.printRecipe = function() {
    window.print();
}

document.addEventListener('DOMContentLoaded', () => {
    // Intercept Meal Planner link to preserve state
    const mealPlannerLinks = document.querySelectorAll('a[href="meal-planner.html"].ck-complete-btn');
    mealPlannerLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            if (document.referrer.includes('meal-planner.html')) {
                e.preventDefault();
                window.history.back();
            }
        });
    });

    // Intercept Home link to preserve state
    const homeLinks = document.querySelectorAll('a[href="index.html"].ck-complete-btn');
    homeLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            if (document.referrer.endsWith('/') || document.referrer.includes('index.html')) {
                e.preventDefault();
                window.history.back();
            }
        });
    });
});
