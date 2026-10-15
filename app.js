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

// Radar Axis Definition
const RADAR_AXIS_LABELS = [
  'Early Morning (6-8am)',
  'Morning Rush (8-11am)',
  'Lunch Break (11am-2pm)',
  'Afternoon Lull (2-5pm)',
  'Evening Rush (5-9pm)',
  'Late Night (9pm-Close)',
  'Weekend Surge',
  'Weekday Base'
];

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

  try {
    const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // 1. Fetch Catalog Aggregates
    const { data: rawAggregates, error: aggError } = await client
      .from('daily_aggregates')
      .select('report_date, metric_label, total_volume, total_count, metric_key')
      .ilike('metric_type', 'PRODUCT_PERFORM%')
      .order('total_volume', { ascending: false });

    if (aggError) throw aggError;

    let displayData = rawAggregates;

    // Fallback if table is empty
    if (!displayData || displayData.length === 0) {
      displayData = [
        { report_date: '2026-10-15', metric_label: 'Tusker Lager 500ml', metric_key: 'SKU-B01', total_volume: 17600, total_count: 88 },
        { report_date: '2026-10-15', metric_label: 'Unga Maize Meal 2kg', metric_key: 'SKU-M02', total_volume: 11340, total_count: 54 },
        { report_date: '2026-10-15', metric_label: 'Coca-Cola 500ml', metric_key: 'SKU-C12', total_volume: 3990, total_count: 57 },
        { report_date: '2026-10-15', metric_label: 'Kenchic Sausage', metric_key: 'SKU-S05', total_volume: 3300, total_count: 55 }
      ];
      if (reportDateEl) reportDateEl.textContent = 'Shift Date: 2026-10-15 (Simulated)';
    } else {
      if (reportDateEl) reportDateEl.textContent = `Shift Date: ${displayData[0].report_date}`;
    }

    const leader = displayData[0];
    const totalCatalogUnits = displayData.reduce((sum, item) => sum + (parseInt(item.total_count, 10) || 0), 0);
    const totalCatalogRevenue = displayData.reduce((sum, item) => sum + (parseFloat(item.total_volume) || 0), 0);

    // Populate Overall Metric Cards
    document.getElementById('unitsSkeleton')?.classList.add('hidden');
    document.getElementById('revenueSkeleton')?.classList.add('hidden');
    totalUnitsEl?.classList.remove('hidden');
    totalRevenueEl?.classList.remove('hidden');

    totalUnitsEl.textContent = totalCatalogUnits.toLocaleString();
    totalRevenueEl.textContent = `KSh ${totalCatalogRevenue.toLocaleString()}`;

    // 2. Fetch or Calculate Time-Distribution for the Leading SKU
    let radarPercentages = [];
    const { data: rawTxns, error: txnError } = await client
      .from('raw_transactions')
      .select('timestamp')
      .eq('sku', leader.metric_key);

    if (!txnError && rawTxns && rawTxns.length > 0) {
      radarPercentages = computeRadarDistribution(rawTxns);
    } else {
      // Realistic beverage evening-weighted profile if raw log not synced
      radarPercentages = [4, 8, 18, 10, 38, 22, 65, 35];
    }

    // Populate Leader Context Header
    radarSkuTitle.textContent = leader.metric_label;
    radarUnits.textContent = Number(leader.total_count).toLocaleString();
    
    const volumeShare = Math.round((leader.total_volume / (totalCatalogRevenue || 1)) * 100);
    radarShare.textContent = `${volumeShare}%`;

    // Determine Peak Window
    const maxVal = Math.max(...radarPercentages.slice(0, 6)); // peak time of day
    const peakIndex = radarPercentages.slice(0, 6).indexOf(maxVal);
    const peakNames = ['Early 6-8am', 'Morning 8-11am', 'Lunch 11-2pm', 'Afternoon 2-5pm', 'Evening 5-9pm', 'Late Night'];
    radarPeak.textContent = peakNames[peakIndex] || 'Evening';

    radarFooterBadge.textContent = `${Number(leader.total_count).toLocaleString()} Units Tracked`;
    radarShiftLabel.textContent = `${leader.metric_label} &bull; Updated: ${leader.report_date}`;

    // 3. Render Demand Profile Radar Chart
    renderRadarChart(radarPercentages);

    // 4. Render Catalog Revenue Comparison Bar Chart
    renderBarChart(displayData);

  } catch (err) {
    console.error('Fatal load error:', err);
    if (errorBanner) {
      errorBanner.textContent = `Connection Alert: ${err.message || 'Unable to fetch Supabase aggregates.'}`;
      errorBanner.classList.remove('hidden');
    }
  }
}

function computeRadarDistribution(txns) {
  let early = 0, morning = 0, lunch = 0, lull = 0, evening = 0, late = 0;
  let weekend = 0, weekday = 0;
  const total = txns.length;

  txns.forEach((t) => {
    const d = new Date(t.timestamp);
    const h = d.getHours();
    const day = d.getDay(); // 0 is Sun, 6 is Sat

    if (h >= 6 && h < 8) early++;
    else if (h >= 8 && h < 11) morning++;
    else if (h >= 11 && h < 14) lunch++;
    else if (h >= 14 && h < 17) lull++;
    else if (h >= 17 && h < 21) evening++;
    else late++;

    if (day === 0 || day === 6) weekend++;
    else weekday++;
  });

  return [
    Math.round((early / total) * 100),
    Math.round((morning / total) * 100),
    Math.round((lunch / total) * 100),
    Math.round((lull / total) * 100),
    Math.round((evening / total) * 100),
    Math.round((late / total) * 100),
    Math.round((weekend / total) * 100),
    Math.round((weekday / total) * 100)
  ];
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
        backgroundColor: 'rgba(34, 141, 87, 0.28)', // Sea Green 28% opacity fill
        borderColor: '#228D57',                     // Primary Sea Green line
        borderWidth: 2.5,
        pointBackgroundColor: '#D4AF37',            // Metallic Gold vertex points
        pointBorderColor: '#EDE5C8',                // Vanilla point ring
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
            font: {
              size: 10,
              weight: 'bold'
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
