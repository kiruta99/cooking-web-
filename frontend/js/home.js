document.addEventListener('DOMContentLoaded', () => {
    // Search form handler
    const heroForm = document.getElementById('hero-search-form');
    if (heroForm) {
        heroForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const query = document.getElementById('hero-search-input').value.trim();
            if (query) {
                window.location.href = `recipes.html?q=${encodeURIComponent(query)}`;
            }
        });
    }

    // Load featured recipes (using random endpoint for variety)
    loadFeaturedRecipes();
});

async function loadFeaturedRecipes() {
    const grid = document.getElementById('featured-recipes-grid');
    if (!grid) return;

    try {
        // Fetch 3 random recipes
        const recipes = [];
        for (let i = 0; i < 3; i++) {
            const res = await fetch(`${MEALDB_BASE_URL}/random.php`);
            if (res.ok) {
                const data = await res.json();
                if (data.meals && data.meals.length > 0) {
                    recipes.push(data.meals[0]);
                }
            }
        }

        if (recipes.length > 0) {
            grid.innerHTML = recipes.map(meal => createRecipeCard(meal)).join('');
        } else {
            grid.innerHTML = '<div class="empty-state"><p>Unable to load featured recipes.</p></div>';
        }
    } catch (error) {
        console.error("TheMealDB request failed:", error);
        grid.innerHTML = '<div class="empty-state"><p>Network error loading featured recipes. Please try again.</p></div>';
    }
}
