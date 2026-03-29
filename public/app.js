import { getCurrentUserId } from './auth.js';

let currentTripData = {};

// ----------------------------------------------------------------
// UTILITY
// ----------------------------------------------------------------
function showLoading(show) {
    const loader = document.getElementById('loading');
    if (loader) loader.style.display = show ? 'flex' : 'none';
}

// ----------------------------------------------------------------
// SIDEBAR NAVIGATION
// ----------------------------------------------------------------
const viewHeadings = { dashboard: 'Dashboard', 'new-plan': 'New Plan', account: 'Account' };

function switchView(viewName) {
    // Hide all views
    document.querySelectorAll('.app-view').forEach(v => {
        v.style.display = 'none';
        v.classList.remove('active-view');
    });
    // Show target
    const target = document.getElementById(`view-${viewName}`);
    if (target) {
        target.style.display = 'flex';
        target.classList.add('active-view');
    }
    // Update sidebar active state
    document.querySelectorAll('.nav-item[data-view]').forEach(a => {
        a.classList.toggle('active', a.dataset.view === viewName);
    });
    // Update header
    const heading = document.getElementById('viewHeading');
    if (heading) heading.textContent = viewHeadings[viewName] || '';

    // Trigger view-specific actions
    if (viewName === 'dashboard') loadSavedTrips();
    if (viewName === 'account') populateAccount();
}

document.querySelectorAll('.nav-item[data-view]').forEach(link => {
    link.addEventListener('click', e => {
        e.preventDefault();
        switchView(link.dataset.view);
    });
});

// "Plan New Trip" button on Dashboard
document.getElementById('goToNewPlan')?.addEventListener('click', () => switchView('new-plan'));

// ----------------------------------------------------------------
// DASHBOARD: Load Saved Trips
// ----------------------------------------------------------------
async function loadSavedTrips() {
    const listEl = document.getElementById('savedTripsList');
    if (!listEl) return;

    const uid = getCurrentUserId();
    if (!uid) {
        listEl.innerHTML = '<div class="no-trips-msg"><i class="fas fa-lock"></i><h3>Not signed in</h3><p>Sign in to see your saved trips.</p></div>';
        return;
    }

    listEl.innerHTML = '<div class="trips-loading"><i class="fas fa-spinner fa-spin"></i><span>Loading your trips…</span></div>';

    try {
        const res = await fetch(`/api/trips/list?userId=${encodeURIComponent(uid)}`);
        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || `Server error: ${res.status}`);
        }
        const data = await res.json();

        if (!data.trips || data.trips.length === 0) {
            listEl.innerHTML = `
                <div class="no-trips-msg">
                    <i class="fas fa-map-marked-alt"></i>
                    <h3>No trips planned yet</h3>
                    <p>Use "New Plan" to craft your first AI-powered itinerary!</p>
                </div>`;
            return;
        }

        listEl.innerHTML = data.trips.map(trip => {
            const input = trip.input || {};
            const dests = (input.destinations || []).join(', ') || 'Unknown';
            const days  = input.days || '?';
            const budget = input.budget ? `₹${Number(input.budget).toLocaleString('en-IN')}` : '—';
            const cost = trip.totalEstimatedCost ? `₹${Number(trip.totalEstimatedCost).toLocaleString('en-IN')}` : budget;
            const loc  = input.currentLocation || '';
            const savedAt = trip.savedAt ? new Date(trip.savedAt).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' }) : '';

            return `
                <div class="trip-card">
                    <div class="trip-card-dest"><i class="fas fa-plane"></i> ${dests}</div>
                    <div class="trip-card-meta">
                        <span class="trip-meta-pill"><i class="fas fa-calendar"></i> ${days} days</span>
                        ${loc ? `<span class="trip-meta-pill"><i class="fas fa-location-dot"></i> ${loc}</span>` : ''}
                        ${savedAt ? `<span class="trip-meta-pill"><i class="fas fa-clock"></i> ${savedAt}</span>` : ''}
                    </div>
                    <div class="trip-card-cost">Est. Cost: ${cost}</div>
                </div>`;
        }).join('');

    } catch (err) {
        console.error('Failed to load trips:', err);
        listEl.innerHTML = `<div class="no-trips-msg"><i class="fas fa-exclamation-circle"></i><h3>Error loading trips</h3><p>${err.message || 'Could not reach the server. Please try again later.'}</p></div>`;
    }

    // Update trip count on Account tab
    try {
        const count = document.getElementById('accountTripCount');
        if (count) count.textContent = document.querySelectorAll('.trip-card').length;
    } catch (_) {}
}

