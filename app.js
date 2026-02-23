let contacts = [];
let rawData  = [];
let headers  = [];
let currentProvider = 'twilio';
let isSending = false;
let cancelRequested = false;
let stats = { total: 0, sent: 0, error: 0 };

const CK = {
  contacts: 'sms_contacts', rawData: 'sms_rawData', headers: 'sms_headers',
  message: 'sms_message', provider: 'sms_provider',
  creds: 'sms_credentials', options: 'sms_options', fileName: 'sms_fileName',
};

const save  = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch(e){} };
const load  = (k, d=null) => { try { const v = localStorage.getItem(k); return v !== null ? JSON.parse(v) : d; } catch(e){ return d; } };
const clear = () => Object.values(CK).forEach(k => localStorage.removeItem(k));

function saveContactsCache() { save(CK.contacts, contacts); save(CK.rawData, rawData); save(CK.headers, headers); }

function saveCredsCache() {
  const c = {};
  ['cfg_sid','cfg_token','cfg_from','cfg_messaging_sid','cfg_delay']
    .forEach(id => { const el = document.getElementById(id); if (el) c[id] = el.value; });
  save(CK.creds, c);
}

function saveOptionsCache() {
  save(CK.options, {
    batch: document.getElementById('cfg_batch')?.value || '60',
    retry: document.getElementById('cfg_retry')?.value || '2',
    enc:   document.getElementById('cfg_enc')?.value   || 'gsm7',
    delay: document.getElementById('cfg_delay')?.value || '200',
  });
}

function restoreCreds() {
  const c = load(CK.creds, {});
  Object.entries(c).forEach(([id, val]) => { const el = document.getElementById(id); if (el) el.value = val; });
}

function restoreOptions() {
  const o = load(CK.options, {});
  ['cfg_batch','cfg_retry','cfg_enc','cfg_delay'].forEach(id => {
    const key = id.replace('cfg_','');
    if (o[key] && document.getElementById(id)) document.getElementById(id).value = o[key];
  });
}

function bootFromCache() {
  const savedProvider = load(CK.provider, 'twilio');
  const tab = document.querySelector(`.ptab[data-provider="${savedProvider}"]`);
  if (tab) setProvider(savedProvider, tab);
  restoreCreds();
  restoreOptions();

  const savedMsg = load(CK.message, '');
  if (savedMsg) { document.getElementById('msgText').value = savedMsg; updateChars(); }

  const savedContacts = load(CK.contacts, []);
  const savedHeaders  = load(CK.headers,  []);
  const savedFileName = load(CK.fileName, null);

  if (savedContacts.length && savedHeaders.length) {
    contacts = savedContacts;
    rawData  = load(CK.rawData, []);
    headers  = savedHeaders;
    populateMappingSelects();

    const name = savedFileName || 'Archivo en caché';
    document.querySelector('.upload-text').textContent = name;
    document.querySelector('.upload-sub').textContent  = `${contacts.length} contactos`;
    document.querySelector('.upload-icon').innerHTML   = '<i class="fa-solid fa-circle-check" style="color:var(--accent)"></i>';
    document.getElementById('mappingSection').style.display = 'block';

    const fa = document.getElementById('fileAlert');
    fa.textContent = `Restaurado: ${name} · ${contacts.length} contactos`;
    fa.className = 'file-alert show';

    updateStats();
    updateMsgPreview();
    updateContactsBtn();
    showCacheIndicator();
  }
  updateSendSection();
}

function showCacheIndicator() {
  if (document.getElementById('cacheIndicator')) return;
  const el = document.createElement('div');
  el.id = 'cacheIndicator';
  el.innerHTML = '<i class="fa-solid fa-database"></i> Caché activo';
  el.title = 'Datos guardados en tu navegador';
  document.body.appendChild(el);
}

function toggleContacts() {
  const overlay = document.getElementById('contactsOverlay');
  overlay.classList.toggle('open');
  const btn = document.getElementById('btnContacts');
  btn.classList.toggle('active');
  if (overlay.classList.contains('open')) renderTable();
}

function closeContacts(e) {
  if (e.target === document.getElementById('contactsOverlay')) toggleContacts();
}

