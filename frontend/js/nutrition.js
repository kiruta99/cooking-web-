/**
 * CookWise — Calorie Calculator
 * Uses the Mifflin-St Jeor equation to estimate BMR and TDEE.
 * 
 * Personal calorie calculation is COMPLETELY SEPARATE from recipe nutrition.
 * Mifflin-St Jeor → personal BMR / TDEE only.
 * Recipe calories → must come from a real nutrition data source or be marked "Not available".
 */

/* ── Constants ──────────────────────────────────────── */

const ACTIVITY_MULTIPLIERS = {
    sedentary:  1.2,
    light:      1.375,
    moderate:   1.55,
    active:     1.725,
    very_active: 1.9
};

const ACTIVITY_LABELS = {
    sedentary:   'Sedentary',
    light:       'Lightly Active',
    moderate:    'Moderately Active',
    active:      'Very Active',
    very_active: 'Extra Active'
};

/* ── State ──────────────────────────────────────────── */

let selectedGender = null;
let lastResult = null; // { bmr, tdee, gender, age, weight, height, activityLevel }

/* ── Core Calculation Function ──────────────────────── */

/**
 * Calculates BMR using the Mifflin-St Jeor equation and derives TDEE.
 *
 * @param {number} weightKg    – Body weight in kilograms
 * @param {number} heightCm    – Height in centimetres
 * @param {number} age         – Age in years
 * @param {string} gender      – 'male' | 'female'
 * @param {string} activityLevel – Key from ACTIVITY_MULTIPLIERS
 * @returns {{ bmr: number, tdee: number }}
 * @throws {Error} on invalid inputs
 */
function calculateDailyCalories(weightKg, heightCm, age, gender, activityLevel) {
    if (weightKg <= 0 || heightCm <= 0 || age <= 0) {
        throw new Error('Weight, height, and age must be positive numbers.');
    }
    if (!['male', 'female'].includes(gender)) {
        throw new Error('Invalid gender: must be "male" or "female".');
    }
    if (!(activityLevel in ACTIVITY_MULTIPLIERS)) {
        throw new Error('Invalid activity level.');
    }

    let bmr;

    if (gender === 'male') {
        // Mifflin-St Jeor for Men
        bmr = (10 * weightKg)
            + (6.25 * heightCm)
            - (5 * age)
            + 5;
    } else {
        // Mifflin-St Jeor for Women
        bmr = (10 * weightKg)
            + (6.25 * heightCm)
            - (5 * age)
            - 161;
    }

    const tdee = bmr * ACTIVITY_MULTIPLIERS[activityLevel];

    return {
        bmr:  Math.round(bmr),
        tdee: Math.round(tdee)
    };
}

/* ── Validation ─────────────────────────────────────── */

function clearErrors() {
    document.querySelectorAll('.field-error').forEach(el => el.classList.remove('visible'));
    document.querySelectorAll('.input-control.invalid').forEach(el => el.classList.remove('invalid'));
}

function showError(fieldId, errorId) {
    const field = document.getElementById(fieldId);
    const errorEl = document.getElementById(errorId);
    if (field) field.classList.add('invalid');
    if (errorEl) errorEl.classList.add('visible');
}

function validateInputs(age, weight, height, activityLevel) {
    let valid = true;

    if (!selectedGender) {
        document.getElementById('err-gender').classList.add('visible');
        valid = false;
    }

    if (!age || isNaN(age) || age < 1 || age > 120) {
        showError('field-age', 'err-age');
        valid = false;
    }

    if (!weight || isNaN(weight) || weight <= 0) {
        showError('field-weight', 'err-weight');
        valid = false;
    }

    if (!height || isNaN(height) || height <= 0) {
        showError('field-height', 'err-height');
        valid = false;
    }

    if (!activityLevel || !(activityLevel in ACTIVITY_MULTIPLIERS)) {
        showError('field-activity', 'err-activity');
        valid = false;
    }

    return valid;
}

/* ── Gender Toggle ──────────────────────────────────── */

window.selectGender = function (gender) {
    selectedGender = gender;

    document.getElementById('btn-male').classList.toggle('selected', gender === 'male');
    document.getElementById('btn-female').classList.toggle('selected', gender === 'female');

    // Clear gender error immediately on selection
    document.getElementById('err-gender').classList.remove('visible');
};

/* ── Number formatter with commas ───────────────────── */

function formatNumber(n) {
    return n.toLocaleString('en-US');
}

/* ── Render Results ─────────────────────────────────── */

function renderResults(result, activityLevel) {
    const tdeeFormatted = formatNumber(result.tdee);
    const bmrFormatted  = formatNumber(result.bmr);
    const actLabel      = ACTIVITY_LABELS[activityLevel] || activityLevel;

    // Header big number
    document.getElementById('res-tdee').textContent          = tdeeFormatted;
    // Body rows
    document.getElementById('res-bmr').textContent           = `${bmrFormatted} kcal`;
    document.getElementById('res-activity-label').textContent = actLabel;
    document.getElementById('res-tdee-2').textContent        = `${tdeeFormatted} kcal`;
    document.getElementById('res-maintenance').textContent   = `${tdeeFormatted} kcal/day`;

    // Show results, hide placeholder
    document.getElementById('result-placeholder').style.display = 'none';
    document.getElementById('result-content').style.display     = 'block';

    // Animate the big number
    animateNumber('res-tdee', result.tdee);
}

