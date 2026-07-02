/* ==========================================================================
   ASTRUS TALENT — newsletter pop-up
   Self-contained: injects its own styles + modal, loads Supabase if needed,
   writes subscribers to the CRM (newsletter_subscribers). Shows once per
   visitor (localStorage) a few seconds after landing; dismiss = won't nag.
   Include on any page with:  <script src="newsletter.js"></script>
   ========================================================================== */
(function () {
  var SUPABASE_URL = 'https://ziciunvqtrcuzcudtfcl.supabase.co';
  var SUPABASE_KEY = 'sb_publishable_iHYbQNjd71dqo-Ls-YVirw_EgRKpKpT';
  var STORAGE_KEY = 'astrus_nl_v1';
  var SHOW_DELAY = 6000; // ms after page load

  function seen() { try { return localStorage.getItem(STORAGE_KEY); } catch (e) { return null; } }
  function mark(v) { try { localStorage.setItem(STORAGE_KEY, v); } catch (e) {} }

  /* Email copy via Netlify Forms (shared with crm.js; defined here too since the
     pop-up runs on every page, including ones without crm.js). */
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

  /* ---- Supabase insert (reuse crm.js if present, else self-load) ---- */
  function ensureSupabase() {
    return new Promise(function (resolve) {
      if (window.supabase) return resolve();
      var s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
      s.onload = resolve; s.onerror = resolve;
      document.head.appendChild(s);
    });
  }
  var _client = null;
  async function subscribe(payload) {
    if (window.crmInsert) return window.crmInsert('newsletter_subscribers', payload);
    await ensureSupabase();
    if (!window.supabase) return { ok: false, error: 'offline' };
    if (!_client) _client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    var res = await _client.from('newsletter_subscribers').insert(payload);
    return res.error ? { ok: false, error: res.error.message } : { ok: true };
  }

  /* ---- Styles ---- */
  var css = `
  .anl-overlay{position:fixed;inset:0;z-index:1000;display:flex;align-items:center;justify-content:center;
    background:rgba(6,8,11,.72);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);
    padding:20px;opacity:0;transition:opacity .25s ease;font-family:'Inter',sans-serif;}
  .anl-overlay.open{opacity:1;}
  .anl-card{position:relative;width:100%;max-width:460px;background:#171a21;border:1px solid #272c35;
    border-radius:16px;padding:34px 34px 30px;box-shadow:0 24px 60px rgba(0,0,0,.5);
    transform:translateY(12px);transition:transform .25s ease;max-height:92vh;overflow-y:auto;}
  .anl-overlay.open .anl-card{transform:translateY(0);}
  .anl-close{position:absolute;top:14px;right:14px;width:30px;height:30px;border:none;cursor:pointer;
    background:rgba(255,255,255,.06);color:#96a3b8;border-radius:8px;font-size:18px;line-height:1;}
  .anl-close:hover{background:rgba(255,255,255,.12);color:#e7ebef;}
  .anl-icon{width:46px;height:46px;border-radius:11px;background:rgba(26,140,255,.12);
    display:flex;align-items:center;justify-content:center;margin-bottom:16px;}
  .anl-icon svg{width:24px;height:24px;stroke:#1a8cff;}
  .anl-title{font-family:'Space Grotesk',sans-serif;font-size:22px;font-weight:700;color:#e7ebef;
    letter-spacing:-.4px;margin:0 0 8px;}
  .anl-sub{font-size:14px;color:#96a3b8;line-height:1.6;margin:0 0 20px;}
  .anl-row{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
  .anl-field{margin-bottom:12px;}
  .anl-label{display:block;font-size:12px;font-weight:600;color:#96a3b8;margin-bottom:6px;}
  .anl-input{width:100%;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);
    border-radius:8px;color:#e7ebef;font-family:inherit;font-size:14px;padding:11px 13px;outline:none;
    transition:border-color .15s,box-shadow .15s;}
  .anl-input:focus{border-color:#1a8cff;box-shadow:0 0 0 3px rgba(26,140,255,.12);}
  .anl-input::placeholder{color:rgba(123,137,157,.6);}
  .anl-phone{display:flex;gap:8px;}
  .anl-phone .anl-code{flex:0 0 104px;} .anl-phone .anl-num{flex:1;min-width:0;}
  .anl-input:-webkit-autofill,.anl-input:-webkit-autofill:hover,.anl-input:-webkit-autofill:focus{
    -webkit-text-fill-color:#e7ebef !important;-webkit-box-shadow:0 0 0 1000px #20232a inset !important;
    box-shadow:0 0 0 1000px #20232a inset !important;caret-color:#e7ebef;transition:background-color 9999s ease-in-out 0s;}
  .anl-btn{width:100%;background:#1a8cff;color:#fff;font-family:inherit;font-weight:600;font-size:15px;
    padding:13px;border:none;border-radius:9px;cursor:pointer;margin-top:6px;display:flex;
    align-items:center;justify-content:center;gap:8px;transition:background .2s;}
  .anl-btn:hover{background:#1578e0;} .anl-btn:disabled{opacity:.7;cursor:default;}
  .anl-note{font-size:11px;color:#96a3b8;text-align:center;margin-top:12px;opacity:.8;}
  .anl-err{font-size:12px;color:#ff6b6b;margin-top:10px;text-align:center;}
  .anl-success{text-align:center;padding:14px 4px;}
  .anl-success .anl-icon{margin:0 auto 16px;background:rgba(37,211,102,.12);}
  .anl-success .anl-icon svg{stroke:#25d366;}
  @media(max-width:520px){.anl-row{grid-template-columns:1fr;}.anl-card{padding:28px 22px 24px;}}
  `;

  var html = `
  <div class="anl-card" role="dialog" aria-modal="true" aria-label="Subscribe to Astrus Talent updates">
    <button class="anl-close" aria-label="Close">&times;</button>
    <div class="anl-body">
      <div class="anl-icon"><svg viewBox="0 0 24 24" fill="none" stroke-width="1.8"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/></svg></div>
      <h3 class="anl-title">Stay ahead of the market</h3>
      <p class="anl-sub">Get the latest Data Center news, hiring trends, and exclusive job openings delivered to your inbox.</p>
      <form class="anl-form">
        <div class="anl-row">
          <div class="anl-field"><label class="anl-label">First Name *</label><input class="anl-input" name="first" required></div>
          <div class="anl-field"><label class="anl-label">Last Name</label><input class="anl-input" name="last"></div>
        </div>
        <div class="anl-field"><label class="anl-label">Work Email *</label><input class="anl-input" type="email" name="email" required placeholder="you@company.com"></div>
        <div class="anl-field"><label class="anl-label">Phone *</label>
          <div class="anl-phone">
            <input class="anl-input anl-code" list="anl-codes" value="+971" aria-label="Dialing code">
            <input class="anl-input anl-num" name="phone" type="tel" inputmode="numeric" placeholder="58 553 6439" required>
          </div>
          <datalist id="anl-codes"><option value="+971">United Arab Emirates</option><option value="+966">Saudi Arabia</option><option value="+974">Qatar</option><option value="+973">Bahrain</option><option value="+968">Oman</option><option value="+965">Kuwait</option><option value="+44">United Kingdom</option><option value="+49">Germany</option><option value="+31">Netherlands</option><option value="+33">France</option><option value="+1">USA / Canada</option><option value="+65">Singapore</option><option value="+61">Australia</option><option value="+91">India</option><option value="+20">Egypt</option><option value="+27">South Africa</option></datalist>
        </div>
        <div class="anl-row">
          <div class="anl-field"><label class="anl-label">Company</label><input class="anl-input" name="company"></div>
          <div class="anl-field"><label class="anl-label">Job Title</label><input class="anl-input" name="title"></div>
        </div>
        <div class="anl-field"><label class="anl-label">LinkedIn Profile *</label><input class="anl-input" name="linkedin" type="url" placeholder="https://linkedin.com/in/your-name" required></div>
        <button class="anl-btn" type="submit">Subscribe
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:15px;height:15px;"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
        </button>
        <div class="anl-err" style="display:none;"></div>
        <p class="anl-note">We respect your privacy. Unsubscribe anytime.</p>
      </form>
    </div>
  </div>`;

  function build() {
    var style = document.createElement('style'); style.textContent = css; document.head.appendChild(style);
    var overlay = document.createElement('div'); overlay.className = 'anl-overlay'; overlay.innerHTML = html;
    document.body.appendChild(overlay);

    function close(reason) {
      overlay.classList.remove('open');
      setTimeout(function () { overlay.remove(); }, 260);
      mark(reason || 'closed');
    }
    overlay.querySelector('.anl-close').addEventListener('click', function () { close('closed'); });
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close('closed'); });

    overlay.querySelector('.anl-form').addEventListener('submit', async function (e) {
      e.preventDefault();
      var f = e.target, btn = f.querySelector('.anl-btn'), err = f.querySelector('.anl-err');
      var v = function (n) { return (f.elements[n].value || '').trim(); };
      err.style.display = 'none'; btn.disabled = true; btn.textContent = 'Subscribing…';
      var code = f.querySelector('.anl-code'), num = f.querySelector('.anl-num');
      var phone = ((code ? code.value.trim() : '') + ' ' + (num ? num.value.trim() : '')).trim();
      var payload = {
        first_name: v('first'), last_name: v('last') || null, email: v('email'),
        phone: phone || null, company_name: v('company') || null,
        job_title: v('title') || null, linkedin_url: v('linkedin') || null, source: 'website_popup'
      };
      if (window.notifyEmail) window.notifyEmail('newsletter', payload);
      var res = await subscribe(payload);
      if (res.ok) {
        overlay.querySelector('.anl-body').innerHTML =
          '<div class="anl-success"><div class="anl-icon"><svg viewBox="0 0 24 24" fill="none" stroke="#25d366" stroke-width="2.2"><path d="M20 6 9 17l-5-5"/></svg></div>' +
          '<h3 class="anl-title">You\'re in</h3><p class="anl-sub">Thanks for subscribing. Market intelligence is on its way to your inbox.</p></div>';
        mark('subscribed');
        setTimeout(function () { close('subscribed'); }, 2200);
      } else {
        btn.disabled = false; btn.innerHTML = 'Subscribe';
        err.textContent = 'Something went wrong. Please try again.'; err.style.display = 'block';
      }
    });

    requestAnimationFrame(function () { overlay.classList.add('open'); });
  }

  if (seen()) return; // already closed or subscribed
  window.addEventListener('load', function () { setTimeout(build, SHOW_DELAY); });
})();
