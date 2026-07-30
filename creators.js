(function () {
  var form = document.getElementById('creator-application');
  if (!form || !window.Drop) return;
  var message = form.querySelector('.creator-message');
  var submit = form.querySelector('.creator-submit');

  function value(id) {
    var field = document.getElementById(id);
    return field ? field.value.trim() : '';
  }
  function urls(ids) {
    return ids.map(value).filter(Boolean);
  }
  function show(text, kind) {
    message.textContent = text;
    message.className = 'creator-message' + (kind ? ' ' + kind : '');
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    show('', '');
    if (!form.checkValidity()) {
      form.reportValidity();
      show('Check the required fields and try again.', 'err');
      return;
    }

    submit.disabled = true;
    submit.textContent = 'Submitting…';
    var payload = {
      email: value('creator-email').toLowerCase(),
      display_name: value('creator-name'),
      city: value('creator-city'),
      state: 'CO',
      is_18_or_older: document.getElementById('creator-age').checked,
      drop_username: value('creator-username') || null,
      platform_urls: urls(['creator-platform', 'creator-platform-2']),
      content_samples: urls(['creator-sample', 'creator-sample-2']),
      audience_summary: value('creator-audience'),
      motivation: value('creator-motivation'),
      meetup_interest: document.getElementById('creator-meetup').checked,
      website: value('creator-website')
    };

    window.Drop.submitCreatorApplication(payload).then(function () {
      form.reset();
      show('Application received. Check your inbox for confirmation.', 'ok');
    }).catch(function (error) {
      show(
        error && error.status === 429
          ? 'Too many attempts. Wait an hour and try again.'
          : 'Your application didn’t go through. Keep this page open and try again.',
        'err'
      );
    }).finally(function () {
      submit.disabled = false;
      submit.textContent = 'Submit application';
    });
  });
})();