function animateNumber(elementId, target) {
    const el = document.getElementById(elementId);
    if (!el) return;

    const duration = 700;
    const start    = performance.now();
    const from     = 0;

    function step(timestamp) {
        const progress = Math.min((timestamp - start) / duration, 1);
        // easeOutQuart
        const eased  = 1 - Math.pow(1 - progress, 4);
        const current = Math.round(from + (target - from) * eased);
        el.textContent = formatNumber(current);
        if (progress < 1) {
            requestAnimationFrame(step);
        }
    }
    requestAnimationFrame(step);
}

/* ── Save Banner Logic ──────────────────────────────── */

async function updateSaveBanner() {
    const banner = document.getElementById('save-banner');
    const bannerText = document.getElementById('save-banner-text');
    const saveBtn    = document.getElementById('btn-save-result');

    const user = await window.authPromise;
    if (!user) {
        bannerText.innerHTML = 'Log in to save your calorie profile to your CookWise account.';
        saveBtn.textContent  = '🔐 Log In to Save';
        saveBtn.onclick = () => { window.location.href = 'login.html'; };
        return;
    }

    bannerText.innerHTML = `Logged in as <strong>${user.username}</strong>. Save this result to your profile.`;
    saveBtn.textContent  = '💾 Save Result';
    saveBtn.onclick      = saveResult;
}

async function saveResult() {
    if (!lastResult) return;

    const btn = document.getElementById('btn-save-result');
    btn.disabled    = true;
    btn.textContent = 'Saving…';

    try {
        const res = await fetch(`${API_BASE_URL}/nutrition/profile`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                gender:         lastResult.gender,
                age:            lastResult.age,
                weight:         lastResult.weight,
                height:         lastResult.height,
                activity_level: lastResult.activityLevel,
                bmr:            lastResult.bmr,
                tdee:           lastResult.tdee
            })
        });

        if (res.ok) {
            btn.textContent = '✅ Saved!';
            btn.style.background = '#16A34A';

            const bannerText = document.getElementById('save-banner-text');
            bannerText.innerHTML = '✅ Your calorie profile has been saved to your CookWise account!';
        } else {
            const data = await res.json().catch(() => ({}));
            btn.textContent = 'Save Failed';
            btn.disabled    = false;
            alert(data.error || 'Could not save your profile. Please try again.');
        }
    } catch (err) {
        console.error('Error saving nutrition profile:', err);
        btn.textContent = 'Save Failed';
        btn.disabled    = false;
        alert('Network error. Please check your connection and try again.');
    }
}

/* ── Load saved profile on page open ───────────────── */

async function loadSavedProfile() {
    if (!currentUser) return;

    try {
        const res = await fetch(`${API_BASE_URL}/nutrition/profile`);
        if (!res.ok) return;

        const data = await res.json();
        if (!data.profile) return;

        const p = data.profile;

        // Pre-fill the form with saved values
        if (p.gender)         selectGender(p.gender);
        if (p.age)            document.getElementById('field-age').value    = p.age;
        if (p.weight)         document.getElementById('field-weight').value = p.weight;
        if (p.height)         document.getElementById('field-height').value = p.height;
        if (p.activity_level) document.getElementById('field-activity').value = p.activity_level;

        // Show saved results immediately
        lastResult = {
            bmr:           p.bmr,
            tdee:          p.tdee,
            gender:        p.gender,
            age:           p.age,
            weight:        p.weight,
            height:        p.height,
            activityLevel: p.activity_level
        };

        renderResults({ bmr: p.bmr, tdee: p.tdee }, p.activity_level);

        // Update banner to reflect already saved state
        const bannerText = document.getElementById('save-banner-text');
        const saveBtn    = document.getElementById('btn-save-result');
        bannerText.innerHTML = `Showing your saved profile from <strong>${new Date(p.calculated_at).toLocaleDateString()}</strong>. Recalculate to update.`;
        saveBtn.textContent  = '🔄 Update Result';
        saveBtn.disabled     = false;
        saveBtn.onclick      = saveResult;

    } catch (err) {
        console.error('Error loading saved nutrition profile:', err);
    }
}

/* ── Form Submit Handler ────────────────────────────── */

document.getElementById('calc-form').addEventListener('submit', function (e) {
    e.preventDefault();
    clearErrors();

    const age      = parseFloat(document.getElementById('field-age').value);
    const weight   = parseFloat(document.getElementById('field-weight').value);
    const height   = parseFloat(document.getElementById('field-height').value);
    const activity = document.getElementById('field-activity').value;

    if (!validateInputs(age, weight, height, activity)) {
        return;
    }

    try {
        const result = calculateDailyCalories(weight, height, age, selectedGender, activity);

        lastResult = {
            bmr:           result.bmr,
            tdee:          result.tdee,
            gender:        selectedGender,
            age,
            weight,
            height,
            activityLevel: activity
        };

        renderResults(result, activity);
        updateSaveBanner();

    } catch (err) {
        console.error('Calculation error:', err);
        alert('An error occurred during calculation. Please check your inputs and try again.');
    }
});

/* ── Init ───────────────────────────────────────────── */

document.addEventListener('DOMContentLoaded', async () => {
    // Wait briefly for checkAuth (from app.js) to resolve before loading saved profile
    setTimeout(async () => {
        await loadSavedProfile();
        await updateSaveBanner();
    }, 400);
});
