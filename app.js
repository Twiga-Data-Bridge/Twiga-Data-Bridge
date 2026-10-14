// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch((err) => {
    console.warn('Service Worker registration skipped:', err);
  });
}

// Supabase Configuration
const SUPABASE_URL = 'https://ofyrcyrzdeqacbatpgyk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9meXJjeXJ6ZGVxYWNiYXRwZ3lrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA1MzM2MjAsImV4cCI6MjEwNjEwOTYyMH0.vxtZbc48Wz5X8BI7knJJjPBedfNk0JjJja5VM6ByPSU';

let salesChartInstance = null;

async function loadDashboard() {
  const errorBanner = document.getElementById('errorBanner');
  const topProduct = document.getElementById('topProduct');
  const totalUnits = document.getElementById('totalUnits');
  const totalRevenue = document.getElementById('totalRevenue');
  const reportDate = document.getElementById('reportDate');

  try {
    const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    const { data, error } = await client
      .from('daily_aggregates')
      .select('report_date, metric_label, total_volume, total_count')
      .eq('metric_type', 'PRODUCT_PERFORMANCE')
      .order('total_volume', { ascending: false });

    if (error) throw error;
    if (!data || data.length === 0) {
      reportDate.textContent = 'No Data Logged';
      return;
    }

    // Hide Skeletons and Reveal Actual Metrics
    document.getElementById('topProductSkeleton').classList.add('hidden');
    document.getElementById('unitsSkeleton').classList.add('hidden');
    document.getElementById('revenueSkeleton').classList.add('hidden');

    topProduct.classList.remove('hidden');
    totalUnits.classList.remove('hidden');
    totalRevenue.classList.remove('hidden');

    // Populate Key Performance Indicators
    topProduct.textContent = data[0].metric_label;
    reportDate.textContent = `Shift Date: ${data[0].report_date}`;

    const units = data.reduce((sum, item) => sum + (parseInt(item.total_count, 10) || 0), 0);
    const revenue = data.reduce((sum, item) => sum + (parseFloat(item.total_volume) || 0), 0);

    totalUnits.textContent = units.toLocaleString();
    totalRevenue.textContent = `KSh ${revenue.toLocaleString()}`;

    // Prepare Chart Data
    const labels = data.map((d) => d.metric_label);
    const volumes = data.map((d) => parseFloat(d.total_volume));

    // Top performer receives Metallic Gold accent; others receive Primary Sea Green
    const barColors = data.map((_, index) => (index === 0 ? '#D4AF37' : '#228D57'));

    const canvas = document.getElementById('salesChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    if (salesChartInstance) {
      salesChartInstance.destroy();
    }

    salesChartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          data: volumes,
          backgroundColor: barColors,
          borderRadius: 12,
          borderSkipped: false,
          barThickness: 32
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
            titleFont: { size: 12, weight: 'bold' },
            bodyFont: { size: 13, weight: 'bold' },
            padding: 10,
            cornerRadius: 8,
            callbacks: {
              label: (ctx) => ` Revenue: KSh ${Number(ctx.raw).toLocaleString()}`
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              color: '#3E3E3C',
              font: { size: 11, weight: '600' }
            }
          },
          y: {
            grid: {
              color: 'rgba(62, 62, 60, 0.08)'
            },
            ticks: {
              color: '#3E3E3C',
              font: { size: 11 },
              callback: (val) => 'KSh ' + (val >= 1000 ? (val / 1000) + 'k' : val)
            }
          }
        }
      }
    });

  } catch (err) {
    if (errorBanner) {
      errorBanner.textContent = `Connection Alert: ${err.message || 'Unable to fetch Supabase aggregates.'}`;
      errorBanner.classList.remove('hidden');
    }
    if (reportDate) {
      reportDate.textContent = 'Sync Offline';
    }
  }
}

// Hydrate on initial DOM load
window.addEventListener('DOMContentLoaded', loadDashboard);
