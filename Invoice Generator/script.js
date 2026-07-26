/**
 * InvoicePro — Invoice Generator Application
 * Full-featured invoice creation, preview, PDF export, and dashboard
 */

(function () {
  'use strict';

  /* ============================================
     CONSTANTS & STATE
     ============================================ */
  const STORAGE_KEYS = {
    invoices: 'invoicepro_invoices',
    settings: 'invoicepro_settings',
    theme: 'invoicepro_theme'
  };

  const CURRENCY_SYMBOLS = {
    USD: '$', EUR: '€', GBP: '£', PKR: '₨', INR: '₹', CAD: 'C$', AUD: 'A$'
  };

  let revenueChart = null;
  let statusChart = null;
  let logoDataUrl = '';
  let editingInvoiceId = null;

  /* ============================================
     DOM REFERENCES
     ============================================ */
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  /* ============================================
     INITIALIZATION
     ============================================ */
  document.addEventListener('DOMContentLoaded', init);

  function init() {
    hideLoading();
    initTheme();
    initDates();
    initDefaultItems();
    loadSettings();
    bindEvents();
    updateDashboard();
    updatePreview();
  }

  /** Hide loading overlay after brief animation */
  function hideLoading() {
    setTimeout(() => {
      $('#loading-overlay').classList.add('hidden');
    }, 1200);
  }

  /** Set default invoice and due dates to today and +30 days */
  function initDates() {
    const today = new Date();
    const due = new Date(today);
    due.setDate(due.getDate() + 30);

    $('#invoice-date').value = formatDateInput(today);
    $('#due-date').value = formatDateInput(due);
    $('#invoice-number').value = generateInvoiceNumber();
  }

  /** Add one default line item row */
  function initDefaultItems() {
    addItemRow('', 1, 0);
  }

  /* ============================================
     EVENT BINDINGS
     ============================================ */
  function bindEvents() {
    // Navigation — Landing
    $('#btn-hero-create').addEventListener('click', () => navigateToApp('create'));
    $('#btn-hero-demo').addEventListener('click', loadDemoData);
    $('#btn-create-invoice-nav').addEventListener('click', () => navigateToApp('create'));
    $('#btn-pricing-start').addEventListener('click', () => navigateToApp('create'));

    $$('[data-nav="landing"]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        showLanding();
      });
    });

    // Mobile menu
    $('#mobile-menu-btn').addEventListener('click', () => {
      $('.nav-links').classList.toggle('open');
    });

    // Sidebar navigation
    $$('.nav-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        switchView(item.dataset.view);
        closeSidebar();
      });
    });

    $('#sidebar-toggle').addEventListener('click', () => {
      $('#sidebar').classList.toggle('open');
    });

    $('#sidebar-close').addEventListener('click', closeSidebar);
    $('#quick-create-btn').addEventListener('click', () => switchView('create'));

    // Dark mode toggles
    $('#dark-mode-toggle-landing').addEventListener('click', toggleTheme);
    $('#dark-mode-toggle-app').addEventListener('click', toggleTheme);

    // Logo upload
    $('#logo-upload-area').addEventListener('click', () => $('#logo-upload').click());
    $('#logo-upload').addEventListener('change', handleLogoUpload);

    // Form inputs — live preview
    const previewFields = [
      'company-name', 'company-email', 'company-phone', 'company-address',
      'customer-name', 'customer-email', 'customer-phone', 'customer-address',
      'invoice-number', 'invoice-date', 'due-date', 'currency', 'template',
      'tax-rate', 'discount'
    ];
    previewFields.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('input', updatePreview);
      if (el) el.addEventListener('change', updatePreview);
    });

    // Items
    $('#add-item-btn').addEventListener('click', () => addItemRow());
    $('#items-body').addEventListener('input', handleItemInput);
    $('#items-body').addEventListener('click', handleItemClick);

    // Actions
    $('#save-invoice-btn').addEventListener('click', saveInvoice);
    $('#download-pdf-btn').addEventListener('click', downloadPDF);
    $('#print-invoice-btn').addEventListener('click', printInvoice);

    // History search
    $('#history-search').addEventListener('input', renderHistory);

    // Settings
    $('#save-settings-btn').addEventListener('click', saveSettings);
    $('#clear-data-btn').addEventListener('click', clearAllData);
  }

  /* ============================================
     NAVIGATION
     ============================================ */
  function showLanding() {
    $('#landing-page').classList.add('active');
    $('#app-page').classList.remove('active');
  }

  function navigateToApp(view) {
    $('#landing-page').classList.remove('active');
    $('#app-page').classList.add('active');
    switchView(view || 'create');
    window.scrollTo(0, 0);
  }

  function switchView(view) {
    $$('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.view === view));
    $$('.view').forEach(v => v.classList.remove('active'));
    $(`#view-${view}`).classList.add('active');

    const titles = {
      dashboard: 'Dashboard',
      create: 'Create Invoice',
      history: 'Invoice History',
      customers: 'Customers',
      settings: 'Settings'
    };
    $('#page-title').textContent = titles[view] || 'Dashboard';

    if (view === 'dashboard') updateDashboard();
    if (view === 'history') renderHistory();
    if (view === 'customers') renderCustomers();
  }

  function closeSidebar() {
    $('#sidebar').classList.remove('open');
  }

  /* ============================================
     THEME (DARK MODE)
     ============================================ */
  function initTheme() {
    const saved = localStorage.getItem(STORAGE_KEYS.theme);
    if (saved === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
    updateThemeIcons();
  }

  function toggleTheme() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    document.documentElement.setAttribute('data-theme', isDark ? 'light' : 'dark');
    localStorage.setItem(STORAGE_KEYS.theme, isDark ? 'light' : 'dark');
    updateThemeIcons();
    refreshCharts();
  }

  function updateThemeIcons() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    $$('.icon-sun').forEach(el => el.classList.toggle('hidden', isDark));
    $$('.icon-moon').forEach(el => el.classList.toggle('hidden', !isDark));
  }

  /* ============================================
     LINE ITEMS
     ============================================ */
  function addItemRow(name = '', qty = 1, price = 0) {
    const tbody = $('#items-body');
    const row = document.createElement('tr');
    row.innerHTML = `
      <td><input type="text" class="item-name" placeholder="Item name" value="${escapeHtml(name)}"></td>
      <td><input type="number" class="item-qty" min="1" value="${qty}"></td>
      <td><input type="number" class="item-price" min="0" step="0.01" value="${price}"></td>
      <td class="item-total">${formatMoney(price * qty)}</td>
      <td><button type="button" class="remove-item-btn" title="Remove">&times;</button></td>
    `;
    tbody.appendChild(row);
    updatePreview();
  }

  function handleItemInput(e) {
    const row = e.target.closest('tr');
    if (!row) return;
    recalcRowTotal(row);
    updatePreview();
  }

  function handleItemClick(e) {
    if (e.target.classList.contains('remove-item-btn')) {
      const tbody = $('#items-body');
      if (tbody.children.length <= 1) {
        showToast('At least one item is required', 'error');
        return;
      }
      e.target.closest('tr').remove();
      updatePreview();
    }
  }

  function recalcRowTotal(row) {
    const qty = parseFloat(row.querySelector('.item-qty').value) || 0;
    const price = parseFloat(row.querySelector('.item-price').value) || 0;
    row.querySelector('.item-total').textContent = formatMoney(qty * price);
  }

  /** Collect all line items from the form */
  function getItems() {
    const items = [];
    $$('#items-body tr').forEach(row => {
      items.push({
        name: row.querySelector('.item-name').value.trim(),
        qty: parseFloat(row.querySelector('.item-qty').value) || 0,
        price: parseFloat(row.querySelector('.item-price').value) || 0
      });
    });
    return items;
  }

  /* ============================================
     CALCULATIONS
     ============================================ */
  function calculateTotals() {
    const items = getItems();
    const subtotal = items.reduce((sum, i) => sum + i.qty * i.price, 0);
    const taxRate = parseFloat($('#tax-rate').value) || 0;
    const discount = parseFloat($('#discount').value) || 0;
    const tax = subtotal * (taxRate / 100);
    const total = Math.max(0, subtotal + tax - discount);

    return { subtotal, tax, taxRate, discount, total };
  }

  function getCurrencySymbol() {
    const code = $('#currency').value;
    return CURRENCY_SYMBOLS[code] || '$';
  }

  function formatMoney(amount) {
    const sym = getCurrencySymbol();
    return `${sym}${amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
  }

  /* ============================================
     LIVE PREVIEW
     ============================================ */
  function updatePreview() {
    const sym = getCurrencySymbol();
    const totals = calculateTotals();

    // Company
    setPreviewText('preview-company-name', $('#company-name').value || 'Your Company');
    setPreviewText('preview-company-email', $('#company-email').value);
    setPreviewText('preview-company-phone', $('#company-phone').value);
    setPreviewText('preview-company-address', $('#company-address').value);

    // Logo
    const logoEl = $('#preview-logo');
    if (logoDataUrl) {
      logoEl.src = logoDataUrl;
      logoEl.classList.remove('hidden');
    } else {
      logoEl.classList.add('hidden');
    }

    // Customer
    setPreviewText('preview-customer-name', $('#customer-name').value || 'Customer Name');
    setPreviewText('preview-customer-email', $('#customer-email').value);
    setPreviewText('preview-customer-phone', $('#customer-phone').value);
    setPreviewText('preview-customer-address', $('#customer-address').value);

    // Invoice meta
    setPreviewText('preview-invoice-number', $('#invoice-number').value || 'INV-001');
    setPreviewText('preview-invoice-date', formatDisplayDate($('#invoice-date').value));
    setPreviewText('preview-due-date', formatDisplayDate($('#due-date').value));

    // Template
    const preview = $('#invoice-preview');
    preview.className = 'invoice-preview template-' + ($('#template').value || 'classic');

    // Items
    const itemsBody = $('#preview-items-body');
    itemsBody.innerHTML = '';
    getItems().forEach(item => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${escapeHtml(item.name) || '—'}</td>
        <td>${item.qty}</td>
        <td>${sym}${item.price.toFixed(2)}</td>
        <td>${sym}${(item.qty * item.price).toFixed(2)}</td>
      `;
      itemsBody.appendChild(tr);
    });

    // Summary
    setPreviewText('preview-subtotal', formatMoney(totals.subtotal));
    setPreviewText('preview-tax-rate', totals.taxRate);
    setPreviewText('preview-tax', formatMoney(totals.tax));
    setPreviewText('preview-discount', `-${formatMoney(totals.discount)}`);
    setPreviewText('preview-total', formatMoney(totals.total));
  }

  function setPreviewText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text || '';
  }

  /* ============================================
     LOGO UPLOAD
     ============================================ */
  function handleLogoUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('Please upload an image file', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      logoDataUrl = ev.target.result;
      $('#logo-preview').innerHTML = `<img src="${logoDataUrl}" alt="Logo">`;
      updatePreview();
    };
    reader.readAsDataURL(file);
  }

  /* ============================================
     FORM VALIDATION
     ============================================ */
  function validateForm() {
    let valid = true;
    const required = [
      { id: 'company-name', label: 'Company name' },
      { id: 'company-email', label: 'Company email' },
      { id: 'customer-name', label: 'Customer name' },
      { id: 'invoice-number', label: 'Invoice number' },
      { id: 'invoice-date', label: 'Invoice date' },
      { id: 'due-date', label: 'Due date' }
    ];

    // Clear previous errors
    $$('.error-msg').forEach(el => el.remove());
    $$('.error').forEach(el => el.classList.remove('error'));

    required.forEach(({ id, label }) => {
      const el = document.getElementById(id);
      if (!el.value.trim()) {
        valid = false;
        el.classList.add('error');
        const msg = document.createElement('div');
        msg.className = 'error-msg';
        msg.textContent = `${label} is required`;
        el.parentElement.appendChild(msg);
      }
    });

    // Email validation
    const emailEl = $('#company-email');
    if (emailEl.value && !isValidEmail(emailEl.value)) {
      valid = false;
      emailEl.classList.add('error');
      showToast('Please enter a valid company email', 'error');
    }

    // Items validation
    const items = getItems();
    const hasValidItem = items.some(i => i.name && i.qty > 0);
    if (!hasValidItem) {
      valid = false;
      showToast('Add at least one item with a name and quantity', 'error');
    }

    // Due date after invoice date
    if ($('#invoice-date').value && $('#due-date').value) {
      if (new Date($('#due-date').value) < new Date($('#invoice-date').value)) {
        valid = false;
        $('#due-date').classList.add('error');
        showToast('Due date must be on or after invoice date', 'error');
      }
    }

    return valid;
  }

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  /* ============================================
     COLLECT FORM DATA
     ============================================ */
  function collectFormData() {
    const totals = calculateTotals();
    return {
      id: editingInvoiceId || generateId(),
      company: {
        name: $('#company-name').value.trim(),
        email: $('#company-email').value.trim(),
        phone: $('#company-phone').value.trim(),
        address: $('#company-address').value.trim(),
        logo: logoDataUrl
      },
      customer: {
        name: $('#customer-name').value.trim(),
        email: $('#customer-email').value.trim(),
        phone: $('#customer-phone').value.trim(),
        address: $('#customer-address').value.trim()
      },
      invoiceNumber: $('#invoice-number').value.trim(),
      invoiceDate: $('#invoice-date').value,
      dueDate: $('#due-date').value,
      currency: $('#currency').value,
      template: $('#template').value,
      taxRate: parseFloat($('#tax-rate').value) || 0,
      discount: parseFloat($('#discount').value) || 0,
      items: getItems(),
      ...totals,
      status: 'pending',
      createdAt: new Date().toISOString()
    };
  }

  /* ============================================
     SAVE INVOICE
     ============================================ */
  function saveInvoice() {
    if (!validateForm()) return;

    const data = collectFormData();
    const invoices = getInvoices();

    const existingIdx = invoices.findIndex(i => i.id === data.id);
    if (existingIdx >= 0) {
      invoices[existingIdx] = { ...invoices[existingIdx], ...data };
    } else {
      invoices.unshift(data);
    }

    localStorage.setItem(STORAGE_KEYS.invoices, JSON.stringify(invoices));
    editingInvoiceId = data.id;
    showToast('Invoice saved successfully!', 'success');
    updateDashboard();
  }

  function getInvoices() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.invoices)) || [];
    } catch {
      return [];
    }
  }

  /* ============================================
     PDF DOWNLOAD
     ============================================ */
  async function downloadPDF() {
    if (!validateForm()) return;

    showToast('Generating PDF...', 'success');
    const preview = $('#invoice-preview');

    try {
      const canvas = await html2canvas(preview, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false
      });

      const imgData = canvas.toDataURL('image/png');
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF('p', 'mm', 'a4');

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pdfWidth - 20;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 10;

      pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
      heightLeft -= pdfHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight + 10;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
        heightLeft -= pdfHeight;
      }

      const filename = `${$('#invoice-number').value || 'invoice'}.pdf`;
      pdf.save(filename);
      showToast('PDF downloaded!', 'success');
    } catch (err) {
      console.error(err);
      showToast('Failed to generate PDF', 'error');
    }
  }

  /* ============================================
     PRINT
     ============================================ */
  function printInvoice() {
    if (!validateForm()) return;

    const printArea = $('#print-area');
    printArea.innerHTML = $('#invoice-preview').outerHTML;

    const style = document.createElement('style');
    style.textContent = `
      @media print {
        body * { visibility: hidden !important; }
        #print-area, #print-area * { visibility: visible !important; }
        #print-area { position: absolute; left: 0; top: 0; width: 100%; }
      }
    `;
    document.head.appendChild(style);

    window.print();

    setTimeout(() => {
      printArea.innerHTML = '';
      style.remove();
    }, 1000);
  }

  /* ============================================
     DASHBOARD
     ============================================ */
  function updateDashboard() {
    const invoices = getInvoices();

    const totalRevenue = invoices.reduce((s, i) => s + (i.total || 0), 0);
    const pendingRevenue = invoices
      .filter(i => i.status === 'pending')
      .reduce((s, i) => s + (i.total || 0), 0);

    const customers = new Set(invoices.map(i => i.customer?.name).filter(Boolean));

    $('#stat-invoices').textContent = invoices.length;
    $('#stat-revenue').textContent = formatMoneyStatic(totalRevenue, 'USD');
    $('#stat-pending').textContent = formatMoneyStatic(pendingRevenue, 'USD');
    $('#stat-customers').textContent = customers.size;

    renderRecentInvoices(invoices.slice(0, 5));
    refreshCharts();
  }

  function formatMoneyStatic(amount, currency) {
    const sym = CURRENCY_SYMBOLS[currency] || '$';
    return `${sym}${amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
  }

  function renderRecentInvoices(invoices) {
    const container = $('#recent-invoices-table');
    if (!invoices.length) {
      container.innerHTML = '<p class="empty-state">No invoices yet. Create your first invoice!</p>';
      return;
    }

    container.innerHTML = buildInvoiceTable(invoices, true);
    bindTableActions(container);
  }

  /* ============================================
     INVOICE HISTORY
     ============================================ */
  function renderHistory() {
    const query = ($('#history-search').value || '').toLowerCase();
    let invoices = getInvoices();

    if (query) {
      invoices = invoices.filter(i =>
        (i.invoiceNumber || '').toLowerCase().includes(query) ||
        (i.customer?.name || '').toLowerCase().includes(query) ||
        (i.company?.name || '').toLowerCase().includes(query)
      );
    }

    const container = $('#history-table');
    if (!invoices.length) {
      container.innerHTML = '<p class="empty-state">No invoices found.</p>';
      return;
    }

    container.innerHTML = buildInvoiceTable(invoices, false);
    bindTableActions(container);
  }

  function buildInvoiceTable(invoices, compact) {
    let html = `<table class="data-table"><thead><tr>
      <th>Invoice #</th><th>Customer</th><th>Date</th><th>Amount</th>
      ${compact ? '' : '<th>Status</th>'}
      <th>Actions</th>
    </tr></thead><tbody>`;

    invoices.forEach(inv => {
      const sym = CURRENCY_SYMBOLS[inv.currency] || '$';
      const amount = `${sym}${(inv.total || 0).toFixed(2)}`;
      html += `<tr>
        <td><strong>${escapeHtml(inv.invoiceNumber)}</strong></td>
        <td>${escapeHtml(inv.customer?.name || '—')}</td>
        <td>${formatDisplayDate(inv.invoiceDate)}</td>
        <td>${amount}</td>
        ${compact ? '' : `<td><span class="status-badge status-${inv.status || 'pending'}">${capitalize(inv.status || 'pending')}</span></td>`}
        <td class="table-actions">
          <button data-action="view" data-id="${inv.id}">View</button>
          <button data-action="toggle-status" data-id="${inv.id}">${inv.status === 'paid' ? 'Mark Pending' : 'Mark Paid'}</button>
          <button class="delete-btn" data-action="delete" data-id="${inv.id}">Delete</button>
        </td>
      </tr>`;
    });

    html += '</tbody></table>';
    return html;
  }

  function bindTableActions(container) {
    container.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const action = btn.dataset.action;

        if (action === 'view') loadInvoice(id);
        if (action === 'delete') deleteInvoice(id);
        if (action === 'toggle-status') toggleInvoiceStatus(id);
      });
    });
  }

  function loadInvoice(id) {
    const invoice = getInvoices().find(i => i.id === id);
    if (!invoice) return;

    editingInvoiceId = id;
    navigateToApp('create');

    $('#company-name').value = invoice.company?.name || '';
    $('#company-email').value = invoice.company?.email || '';
    $('#company-phone').value = invoice.company?.phone || '';
    $('#company-address').value = invoice.company?.address || '';
    $('#customer-name').value = invoice.customer?.name || '';
    $('#customer-email').value = invoice.customer?.email || '';
    $('#customer-phone').value = invoice.customer?.phone || '';
    $('#customer-address').value = invoice.customer?.address || '';
    $('#invoice-number').value = invoice.invoiceNumber || '';
    $('#invoice-date').value = invoice.invoiceDate || '';
    $('#due-date').value = invoice.dueDate || '';
    $('#currency').value = invoice.currency || 'USD';
    $('#template').value = invoice.template || 'classic';
    $('#tax-rate').value = invoice.taxRate || 0;
    $('#discount').value = invoice.discount || 0;

    logoDataUrl = invoice.company?.logo || '';
    if (logoDataUrl) {
      $('#logo-preview').innerHTML = `<img src="${logoDataUrl}" alt="Logo">`;
    } else {
      $('#logo-preview').innerHTML = '<span>Click to upload logo</span>';
    }

    // Rebuild items
    $('#items-body').innerHTML = '';
    (invoice.items || []).forEach(item => addItemRow(item.name, item.qty, item.price));
    if (!invoice.items?.length) addItemRow();

    updatePreview();
    showToast('Invoice loaded', 'success');
  }

  function deleteInvoice(id) {
    if (!confirm('Delete this invoice?')) return;
    const invoices = getInvoices().filter(i => i.id !== id);
    localStorage.setItem(STORAGE_KEYS.invoices, JSON.stringify(invoices));
    showToast('Invoice deleted', 'success');
    updateDashboard();
    renderHistory();
  }

  function toggleInvoiceStatus(id) {
    const invoices = getInvoices();
    const inv = invoices.find(i => i.id === id);
    if (!inv) return;
    inv.status = inv.status === 'paid' ? 'pending' : 'paid';
    localStorage.setItem(STORAGE_KEYS.invoices, JSON.stringify(invoices));
    showToast(`Invoice marked as ${inv.status}`, 'success');
    updateDashboard();
    renderHistory();
  }

  /* ============================================
     CUSTOMERS
     ============================================ */
  function renderCustomers() {
    const invoices = getInvoices();
    const customerMap = {};

    invoices.forEach(inv => {
      const name = inv.customer?.name;
      if (!name) return;
      if (!customerMap[name]) {
        customerMap[name] = {
          name,
          email: inv.customer.email || '',
          phone: inv.customer.phone || '',
          invoices: 0,
          total: 0
        };
      }
      customerMap[name].invoices++;
      customerMap[name].total += inv.total || 0;
    });

    const customers = Object.values(customerMap);
    const container = $('#customers-table');

    if (!customers.length) {
      container.innerHTML = '<p class="empty-state">No customers yet.</p>';
      return;
    }

    let html = `<table class="data-table"><thead><tr>
      <th>Name</th><th>Email</th><th>Phone</th><th>Invoices</th><th>Total Spent</th>
    </tr></thead><tbody>`;

    customers.forEach(c => {
      html += `<tr>
        <td><strong>${escapeHtml(c.name)}</strong></td>
        <td>${escapeHtml(c.email) || '—'}</td>
        <td>${escapeHtml(c.phone) || '—'}</td>
        <td>${c.invoices}</td>
        <td>${formatMoneyStatic(c.total, 'USD')}</td>
      </tr>`;
    });

    html += '</tbody></table>';
    container.innerHTML = html;
  }

  /* ============================================
     CHARTS
     ============================================ */
  function refreshCharts() {
    const invoices = getInvoices();
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const gridColor = isDark ? 'rgba(148,163,184,0.15)' : 'rgba(0,0,0,0.06)';
    const textColor = isDark ? '#94A3B8' : '#6B7280';

    // Revenue by month (last 6 months)
    const months = [];
    const revenue = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      months.push(d.toLocaleString('default', { month: 'short' }));
      revenue.push(
        invoices
          .filter(inv => inv.invoiceDate?.startsWith(key))
          .reduce((s, inv) => s + (inv.total || 0), 0)
      );
    }

    if (revenueChart) revenueChart.destroy();
    const revCtx = document.getElementById('revenue-chart');
    if (revCtx) {
      revenueChart = new Chart(revCtx, {
        type: 'bar',
        data: {
          labels: months,
          datasets: [{
            label: 'Revenue',
            data: revenue,
            backgroundColor: 'rgba(37, 99, 235, 0.7)',
            borderRadius: 8,
            borderSkipped: false
          }]
        },
        options: {
          responsive: true,
          plugins: { legend: { display: false } },
          scales: {
            y: { beginAtZero: true, grid: { color: gridColor }, ticks: { color: textColor } },
            x: { grid: { display: false }, ticks: { color: textColor } }
          }
        }
      });
    }

    // Status doughnut
    const paid = invoices.filter(i => i.status === 'paid').length;
    const pending = invoices.length - paid;

    if (statusChart) statusChart.destroy();
    const statusCtx = document.getElementById('status-chart');
    if (statusCtx) {
      statusChart = new Chart(statusCtx, {
        type: 'doughnut',
        data: {
          labels: ['Paid', 'Pending'],
          datasets: [{
            data: [paid, pending],
            backgroundColor: ['#10B981', '#F59E0B'],
            borderWidth: 0
          }]
        },
        options: {
          responsive: true,
          plugins: { legend: { position: 'bottom', labels: { color: textColor, padding: 16 } } },
          cutout: '65%'
        }
      });
    }
  }

  /* ============================================
     SETTINGS
     ============================================ */
  function loadSettings() {
    try {
      const settings = JSON.parse(localStorage.getItem(STORAGE_KEYS.settings));
      if (!settings) return;

      if (settings.company) $('#company-name').value = settings.company;
      if (settings.email) {
        $('#company-email').value = settings.email;
        $('#default-email').value = settings.email;
      }
      if (settings.currency) {
        $('#currency').value = settings.currency;
        $('#default-currency').value = settings.currency;
      }
      if (settings.tax != null) {
        $('#tax-rate').value = settings.tax;
        $('#default-tax').value = settings.tax;
      }
      if (settings.company) $('#default-company').value = settings.company;
    } catch { /* ignore */ }
  }

  function saveSettings() {
    const settings = {
      company: $('#default-company').value.trim(),
      email: $('#default-email').value.trim(),
      currency: $('#default-currency').value,
      tax: parseFloat($('#default-tax').value) || 0
    };

    localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings));

    // Apply to form
    if (settings.company) $('#company-name').value = settings.company;
    if (settings.email) $('#company-email').value = settings.email;
    if (settings.currency) $('#currency').value = settings.currency;
    if (settings.tax != null) $('#tax-rate').value = settings.tax;

    updatePreview();
    showToast('Settings saved!', 'success');
  }

  function clearAllData() {
    if (!confirm('This will delete all invoices and settings. Continue?')) return;
    localStorage.removeItem(STORAGE_KEYS.invoices);
    localStorage.removeItem(STORAGE_KEYS.settings);
    editingInvoiceId = null;
    resetForm();
    updateDashboard();
    renderHistory();
    renderCustomers();
    showToast('All data cleared', 'success');
  }

  /* ============================================
     DEMO DATA
     ============================================ */
  function loadDemoData() {
    navigateToApp('create');

    $('#company-name').value = 'Acme Digital Studio';
    $('#company-email').value = 'billing@acmedigital.com';
    $('#company-phone').value = '+1 (555) 123-4567';
    $('#company-address').value = '742 Evergreen Terrace, Springfield';
    $('#customer-name').value = 'Jane Smith';
    $('#customer-email').value = 'jane@techcorp.io';
    $('#customer-phone').value = '+1 (555) 987-6543';
    $('#customer-address').value = '100 Innovation Drive, San Francisco';
    $('#invoice-number').value = 'INV-2026-042';
    $('#tax-rate').value = 10;
    $('#discount').value = 50;
    $('#template').value = 'modern';

    $('#items-body').innerHTML = '';
    addItemRow('Website Design', 1, 2500);
    addItemRow('Frontend Development', 40, 85);
    addItemRow('SEO Optimization', 1, 600);

    updatePreview();
    showToast('Demo data loaded!', 'success');
  }

  function resetForm() {
    initDates();
    editingInvoiceId = null;
    logoDataUrl = '';
    $('#logo-preview').innerHTML = '<span>Click to upload logo</span>';
    $('#invoice-form').reset();
    loadSettings();
    $('#items-body').innerHTML = '';
    initDefaultItems();
    updatePreview();
  }

  /* ============================================
     UTILITIES
     ============================================ */
  function showToast(message, type = '') {
    const toast = $('#toast');
    toast.textContent = message;
    toast.className = 'toast show' + (type ? ` ${type}` : '');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.classList.remove('show'), 3000);
  }

  function formatDateInput(date) {
    return date.toISOString().split('T')[0];
  }

  function formatDisplayDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  function generateInvoiceNumber() {
    const num = Math.floor(Math.random() * 9000) + 1000;
    return `INV-${num}`;
  }

  function generateId() {
    return 'inv_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

})();
