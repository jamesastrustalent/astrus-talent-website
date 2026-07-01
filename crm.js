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

    var res = await window.crmInsert(table, buildPayload());

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
    errEl.innerHTML = 'Something went wrong. Please try again or email ' +
      '<a href="mailto:info@astrustalent.com" style="color:var(--blue)">info@astrustalent.com</a>.';
    return false;
  };
})();
