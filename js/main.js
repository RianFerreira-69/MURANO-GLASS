/* ==========================================================================
   Murano Glass - landing page
   O Meta Pixel (ID e PageView) fica no snippet do <head> do index.html.
   Aqui ficam os demais eventos: Contact, ViewContent e Lead.
   ========================================================================== */
(function () {
  'use strict';

  /* ---------- configuração ---------- */
  const WHATSAPP_NUMBER = '5516993257274';
  const SCROLL_VIEWCONTENT_RATIO = 0.5;
  const FORM_ENDPOINT = '/';
  const LABELS = {
    sending: 'Enviando...',
  };
  const ERROR_MESSAGES = {
    nome: { valueMissing: 'Informe seu nome.' },
    whatsapp: {
      valueMissing: 'Informe seu WhatsApp com DDD.',
      patternMismatch: 'Digite DDD e número, ex.: (16) 99999-9999.',
    },
    produto: { valueMissing: 'Escolha o que você precisa.' },
    cidade: { valueMissing: 'Informe sua cidade.' },
  };
  const SUMMARY_ERROR = 'Confira os campos destacados e tente de novo.';

  /* ---------- utilitários ---------- */
  function track(eventName, params) {
    try {
      if (!window.fbq) { return; }
      if (params) {
        window.fbq('track', eventName, params);
      } else {
        window.fbq('track', eventName);
      }
    } catch (error) {
      /* o Pixel nunca deve quebrar a página */
    }
  }

  function buildWhatsappUrl(text) {
    return 'https://wa.me/' + WHATSAPP_NUMBER + '?text=' + encodeURIComponent(text);
  }

  /* ---------- Contact: cliques diretos em WhatsApp/ligar ----------
     O botão da tela de agradecimento NÃO tem data-contact, de propósito. */
  function initContactTracking() {
    document.querySelectorAll('[data-contact]').forEach(function (link) {
      link.addEventListener('click', function () {
        track('Contact', { content_name: link.getAttribute('data-contact') });
      });
    });
  }

  /* ---------- máscara de WhatsApp: (DD) 9XXXX-XXXX ---------- */
  function formatPhone(value) {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    let masked = '';
    if (digits.length > 0) { masked = '(' + digits.slice(0, 2); }
    if (digits.length > 2) {
      const rest = digits.slice(2);
      const cut = digits.length > 10 ? 5 : 4;
      masked += ') ' + rest.slice(0, cut);
      if (rest.length > cut) { masked += '-' + rest.slice(cut); }
    }
    return masked;
  }

  function initPhoneMask() {
    document.querySelectorAll('[data-phone-mask]').forEach(function (input) {
      input.addEventListener('input', function () {
        input.value = formatPhone(input.value);
      });
    });
  }

  /* ---------- formulário de orçamento ----------
     Envio via fetch para o Netlify Forms. O e-mail de destino é configurado no painel
     do Netlify (Forms > Form notifications), não aqui no HTML. */
  function getFieldError(field) {
    const messages = ERROR_MESSAGES[field.name];
    if (!messages) { return ''; }
    const isEmpty = field.value.trim() === '';
    if (field.required && isEmpty) { return messages.valueMissing || ''; }
    if (field.validity.patternMismatch) { return messages.patternMismatch || ''; }
    return '';
  }

  function setFieldError(field, message) {
    const wrapper = field.closest('.form-field');
    const output = document.getElementById(field.getAttribute('aria-describedby'));
    wrapper.classList.toggle('form-field--invalid', Boolean(message));
    field.setAttribute('aria-invalid', message ? 'true' : 'false');
    if (output) {
      output.textContent = message;
      output.hidden = !message;
    }
  }

  function validateForm(form) {
    const invalidFields = [];
    form.querySelectorAll('input[name], select[name], textarea[name]').forEach(function (field) {
      if (!ERROR_MESSAGES[field.name]) { return; }
      const message = getFieldError(field);
      setFieldError(field, message);
      if (message) { invalidFields.push(field); }
    });
    return invalidFields;
  }

  function showThanks(form, whatsappUrl, failed) {
    const card = form.parentNode;
    const thanks = card.querySelector('[data-form-thanks]');
    form.hidden = true;
    card.querySelector('[data-form-title]').hidden = true;
    thanks.hidden = false;
    thanks.querySelector('[data-thanks-wa]').href = whatsappUrl;
    thanks.querySelector('[data-thanks-note]').hidden = !failed;
    thanks.querySelector('h3').focus();
  }

  function sendForm(form) {
    return fetch(FORM_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(new FormData(form)).toString(),
    }).then(function (response) {
      if (!response.ok) { throw new Error('status ' + response.status); }
    });
  }

  function setupQuoteForm(form) {
    const summary = form.querySelector('[data-form-error]');
    const submitButton = form.querySelector('button[type=submit]');
    let isSending = false;

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      if (isSending) { return; }
      summary.hidden = true;

      /* honeypot preenchido: é robô, ignora em silêncio */
      if (form.querySelector('[name=bot-field]').value) { return; }

      const invalidFields = validateForm(form);
      if (invalidFields.length > 0) {
        summary.textContent = SUMMARY_ERROR;
        summary.hidden = false;
        invalidFields[0].focus();
        return;
      }

      const name = form.nome.value.trim();
      const product = form.produto.value;
      const city = form.cidade.value.trim();
      const whatsappUrl = buildWhatsappUrl(
        'Olá! Sou ' + name + ', da cidade de ' + city + '. Quero um orçamento de ' + product + '. Vim pela página da Murano Glass.'
      );

      isSending = true;
      submitButton.disabled = true;
      submitButton.textContent = LABELS.sending;

      sendForm(form)
        .then(function () {
          /* Lead só dispara aqui, no envio com sucesso */
          track('Lead', { content_name: product, content_category: city });
          showThanks(form, whatsappUrl, false);
        })
        .catch(function () {
          /* Falhou o envio: não perde o lead, abre o WhatsApp com a mensagem pronta (sem Lead) */
          showThanks(form, whatsappUrl, true);
          try { window.open(whatsappUrl, '_blank', 'noopener'); } catch (error) { /* popup bloqueado */ }
        });
    });

    /* limpa o erro do campo assim que a pessoa volta a digitar */
    form.addEventListener('input', function (event) {
      if (ERROR_MESSAGES[event.target.name]) { setFieldError(event.target, ''); }
    });
    form.addEventListener('change', function (event) {
      if (ERROR_MESSAGES[event.target.name]) { setFieldError(event.target, ''); }
    });
  }

  function initQuoteForms() {
    document.querySelectorAll('[data-quote-form]').forEach(setupQuoteForm);
  }

  /* ---------- ViewContent aos 50% de rolagem (uma vez) ---------- */
  function initScrollTracking() {
    let fired = false;
    function onScroll() {
      if (fired) { return; }
      const root = document.documentElement;
      const max = root.scrollHeight - window.innerHeight;
      const scrolled = window.scrollY || root.scrollTop;
      if (max > 0 && scrolled / max >= SCROLL_VIEWCONTENT_RATIO) {
        fired = true;
        track('ViewContent');
        window.removeEventListener('scroll', onScroll);
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* ---------- lightbox da galeria ---------- */
  function initLightbox() {
    const lightbox = document.getElementById('lightbox');
    if (!lightbox) { return; }
    const image = lightbox.querySelector('.lightbox__img');
    const caption = lightbox.querySelector('.lightbox__caption');
    const closeButton = lightbox.querySelector('.lightbox__close');
    /* o que fica "inerte" (sem foco nem leitura) enquanto o diálogo está aberto */
    const background = Array.from(document.body.children).filter(function (element) {
      return element !== lightbox && element.tagName !== 'SCRIPT';
    });
    let opener = null;

    function setBackgroundInert(isInert) {
      background.forEach(function (element) { element.inert = isInert; });
    }

    function open(button) {
      const photo = button.querySelector('img');
      const figcaption = button.parentNode.querySelector('figcaption');
      opener = button;
      image.src = photo.currentSrc || photo.src;
      image.alt = photo.alt;
      caption.textContent = figcaption ? figcaption.textContent : '';
      lightbox.hidden = false;
      setBackgroundInert(true);
      closeButton.focus();
    }

    function close() {
      lightbox.hidden = true;
      setBackgroundInert(false);
      if (opener) { opener.focus(); }
    }

    document.querySelectorAll('.shot button').forEach(function (button) {
      button.addEventListener('click', function () { open(button); });
    });
    closeButton.addEventListener('click', close);
    lightbox.addEventListener('click', function (event) {
      if (event.target === lightbox) { close(); }
    });
    document.addEventListener('keydown', function (event) {
      if (lightbox.hidden) { return; }
      if (event.key === 'Escape') {
        close();
      } else if (event.key === 'Tab') {
        /* o único elemento focável do diálogo é o botão de fechar: o foco fica nele */
        event.preventDefault();
        closeButton.focus();
      }
    });
  }

  /* ---------- início ---------- */
  initContactTracking();
  initPhoneMask();
  initQuoteForms();
  initScrollTracking();
  initLightbox();
})();
