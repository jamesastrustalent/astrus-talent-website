/* ==========================================================================
   ASTRUS TALENT — shared form helpers
   - Injects a dial-code <datalist> (prefilled common codes, editable to add
     any code manually) shared by every phone field.
   - window.astrusPhone(formEl) returns "<code> <number>" from a .phone-field.
   ========================================================================== */
(function () {
  var CODES = [
    ['+971', 'United Arab Emirates'], ['+966', 'Saudi Arabia'], ['+974', 'Qatar'],
    ['+973', 'Bahrain'], ['+968', 'Oman'], ['+965', 'Kuwait'], ['+962', 'Jordan'],
    ['+44', 'United Kingdom'], ['+353', 'Ireland'], ['+49', 'Germany'], ['+31', 'Netherlands'],
    ['+33', 'France'], ['+34', 'Spain'], ['+39', 'Italy'], ['+46', 'Sweden'], ['+41', 'Switzerland'],
    ['+1', 'USA / Canada'], ['+65', 'Singapore'], ['+61', 'Australia'], ['+81', 'Japan'],
    ['+82', 'South Korea'], ['+91', 'India'], ['+852', 'Hong Kong'], ['+60', 'Malaysia'],
    ['+20', 'Egypt'], ['+27', 'South Africa'], ['+234', 'Nigeria'], ['+55', 'Brazil']
  ];
  function inject() {
    if (document.getElementById('astrus-dialcodes')) return;
    var dl = document.createElement('datalist');
    dl.id = 'astrus-dialcodes';
    CODES.forEach(function (c) {
      var o = document.createElement('option');
      o.value = c[0]; o.label = c[1];
      dl.appendChild(o);
    });
    document.body.appendChild(dl);
  }
  window.astrusPhone = function (form) {
    var code = form.querySelector('.phone-code');
    var num = form.querySelector('.phone-num');
    var c = code ? code.value.trim() : '';
    var n = num ? num.value.trim() : '';
    return (c + ' ' + n).trim();
  };
  /* show the chosen filename inside a .file-drop upload control */
  document.addEventListener('change', function (e) {
    var input = e.target;
    if (!input || input.type !== 'file') return;
    var drop = input.closest('.file-drop');
    if (!drop) return;
    var span = drop.querySelector('.file-drop-text');
    if (span && !drop.dataset.def) drop.dataset.def = span.textContent;
    var f = input.files && input.files[0];
    if (span) span.textContent = f ? f.name : drop.dataset.def;
    drop.classList.toggle('has-file', !!f);
  });

  if (document.readyState !== 'loading') inject();
  else document.addEventListener('DOMContentLoaded', inject);
})();