// ----------------------------------------------------------------
// ACCOUNT: Populate user information
// ----------------------------------------------------------------
function populateAccount() {
    const uid  = getCurrentUserId();
    const emailEl = document.getElementById('userEmailDisplay');
    const email = emailEl?.textContent || '—';

    const initial = email && email !== '—' ? email[0].toUpperCase() : 'U';
    const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

    setEl('accountAvatar',    initial);
    setEl('accountName',      email.split('@')[0] || 'Traveler');
    setEl('accountEmail',     email);
    setEl('accountEmailFull', email);
    setEl('accountUID',       uid || '—');

    // Member since — pulled from auth if available
    const created = window.__userCreatedAt;
    setEl('accountCreated', created
        ? new Date(created).toLocaleDateString('en-IN', { day:'numeric', month:'long', year:'numeric' })
        : 'N/A');

    setEl('accountTripCount', document.querySelectorAll('.trip-card').length.toString() || '0');
}

// Account page logout button
document.getElementById('accountLogoutBtn')?.addEventListener('click', async () => {
    if (confirm('Are you sure you want to sign out?')) {
        const { signOut, getAuth } = await import("https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js");
        try { await signOut(getAuth()); } catch (e) { console.error(e); }
    }
});

// ----------------------------------------------------------------
// LOCATION BUTTON
// ----------------------------------------------------------------
document.getElementById('getLocationBtn')?.addEventListener('click', () => {
    const locInput = document.getElementById('currentLocation');
    if (!navigator.geolocation) { alert('Geolocation not supported'); return; }
    locInput.placeholder = 'Detecting location…';
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
        try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${coords.latitude}&lon=${coords.longitude}`);
            const data = await res.json();
            const city = data.address.city || data.address.town || data.address.village || data.address.county;
            locInput.value = city ? `${city}, ${data.address.country}` : `${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`;
        } catch {
            locInput.value = `${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`;
        }
    }, () => {
        alert('Unable to retrieve location');
        locInput.placeholder = 'e.g. Mumbai, India';
    });
});

// ----------------------------------------------------------------
// ANALYZE BUTTON
// ----------------------------------------------------------------
document.getElementById('analyzeButton')?.addEventListener('click', async () => {
    const destinationsInput = document.getElementById('destinations').value;
    const destinations = destinationsInput.split(',').map(d => d.trim()).filter(d => d);
    const budget = document.getElementById('budget').value;
    const days   = document.getElementById('days').value;
    const currentLocation = document.getElementById('currentLocation').value;
    const tripType = document.querySelector('input[name="tripType"]:checked')?.value;
    const isInternationalRequested = tripType === 'true';
    const isMultiCityRequested     = tripType === 'multi';

    if (!destinations.length || !budget || days <= 0 || !currentLocation) {
        alert('Please fill in all required fields and ensure trip duration is greater than 0');
        return;
    }

    if (isMultiCityRequested && destinations.length < 2) { alert('Multi-city trip must have at least 2 destinations.'); return; }
    if (!isMultiCityRequested && destinations.length > 1) { alert('Please select "Multi-city" for multiple destinations.'); return; }

    const indianCities = ['mumbai','delhi','bangalore','hyd','chennai','kolkata','pune','goa','jaipur','lucknow','kanpur','nagpur','indore','thane','bhopal','visakhapatnam','patna','surat'];
    const hasIntlDest = destinations.some(d => {
        const dest = d.toLowerCase();
        return !indianCities.some(c => dest.includes(c)) && !dest.includes('india');
    });

    if (isInternationalRequested && !hasIntlDest) { alert('International trip must have at least one foreign destination.'); return; }
    if (!isInternationalRequested && tripType !== 'multi' && hasIntlDest) { alert('Domestic trip cannot have foreign destinations. Please select International.'); return; }

    showLoading(true);
    try {
        const res  = await fetch('/api/trips/analyze', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ destinations, budget, days, currentLocation, isInternational: isInternationalRequested }) });
        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || `Server ${res.status}`);
        }
        const data = await res.json();
        currentTripData = { ...data, input: { destinations, budget, days, currentLocation } };
        renderAnalysis(data);
    } catch (e) { alert('Analysis failed: ' + e.message); }
    finally { showLoading(false); }
});

function renderAnalysis(data) {
    document.querySelectorAll('.dashboard-content, .cta-area').forEach(d => d.style.display = 'none');
    const section = document.getElementById('analysis-section');
    section.style.display = 'block';

    const message = document.getElementById('analysis-message');
    const breakdown = document.getElementById('breakdown-container');

    message.innerHTML = `<strong>${data.message}</strong>`;
    breakdown.innerHTML = data.cityBreakdown.map(city => {
        let localStr = '';
        let flightStr = '';
        let hotelStr = '';
        let foodStr = '';
        
        if (data.multiCurrencyContext && data.multiCurrencyContext[city.city]) {
            const ctx = data.multiCurrencyContext[city.city];
            if (ctx.currency !== 'INR' && ctx.rate) {
                const ls = (val) => `${ctx.symbol}${(val * ctx.rate).toLocaleString(undefined, {maximumFractionDigits:0})}`;
                localStr = ` <span style="font-size:0.8em; opacity:0.8;">(approx. ${ls(city.totalMin)})</span>`;
                flightStr = ` <br><span style="font-size:0.75em; opacity:0.7; font-weight:normal;">≈ ${ls(city.minFlights)}</span>`;
                hotelStr = ` <br><span style="font-size:0.75em; opacity:0.7; font-weight:normal;">≈ ${ls(city.minHotels)}</span>`;
                foodStr = ` <br><span style="font-size:0.75em; opacity:0.7; font-weight:normal;">≈ ${ls(city.minFood)}</span>`;
            }
        }

        return `
        <div style="background:rgba(255,255,255,0.05);padding:1.5rem;border-radius:16px;margin-bottom:1rem;border:1px solid ${data.feasible ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}">
            <h4 style="color:var(--primary);margin-bottom:1rem;">${city.city}</h4>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:1rem;">
                <div><small>Flights</small><div style="font-weight:600;">₹${city.minFlights.toLocaleString()}${flightStr}</div></div>
                <div><small>Hotels</small><div style="font-weight:600;">₹${city.minHotels.toLocaleString()}${hotelStr}</div></div>
                <div><small>Food/Local</small><div style="font-weight:600;">₹${city.minFood.toLocaleString()}${foodStr}</div></div>
            </div>
            <div style="margin-top:1rem;border-top:1px solid rgba(255,255,255,0.1);padding-top:0.5rem;text-align:right;">
                <strong style="color:var(--accent)">Estimated Min: ₹${(city.totalMin || 0).toLocaleString()}${localStr}</strong>
            </div>
        </div>`;
    }).join('');
    const generateBtn = document.getElementById('generateButton');
    const suggContainer = document.getElementById('suggestion-container');

    if (data.feasible) {
        generateBtn.style.display = 'block';
        suggContainer.style.display = 'none';
    } else {
        generateBtn.style.display = 'none';
        suggContainer.style.display = 'block';
        document.getElementById('suggestion-list').innerHTML = data.suggestions.map(s =>
            `<li style="margin-bottom:0.5rem;padding:0.5rem;background:rgba(239,68,68,0.1);border-radius:8px;border-left:3px solid #ef4444;">${s}</li>`
        ).join('');
    }
}

// ----------------------------------------------------------------
// GENERATE ITINERARY
// ----------------------------------------------------------------
document.getElementById('generateButton')?.addEventListener('click', async () => {
    showLoading(true);
    try {
        const res  = await fetch('/api/trips/plan', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ destinations:currentTripData.input.destinations, budget:currentTripData.input.budget, days:currentTripData.input.days, currentLocation:currentTripData.input.currentLocation, allocation:currentTripData.cityBreakdown }) });
        
        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || `Server Status ${res.status}`);
        }
        
        const data = await res.json();
        if (!data.days) throw new Error("AI returned invalid itinerary structure.");
        
        currentTripData = { ...currentTripData, itinerary:data.days, totalEstimatedCost:data.totalEstimatedCost, weatherContext:data.weatherContext };
        renderItinerary(currentTripData);

        const uid = getCurrentUserId();
        if (uid) {
            try {
                await fetch('/api/trips/save', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ userId:uid, itineraryData:currentTripData }) });
                console.log('Itinerary auto-saved.');
            } catch (e) { console.error('Auto-save failed:', e); }
        }
    } catch (e) { 
        console.error('Itinerary Error:', e);
        alert('Failed to generate itinerary: ' + e.message); 
    }
    finally { showLoading(false); }
});

// ----------------------------------------------------------------
// RESTART
// ----------------------------------------------------------------
document.getElementById('restartButton')?.addEventListener('click', () => location.reload());

// ----------------------------------------------------------------
// RENDER ITINERARY
// ----------------------------------------------------------------
function renderItinerary(data) {
    document.getElementById('analysis-section').style.display = 'none';
    const section = document.getElementById('itinerary-section');
    section.style.display = 'block';

    // Find currency symbol for header (default to ₹ if no multi-currency matches yet)
    const symbol = '₹';

    let weatherHtml = '';
    if (data.weatherContext && Object.keys(data.weatherContext).length > 0) {
        weatherHtml = `<div style="margin:1rem 0;padding:1rem;background:rgba(16,185,129,0.1);border-radius:12px;border:1px solid rgba(16,185,129,0.2);">
            <h4 style="color:var(--accent);margin-bottom:0.5rem;font-size:0.9rem;text-transform:uppercase;letter-spacing:1px;">Live Weather Context</h4>
            <div style="display:flex;flex-wrap:wrap;gap:1rem;">
                ${Object.entries(data.weatherContext).map(([city,w]) => `<div style="background:rgba(255,255,255,0.05);padding:0.5rem 1rem;border-radius:8px;"><strong>${city}:</strong> ${w.temp}°C, ${w.condition}</div>`).join('')}
            </div></div>`;
    }

    section.innerHTML = `
        <div class="planner-card">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem;">
                <div>
                    <h2 style="margin:0;">AI-Optimized Schedule</h2>
                    <p style="color:var(--accent);margin:0.25rem 0;font-weight:600;">Total Estimated Cost: ${symbol}${data.totalEstimatedCost.toLocaleString()}</p>
                </div>
                <button id="saveItineraryBtn" class="cta-button" style="width:auto;padding:0.6rem 1.2rem;font-size:0.9rem;">Save to Account</button>
            </div>
            ${weatherHtml}
            <div style="display:flex;flex-direction:column;gap:2rem;margin-top:2rem;">
                ${data.itinerary.map(day => {
                    let lsHotel = (val) => '';
                    let lsAct = (val) => '';
                    let cSymbol = '₹';
                    
                    if (data.multiCurrencyContext) {
                        // Find the currency context for this specific city
                        const cityKey = Object.keys(data.multiCurrencyContext).find(k => day.city.toLowerCase().includes(k.toLowerCase())) || Object.keys(data.multiCurrencyContext)[0];
                        if (cityKey) {
                            const ctx = data.multiCurrencyContext[cityKey];
                            if (ctx && ctx.currency !== 'INR') {
                                lsHotel = (val) => ` <span style="font-size:0.7em;font-weight:normal;opacity:0.8;">(≈ ${ctx.symbol}${(val * ctx.rate).toLocaleString(undefined, {maximumFractionDigits:0})})</span>`;
                                lsAct = (val) => ` <span style="font-size:0.8em;opacity:0.8;">(≈ ${ctx.symbol}${(val * ctx.rate).toLocaleString(undefined, {maximumFractionDigits:0})})</span>`;
                            }
                        }
                    }

                    return `
                    <div style="border-left:4px solid var(--primary);padding-left:1.5rem;">
                        <h3 style="margin-bottom:0.5rem;color:var(--primary);">Day ${day.day}: ${day.city}</h3>
                        ${day.hotelSuggestion ? `<div style="background:rgba(255,107,157,0.1);padding:1rem;border-radius:12px;margin-bottom:1.5rem;border:1px solid var(--accent);"><div style="display:flex;justify-content:space-between;align-items:start;"><div><h4 style="color:var(--accent);margin:0;font-size:1rem;"><i class="fas fa-hotel"></i> ${day.hotelSuggestion.name}</h4><p style="font-size:0.8rem;color:var(--text-muted);margin:0.25rem 0;">${day.hotelSuggestion.description}</p></div><div style="font-weight:700;color:var(--accent);">₹${day.hotelSuggestion.estimatedCostPerNight.toLocaleString()}${lsHotel(day.hotelSuggestion.estimatedCostPerNight)}<small>/night</small></div></div></div>` : ''}
                        ${['Morning','Afternoon','Evening','Night'].map(block => {
                            const acts = day.blocks[block] || [];
                            if (!acts.length) return '';
                            return `<div style="margin-bottom:1.5rem;">
                                <h4 style="font-size:0.8rem;text-transform:uppercase;color:var(--text-muted);margin-bottom:0.75rem;letter-spacing:1px;">${block}</h4>
                                ${acts.map((act, idx) => `
                                    <div style="display:flex;gap:1rem;background:rgba(255,255,255,0.03);padding:1rem;border-radius:12px;margin-bottom:0.5rem;">
                                        <span style="font-family:monospace;color:var(--accent);font-weight:600;min-width:60px;">${act.time}</span>
                                        <div style="flex:1">
                                            <div style="display:flex;justify-content:space-between;align-items:start;">
                                                <strong>${act.place}</strong>
                                                <span style="font-size:0.7rem;padding:2px 8px;border-radius:100px;background:rgba(255,107,157,0.1);color:var(--accent);border:1px solid var(--accent);">${act.category}</span>
                                            </div>
                                            <p style="font-size:0.85rem;color:var(--text-muted);margin:0.5rem 0;">${act.description}</p>
                                            <div style="display:flex;justify-content:space-between;align-items:center;margin-top:0.5rem;">
                                                <span style="font-weight:600;color:var(--accent)">₹${act.cost.toLocaleString()}${lsAct(act.cost)}</span>
                                                <button onclick="markMissed(${day.day},'${block}',${idx})" style="padding:4px 12px;font-size:0.7rem;background:rgba(255,255,255,0.05);border:1px solid var(--border);border-radius:4px;color:var(--text-muted);cursor:pointer;">Missed</button>
                                            </div>
                                        </div>
                                    </div>`).join('')}
                            </div>`;
                        }).join('')}
                    </div>`
                }).join('')}
            </div>
        </div>`;

    document.getElementById('saveItineraryBtn').addEventListener('click', async () => {
        const uid = getCurrentUserId();
        if (!uid) { alert('You must be logged in to save itineraries.'); return; }
        showLoading(true);
        try {
            const res = await fetch('/api/trips/save', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ userId:uid, itineraryData:currentTripData }) });
            const result = await res.json();
            if (result.success) alert('Itinerary saved! ID: ' + result.id);
        } catch { alert('Failed to save.'); }
        finally { showLoading(false); }
    });
}

// ----------------------------------------------------------------
// MARK MISSED
// ----------------------------------------------------------------
window.markMissed = async (day, blockName, idx) => {
    const dayData = currentTripData.itinerary.find(d => d.day === day);
    const missedActivity = dayData.blocks[blockName][idx];
    const remainingItinerary = currentTripData.itinerary.filter(d => d.day >= day);
    showLoading(true);
    try {
        const res = await fetch('/api/trips/reschedule', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ remainingItinerary, missedActivity, remainingBudget:currentTripData.input.budget, currentLocation:currentTripData.input.currentLocation }) });
        if (!res.ok) throw new Error('Reschedule failed');
        const data = await res.json();
        currentTripData.itinerary = [...currentTripData.itinerary.filter(d => d.day < day), ...data.days];
        renderItinerary(currentTripData);
    } catch { alert('Rescheduling failed.'); }
    finally { showLoading(false); }
};

// ----------------------------------------------------------------
// DATE PICKER
// ----------------------------------------------------------------
const startDateInput = document.getElementById('startDate');
const endDateInput   = document.getElementById('endDate');
const daysHidden     = document.getElementById('days');
const durationDisplay = document.getElementById('durationDisplay');

if (startDateInput && endDateInput) {
    const today = new Date().toISOString().split('T')[0];
    startDateInput.min = today;

    const calcDuration = () => {
        const start = new Date(startDateInput.value);
        const end   = new Date(endDateInput.value);
        if (startDateInput.value && endDateInput.value) {
            if (end < start) {
                durationDisplay.textContent = 'Error: End date before start';
                durationDisplay.style.color = 'var(--accent)';
                daysHidden.value = 0;
            } else {
                const diff = Math.ceil(Math.abs(end - start) / 86400000) + 1;
                durationDisplay.textContent = `Duration: ${diff} days`;
                durationDisplay.style.color = 'var(--accent)';
                daysHidden.value = diff;
            }
        }
    };
    startDateInput.addEventListener('change', e => { endDateInput.min = e.target.value; calcDuration(); });
    endDateInput.addEventListener('change', calcDuration);
}

// ----------------------------------------------------------------
// BUDGET CONTROLS
// ----------------------------------------------------------------
const budgetRange = document.getElementById('budgetRange');
const budgetInput = document.getElementById('budgetInput');
const budgetHidden = document.getElementById('budget');

function updateBudgets(val) {
    if (budgetRange) budgetRange.value = val;
    if (budgetInput) budgetInput.value = val;
    if (budgetHidden) budgetHidden.value = val;
    
    const display = document.getElementById('inrValueDisplay');
    if (display) display.textContent = new Intl.NumberFormat('en-IN').format(val);
    
    updateTripLogic();
}

if (budgetRange) {
    budgetRange.addEventListener('input', e => updateBudgets(e.target.value));
}
if (budgetInput) {
    budgetInput.addEventListener('input', e => {
        let val = parseInt(e.target.value) || 0;
        if (val > 1000000) val = 1000000; // Cap
        updateBudgets(val);
    });
}

// ----------------------------------------------------------------
// QUICK TAGS
// ----------------------------------------------------------------
const destInput = document.getElementById('destinations');

const updateTripLogic = async () => {
    if (!destInput) return;
    const dests = destInput.value.split(',').map(d => d.trim()).filter(d => d);
    if (!dests.length) return;
    if (dests.length > 1) {
        const multi = document.querySelector('input[name="tripType"][value="multi"]');
        if (multi) multi.checked = true;
    } else {
        try {
            const res = await fetch(`/api/trips/currency-suggestion?destination=${encodeURIComponent(dests[0])}`);
            if (!res.ok) return;
            const data = await res.json();
            if (data.currency) {
                const isIntl = data.currency !== 'INR';
                const radio = document.querySelector(`input[name="tripType"][value="${isIntl}"]`);
                if (radio) radio.checked = true;
                const label = document.getElementById('targetCurrencyLabel');
                const sym   = document.getElementById('targetCurrencySymbol');
                const val   = document.getElementById('eurValueDisplay');
                if (label) label.textContent = data.currency;
                if (sym)   sym.textContent   = data.symbol || '';
                const budget = document.getElementById('budget').value;
                if (val) val.textContent = (budget * data.rate).toFixed(2);
            }
        } catch (e) { console.error('Currency suggestion error:', e); }
    }
};

if (destInput) destInput.addEventListener('input', updateTripLogic);

document.querySelectorAll('#quick-tags .tag').forEach(tag => {
    tag.addEventListener('click', () => {
        if (!destInput) return;
        destInput.value = destInput.value ? `${destInput.value}, ${tag.textContent}` : tag.textContent;
        updateTripLogic();
    });
});

// ----------------------------------------------------------------
// AUTH STATE from auth.js
// ----------------------------------------------------------------
window.addEventListener('user-ready', e => {
    const mainApp = document.getElementById('mainAppContent');
    if (e.detail?.uid) {
        if (mainApp) mainApp.style.display = 'block';
        // Load saved trips when user logs in
        loadSavedTrips();
    } else {
        if (mainApp) mainApp.style.display = 'none';
    }
});
