/* ==========================================================================
   ASTRUS TALENT — website form submissions -> Recruitment CRM (Supabase)
   Every public form inserts directly into the CRM database so it lands in the
   correct inbox:
     job_applications  (job_id null) -> Talent Pool
     client_inquiries                -> Client Inquiries
     contact_messages                -> Enquiries
     newsletter_subscribers          -> Newsletter
   ========================================================================== */
(function () {
  var SUPABASE_URL = 'https://ziciunvqtrcuzcudtfcl.supabase.co';
  var SUPABASE_KEY = 'sb_publishable_iHYbQNjd71dqo-Ls-YVirw_EgRKpKpT';
  var _db = null;

  function db() {
    if (!_db && window.supabase) {
      _db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    }
    return _db;
  }

  /* Insert a row into a CRM table. Returns { ok:true } or { ok:false, error }. */
  window.crmInsert = async function (table, payload) {
    try {
      var client = db();
      if (!client) return { ok: false, error: 'Connection unavailable' };
      var res = await client.from(table).insert(payload);
      if (res.error) return { ok: false, error: res.error.message };
      return { ok: true };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  };

  /* Shared submit handler:
       formEl        - the <form>
       table         - CRM table name
       buildPayload  - () => object of columns
       successMsg    - { title, body } shown in place of the form on success   */
  window.crmSubmit = async function (formEl, table, buildPayload, successMsg) {
    var btn = formEl.querySelector('button[type="submit"], .btn-submit');
    var original = btn ? btn.textContent : '';
    if (btn) { btn.disabled = true; btn.textContent = 'Submitting…'; }

    var res;
    try {
      var payload = await buildPayload();
      res = await window.crmInsert(table, payload);
    } catch (err) {
      res = { ok: false, error: (err && err.message) || 'Something went wrong' };
    }

    if (res.ok) {
      var card = formEl.closest('.form-card') || formEl;
      card.innerHTML =
        '<div style="text-align:center;padding:24px 8px;">' +
        '<div style="width:56px;height:56px;border-radius:50%;background:var(--blue-dim);display:flex;align-items:center;justify-content:center;margin:0 auto 18px;">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="var(--blue)" stroke-width="2.2" style="width:26px;height:26px;"><path d="M20 6 9 17l-5-5"/></svg></div>' +
        '<h3 style="color:var(--text);font-size:22px;margin-bottom:10px;font-family:\'Space Grotesk\',sans-serif;">' + successMsg.title + '</h3>' +
        '<p style="color:var(--muted);line-height:1.7;max-width:420px;margin:0 auto;">' + successMsg.body + '</p></div>';
      return false;
    }

    if (btn) { btn.disabled = false; btn.textContent = original; }
    var errId = table + '-crm-error';
    var errEl = document.getElementById(errId);
    if (!errEl) {
      errEl = document.createElement('div');
      errEl.id = errId;
      errEl.className = 'privacy-note';
      errEl.style.color = '#ff6b6b';
      errEl.style.marginTop = '12px';
      if (btn) btn.parentNode.insertBefore(errEl, btn.nextSibling);
      else formEl.appendChild(errEl);
    }
    errEl.innerHTML = '';
    errEl.appendChild(document.createTextNode((res.error || 'Something went wrong') + '. '));
    errEl.insertAdjacentHTML('beforeend', 'Please try again or email <a href="mailto:info@astrustalent.com" style="color:var(--blue)">info@astrustalent.com</a>.');
    return false;
  };

  /* Upload a CV file to the public "cvs" bucket; returns { ok, url }. */
  function genId() {
    try { return crypto.randomUUID(); }
    catch (e) { return 'cv-' + Date.now() + '-' + Math.round(Math.random() * 1e9).toString(36); }
  }
  window.crmUploadCV = async function (file) {
    try {
      if (!file) return { ok: false, error: 'Please attach your CV' };
      var ext = (file.name.split('.').pop() || '').toLowerCase();
      if (['pdf', 'doc', 'docx'].indexOf(ext) < 0) return { ok: false, error: 'CV must be a PDF, DOC or DOCX' };
      if (file.size > 8 * 1024 * 1024) return { ok: false, error: 'CV is too large (max 8MB)' };
      var client = db();
      if (!client) return { ok: false, error: 'Upload unavailable, please try again' };
      var safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-60);
      var name = genId() + '-' + safe;
      var res = await client.storage.from('cvs').upload(name, file, { upsert: false, contentType: file.type || undefined });
      if (res.error) return { ok: false, error: 'Could not upload CV: ' + res.error.message };
      var pub = client.storage.from('cvs').getPublicUrl(name);
      return { ok: true, url: pub.data.publicUrl };
    } catch (e) {
      return { ok: false, error: 'Could not upload CV' };
    }
  };
})();