function updateContactsBtn() {
  const btn = document.getElementById('btnContacts');
  const lbl = document.getElementById('contactsToggleLabel');
  if (contacts.length > 0) {
    lbl.textContent = `${contacts.length} contactos`;
    btn.style.borderColor = 'var(--accent2)';
    btn.style.color = 'var(--accent2)';
  } else {
    lbl.textContent = 'Ver contactos';
    btn.style.borderColor = '';
    btn.style.color = '';
  }
}

function toggleProcessModal() {
  const overlay = document.getElementById('processOverlay');
  overlay.classList.toggle('open');
}

function closeProcessModal(e) {
  if (e.target === document.getElementById('processOverlay')) toggleProcessModal();
}

function updateProcessModal() {
  const remaining = stats.total - stats.sent - stats.error;
  document.getElementById('pstat-total').textContent     = stats.total;
  document.getElementById('pstat-sent').textContent      = stats.sent;
  document.getElementById('pstat-error').textContent     = stats.error;
  document.getElementById('pstat-remaining').textContent = Math.max(0, remaining);

  const pct = stats.total > 0 ? Math.round(((stats.sent + stats.error) / stats.total) * 100) : 0;
  const pctEl = document.getElementById('processPct');
  if (stats.total > 0) {
    pctEl.textContent = pct + '%';
    pctEl.classList.add('show');
  } else {
    pctEl.classList.remove('show');
  }
}

function populateMappingSelects() {
  ['mapPhone','mapName','mapExtra'].forEach(id => {
    const sel = document.getElementById(id);
    const first = sel.options[0].outerHTML;
    sel.innerHTML = first;
    headers.forEach((h, i) => { sel.innerHTML += `<option value="${i}">${h}</option>`; });
  });
  const phoneHints = ['phone','telefono','tel','celular','movil','numero','number','mobile'];
  const nameHints  = ['nombre','name','cliente','contact'];
  headers.forEach((h, i) => {
    const hl = h.toLowerCase();
    if (phoneHints.some(x => hl.includes(x))) document.getElementById('mapPhone').value = i;
    if (nameHints.some(x => hl.includes(x)))  document.getElementById('mapName').value  = i;
  });
}

const fileInput  = document.getElementById('fileInput');
const uploadZone = document.getElementById('uploadZone');

uploadZone.addEventListener('dragover', e => { e.preventDefault(); uploadZone.classList.add('dragover'); });
uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('dragover'));
uploadZone.addEventListener('drop', e => {
  e.preventDefault(); uploadZone.classList.remove('dragover');
  if (e.dataTransfer.files[0]) processFile(e.dataTransfer.files[0]);
});
fileInput.addEventListener('change', e => { if (e.target.files[0]) processFile(e.target.files[0]); });

function processFile(file) {
  const reader = new FileReader();
  reader.onload = e => {
    try {
      if (file.name.endsWith('.csv')) {
        const rows = e.target.result.split('\n').map(r => r.split(',').map(c => c.trim().replace(/^"|"$/g,'')));
        headers = rows[0];
        rawData = rows.slice(1).filter(r => r.some(c => c));
      } else {
        const wb   = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
        const ws   = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
        headers = data[0].map(String);
        rawData = data.slice(1).filter(r => r.some(c => c !== undefined && c !== ''));
      }
      populateMappingSelects();
      save(CK.fileName, file.name);

      document.querySelector('.upload-text').textContent = file.name;
      document.querySelector('.upload-sub').textContent  = `${rawData.length} filas encontradas`;
      document.querySelector('.upload-icon').innerHTML   = '<i class="fa-solid fa-circle-check" style="color:var(--accent)"></i>';
      document.getElementById('mappingSection').style.display = 'block';

      const fa = document.getElementById('fileAlert');
      fa.textContent = `${file.name} · ${rawData.length} filas · ${headers.length} columnas`;
      fa.className = 'file-alert show';
    } catch(err) { console.error('Error al leer:', err.message); }
  };
  if (file.name.endsWith('.csv')) reader.readAsText(file);
  else reader.readAsArrayBuffer(file);
}

