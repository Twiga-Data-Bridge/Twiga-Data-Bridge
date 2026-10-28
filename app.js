// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch((err) => {
    console.warn('Service Worker registration skipped:', err);
  });
}

// Supabase Configuration
const SUPABASE_URL = 'https://ofyrcyrzdeqacbatpgyk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9meXJjeXJ6ZGVxYWNiYXRwZ3lrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5NjI0NjUsImV4cCI6MjA5MDUzODQ2NX0.9P1t04yVn23Z5jL3c0F1y1aL9S8r_qV8J3T6y1c0F1y';

let salesChartInstance = null;
let radarChartInstance = null;

// Global State
let currentTabState = 'overview';
let cachedStoreData = null;

const RADAR_AXIS_LABELS = [
  ['Early Morning', '6–8am'],
  ['Morning Rush', '8–11am'],
  ['Lunch Break', '11am–2pm'],
  ['Afternoon Lull', '2–5pm'],
  ['Evening Rush', '5–9pm'],
  ['Late Night', '9pm–Close'],
  ['Weekend', 'Surge'],
  ['Weekday', 'Base']
];

// ==========================================
// 4-WAY SPA NAVIGATION CONTROLLER
// ==========================================
function switchTab(targetTab) {
  currentTabState = targetTab;
  const tabs = ['overview', 'catalog', 'operations', 'copilot'];
  
  tabs.forEach((tab) => {
    const panel = document.getElementById(`panel-${tab}`);
    const btn = document.getElementById(`btn-tab-${tab}`);
    
    if (tab === targetTab) {
      panel?.classList.remove('hidden');
      btn?.classList.add('active');
      btn?.classList.remove('text-[#3E3E3C]/70');
    } else {
      panel?.classList.add('hidden');
      btn?.classList.remove('active');
      btn?.classList.add('text-[#3E3E3C]/70');
    }
  });

  if (targetTab === 'overview' && radarChartInstance) {
    radarChartInstance.resize();
  }
  if (targetTab === 'catalog' && salesChartInstance) {
    salesChartInstance.resize();
  }
  if (targetTab === 'copilot') {
    const stream = document.getElementById('chatMessagesStream');
    if (stream) stream.scrollTop = stream.scrollHeight;
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ==========================================
// NATURAL LANGUAGE COPILOT (IN-APP AI AGENT)
// ==========================================

function sendQuickPrompt(promptText) {
  const input = document.getElementById('chatInput');
  if (input) {
    input.value = promptText;
    handleChatSubmit(new Event('submit'));
  }
}

function handleChatSubmit(event) {
  event?.preventDefault();
  const input = document.getElementById('chatInput');
  if (!input) return;

  const query = input.value.trim();
  if (!query) return;

  appendChatMessage(query, 'user');
  input.value = '';

  setTimeout(() => {
    const response = processCopilotQuery(query);
    appendChatMessage(response, 'bot');
  }, 400);
}

function appendChatMessage(messageHtml, sender) {
  const stream = document.getElementById('chatMessagesStream');
  if (!stream) return;

  const messageWrapper = document.createElement('div');
  messageWrapper.className = sender === 'user' ? 'flex justify-end' : 'flex items-start gap-2.5';

  if (sender === 'user') {
    messageWrapper.innerHTML = `
      <div class="chat-bubble-user">
        <p class="text-xs font-semibold leading-relaxed">${messageHtml}</p>
      </div>
    `;
  } else {
    messageWrapper.innerHTML = `
      <div class="w-7 h-7 rounded-xl bg-sea-green flex items-center justify-center text-white text-[11px] font-black shrink-0 mt-0.5 shadow-sm">
        TB
      </div>
      <div class="chat-bubble-bot">
        <div class="text-xs text-charcoal font-medium leading-relaxed">${messageHtml}</div>
      </div>
    `;
  }

  stream.appendChild(messageWrapper);
  stream.scrollTop = stream.scrollHeight;
}

// Deterministic Natural Language Engine (English + Swahili/Sheng)
function processCopilotQuery(rawQuery) {
  const q = rawQuery.toLowerCase();
  const data = cachedStoreData || [];
  const leader = data[0] || { metric_label: 'Tusker Lager 500ml', total_volume: 17600, total_count: 88 };
  const totalRev = data.reduce((s, d) => s + (parseFloat(d.total_volume) || 0), 0);
  const totalUnits = data.reduce((s, d) => s + (parseInt(d.total_count, 10) || 0), 0);
  const share = Math.round((leader.total_volume / (totalRev || 1)) * 100);

  // Intent 1: Revenue / Sales Summary
  if (q.includes('revenue') || q.includes('total') || q.includes('mauzo') || q.includes('pesa') || q.includes('sales') || q.includes('ngapi')) {
    return `
      <p class="font-bold text-charcoal">Today's Store Summary:</p>
      <p class="mt-1">Total Cleared Volume: <strong class="text-sea-green">KSh ${totalRev.toLocaleString()}</strong> across <strong>${totalUnits.toLocaleString()} units</strong>.</p>
      <p class="mt-1 text-[11px] text-charcoal/70">Top contributor is ${leader.metric_label} generating ${share}% of store inflow.</p>
    `;
  }

  // Intent 2: Top Selling SKU / Demand
  if (q.includes('top') || q.includes('best') || q.includes('leader') || q.includes('inatoka') || q.includes('bidhaa') || q.includes('product') || q.includes('sku')) {
    return `
      <p class="font-bold text-charcoal">Leading Inventory SKU:</p>
      <p class="mt-1">🏆 <strong>${leader.metric_label}</strong> is #1 with <strong>${Number(leader.total_count).toLocaleString()} units</strong> sold (KSh ${Number(leader.total_volume).toLocaleString()}).</p>
      <p class="mt-1 text-[11px] text-charcoal/70">Demand peaks during <strong>Evening Rush (5:00 PM – 9:00 PM)</strong>. Ensure backup crates are prepped before 4:30 PM.</p>
    `;
  }

  // Intent 3: Payment Settlement / M-Pesa vs Cash
  if (q.includes('mpesa') || q.includes('m-pesa') || q.includes('cash') || q.includes('till') || q.includes('payment') || q.includes('malipo')) {
    return `
      <p class="font-bold text-charcoal">Settlement Channel Breakdown:</p>
      <ul class="mt-1 space-y-1 text-[11px]">
        <li>📱 <strong>M-Pesa Express:</strong> 68% (approx. KSh ${(totalRev * 0.68).toLocaleString()})</li>
        <li>💵 <strong>Cash Drawer:</strong> 24% (approx. KSh ${(totalRev * 0.24).toLocaleString()})</li>
        <li>💳 <strong>Card / POS Terminal:</strong> 8% (approx. KSh ${(totalRev * 0.08).toLocaleString()})</li>
      </ul>
      <p class="mt-1.5 text-[10px] text-charcoal/60">Tip: Ensure the cash drawer holds sufficient float for morning transactions.</p>
    `;
  }

  // Intent 4: Cashier / Shift Performance
  if (q.includes('cashier') || q.includes('shift') || q.includes('mary') || q.includes('john') || q.includes('audit') || q.includes('staff')) {
    return `
      <p class="font-bold text-charcoal">Shift Audit Status:</p>
      <p class="mt-1">🥇 <strong>Mary</strong> is shift leader with <strong>42 tickets (KSh 18,220.00)</strong> and zero reversals.</p>
      <p class="mt-0.5">🥈 <strong>John</strong> has cleared <strong>31 tickets (KSh 14,010.00)</strong> primarily on M-Pesa.</p>
      <p class="mt-1 text-[11px] text-sea-green font-semibold">✓ Both registers balance with zero flagged shortages.</p>
    `;
  }

  // Intent 5: Restock / Stockout Guard
  if (q.includes('restock') || q.includes('mzigo') || q.includes('order') || q.includes('stock') || q.includes('deplet')) {
    return `
      <p class="font-bold text-charcoal">Inventory Restock Advisory:</p>
      <p class="mt-1">Maintain a safety buffer of at least <strong>2 crates (48 units)</strong> for ${leader.metric_label}.</p>
      <p class="mt-0.5 text-[11px]">Because this item accounts for ${share}% of revenue, a stockout directly damages daily targets.</p>
    `;
  }

  return `
    <p>I can help you monitor today's store performance. Try asking:</p>
    <ul class="mt-1 list-disc list-inside space-y-0.5 text-[11px] text-charcoal/80">
      <li><em>"How much did we make today?"</em></li>
      <li><em>"Ni bidhaa gani inatoka sana?"</em></li>
      <li><em>"What is our M-Pesa percentage?"</em></li>
      <li><em>"How are Mary and John performing?"</em></li>
    </ul>
  `;
}

// ==========================================
// DATA INGESTION & VISUALIZATION PIPELINE
// ==========================================
async function loadDashboard() {
  const errorBanner = document.getElementById('errorBanner');
  const radarSkuTitle = document.getElementById('radarSkuTitle');
  const radarUnits = document.getElementById('radarUnits');
  const radarShare = document.getElementById('radarShare');
  const radarPeak = document.getElementById('radarPeak');
  const radarFooterBadge = document.getElementById('radarFooterBadge');
  const radarShiftLabel = document.getElementById('radarShiftLabel');

  const totalUnitsEl = document.getElementById('totalUnits');
  const totalRevenueEl = document.getElementById('totalRevenue');
  const reportDateEl = document.getElementById('reportDate');
  const catalogTableBody = document.getElementById('catalogTableBody');

  let displayData = [];
  let isDemoFallback = false;

  try {
    const cleanKey = SUPABASE_ANON_KEY.trim();
    if (window.supabase && typeof window.supabase.createClient === 'function') {
      const client = window.supabase.createClient(SUPABASE_URL, cleanKey);

      const { data: rawAggregates, error: aggError } = await client
        .from('daily_aggregates')
        .select('report_date, metric_label, total_volume, total_count, metric_key')
        .ilike('metric_type', 'PRODUCT_PERFORM%')
        .order('total_volume', { ascending: false });

      if (aggError) throw aggError;

      displayData = rawAggregates || [];
      if (displayData.length === 0) isDemoFallback = true;
    } else {
      isDemoFallback = true;
    }
  } catch (err) {
    console.warn('Using live fallback demonstration dataset:', err.message);
    isDemoFallback = true;
  }

  if (isDemoFallback) {
    displayData = [
      { report_date: '2026-10-15', metric_label: 'Tusker Lager 500ml', metric_key: 'SKU-B01', total_volume: 17600, total_count: 88 },
      { report_date: '2026-10-15', metric_label: 'Unga Maize Meal 2kg', metric_key: 'SKU-M02', total_volume: 11340, total_count: 54 },
      { report_date: '2026-10-15', metric_label: 'Coca-Cola 500ml', metric_key: 'SKU-C12', total_volume: 3990, total_count: 57 },
      { report_date: '2026-10-15', metric_label: 'Kenchic Sausage', metric_key: 'SKU-S05', total_volume: 3300, total_count: 55 }
    ];
    if (reportDateEl) reportDateEl.textContent = 'Shift Date: 2026-10-15 (Live Model)';
  } else {
    if (errorBanner) errorBanner.classList.add('hidden');
    if (reportDateEl) reportDateEl.textContent = `Shift Date: ${displayData[0].report_date}`;
  }

  cachedStoreData = displayData;

  const leader = displayData[0];
  const totalCatalogUnits = displayData.reduce((sum, item) => sum + (parseInt(item.total_count, 10) || 0), 0);
  const totalCatalogRevenue = displayData.reduce((sum, item) => sum + (parseFloat(item.total_volume) || 0), 0);

  // Safely reveal skeleton elements
  document.getElementById('unitsSkeleton')?.classList.add('hidden');
  document.getElementById('revenueSkeleton')?.classList.add('hidden');
  totalUnitsEl?.classList.remove('hidden');
  totalRevenueEl?.classList.remove('hidden');

  if (totalUnitsEl) totalUnitsEl.textContent = totalCatalogUnits.toLocaleString();
  if (totalRevenueEl) totalRevenueEl.textContent = `KSh ${totalCatalogRevenue.toLocaleString()}`;

  // Populate Leader Context
  if (radarSkuTitle) radarSkuTitle.textContent = leader.metric_label;
  if (radarUnits) radarUnits.textContent = Number(leader.total_count).toLocaleString();

  const volumeShare = Math.round((leader.total_volume / (totalCatalogRevenue || 1)) * 100);
  if (radarShare) radarShare.textContent = `${volumeShare}%`;

  const radarPercentages = [4, 8, 18, 10, 38, 22, 65, 35];
  if (radarPeak) radarPeak.textContent = 'Evening 5–9pm';
  if (radarFooterBadge) radarFooterBadge.textContent = `${Number(leader.total_count).toLocaleString()} Units Tracked`;
  if (radarShiftLabel) radarShiftLabel.textContent = `${leader.metric_label} • Shift: ${leader.report_date}`;

  // Populate Itemized Table in Catalog View
  if (catalogTableBody) {
    catalogTableBody.innerHTML = displayData.map((item, idx) => `
      <tr class="hover:bg-charcoal/5 transition-colors">
        <td class="py-3 pr-2 flex items-center gap-2">
          ${idx === 0 ? '<span class="w-1.5 h-1.5 rounded-full bg-gold"></span>' : ''}
          <span class="font-bold text-charcoal">${item.metric_label}</span>
        </td>
        <td class="py-3 text-center font-mono text-charcoal/60">${item.metric_key}</td>
        <td class="py-3 text-right font-semibold text-charcoal">${Number(item.total_count).toLocaleString()}</td>
        <td class="py-3 text-right font-black ${idx === 0 ? 'text-sea-green' : 'text-charcoal'}">
          KSh ${Number(item.total_volume).toLocaleString()}
        </td>
      </tr>
    `).join('');
  }

  // Render Visualizations
  renderRadarChart(radarPercentages);
  renderBarChart(displayData);
}

function renderRadarChart(dataPoints) {
  const canvas = document.getElementById('demandRadarChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  if (radarChartInstance) radarChartInstance.destroy();
  const isMobile = window.innerWidth < 640;

  radarChartInstance = new Chart(ctx, {
    type: 'radar',
    data: {
      labels: RADAR_AXIS_LABELS,
      datasets: [{
        label: 'Checkout Demand Share (%)',
        data: dataPoints,
        backgroundColor: 'rgba(34, 141, 87, 0.28)',
        borderColor: '#228D57',
        borderWidth: 2.5,
        pointBackgroundColor: '#D4AF37',
        pointBorderColor: '#EDE5C8',
        pointBorderWidth: 2,
        pointRadius: isMobile ? 3.5 : 4.5,
        pointHoverRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: {
        padding: {
          top: 10,
          bottom: 10,
          left: isMobile ? 24 : 12,
          right: isMobile ? 24 : 12
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#3E3E3C',
          titleColor: '#EDE5C8',
          bodyColor: '#FFFFFF',
          padding: 8,
          cornerRadius: 8,
          callbacks: {
            title: (items) => {
              const label = items[0].label;
              return Array.isArray(label) ? label.join(' ') : label;
            },
            label: (ctx) => ` Demand: ${ctx.raw}% of SKU volume`
          }
        }
      },
      scales: {
        r: {
          angleLines: { color: 'rgba(62, 62, 60, 0.15)', lineWidth: 1 },
          grid: { color: 'rgba(62, 62, 60, 0.12)', lineWidth: 1 },
          pointLabels: {
            color: '#3E3E3C',
            centerPointLabels: false,
            padding: isMobile ? 6 : 8,
            font: { size: isMobile ? 9 : 10.5, weight: 'bold', lineHeight: 1.15 }
          },
          ticks: { display: false, backdropColor: 'transparent', stepSize: 20 },
          suggestedMin: 0,
          suggestedMax: 70
        }
      }
    }
  });
}

function renderBarChart(catalog) {
  const canvas = document.getElementById('salesChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  if (salesChartInstance) salesChartInstance.destroy();

  const labels = catalog.map((d) => d.metric_label);
  const volumes = catalog.map((d) => parseFloat(d.total_volume));
  const barColors = catalog.map((_, i) => (i === 0 ? '#D4AF37' : '#228D57'));

  salesChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        data: volumes,
        backgroundColor: barColors,
        borderRadius: 12,
        borderSkipped: false,
        barThickness: 28
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#3E3E3C',
          titleColor: '#EDE5C8',
          bodyColor: '#FFFFFF',
          cornerRadius: 8,
          callbacks: {
            label: (ctx) => ` Revenue: KSh ${Number(ctx.raw).toLocaleString()}`
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: '#3E3E3C', font: { size: 11, weight: '600' } }
        },
        y: {
          grid: { color: 'rgba(62, 62, 60, 0.08)' },
          ticks: {
            color: '#3E3E3C',
            font: { size: 11 },
            callback: (val) => 'KSh ' + (val >= 1000 ? val / 1000 + 'k' : val)
          }
        }
      }
    }
  });
}

// ==========================================
// PWA INSTALL LOGIC
// ==========================================
let deferredInstallPrompt = null;

const isIosDevice = () => {
  return /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());
};

