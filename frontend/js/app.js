// Base API URL config — relative path so session cookies are always sent
const API_BASE_URL = '/api';
const MEALDB_BASE_URL = 'https://www.themealdb.com/api/json/v1/1';

// Global State
let currentUser = null;

// Hide all auth nav buttons immediately (before async check) to prevent flash
(function initNavHide() {
    const ids = ['nav-login-btn', 'nav-register-btn', 'nav-dashboard-btn', 'nav-logout-btn'];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.visibility = 'hidden';
    });
})();

// Auth check on load
async function checkAuth() {
    try {
        const res = await fetch(`${API_BASE_URL}/auth/me`, { credentials: 'include' });
        if (res.ok) {
            const data = await res.json();
            currentUser = data.user;
            updateNavForAuth(true);
            return data.user;
        } else {
            updateNavForAuth(false);
            return null;
        }
    } catch (err) {
        console.error('Auth check failed:', err);
        updateNavForAuth(false);
        return null;
    }
}

// Immediately start the auth check and store the promise
window.authPromise = checkAuth();

function updateNavForAuth(isAuth) {
    const loginBtn    = document.getElementById('nav-login-btn');
    const registerBtn = document.getElementById('nav-register-btn');
    const dashBtn     = document.getElementById('nav-dashboard-btn');
    const logoutBtn   = document.getElementById('nav-logout-btn');

    // Restore visibility first, then set display
    [loginBtn, registerBtn, dashBtn, logoutBtn].forEach(el => {
        if (el) el.style.visibility = '';
    });

    if (loginBtn)    loginBtn.style.display    = isAuth ? 'none' : 'inline-flex';
    if (registerBtn) registerBtn.style.display = isAuth ? 'none' : 'inline-flex';
    if (dashBtn)     dashBtn.style.display     = isAuth ? 'inline-flex' : 'none';
    if (logoutBtn)   logoutBtn.style.display   = isAuth ? 'inline-flex' : 'none';
}

// Logout handler
const logoutBtn = document.getElementById('nav-logout-btn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
        try {
            await fetch(`${API_BASE_URL}/auth/logout`, { method: 'POST', credentials: 'include' });
            window.location.href = 'index.html';
        } catch (err) {
            console.error('Logout failed:', err);
        }
    });
}

function getStableKcal(meal) {
    if (meal?.kcal !== undefined && meal?.kcal !== null && !isNaN(Number(meal.kcal))) {
        return Number(meal.kcal);
    }

    const idMeal = meal?.idMeal || meal?.meal_id || "0";
    let hash = 0;
    for (let i = 0; i < idMeal.toString().length; i++) {
        hash = ((hash << 5) - hash) + idMeal.toString().charCodeAt(i);
        hash |= 0; 
    }
    hash = Math.abs(hash);

    let min = 250, max = 800;
    const cat = (meal?.strCategory || "").toLowerCase();
    
    if (cat.includes('breakfast')) { min = 250; max = 500; }
    else if (cat.includes('chicken')) { min = 350; max = 700; }
    else if (cat.includes('beef')) { min = 400; max = 800; }
    else if (cat.includes('seafood')) { min = 300; max = 650; }
    else if (cat.includes('vegetarian') || cat.includes('vegan')) { min = 250; max = 550; }
    else if (cat.includes('dessert')) { min = 250; max = 600; }
    else if (cat.includes('pasta')) { min = 400; max = 750; }

    return min + (hash % (max - min + 1));
}

// UI Helpers
function createRecipeCard(meal, matchData = null) {
    // Generate card HTML
    const matchHtml = matchData ? 
        `<div class="recipe-match"><span class="meta-icon">✓</span> ${matchData.matched}/${matchData.total} ingredients matched</div>` : '';

    const kcalValue = getStableKcal(meal);
    const caloriesHtml = `<div class="meta-item"><span class="meta-icon">🔥</span> ${kcalValue} kcal</div>`;

    const cuisineHtml = meal.strArea ? `<div class="badge-cuisine">${meal.strArea}</div>` : `<div class="badge-cuisine">Cuisine unavailable</div>`;
    const imageSrc = meal.strMealThumb ? meal.strMealThumb : 'images/placeholder-recipe.jpg';

    return `
        <a href="recipe-details.html?id=${meal.idMeal}" class="recipe-card">
            <div class="recipe-img-container">
                <img src="${imageSrc}" alt="${meal.strMeal || 'Recipe'}" loading="lazy">
                ${cuisineHtml}
            </div>
            <div class="recipe-content">
                <h3 class="recipe-title">${meal.strMeal}</h3>
                <div class="recipe-meta">
                    ${matchHtml}
                    ${meal.strCategory ? `<div class="meta-item"><span class="tag">${meal.strCategory}</span></div>` : ''}
                    ${caloriesHtml}
                </div>
                <div class="recipe-actions">
                    <span class="btn btn-outline" style="padding: 6px 12px; font-size: 14px;">View Recipe</span>
                    <button class="btn-save" data-id="${meal.idMeal}" data-name="${meal.strMeal}" data-thumb="${meal.strMealThumb}" onclick="event.preventDefault(); saveRecipe(this)">❤️</button>
                </div>
            </div>
        </a>
    `;
}

async function saveRecipe(btn) {
    if (!currentUser) {
        alert('Please login to save recipes!');
        window.location.href = 'login.html';
        return;
    }
    const { id, name, thumb } = btn.dataset;
    try {
        const res = await fetch(`${API_BASE_URL}/favorites`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ meal_id: id, meal_name: name, meal_thumb: thumb })
        });
        if (res.ok) {
            alert('Recipe saved!');
        } else {
            const data = await res.json();
            alert(data.error || 'Could not save recipe');
        }
    } catch (err) {
        console.error(err);
        alert('Network error.');
    }
}

// Note: checkAuth is now executed immediately and stored in window.authPromise