function applyMapping() {
  const phoneIdx = document.getElementById('mapPhone').value;
  if (phoneIdx === '') { alert('Selecciona la columna de teléfono'); return; }
  const nameIdx  = document.getElementById('mapName').value;
  const extraIdx = document.getElementById('mapExtra').value;

  contacts = rawData.map((row, i) => {
    let phone = String(row[phoneIdx] || '').replace(/\s+/g,'').trim();
    if (phone && !phone.startsWith('+')) {
      if (phone.startsWith('57') && phone.length >= 11) {
        phone = '+' + phone;
      } else {
        phone = '+57' + phone;
      }
    }
    return {
      id: i,
      phone,
      nombre: nameIdx  !== '' ? String(row[nameIdx]  || '') : '',
      extra:  extraIdx !== '' ? String(row[extraIdx] || '') : '',
      status: 'pending'
    };
  }).filter(c => c.phone.length >= 10);

  saveContactsCache();
  updateStats();
  updateSendSection();
  updateMsgPreview();
  updateContactsBtn();
  showCacheIndicator();

  const overlay = document.getElementById('contactsOverlay');
  if (!overlay.classList.contains('open')) toggleContacts();
}

function renderTable() {
  const container = document.getElementById('previewContainer');
  document.getElementById('previewCount').textContent = contacts.length ? `${contacts.length} contactos` : '';

  if (!contacts.length) {
    container.innerHTML = `<div class="empty-state"><i class="fa-solid fa-inbox" style="font-size:32px;opacity:0.2;display:block;margin-bottom:10px;"></i>Sin contactos válidos</div>`;
    return;
  }

  const template = document.getElementById('msgText').value;
  const rows = contacts.map(c => {
    const cls = {pending:'dot dot-pending',sending:'dot dot-sending',sent:'dot dot-sent',error:'dot dot-error'}[c.status];
    const msg = template ? renderMessage(template, c) : '—';
    return `<tr>
      <td><span class="${cls}"></span>${c.status}</td>
      <td>${c.phone}</td>
      <td>${c.nombre || '—'}</td>
      <td>${c.extra  || '—'}</td>
      <td>${msg}</td>
    </tr>`;
  }).join('');

  container.innerHTML = `
    <table>
      <thead><tr>
        <th>Estado</th><th>Teléfono</th><th>Nombre</th><th>Extra</th><th>Mensaje</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function updateChars() {
  const txt = document.getElementById('msgText').value;
  const len = txt.length;
  const counter = document.getElementById('charCount');
  counter.textContent = `${len}/160`;
  counter.className = 'char-count' + (len > 160 ? ' over' : len > 130 ? ' warn' : '');
  document.getElementById('stat-chars').textContent = len;
  save(CK.message, txt);
  updateMsgPreview();
  updateSendSection();
}

function renderMessage(template, c) {
  return template
    .replace(/\{\{nombre\}\}/gi,   c.nombre || '')
    .replace(/\{\{telefono\}\}/gi, c.phone  || '')
    .replace(/\{\{extra\}\}/gi,    c.extra  || '');
}

function updateMsgPreview() {
  const tpl     = document.getElementById('msgText').value;
  const preview = document.getElementById('msgPreview');
  if (!tpl) { preview.innerHTML = '<span class="muted">El mensaje aparecerá aquí...</span>'; return; }
  preview.textContent = contacts[0] ? renderMessage(tpl, contacts[0]) : tpl;
  contacts.forEach(c => { c.renderedMsg = renderMessage(tpl, c); });
}

function insertVar(v) {
  const ta = document.getElementById('msgText');
  const s = ta.selectionStart, e = ta.selectionEnd;
  ta.value = ta.value.slice(0,s) + v + ta.value.slice(e);
  ta.selectionStart = ta.selectionEnd = s + v.length;
  ta.focus(); updateChars();
}

const providerConfigs = {
  twilio: `
    <div class="field"><label>Account SID</label>
      <input type="text" id="cfg_sid" placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" oninput="saveCredsCache()">
    </div>
    <div class="field"><label>Auth Token</label>
      <input type="text" id="cfg_token" placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" oninput="saveCredsCache()">
    </div>
    <div style="margin:2px 1%;font-size:10px;color:var(--muted);font-family:'Space Mono',monospace;">
      REMITENTE — elige uno de los dos:
    </div>
    <div class="field"><label><i class="fa-solid fa-phone"></i> Número remitente <span style="color:var(--muted)">(cuentas de pago)</span></label>
      <input type="text" id="cfg_from" placeholder="+15551234567  (deja vacío si usas Messaging Service)" oninput="saveCredsCache(); toggleTwilioSender()">
    </div>
    <div class="field"><label><i class="fa-solid fa-envelope"></i> Messaging Service SID <span style="color:var(--accent)" title="Recomendado para cuentas Trial">★ recomendado Trial</span></label>
      <input type="text" id="cfg_messaging_sid" placeholder="MGxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" oninput="saveCredsCache(); toggleTwilioSender()">
    </div>
    <div id="twilio_sender_hint" style="font-size:10px;padding:6px 10px;border-radius:7px;margin:0 1% 2px;background:rgba(0,229,160,0.07);border:1px solid rgba(0,229,160,0.18);color:var(--accent);font-family:'Space Mono',monospace;display:none;"></div>
    <div class="field"><label>Delay entre envíos (ms)</label>
      <input type="text" id="cfg_delay" value="200" oninput="saveOptionsCache()">
    </div>`,

  whatsapp: `
    <div class="field"><label>Account SID</label>
      <input type="text" id="cfg_sid" placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" oninput="saveCredsCache()">
    </div>
    <div class="field"><label>Auth Token</label>
      <input type="text" id="cfg_token" placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" oninput="saveCredsCache()">
    </div>
    <div class="field"><label><i class="fa-brands fa-whatsapp"></i> Número WhatsApp remitente</label>
      <input type="text" id="cfg_from" placeholder="+14155238886 (sandbox) o tu número aprobado" oninput="saveCredsCache()">
    </div>
    <div class="field"><label>Messaging Service SID <span style="color:var(--muted)">(opcional)</span></label>
      <input type="text" id="cfg_messaging_sid" placeholder="MGxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" oninput="saveCredsCache()">
    </div>
    <div style="font-size:10px;padding:8px 10px;border-radius:7px;margin:0 1% 4px;background:rgba(37,211,102,0.07);border:1px solid rgba(37,211,102,0.2);color:#25d366;font-family:'Space Mono',monospace;">
      <i class="fa-brands fa-whatsapp"></i> Los números de destino deben estar en formato <b>whatsapp:+57XXXXXXXXXX</b>.<br>
      Sandbox Twilio: únete enviando el código al +14155238886 antes del primer envío.
    </div>
    <div class="field"><label>Delay entre envíos (ms)</label>
      <input type="text" id="cfg_delay" value="500" oninput="saveOptionsCache()">
    </div>`,

  demo: `<div style="padding:20px;text-align:center;color:var(--muted);font-size:12px;">
    <i class="fa-solid fa-flask" style="font-size:28px;color:var(--warn);display:block;margin-bottom:10px;"></i>
    Modo demo activo<br>Envíos simulados, sin credenciales.</div>`
};

function toggleTwilioSender() {
  const from = document.getElementById('cfg_from')?.value?.trim();
  const msid = document.getElementById('cfg_messaging_sid')?.value?.trim();
  const hint = document.getElementById('twilio_sender_hint');
  if (!hint) return;
  if (msid) {
    hint.style.display = 'block';
    hint.innerHTML = '✅ Usando <b>Messaging Service SID</b> como remitente';
  } else if (from) {
    hint.style.display = 'block';
    hint.innerHTML = '✅ Usando <b>número directo</b> como remitente';
  } else {
    hint.style.display = 'none';
  }
}

function setProvider(p, el) {
  currentProvider = p;
  document.querySelectorAll('.ptab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('providerConfig').innerHTML = providerConfigs[p];
  document.getElementById('demo-note').style.display = p === 'demo' ? 'flex' : 'none';
  restoreCreds();
  restoreOptions();
  if (p === 'twilio') toggleTwilioSender();
  save(CK.provider, p);
}

document.addEventListener('change', e => {
  if (['cfg_retry','cfg_enc','cfg_batch'].includes(e.target.id)) saveOptionsCache();
});

function updateStats() {
  document.getElementById('stat-total').textContent = contacts.length;
  document.getElementById('stat-sent').textContent  = stats.sent;
  document.getElementById('stat-error').textContent = stats.error;
  updateProcessModal();
}

function updateSendSection() {
  const hasCont = contacts.length > 0;
  const hasMsg  = document.getElementById('msgText').value.trim().length > 0;
  document.getElementById('btnSend').disabled = !hasCont || !hasMsg || isSending;
  document.getElementById('sendSummary').textContent =
    hasCont ? `${contacts.length} destinatarios listos` : 'Sin contactos cargados';
  document.getElementById('sendSubtitle').textContent =
    hasMsg  ? `"${document.getElementById('msgText').value.slice(0,60)}..."` : 'Redacta el mensaje para comenzar';
}

async function startSending() {
  if (isSending || !contacts.length) return;
  const template = document.getElementById('msgText').value.trim();
  if (!template) { alert('Escribe un mensaje primero'); return; }
  if (currentProvider !== 'demo') {
    const channel = currentProvider === 'whatsapp' ? 'WhatsApp' : 'SMS';
    if (!confirm(`¿Enviar ${channel} a ${contacts.length} contactos?\nEsto usará tu proveedor real.`)) return;
  }

  isSending = true; cancelRequested = false;
  stats = { total: contacts.length, sent: 0, error: 0 };
  updateStats();
  document.getElementById('btnSend').disabled = true;
  document.getElementById('btnCancel').style.display = 'flex';
  document.getElementById('logWrap').innerHTML = '';
  document.getElementById('progressBar').style.width = '0%';

  const btnProc = document.getElementById('btnProcess');
  btnProc.classList.add('visible', 'sending');
  updateProcessModal();

  const delay = parseInt(document.getElementById('cfg_delay')?.value || '200');

  for (let i = 0; i < contacts.length; i++) {
    if (cancelRequested) {
      addLog('info', `--- Cancelado · ${stats.sent} enviados · ${contacts.length - i} pendientes ---`);
      break;
    }

    const c = contacts[i];
    c.status = 'sending';
    c.renderedMsg = renderMessage(template, c);

    const pct = Math.round((i / contacts.length) * 100);
    document.getElementById('progressBar').style.width = pct + '%';
    document.getElementById('progressText').textContent = `Enviando ${i+1} de ${contacts.length} · ${pct}%`;

    try {
      const r = await sendMessage(c.phone, c.renderedMsg);
      if (r.success) { c.status = 'sent';  stats.sent++;  addLog('ok',  `[OK]  ${c.phone} · ${c.nombre||'sin nombre'}`); }
      else           { c.status = 'error'; stats.error++; addLog('err', `[ERR] ${c.phone} · ${r.error}`); }
    } catch(e) { c.status = 'error'; stats.error++; addLog('err', `[ERR] ${c.phone} · ${e.message}`); }

    updateStats();
    saveContactsCache();
    if (i < contacts.length - 1) await sleep(delay);
  }

  if (!cancelRequested) {
    document.getElementById('progressBar').style.width = '100%';
    addLog('info', `--- Campaña finalizada: ${stats.sent} ok, ${stats.error} errores ---`);
  }
  document.getElementById('progressText').textContent =
    `${cancelRequested ? 'Cancelado' : 'Completado'} · ${stats.sent} enviados · ${stats.error} fallidos`;

  isSending = false; cancelRequested = false;
  document.getElementById('btnSend').disabled = false;
  document.getElementById('btnCancel').style.display = 'none';
  document.getElementById('btnExport').style.display = 'flex';
  document.getElementById('btnProcess').classList.remove('sending');
  updateProcessModal();

  if (document.getElementById('contactsOverlay').classList.contains('open')) renderTable();
}

async function cancelSending() {
  cancelRequested = true;
  document.getElementById('btnCancel').style.display = 'none';
  document.getElementById('progressText').textContent = 'Cancelando...';
}

async function sendMessage(phone, message) {
  if (currentProvider === 'demo') {
    await sleep(Math.random() * 300 + 100);
    if (Math.random() < 0.05) return { success: false, error: 'Error simulado' };
    return { success: true };
  }

  const sid  = document.getElementById('cfg_sid')?.value?.trim();
  const tok  = document.getElementById('cfg_token')?.value?.trim();
  const msid = document.getElementById('cfg_messaging_sid')?.value?.trim();
  const frm  = document.getElementById('cfg_from')?.value?.trim();

  if (!sid || !tok) throw new Error('Completa Account SID y Auth Token');

  const isWhatsApp = currentProvider === 'whatsapp';

  let toNumber = phone;
  let fromNumber = frm;

  if (isWhatsApp) {
    toNumber   = phone.startsWith('whatsapp:') ? phone : `whatsapp:${phone}`;
    fromNumber = frm.startsWith('whatsapp:')   ? frm   : `whatsapp:${frm}`;
    if (!frm) throw new Error('Configura el número remitente de WhatsApp');
  } else {
    if (!msid && !frm) throw new Error('Configura un Número remitente o un Messaging Service SID');
  }

  const body = new URLSearchParams({ To: toNumber, Body: message });

  if (isWhatsApp) {
    if (msid) body.append('MessagingServiceSid', msid);
    else      body.append('From', fromNumber);
  } else {
    if (msid) body.append('MessagingServiceSid', msid);
    else      body.append('From', fromNumber);
  }

  const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + btoa(sid + ':' + tok),
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body
  });

  const d = await r.json();
  if (!r.ok) return { success: false, error: d.message || `Error Twilio ${r.status}` };
  return { success: true };
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function addLog(type, text) {
  const log  = document.getElementById('logWrap');
  const line = document.createElement('div');
  line.className   = 'log-' + type;
  line.textContent = `[${new Date().toLocaleTimeString()}] ${text}`;
  log.appendChild(line);
  log.scrollTop = log.scrollHeight;
}

function exportReport() {
  const rows = [['Teléfono','Nombre','Extra','Estado','Mensaje']];
  contacts.forEach(c => rows.push([c.phone, c.nombre, c.extra, c.status, c.renderedMsg||'']));
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Reporte SMS');
  XLSX.writeFile(wb, `reporte_sms_${Date.now()}.xlsx`);
}

function resetAll() {
  if (!confirm('¿Borrar todos los datos y limpiar el caché?')) return;
  contacts = []; rawData = []; headers = [];
  isSending = false; cancelRequested = false;
  stats = { total:0, sent:0, error:0 };
  clear();

  updateStats();
  document.getElementById('mappingSection').style.display = 'none';
  document.getElementById('fileAlert').className = 'file-alert';
  document.getElementById('progressWrap').style.display = 'none';
  document.getElementById('logWrap').style.display = 'none';
  document.getElementById('logWrap').innerHTML = '';
  document.getElementById('msgText').value = '';
  document.getElementById('charCount').textContent = '0/160';
  document.getElementById('msgPreview').innerHTML = '<span class="muted">El mensaje aparecerá aquí...</span>';
  document.getElementById('btnExport').style.display = 'none';
  document.getElementById('btnCancel').style.display = 'none';
  document.getElementById('progressBar').style.width = '0%';
  document.getElementById('btnProcess').classList.remove('sending');
  document.getElementById('processPct').classList.remove('show');
  document.getElementById('processOverlay').classList.remove('open');
  document.getElementById('progressText').textContent = 'Esperando inicio...';
  document.getElementById('progressBar').style.width = '0%';
  document.getElementById('pstat-total').textContent = '0';
  document.getElementById('pstat-sent').textContent  = '0';
  document.getElementById('pstat-error').textContent = '0';
  document.getElementById('pstat-remaining').textContent = '0';
  document.querySelector('.upload-text').textContent = 'Arrastra tu archivo aquí';
  document.querySelector('.upload-sub').textContent  = 'o haz clic · .xlsx .xls .csv';
  document.querySelector('.upload-icon').innerHTML   = '<i class="fa-solid fa-file-arrow-up"></i>';
  document.getElementById('cacheIndicator')?.remove();

  const overlay = document.getElementById('contactsOverlay');
  overlay.classList.remove('open');
  document.getElementById('btnContacts').classList.remove('active');

  fileInput.value = '';
  updateContactsBtn();
  updateSendSection();
}

bootFromCache();