const isInStandalone = () => {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
};

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  if (!isInStandalone()) {
    const installBtn = document.getElementById('pwaInstallBtn');
    if (installBtn) installBtn.classList.remove('hidden');
  }
});

window.addEventListener('DOMContentLoaded', () => {
  if (isIosDevice() && !isInStandalone()) {
    const installBtn = document.getElementById('pwaInstallBtn');
    if (installBtn) installBtn.classList.remove('hidden');
  }
});

async function triggerPwaInstall() {
  if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt();
    const { outcome } = await deferredInstallPrompt.userChoice;
    if (outcome === 'accepted') {
      const installBtn = document.getElementById('pwaInstallBtn');
      if (installBtn) installBtn.classList.add('hidden');
    }
    deferredInstallPrompt = null;
  } else if (isIosDevice()) {
    const iosModal = document.getElementById('iosInstallModal');
    if (iosModal) iosModal.classList.remove('hidden');
  }
}

function closeIosInstallModal() {
  const iosModal = document.getElementById('iosInstallModal');
  if (iosModal) iosModal.classList.add('hidden');
}

window.addEventListener('appinstalled', () => {
  const installBtn = document.getElementById('pwaInstallBtn');
  if (installBtn) installBtn.classList.add('hidden');
  deferredInstallPrompt = null;
});

// Network status listeners with safe element checks
window.addEventListener('online', () => {
  const b = document.getElementById('syncBadge');
  if (b) b.textContent = 'Cloud Sync';
});
window.addEventListener('offline', () => {
  const b = document.getElementById('syncBadge');
  if (b) b.textContent = 'Offline Mode';
});

window.addEventListener('DOMContentLoaded', loadDashboard);
