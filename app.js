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

    // Fetch using wildcard match to handle PRODUCT_PERFORMANCE or PRODUCT_PERFORMA
    const { data: rawData, error } = await client
      .from('daily_aggregates')
      .select('report_date, metric_label, total_volume, total_count, metric_type')
      .ilike('metric_type', 'PRODUCT_PERFORM%')
      .order('total_volume', { ascending: false });

    console.log('Supabase Query Response:', { rawData, error });

    if (error) throw error;

    let displayData = rawData;

    // Graceful fallback if database table is currently empty
    if (!displayData || displayData.length === 0) {
      console.warn('No records returned from Supabase. Activating mock demonstration data.');
      displayData = [
        { report_date: '2026-10-15', metric_label: 'Tusker Lager 500ml', total_volume: 17600, total_count: 88 },
        { report_date: '2026-10-15', metric_label: 'Unga Maize Meal 2kg', total_volume: 11340, total_count: 54 },
        { report_date: '2026-10-15', metric_label: 'Coca-Cola 500ml', total_volume: 3990, total_count: 57 },
        { report_date: '2026-10-15', metric_label: 'Kenchic Sausage', total_volume: 3300, total_count: 55 }
      ];
      if (reportDate) reportDate.textContent = 'Shift Date: 2026-10-15 (Simulated)';
    } else {
      if (reportDate) reportDate.textContent = `Shift Date: ${displayData[0].report_date}`;
    }

    // Unhide metric fields and remove skeletons
    document.getElementById('topProductSkeleton')?.classList.add('hidden');
    document.getElementById('unitsSkeleton')?.classList.add('hidden');
    document.getElementById('revenueSkeleton')?.classList.add('hidden');

    topProduct?.classList.remove('hidden');
    totalUnits?.classList.remove('hidden');
    totalRevenue?.classList.remove('hidden');

    // Populate Key Performance Indicators
    topProduct.textContent = displayData[0].metric_label;

    const units = displayData.reduce((sum, item) => sum + (parseInt(item.total_count, 10) || 0), 0);
    const revenue = displayData.reduce((sum, item) => sum + (parseFloat(item.total_volume) || 0), 0);

    totalUnits.textContent = units.toLocaleString();
    totalRevenue.textContent = `KSh ${revenue.toLocaleString()}`;

    // Render 12px Rounded Bar Chart
    const labels = displayData.map((d) => d.metric_label);
    const volumes = displayData.map((d) => parseFloat(d.total_volume));

    // Metallic Gold for #1 SKU, Primary Sea Green for remaining
    const barColors = displayData.map((_, index) => (index === 0 ? '#D4AF37' : '#228D57'));

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
    console.error('Fatal load error:', err);
    if (errorBanner) {
      errorBanner.textContent = `Connection Alert: ${err.message || 'Unable to fetch Supabase aggregates.'}`;
      errorBanner.classList.remove('hidden');
    }
  }
}

window.addEventListener('DOMContentLoaded', loadDashboard);
