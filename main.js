(() => {
  const root = document.documentElement;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const nativeScrollAnims = CSS.supports('(animation-timeline: view()) and (animation-range: entry)');
  const isMobile = () => matchMedia('(max-width: 760px)').matches;

  // --- Entrada del hero ---
  setTimeout(() => document.body.classList.add('is-loaded'), 30);


  // --- Palabras de "Nosotros" (cada una con su índice) ---
  document.querySelectorAll('[data-words]').forEach(el => {
    const words = el.textContent.trim().split(/\s+/);
    el.style.setProperty('--n', words.length);
    el.innerHTML = words.map((w, i) => `<span class="w" style="--i:${i}">${w}</span>`).join(' ');
  });

  // --- Altura de la sección horizontal = ancho del track ---
  const results = document.querySelector('.results');
  const track = document.querySelector('.results-track');
  function sizeResults() {
    if (isMobile() || reduceMotion) { results.style.height = ''; return; }
    results.style.height = `${track.scrollWidth - innerWidth + innerHeight}px`;
  }
  sizeResults();
  addEventListener('resize', sizeResults);
  addEventListener('load', sizeResults);

  // --- Fallback del motor de scroll (Firefox y navegadores sin scroll-driven animations) ---
  if (!nativeScrollAnims && !reduceMotion) {
    const els = [...document.querySelectorAll('[data-sp]')];
    const clamp = v => Math.min(1, Math.max(0, v));
    let ticking = false;
    function update() {
      ticking = false;
      const vh = innerHeight;
      for (const el of els) {
        let p;
        if (el.dataset.sp === 'page') {
          p = scrollY / (root.scrollHeight - vh);
        } else {
          const r = el.getBoundingClientRect();
          switch (el.dataset.sp) {
            case 'contain': p = -r.top / (r.height - vh); break;
            case 'exit': p = -r.top / r.height; break;
            case 'entry': p = (vh - r.top) / r.height; break;
            default: p = (vh - r.top) / (vh + r.height); // cover
          }
          const [a, b] = (el.dataset.range || '0 1').split(' ').map(Number);
          p = (p - a) / (b - a);
        }
        el.style.setProperty('--p', clamp(p).toFixed(4));
      }
    }
    const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
    addEventListener('scroll', onScroll, { passive: true });
    addEventListener('resize', onScroll);
    update();
  }

  // --- Proceso: 16:9 → 9:16 como animación, apenas se empieza a scrollear la sección ---
  const story = document.querySelector('.story');
  function updateStory() {
    story.classList.toggle('is-short', story.getBoundingClientRect().top < -40);
  }
  addEventListener('scroll', updateStory, { passive: true });
  updateStory();

  // --- Reveals al entrar en pantalla ---
  const revealObserver = new IntersectionObserver(entries => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add('is-in'); revealObserver.unobserve(e.target); }
  }, { rootMargin: '0px 0px -12% 0px' });
  document.querySelectorAll('.reveal').forEach((el, i) => {
    if (!el.style.getPropertyValue('--d') && el.closest('.voice-list')) el.style.setProperty('--d', i % 8);
    revealObserver.observe(el);
  });

  // --- Contador "12M+" ---
  const counter = document.querySelector('.count');
  new IntersectionObserver((entries, obs) => {
    if (!entries[0].isIntersecting) return;
    obs.disconnect();
    const to = +counter.dataset.to, start = performance.now(), dur = reduceMotion ? 0 : 1600;
    const tick = now => {
      const t = dur ? Math.min(1, (now - start) / dur) : 1;
      counter.textContent = Math.round(to * (1 - Math.pow(1 - t, 4)));
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, { threshold: .6 }).observe(counter);

  // --- Videos: sólo se reproducen cuando están en pantalla ---
  const videoObserver = new IntersectionObserver(entries => {
    for (const e of entries) {
      const v = e.target;
      if (e.isIntersecting) v.play().catch(() => {}); else v.pause();
    }
  }, { threshold: .35 });
  document.querySelectorAll('.clip video, .frame video').forEach(v => { v.removeAttribute('autoplay'); videoObserver.observe(v); });

  // --- Sonido: suena sólo el video más visible y pasa al siguiente al scrollear.
  // Tocar un video lo silencia (y tocarlo de nuevo lo vuelve a activar).
  // Si el navegador bloquea el sonido sin interacción, arranca con el primer clic o tecla.
  const heroVideo = document.getElementById('hero-video');
  const soundBtn = document.getElementById('sound-btn');
  const players = [...document.querySelectorAll('.phone, .frame, .clip-media')]
    .map(box => ({ box, video: box.querySelector('video') }));
  let soundOn = true, audible = null, waitingGesture = false;

  function syncSoundBtn() {
    const on = !heroVideo.muted;
    soundBtn.setAttribute('aria-pressed', String(on));
    soundBtn.querySelector('.sound-label').textContent = on ? 'Silenciar' : 'Activar sonido';
  }
  function mostVisible() {
    let best = null, bestScore = 0;
    for (const { box, video } of players) {
      const r = box.getBoundingClientRect();
      const w = Math.max(0, Math.min(r.right, innerWidth) - Math.max(r.left, 0));
      const h = Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top, 0));
      const visible = w * h / (r.width * r.height || 1);
      if (visible < .6) continue;
      // Si hay varios enteros en pantalla, gana el más cercano al centro
      const score = visible - Math.abs(r.left + r.width / 2 - innerWidth / 2) / innerWidth;
      if (score > bestScore) { best = video; bestScore = score; }
    }
    return best;
  }
  function setAudible(video) {
    if (audible) audible.muted = true;
    audible = video;
    if (video) {
      video.muted = false;
      video.play().catch(() => {
        video.muted = true; video.play().catch(() => {});
        audible = null; waitingGesture = true; syncSoundBtn();
      });
    }
    syncSoundBtn();
  }
  function updateSound() {
    if (waitingGesture) return;
    const next = soundOn ? mostVisible() : null;
    if (next !== audible) setAudible(next);
  }
  let soundTicking = false;
  addEventListener('scroll', () => {
    if (!soundTicking) { soundTicking = true; requestAnimationFrame(() => { soundTicking = false; updateSound(); }); }
  }, { passive: true });
  addEventListener('resize', updateSound);
  addEventListener('load', updateSound);
  updateSound();

  function onGesture(e) {
    if (!waitingGesture || e.target.closest('.phone, .frame, .clip-media')) return; // el toque sobre un video lo resuelve toggleSound
    waitingGesture = false; audible = null; updateSound();
  }
  addEventListener('click', onGesture, true);
  addEventListener('keydown', onGesture, true);

  function toggleSound(video) {
    waitingGesture = false;
    soundOn = video.muted;
    setAudible(soundOn ? video : null);
  }
  players.forEach(({ box, video }) => box.addEventListener('click', e => {
    if (!e.target.closest('button, a')) toggleSound(video);
  }));
  soundBtn.addEventListener('click', () => toggleSound(heroVideo));

  // --- Nav: se esconde al bajar, vuelve al subir; link activo ---
  const nav = document.getElementById('nav');
  let lastY = scrollY;
  addEventListener('scroll', () => {
    const y = scrollY;
    nav.classList.toggle('is-hidden', y > lastY && y > 400);
    lastY = y;
  }, { passive: true });
  const links = [...document.querySelectorAll('.nav-links a')];
  const sectionObserver = new IntersectionObserver(entries => {
    for (const e of entries) if (e.isIntersecting) {
      links.forEach(a => a.classList.toggle('is-active', a.getAttribute('href') === `#${e.target.id}`));
    }
  }, { rootMargin: '-45% 0px -50% 0px' });
  document.querySelectorAll('main section[id]').forEach(s => sectionObserver.observe(s));

  // --- Botones magnéticos ---
  if (!reduceMotion && matchMedia('(hover: hover)').matches) {
    document.querySelectorAll('.magnetic').forEach(btn => {
      btn.addEventListener('pointermove', e => {
        const r = btn.getBoundingClientRect();
        btn.style.translate = `${(e.clientX - r.left - r.width / 2) * .25}px ${(e.clientY - r.top - r.height / 2) * .35}px`;
      });
      btn.addEventListener('pointerleave', () => { btn.style.translate = ''; });
    });
  }

  // --- Voces: imagen que sigue al cursor ---
  const cursorImg = document.querySelector('.cursor-img');
  const cursorImgEl = cursorImg.querySelector('img');
  let tx = 0, ty = 0, cx = 0, cy = 0, rafId = null;
  function follow() {
    cx += (tx - cx) * .14; cy += (ty - cy) * .14;
    const tilt = Math.max(-12, Math.min(12, (tx - cx) * .08));
    cursorImg.style.transform = `translate(${cx - 110}px, ${cy - 140}px) rotate(${tilt}deg)`;
    rafId = Math.abs(tx - cx) + Math.abs(ty - cy) > .2 ? requestAnimationFrame(follow) : null;
  }
  const voiceList = document.querySelector('.voice-list');
  voiceList.addEventListener('pointermove', e => {
    tx = e.clientX + 150; ty = e.clientY; // tarjeta a la derecha del cursor, sin tapar el nombre
    if (!cursorImg.classList.contains('is-on')) { cx = tx; cy = ty; }
    if (!rafId) rafId = requestAnimationFrame(follow);
  });
  document.querySelectorAll('.voice').forEach(v => {
    v.addEventListener('pointerenter', () => {
      cursorImgEl.src = v.dataset.img;
      cursorImg.classList.toggle('is-logo', 'logo' in v.dataset);
      cursorImg.classList.add('is-on');
    });
  });
  voiceList.addEventListener('pointerleave', () => cursorImg.classList.remove('is-on'));

  // --- Voces: diálogo con bio y link a la red principal de cada uno ---
  const dialog = document.getElementById('voice-dialog');
  const vdMedia = dialog.querySelector('.vd-media');
  const vdImg = dialog.querySelector('.vd-img');
  const vdLink = dialog.querySelector('.vd-link');
  const networkOf = url => url.includes('instagram.com') ? 'Instagram' : url.includes('linkedin.com') ? 'LinkedIn' : url.includes('x.com') ? 'X' : 'redes';
  document.querySelectorAll('.voice').forEach(v => {
    v.addEventListener('click', () => {
      const { name, img, title, desc, link } = v.dataset;
      const isLogo = 'logo' in v.dataset;
      vdMedia.classList.toggle('is-logo', isLogo);
      vdImg.src = img;
      vdImg.alt = isLogo ? `Logo de ${name}` : `Foto de ${name}`;
      dialog.querySelector('.vd-name').textContent = name;
      dialog.querySelector('.vd-title').textContent = title;
      dialog.querySelector('.vd-desc').textContent = desc;
      vdLink.href = link;
      vdLink.textContent = `Ver en ${networkOf(link)} ↗`;
      cursorImg.classList.remove('is-on');
      dialog.showModal();
    });
  });
  dialog.querySelector('.vd-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });
})();
