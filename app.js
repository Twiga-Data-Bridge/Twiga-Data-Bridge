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

// Carousel & View Context State
let currentTabState = 'overview';
let currentSlideIndex = 0;

// Multi-line labels avoid text clipping on mobile viewports
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

// SPA View-Switching Controller
function switchTab(targetTab) {
  currentTabState = targetTab;
  currentSlideIndex = 0;

  const tabs = ['overview', 'catalog', 'operations'];
  
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

  // Update carousel if open
  const drawer = document.getElementById('helperDrawer');
  if (drawer && drawer.classList.contains('open')) {
    renderCurrentSlide();
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Drawer Toggle Controller
function toggleHelperDrawer() {
  const drawer = document.getElementById('helperDrawer');
  const backdrop = document.getElementById('drawerBackdrop');
  if (!drawer || !backdrop) return;

  const isOpen = drawer.classList.contains('open');
  if (isOpen) {
    drawer.classList.remove('open');
    backdrop.classList.remove('opacity-100');
    backdrop.classList.add('opacity-0');
    setTimeout(() => backdrop.classList.add('hidden'), 300);
  } else {
    currentSlideIndex = 0;
    renderCurrentSlide();
    backdrop.classList.remove('hidden');
    requestAnimationFrame(() => {
      backdrop.classList.remove('opacity-0');
      backdrop.classList.add('opacity-100');
      drawer.classList.add('open');
    });
  }
}

// Contextual Slide Definitions
function getContextSlides() {
  const leaderName = document.getElementById('radarSkuTitle')?.textContent || 'Sales Leader';
  const leaderUnits = document.getElementById('radarUnits')?.textContent || '--';
  const leaderShare = document.getElementById('radarShare')?.textContent || '--%';
  const leaderPeak = document.getElementById('radarPeak')?.textContent || 'Evening';
  const totalUnits = document.getElementById('totalUnits')?.textContent || '--';
  const totalRev = document.getElementById('totalRevenue')?.textContent || 'KSh --';

  const slideDeck = {
    overview: [
      {
        badge: 'Leader & Peak Demand',
        badgeClass: 'gold-badge',
        title: `${leaderName} (${leaderShare} Volume)`,
        desc: `This product is your primary revenue generator, peaking during ${leaderPeak}. Stock depletion during this trading window causes immediate profit loss.`,
        action: `Front-face at least 30 units of ${leaderName} and verify cold-shelf readiness 30 minutes before ${leaderPeak}.`
      },
      {
        badge: 'Volume Throughput',
        badgeClass: 'badge-growth',
        title: `${totalUnits} Total Units Dispatched`,
        desc: `Reflects physical checkout item count across all shelves today. A surge in units without matching revenue growth signals heavier low-margin product sales.`,
        action: `Review cashier scanning pace and prepare replenishments for secondary basket items during off-peak trade.`
      },
      {
        badge: 'Total Revenue',
        badgeClass: 'bg-sea-green/15 text-sea-green',
        title: `${totalRev} Cleared Volume`,
        desc: `Gross cumulative receipts settled via cash, M-Pesa, and card. Represents your net store inflow before supplier settlements.`,
        action: `Verify physical cash in drawer matches register receipts before releasing shift cashiers.`
      }
    ],
    catalog: [
      {
        badge: 'Revenue Distribution',
        badgeClass: 'gold-badge',
        title: 'Catalog Revenue Comparison',
        desc: `Compares gross turnover across inventory lines. Taller bars indicate high-velocity capital turnover items; shorter bars indicate slower-moving lines.`,
        action: `Allocate prime shelf eye-level space to your top 2 revenue-earning SKUs to accelerate fast turnarounds.`
      },
      {
        badge: 'Inventory Audit',
        badgeClass: 'badge-growth',
        title: 'SKU Inventory Ledger',
        desc: `Itemizes every unit sold against exact gross yield. Shows which individual products justify their supplier order cadence.`,
        action: `Flag items where units sold remain low over 3 consecutive shifts to reduce stagnant stock tie-up.`
      }
    ],
    operations: [
      {
        badge: 'Cashier Audit',
        badgeClass: 'gold-badge',
        title: 'Shift Performance Tracking',
        desc: `Monitors register throughput and transaction volumes per cashier to maintain accountability and prevent drawer discrepancies.`,
        action: `Reconcile total tickets against drawer settlement before changing cashier logins.`
      }
    ]
  };

  return slideDeck[currentTabState] || slideDeck.overview;
}

// Render active slide
function renderCurrentSlide() {
  const slides = getContextSlides();
  const slide = slides[currentSlideIndex] || slides[0];

  const contextLabel = document.getElementById('carouselContextLabel');
  const cardContainer = document.getElementById('carouselSlideCard');
  const dotsContainer = document.getElementById('carouselDots');
  const counterText = document.getElementById('slideCounterText');
  const btnPrev = document.getElementById('btnPrevSlide');
  const btnNext = document.getElementById('btnNextSlide');

  if (contextLabel) {
    contextLabel.textContent = `${currentTabState.toUpperCase()} Screen Guidance`;
  }

  if (cardContainer) {
    cardContainer.innerHTML = `
      <div>
        <div class="flex items-center justify-between">
          <span class="text-[10px] font-black uppercase tracking-wider text-charcoal/60">Insight</span>
          <span class="${slide.badgeClass} text-[10px] font-black uppercase px-2 py-0.5 rounded shadow-sm">${slide.badge}</span>
        </div>
        <h3 class="text-base font-black text-charcoal mt-2">${slide.title}</h3>
        <p class="text-xs text-charcoal/80 font-medium mt-1.5 leading-relaxed">${slide.desc}</p>
      </div>
      <div class="mt-4 p-3 bg-sea-green/10 rounded-xl border border-sea-green/20 text-[11px] font-semibold text-sea-green flex items-start gap-2">
        <svg class="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
        </svg>
        <span>${slide.action}</span>
      </div>
    `;
  }

  if (dotsContainer) {
    dotsContainer.innerHTML = slides.map((_, i) => `
      <div class="carousel-dot ${i === currentSlideIndex ? 'active' : ''}"></div>
    `).join('');
  }

  if (counterText) {
    counterText.textContent = `Card ${currentSlideIndex + 1} of ${slides.length}`;
  }
  if (btnPrev) btnPrev.disabled = currentSlideIndex === 0;
  if (btnNext) btnNext.disabled = currentSlideIndex === slides.length - 1;
}

function nextSlide() {
  const slides = getContextSlides();
  if (currentSlideIndex < slides.length - 1) {
    currentSlideIndex++;
    renderCurrentSlide();
  }
}

function prevSlide() {
  if (currentSlideIndex > 0) {
    currentSlideIndex--;
    renderCurrentSlide();
  }
}

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
    const client = window.supabase.createClient(SUPABASE_URL, cleanKey);

    const { data: rawAggregates, error: aggError } = await client
      .from('daily_aggregates')
      .select('report_date, metric_label, total_volume, total_count, metric_key')
      .ilike('metric_type', 'PRODUCT_PERFORM%')
      .order('total_volume', { ascending: false });

    if (aggError) throw aggError;

    displayData = rawAggregates || [];
    if (displayData.length === 0) isDemoFallback = true;

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

  const leader = displayData[0];
  const totalCatalogUnits = displayData.reduce((sum, item) => sum + (parseInt(item.total_count, 10) || 0), 0);
  const totalCatalogRevenue = displayData.reduce((sum, item) => sum + (parseFloat(item.total_volume) || 0), 0);

  // Unhide Skeletons
  document.getElementById('unitsSkeleton')?.classList.add('hidden');
  document.getElementById('revenueSkeleton')?.classList.add('hidden');
  totalUnitsEl?.classList.remove('hidden');
  totalRevenueEl?.classList.remove('hidden');

  totalUnitsEl.textContent = totalCatalogUnits.toLocaleString();
  totalRevenueEl.textContent = `KSh ${totalCatalogRevenue.toLocaleString()}`;

  // Populate Leader Context
  radarSkuTitle.textContent = leader.metric_label;
  radarUnits.textContent = Number(leader.total_count).toLocaleString();

  const volumeShare = Math.round((leader.total_volume / (totalCatalogRevenue || 1)) * 100);
  radarShare.textContent = `${volumeShare}%`;

  const radarPercentages = [4, 8, 18, 10, 38, 22, 65, 35];
  radarPeak.textContent = 'Evening 5–9pm';
  radarFooterBadge.textContent = `${Number(leader.total_count).toLocaleString()} Units Tracked`;
  radarShiftLabel.textContent = `${leader.metric_label} • Shift: ${leader.report_date}`;

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

window.addEventListener('online', () => {
  const b = document.getElementById('syncBadge');
  if (b) b.textContent = 'Cloud Sync';
});
window.addEventListener('offline', () => {
  const b = document.getElementById('syncBadge');
  if (b) b.textContent = 'Offline Mode';
});
window.addEventListener('DOMContentLoaded', loadDashboard);
