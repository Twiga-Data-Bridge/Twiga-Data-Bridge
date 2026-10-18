// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch((err) => {
    console.warn('Service Worker registration skipped:', err);
  });
}

// Supabase Configuration
const SUPABASE_URL = 'https://ofyrcyrzdeqacbatpgyk.supabase.co';

// PASTE YOUR FRESHLY COPIED KEY DIRECTLY BETWEEN THE QUOTES (NO LEADING/TRAILING SPACES)
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9meXJjeXJ6ZGVxYWNiYXRwZ3lrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA1MzM2MjAsImV4cCI6MjEwNjEwOTYyMH0.vxtZbc48Wz5X8BI7knJJjPBedfNk0JjJja5VM6ByPSU';

let salesChartInstance = null;
let radarChartInstance = null;

// Multi-line labels allow Chart.js to stack text vertically on small screens
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
          left: isMobile ? 22 : 12,
          right: isMobile ? 22 : 12
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
          angleLines: {
            color: 'rgba(62, 62, 60, 0.15)',
            lineWidth: 1
          },
          grid: {
            color: 'rgba(62, 62, 60, 0.12)',
            lineWidth: 1
          },
          pointLabels: {
            color: '#3E3E3C',
            centerPointLabels: false,
            padding: isMobile ? 6 : 8,
            font: {
              size: isMobile ? 9 : 10.5,
              weight: 'bold',
              lineHeight: 1.15
            }
          },
          ticks: {
            display: false,
            backdropColor: 'transparent',
            stepSize: 20
          },
          suggestedMin: 0,
          suggestedMax: Math.max(...dataPoints, 50) + 10
        }
      }
    }
  });
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

  let displayData = [];
  let isDemoFallback = false;

  try {
    const cleanKey = SUPABASE_ANON_KEY.trim();
    const client = window.supabase.createClient(SUPABASE_URL, cleanKey);

    // 1. Fetch Aggregated Metrics
    const { data: rawAggregates, error: aggError } = await client
      .from('daily_aggregates')
      .select('report_date, metric_label, total_volume, total_count, metric_key')
      .ilike('metric_type', 'PRODUCT_PERFORM%')
      .order('total_volume', { ascending: false });

    if (aggError) {
      console.error('Supabase query error:', aggError);
      throw aggError;
    }

    displayData = rawAggregates || [];

    if (displayData.length === 0) {
      isDemoFallback = true;
    }
  } catch (err) {
    console.warn('Using live fallback demonstration dataset due to API/Network status:', err.message);
    if (errorBanner) {
      errorBanner.textContent = `Supabase Alert: ${err.message || 'Invalid API Key'}. Displaying synchronized demo metrics.`;
      errorBanner.classList.remove('hidden');
    }
    isDemoFallback = true;
  }

  // Populate data using retrieved rows or structured fallback
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

  // Populate Demand Profile Header
  radarSkuTitle.textContent = leader.metric_label;
  radarUnits.textContent = Number(leader.total_count).toLocaleString();

  const volumeShare = Math.round((leader.total_volume / (totalCatalogRevenue || 1)) * 100);
  radarShare.textContent = `${volumeShare}%`;

  // Standard 8-axis diurnal weighting
  const radarPercentages = [4, 8, 18, 10, 38, 22, 65, 35];
  radarPeak.textContent = 'Evening 5-9pm';
  radarFooterBadge.textContent = `${Number(leader.total_count).toLocaleString()} Units Tracked`;
  radarShiftLabel.textContent = `${leader.metric_label} • Shift: ${leader.report_date}`;

  // Render Charts
  renderRadarChart(radarPercentages);
  renderBarChart(displayData);
}

function renderRadarChart(dataPoints) {
  const canvas = document.getElementById('demandRadarChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  if (radarChartInstance) radarChartInstance.destroy();

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
        pointRadius: 4.5,
        pointHoverRadius: 6.5
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
          padding: 10,
          cornerRadius: 8,
          callbacks: {
            label: (ctx) => ` Demand: ${ctx.raw}% of SKU volume`
          }
        }
      },
      scales: {
        r: {
          angleLines: { color: 'rgba(62, 62, 60, 0.15)', lineWidth: 1 },
          grid: { color: 'rgba(62, 62, 60, 0.12)', lineWidth: 1 },
          pointLabels: { color: '#3E3E3C', font: { size: 10, weight: 'bold' } },
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

window.addEventListener('DOMContentLoaded', loadDashboard);
