document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    // Accept ?q= (normal search) or ?search= (from My Kitchen pantry match)
    const query = urlParams.get('q') || urlParams.get('search');
    
    const searchInput = document.getElementById('recipes-search-input');
    const searchForm = document.getElementById('recipes-search-form');

    if (query) {
        searchInput.value = query;
        performSearch(query);
    } else {
        // If no query, load defaults
        performSearch('chicken');
    }

    searchForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const val = searchInput.value.trim();
        if (val) {
            // Update URL without reloading
            const newurl = window.location.protocol + "//" + window.location.host + window.location.pathname + '?q=' + encodeURIComponent(val);
            window.history.pushState({path:newurl},'',newurl);
            performSearch(val);
        }
    });
});

function getRecipeIngredients(meal) {
    const ingredients = [];
    for (let i = 1; i <= 20; i++) {
        const ingredient = meal[`strIngredient${i}`];
        const measure = meal[`strMeasure${i}`];
        if (ingredient && ingredient.trim()) {
            ingredients.push({
                name: ingredient.trim().toLowerCase(),
                measure: measure ? measure.trim() : ""
            });
        }
    }
    return ingredients;
}

async function performSearch(query) {
    const grid = document.getElementById('recipes-grid');
    const loader = document.getElementById('loading-state');
    const meta = document.getElementById('results-meta');

    grid.innerHTML = '';
    meta.style.display = 'none';
    loader.style.display = 'grid';

    try {
        const requestedIngredients = query.split(',')
            .map(item => item.trim().toLowerCase())
            .filter(Boolean);

        let finalMeals = [];

        if (requestedIngredients.length === 1) {
            // Single ingredient search or Name search
            // We'll try search by name first, if no results or few, try by ingredient
            let meals = [];
            const nameRes = await fetch(`${MEALDB_BASE_URL}/search.php?s=${encodeURIComponent(requestedIngredients[0])}`);
            if (nameRes.ok) {
                const nameData = await nameRes.json();
                if (nameData.meals) {
                    meals = nameData.meals;
                }
            }

            // If name search didn't yield much, try filter by ingredient
            if (meals.length < 5) {
                const ingRes = await fetch(`${MEALDB_BASE_URL}/filter.php?i=${encodeURIComponent(requestedIngredients[0])}`);
                if (ingRes.ok) {
                    const ingData = await ingRes.json();
                    if (ingData.meals) {
                        // Fetch full details for the first 10 to keep it fast
                        const toFetch = ingData.meals.slice(0, 10);
                        for (const m of toFetch) {
                            if (!meals.find(existing => existing.idMeal === m.idMeal)) {
                                const detailRes = await fetch(`${MEALDB_BASE_URL}/lookup.php?i=${m.idMeal}`);
                                if (detailRes.ok) {
                                    const detailData = await detailRes.json();
                                    if (detailData.meals) {
                                        meals.push(detailData.meals[0]);
                                    }
                                }
                            }
                        }
                    }
                }
            }
            finalMeals = meals.map(m => ({ meal: m, matchData: null }));
        } else if (requestedIngredients.length > 1) {
            // MULTI-INGREDIENT MATCH
            const mealIdCounts = {};
            
            // 1. Search separately and count occurrences
            for (const ing of requestedIngredients) {
                try {
                    const res = await fetch(`${MEALDB_BASE_URL}/filter.php?i=${encodeURIComponent(ing)}`);
                    if (res.ok) {
                        const data = await res.json();
                        if (data.meals) {
                            for (const m of data.meals) {
                                mealIdCounts[m.idMeal] = (mealIdCounts[m.idMeal] || 0) + 1;
                            }
                        }
                    }
                } catch (err) {
                    console.error('Error fetching for ingredient:', ing);
                }
            }

            // 2. Sort candidate IDs by frequency
            const candidateIds = Object.keys(mealIdCounts)
                .sort((a, b) => mealIdCounts[b] - mealIdCounts[a])
                .slice(0, 20);

            // 3. Fetch Full Details and Verify Actual Ingredient List
            for (const id of candidateIds) {
                try {
                    const res = await fetch(`${MEALDB_BASE_URL}/lookup.php?i=${id}`);
                    if (res.ok) {
                        const data = await res.json();
                        if (data.meals && data.meals.length > 0) {
                            const meal = data.meals[0];
                            const mealIngredients = getRecipeIngredients(meal).map(i => i.name);
                            
                            // Check matches
                            let matchCount = 0;
                            for (const reqIng of requestedIngredients) {
                                if (mealIngredients.some(mi => mi.includes(reqIng) || reqIng.includes(mi))) {
                                    matchCount++;
                                }
                            }

                            // Include if at least 1 matches
                            if (matchCount > 0) {
                                finalMeals.push({
                                    meal,
                                    matchData: { matched: matchCount, total: requestedIngredients.length }
                                });
                            }
                        }
                    }
                } catch(e) {
                    console.error(e);
                }
            }
            
            // 4. Sort finalMeals by matchCount descending
            finalMeals.sort((a, b) => b.matchData.matched - a.matchData.matched);
        }

        renderResults(finalMeals);

    } catch (error) {
        console.error("TheMealDB request failed:", error);
        loader.style.display = 'none';
        grid.innerHTML = '<div class="empty-state"><div class="empty-state-icon">⚠️</div><h3>Error</h3><p>Unable to load recipes. Please try again.</p></div>';
    }
}

function renderResults(mealsData) {
    const grid = document.getElementById('recipes-grid');
    const loader = document.getElementById('loading-state');
    const meta = document.getElementById('results-meta');

    loader.style.display = 'none';

    if (mealsData.length === 0) {
        grid.innerHTML = '<div class="empty-state" style="grid-column: 1 / -1;"><div class="empty-state-icon">🔍</div><h3>No recipes found</h3><p>Try adjusting your ingredients or checking for spelling errors.</p></div>';
        return;
    }

    meta.style.display = 'block';
    meta.textContent = `Found ${mealsData.length} recipe${mealsData.length > 1 ? 's' : ''} matching your criteria`;

    grid.innerHTML = mealsData.map(data => createRecipeCard(data.meal, data.matchData)).join('');
}
