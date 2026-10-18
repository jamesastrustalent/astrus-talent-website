/* ==========================================================================
   ASTRUS TALENT — website form submissions -> Recruitment CRM (Supabase)
   Every public form inserts directly into the CRM database so it lands in the
   correct inbox:
     job_applications  (job_id null) -> Talent Pool
     client_inquiries                -> Client Inquiries
     contact_messages                -> Enquiries
     newsletter_subscribers          -> Newsletter

   Writes are trimmed, length-limited and tag-stripped here before insert.
   CV files go to the private "cvs" bucket; job_applications.cv_url stores the
   object path (applications/<id>-<file>), never a public URL.
   ========================================================================== */
(function () {
  var SUPABASE_URL = 'https://ziciunvqtrcuzcudtfcl.supabase.co';
  var SUPABASE_KEY = 'sb_publishable_iHYbQNjd71dqo-Ls-YVirw_EgRKpKpT';
  var CV_NOTE = 'CV is in the CRM (private storage). Open the application in the CRM to download it. There is no public link.';
  var CV_MAX_BYTES = 10 * 1024 * 1024;
  var UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  var CV_MIME = {
    pdf: ['application/pdf'],
    doc: ['application/msword', 'application/vnd.ms-word'],
    docx: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/zip']
  };

  var LIMITS = {
    first_name: 100,
    last_name: 100,
    email: 254,
    phone: 40,
    company_name: 200,
    job_title: 160,
    job_ref: 160,
    enquiry: 6000,
    notes: 6000,
    cover_note: 6000,
    linkedin_url: 500,
    cv_url: 240
  };

  var LABELS = {
    first_name: 'First name',
    last_name: 'Last name',
    email: 'Email address',
    phone: 'Phone number',
    company_name: 'Company',
    job_title: 'Job title',
    job_ref: 'Role',
    enquiry: 'Message',
    notes: 'Message',
    cover_note: 'Cover note',
    linkedin_url: 'LinkedIn URL'
  };

  var FREE_TEXT = {
    first_name: 1, last_name: 1, enquiry: 1, notes: 1, cover_note: 1,
    company_name: 1, job_title: 1, job_ref: 1
  };
  var MULTILINE = { enquiry: 1, notes: 1, cover_note: 1 };

  var _db = null;

  function db() {
    if (!_db && window.supabase) {
      _db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    }
    return _db;
  }

  function fail(message) {
    return { ok: false, error: message, validation: true };
  }

  function stripControls(value, keepNewlines) {
    if (keepNewlines) {
      return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u2028\u2029]/g, '');
    }
    return value.replace(/[\u0000-\u001F\u007F\u2028\u2029]/g, ' ');
  }

  function stripTags(value) {
    var prev;
    var out = value.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '');
    do {
      prev = out;
      out = out.replace(/<[^>]*>/g, '');
    } while (out !== prev);
    return out.replace(/[<>]/g, '');
  }

  function cleanFreeText(value, max, multiline, label) {
    if (value == null) return { ok: true, value: '' };
    if (typeof value !== 'string') return fail(label + ' is not valid.');
    var s = multiline ? value.replace(/\r\n/g, '\n').replace(/\r/g, '\n') : value;
    s = stripTags(stripControls(s, multiline));
    if (multiline) {
      s = s.replace(/[ \t]+\n/g, '\n').replace(/\n{4,}/g, '\n\n\n').trim();
    } else {
      s = s.replace(/\s+/g, ' ').trim();
    }
    if (s.length > max) return fail(label + ' is too long (max ' + max + ' characters).');
    return { ok: true, value: s };
  }

  function validEmail(value) {
    if (typeof value !== 'string') return fail('Please enter a valid email address.');
    var s = stripControls(value, false).trim().toLowerCase();
    if (s.length > LIMITS.email) return fail('Email address is too long (max ' + LIMITS.email + ' characters).');
    if (!s || /[<>\s]/.test(s) || s.indexOf('..') !== -1) return fail('Please enter a valid email address.');
    if (!/^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$/.test(s)) return fail('Please enter a valid email address.');
    return { ok: true, value: s };
  }

  function validPhone(value) {
    if (typeof value !== 'string') return fail('Please enter a valid phone number.');
    var s = stripTags(stripControls(value, false)).replace(/\s+/g, ' ').trim();
    if (!s) return fail('Please enter a phone number.');
    if (s.length > LIMITS.phone) return fail('Phone number is too long (max ' + LIMITS.phone + ' characters).');
    if (s.length < 6 || !/^[0-9+().\-\s]+$/.test(s)) return fail('Please enter a valid phone number.');
    return { ok: true, value: s };
  }

  function validHttpUrl(value) {
    if (typeof value !== 'string') return fail('Please enter a LinkedIn URL starting with http:// or https://.');
    var raw = value.trim();
    if (!raw) return fail('Please enter a LinkedIn URL starting with http:// or https://.');
    if (raw.length > LIMITS.linkedin_url) return fail('LinkedIn URL is too long (max ' + LIMITS.linkedin_url + ' characters).');
    if (/[\u0000-\u001F\u007F\s<>]/.test(raw)) return fail('Please enter a LinkedIn URL starting with http:// or https://.');
    var u;
    try { u = new URL(raw); }
    catch (e) { return fail('Please enter a LinkedIn URL starting with http:// or https://.'); }
    if (u.protocol !== 'http:' && u.protocol !== 'https:') {
      return fail('LinkedIn URL must start with http:// or https://.');
    }
    if (u.username || u.password || !u.hostname) {
      return fail('Please enter a LinkedIn URL starting with http:// or https://.');
    }
    if (u.href.length > LIMITS.linkedin_url) return fail('LinkedIn URL is too long (max ' + LIMITS.linkedin_url + ' characters).');
    return { ok: true, url: u.href };
  }

  function validCvPath(value) {
    if (typeof value !== 'string') return fail('Please attach your CV.');
    if (value.length > LIMITS.cv_url || value.indexOf('..') !== -1 || value.indexOf('\\') !== -1 || value.indexOf('//') !== -1) {
      return fail('Please attach your CV again.');
    }
    var uuidPath = /^applications\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-[A-Za-z0-9_-]{1,48}\.(pdf|doc|docx)$/i;
    var fallbackPath = /^applications\/cv-\d{12,16}-[a-z0-9]{4,16}-[A-Za-z0-9_-]{1,48}\.(pdf|doc|docx)$/i;
    if (!uuidPath.test(value) && !fallbackPath.test(value)) return fail('Please attach your CV again.');
    return { ok: true, value: value };
  }

  function takeText(payload, key, required) {
    if (!Object.prototype.hasOwnProperty.call(payload, key) || payload[key] == null) {
      if (required) return fail('Please enter your ' + LABELS[key].toLowerCase() + '.');
      return { ok: true, value: '' };
    }
    return cleanFreeText(payload[key], LIMITS[key], !!MULTILINE[key], LABELS[key]);
  }

  function putText(out, key, cleaned, required) {
    if (!cleaned.ok) return cleaned;
    if (!cleaned.value) {
      if (required) return fail('Please enter your ' + LABELS[key].toLowerCase() + '.');
      return { ok: true };
    }
    out[key] = cleaned.value;
    return { ok: true };
  }

  function preparePayload(table, payload, options) {
    var src = payload || {};
    var partial = !!(options && options.partial);
    var out = {};
    var step;

    if (table !== 'contact_messages' && table !== 'client_inquiries' && table !== 'job_applications' && table !== 'newsletter_subscribers') {
      return fail('This form could not be submitted.');
    }

    step = putText(out, 'first_name', takeText(src, 'first_name', true), true);
    if (!step.ok) return step;

    step = putText(out, 'last_name', takeText(src, 'last_name', false), false);
    if (!step.ok) return step;

    if (!Object.prototype.hasOwnProperty.call(src, 'email') || typeof src.email !== 'string' || !src.email.trim()) {
      return fail('Please enter your email address.');
    }
    step = validEmail(src.email);
    if (!step.ok) return step;
    out.email = step.value;

    if (!Object.prototype.hasOwnProperty.call(src, 'phone') || typeof src.phone !== 'string') {
      return fail('Please enter a phone number.');
    }
    step = validPhone(src.phone);
    if (!step.ok) return step;
    out.phone = step.value;

    if (table === 'contact_messages') {
      step = putText(out, 'company_name', takeText(src, 'company_name', false), false);
      if (!step.ok) return step;
      step = putText(out, 'enquiry', takeText(src, 'enquiry', true), true);
      if (!step.ok) return step;
      if (src.type !== 'client_enquiry' && src.type !== 'candidate_enquiry' && src.type !== 'assessment_demo') {
        return fail('This form could not be submitted.');
      }
      out.type = src.type;
      if (out.type === 'assessment_demo' && !out.company_name) return fail('Please enter your company.');
      out.status = 'new';
    }

    if (table === 'client_inquiries') {
      step = putText(out, 'company_name', takeText(src, 'company_name', true), true);
      if (!step.ok) return step;
      step = putText(out, 'notes', takeText(src, 'notes', true), true);
      if (!step.ok) return step;
      out.status = 'new';
    }

    if (table === 'job_applications') {
      if (src.job_id == null || src.job_id === '') out.job_id = null;
      else if (typeof src.job_id === 'string' && UUID_RE.test(src.job_id)) out.job_id = src.job_id.toLowerCase();
      else return fail('This role could not be found.');

      step = putText(out, 'job_ref', takeText(src, 'job_ref', false), false);
      if (!step.ok) return step;
      step = putText(out, 'cover_note', takeText(src, 'cover_note', false), false);
      if (!step.ok) return step;

      if (!Object.prototype.hasOwnProperty.call(src, 'linkedin_url') || src.linkedin_url == null || src.linkedin_url === '') {
        return fail('Please enter a LinkedIn URL starting with http:// or https://.');
      }
      step = validHttpUrl(src.linkedin_url);
      if (!step.ok) return step;
      out.linkedin_url = step.url;

      if (Object.prototype.hasOwnProperty.call(src, 'cv_url') && src.cv_url != null && src.cv_url !== '') {
        step = validCvPath(src.cv_url);
        if (!step.ok) return step;
        out.cv_url = step.value;
      } else if (!partial) {
        return fail('Please attach your CV.');
      }
    }

    if (table === 'newsletter_subscribers') {
      step = putText(out, 'company_name', takeText(src, 'company_name', false), false);
      if (!step.ok) return step;
      step = putText(out, 'job_title', takeText(src, 'job_title', false), false);
      if (!step.ok) return step;
      if (!Object.prototype.hasOwnProperty.call(src, 'linkedin_url') || src.linkedin_url == null || src.linkedin_url === '') {
        return fail('Please enter a LinkedIn URL starting with http:// or https://.');
      }
      step = validHttpUrl(src.linkedin_url);
      if (!step.ok) return step;
      out.linkedin_url = step.url;
      if (src.source != null && src.source !== 'website_popup') return fail('This form could not be submitted.');
      out.source = 'website_popup';
    }

    return { ok: true, payload: out };
  }

  function notificationCopy(data) {
    var copy = {};
    var src = data || {};
    Object.keys(src).forEach(function (key) {
      if (key === 'cv_url') return;
      var value = src[key];
      if (value == null || value === '') return;
      if (FREE_TEXT[key] && typeof value === 'string') {
        var max = LIMITS[key] || 500;
        var clipped = value.length > max ? value.slice(0, max) : value;
        var cleaned = cleanFreeText(clipped, max, !!MULTILINE[key], LABELS[key] || 'Field');
        if (cleaned.ok && cleaned.value) copy[key] = cleaned.value;
        return;
      }
      copy[key] = value;
    });
    if (Object.prototype.hasOwnProperty.call(src, 'cv_url')) copy.cv_url = CV_NOTE;
    return copy;
  }

  window.crmPrepare = function (table, payload, options) {
    return preparePayload(table, payload, options || {});
  };

  window.crmHttpUrl = function (value) {
    var result = validHttpUrl(value);
    if (!result.ok) {
      var err = new Error(result.error);
      err.crmValidation = true;
      throw err;
    }
    return result.url;
  };

  /* Email a copy of the submission to info@astrustalent.com via Netlify Forms.
     Fire-and-forget; never blocks or breaks the CRM save. CV fields are a note,
     not a link. */
  if (!window.notifyEmail) {
    window.notifyEmail = function (formName, data) {
      try {
        var body = new URLSearchParams();
        body.append('form-name', formName);
        Object.keys(data || {}).forEach(function (k) {
          if (data[k] != null && data[k] !== '') body.append(k, data[k]);
        });
        return fetch('/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: body.toString()
        }).catch(function () {});
      } catch (e) { return Promise.resolve(); }
    };
  }

  window.crmNotify = function (formName, data) {
    if (window.notifyEmail) return window.notifyEmail(formName, notificationCopy(data));
    return Promise.resolve();
  };

  /* Insert a row into a CRM table. Returns { ok:true } or { ok:false, error }. */
  window.crmInsert = async function (table, payload) {
    try {
      var prepared = preparePayload(table, payload, {});
      if (!prepared.ok) return prepared;
      var client = db();
      if (!client) return { ok: false, error: 'Connection unavailable' };
      /* Anon may insert but cannot read these tables. Do not chain .select():
         that asks PostgREST for INSERT ... RETURNING and fails under the new RLS.
         return=minimal makes the request explicit even if a client default changes. */
      var query = client.from(table).insert(prepared.payload);
      if (query && typeof query.setHeader === 'function') query.setHeader('Prefer', 'return=minimal');
      var res = await query;
      if (res.error) return { ok: false, error: res.error.message };
      return { ok: true };
    } catch (err) {
      return { ok: false, error: (err && err.message) || 'Something went wrong' };
    }
  };

  /* Shared submit handler:
       formEl        - the <form>
       table         - CRM table name
       buildPayload  - () => object of columns
       successMsg    - { title, body } shown in place of the form on success   */
  window.crmSubmit = async function (formEl, table, buildPayload, successMsg, formName) {
    var btn = formEl.querySelector('button[type="submit"], .btn-submit');
    var original = btn ? btn.textContent : '';
    if (btn) { btn.disabled = true; btn.textContent = 'Submitting…'; }

    var res;
    try {
      var payload = await buildPayload();
      var prepared = preparePayload(table, payload, {});
      if (!prepared.ok) throw new Error(prepared.error);
      if (formName) window.crmNotify(formName, prepared.payload);
      res = await window.crmInsert(table, prepared.payload);
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

  function genId() {
    try {
      if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
    } catch (e) {}
    var rand = '';
    try { rand = Math.random().toString(36).slice(2, 10); } catch (e2) { rand = 'xxxx'; }
    return 'cv-' + Date.now() + '-' + rand;
  }

  function sanitisedCvName(originalName, ext) {
    var base = String(originalName || '').replace(/\\/g, '/').split('/').pop();
    var stem = base.replace(/\.[A-Za-z0-9]{1,8}$/, '');
    stem = stem.replace(/[^A-Za-z0-9_-]/g, '_').replace(/_+/g, '_').replace(/^[_-]+|[_-]+$/g, '');
    if (!stem) stem = 'cv';
    if (stem.length > 40) stem = stem.slice(0, 40).replace(/[_-]+$/g, '');
    if (!stem) stem = 'cv';
    return stem + '.' + ext;
  }

  /* Upload a CV into the private "cvs" bucket. Returns { ok:true, path } where
     path is the object key stored in job_applications.cv_url. */
  window.crmUploadCV = async function (file) {
    try {
      if (!file) return { ok: false, error: 'Please attach your CV', validation: true };
      var ext = String(file.name || '').replace(/\\/g, '/').split('/').pop().split('.').pop().toLowerCase();
      if (!CV_MIME[ext]) return { ok: false, error: 'CV must be a PDF, DOC or DOCX', validation: true };
      if (typeof file.size !== 'number' || file.size <= 0) return { ok: false, error: 'CV file is empty', validation: true };
      if (file.size > CV_MAX_BYTES) return { ok: false, error: 'CV is too large (max 10MB)', validation: true };
      var givenType = String(file.type || '').toLowerCase();
      if (givenType && givenType !== 'application/octet-stream' && CV_MIME[ext].indexOf(givenType) < 0) {
        return { ok: false, error: 'CV must be a PDF, DOC or DOCX', validation: true };
      }
      var client = db();
      if (!client) return { ok: false, error: 'Upload unavailable, please try again' };
      var path = 'applications/' + genId() + '-' + sanitisedCvName(file.name, ext);
      var check = validCvPath(path);
      if (!check.ok) return { ok: false, error: 'Could not upload CV' };
      var res = await client.storage.from('cvs').upload(path, file, {
        upsert: false,
        contentType: CV_MIME[ext][0]
      });
      if (res.error) return { ok: false, error: 'Could not upload CV: ' + res.error.message };
      return { ok: true, path: path };
    } catch (e) {
      return { ok: false, error: 'Could not upload CV' };
    }
  };
})();
