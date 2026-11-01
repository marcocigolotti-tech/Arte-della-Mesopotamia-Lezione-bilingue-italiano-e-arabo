'use strict';

(function () {
  const isGlossary = /glossario\.html$/i.test(location.pathname);

  function addStyle() {
    const style = document.createElement('style');
    style.textContent = `
      .audio-tools{max-width:1500px;margin:0 auto;padding:14px 4%;background:#edf3f5;border-bottom:1px solid #c7d4d8;color:#233c46;font:16px/1.5 Arial,sans-serif}
      .audio-tools-inner{display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap}
      .audio-tools strong{font-size:17px}.audio-buttons{display:flex;gap:8px;flex-wrap:wrap}
      .audio-tools button{min-height:44px;padding:8px 13px;border:1px solid #526a73;border-radius:7px;background:#fff;color:#233c46;font:700 15px Arial,sans-serif}
      .audio-tools button:hover{background:#dce9ed}.audio-tools button:focus-visible{outline:3px solid #996232;outline-offset:2px}
      .audio-tools button[aria-pressed="true"]{background:#233c46;color:#fff}
      .audio-tools button:disabled{opacity:.55;cursor:not-allowed}
      .audio-status{margin:7px 0 0;font-size:13px}.audio-note{font-size:12px;color:#526168;margin:3px 0 0}
      .glossary-image-credit{display:grid;grid-template-columns:1fr 1fr;gap:12px 24px;border-top:1px solid #ded8cc;padding:10px 0;font-size:12px}
      .glossary-image-credit p{margin:0}.glossary-image-credit [lang="ar"]{text-align:right;line-height:1.8}
      .glossary-image-credit a{color:#075c9a}
      @media(max-width:650px){.audio-tools{padding:12px 16px}.audio-tools-inner{display:block}.audio-buttons{margin-top:9px}.audio-tools button{font-size:14px;padding:8px 10px}.glossary-image-credit{grid-template-columns:1fr;gap:4px}.glossary-image-credit p[lang="ar"]{margin-bottom:12px}}
      @media print{.audio-tools{display:none!important}}
    `;
    document.head.append(style);
  }

  function createButton(label, lang, handler) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    if (lang) {
      button.lang = lang;
      if (lang === 'ar') button.dir = 'rtl';
    }
    button.addEventListener('click', handler);
    return button;
  }

  function installAudioControls() {
    const panel = document.createElement('section');
    panel.className = 'audio-tools';
    panel.setAttribute('aria-label', 'Lettura vocale in italiano e in arabo');
    const inner = document.createElement('div');
    inner.className = 'audio-tools-inner';
    const heading = document.createElement('strong');
    heading.textContent = 'Lettura vocale · القراءة الصوتية';
    const buttons = document.createElement('div');
    buttons.className = 'audio-buttons';
    const status = document.createElement('p');
    status.className = 'audio-status';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    const note = document.createElement('p');
    note.className = 'audio-note';
    note.textContent = 'La voce dipende dal dispositivo: per l’arabo è necessaria una voce araba installata. · يعتمد الصوت على الجهاز؛ للاستماع بالعربية يجب تثبيت صوت عربي.';

    let segments = [];
    let segmentIndex = 0;
    let selectedLanguage = '';
    let session = 0;
    const pauseButton = createButton('Pausa · إيقاف مؤقت', null, () => {
      if (!('speechSynthesis' in window)) return;
      if (speechSynthesis.paused) {
        speechSynthesis.resume();
        pauseButton.textContent = 'Pausa · إيقاف مؤقت';
      } else if (speechSynthesis.speaking) {
        speechSynthesis.pause();
        pauseButton.textContent = 'Riprendi · متابعة';
      }
    });
    pauseButton.disabled = true;
    const stopButton = createButton('Interrompi · إيقاف', null, stopReading);

    function getText(language) {
      const root = isGlossary ? document.querySelector('main') : document.querySelector('#inizio');
      if (!root) return [];
      const excluded = '.audio-tools,.tools,.controls,nav,aside,button,input,script,style,dialog,details,footer,.back,#menu,#viewer';
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          const parent = node.parentElement;
          if (!parent || parent.closest(excluded)) return NodeFilter.FILTER_REJECT;
          const languageTag = parent.closest('[lang]');
          const actualLanguage = (languageTag?.getAttribute('lang') || document.documentElement.lang || 'it').slice(0, 2);
          if (actualLanguage !== language) return NodeFilter.FILTER_REJECT;
          return node.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
        }
      });
      const parts = [];
      while (walker.nextNode()) parts.push(walker.currentNode.nodeValue.trim());
      return parts;
    }

    function makeChunks(text, maxLength = 430) {
      const chunks = [];
      let rest = text.replace(/\s+/g, ' ').trim();
      while (rest.length > maxLength) {
        let cut = -1;
        const marks = /[.!?؟؛。]\s/g;
        let match;
        while ((match = marks.exec(rest)) && match.index < maxLength) cut = marks.lastIndex;
        if (cut < maxLength * 0.55) {
          cut = rest.lastIndexOf(' ', maxLength);
          if (cut < maxLength * 0.55) cut = maxLength;
        }
        chunks.push(rest.slice(0, cut).trim());
        rest = rest.slice(cut).trim();
      }
      if (rest) chunks.push(rest);
      return chunks;
    }

    function updateStatus(message) {
      status.textContent = message;
    }

    function speakNext(token) {
      if (token !== session) return;
      if (segmentIndex >= segments.length) {
        pauseButton.disabled = true;
        updateStatus(selectedLanguage === 'it' ? 'Lettura completata.' : 'اكتملت القراءة.');
        return;
      }
      const utterance = new SpeechSynthesisUtterance(segments[segmentIndex++]);
      utterance.lang = selectedLanguage === 'it' ? 'it-IT' : 'ar-SA';
      utterance.rate = 0.94;
      const prefix = selectedLanguage === 'it' ? 'it' : 'ar';
      const voice = speechSynthesis.getVoices().find(item => item.lang.toLowerCase().startsWith(prefix));
      if (voice) utterance.voice = voice;
      utterance.onend = () => speakNext(token);
      utterance.onerror = event => {
        if (token !== session || event.error === 'canceled' || event.error === 'interrupted') return;
        pauseButton.disabled = true;
        updateStatus('La lettura vocale non è disponibile con la voce selezionata. · تعذّرت القراءة بالصوت المحدد.');
      };
      speechSynthesis.speak(utterance);
    }

    function stopReading() {
      session += 1;
      if ('speechSynthesis' in window) speechSynthesis.cancel();
      pauseButton.disabled = true;
      pauseButton.textContent = 'Pausa · إيقاف مؤقت';
      document.querySelectorAll('.audio-tools button[aria-pressed="true"]').forEach(button => button.setAttribute('aria-pressed', 'false'));
      updateStatus('Lettura interrotta. · تم إيقاف القراءة.');
    }

    function startReading(language) {
      if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) {
        updateStatus('Questo browser non supporta la lettura vocale. · هذا المتصفح لا يدعم القراءة الصوتية.');
        return;
      }
      speechSynthesis.cancel();
      session += 1;
      const token = session;
      selectedLanguage = language;
      segments = makeChunks(getText(language).join('. '));
      segmentIndex = 0;
      if (!segments.length) {
        updateStatus(language === 'it' ? 'Non ho trovato testo italiano da leggere.' : 'لم أجد نصًا عربيًا لقراءته.');
        return;
      }
      document.querySelectorAll('.audio-tools button[aria-pressed]').forEach(button => button.setAttribute('aria-pressed', 'false'));
      (language === 'it' ? italianButton : arabicButton).setAttribute('aria-pressed', 'true');
      pauseButton.disabled = false;
      pauseButton.textContent = 'Pausa · إيقاف مؤقت';
      updateStatus(language === 'it' ? 'Lettura in italiano in corso…' : 'جارٍ الاستماع باللغة العربية…');
      speakNext(token);
    }

    const italianButton = createButton('Ascolta in italiano', 'it', () => startReading('it'));
    const arabicButton = createButton('استمع بالعربية', 'ar', () => startReading('ar'));
    buttons.append(italianButton, arabicButton, pauseButton, stopButton);
    inner.append(heading, buttons);
    panel.append(inner, status, note);
    if (isGlossary) document.querySelector('main')?.prepend(panel);
    else document.querySelector('header')?.insertAdjacentElement('afterend', panel);
  }

  function enhanceGlossary() {
    if (typeof terms === 'undefined' || typeof draw !== 'function') return;
    const imageByTerm = {
      'Argilla': 14,
      'Mattone': 15,
      'Mattone smaltato': 16,
      'Smalto': 17,
      'Lapislazzuli': 18,
      'Madreperla': 19,
      'Rilievo': 20,
      'Iscrizione': 22
    };
    for (const [word, image] of Object.entries(imageByTerm)) {
      const term = terms.find(item => item.it === word);
      if (term) term.image = image;
    }
    terms.push(
      {it:'Mušḫuššu (drago sacro)',ar:'موشخوشو (التنين المقدّس)',di:'Creatura fantastica della Mesopotamia, associata al dio Marduk e raffigurata sulla Porta di Ishtar.',da:'مخلوق أسطوري من بلاد ما بين النهرين، ارتبط بالإله مردوخ وصُوّر على بوابة عشتار.',image:21},
      {it:'Genio alato',ar:'العبقري المجنّح',di:'Figura alata protettrice rappresentata nell’arte assira. Non è un lamassu.',da:'شخصية مجنّحة حامية ظهرت في الفن الآشوري. وهي ليست لاماسو.',image:20}
    );
    draw();
    addImageCaptions();
    addImageCredits();
  }

  const captions = {
    14:['Lavorazione moderna dell’argilla in Messico: un esempio di oggi, non un reperto mesopotamico.','تشكيل حديث للطين في المكسيك: مثال معاصر، وليس أثرًا من بلاد ما بين النهرين.'],
    15:['Mattone con iscrizione del re Nabucodonosor II; fotografia realizzata in un museo in Brasile.','لبنة تحمل كتابة للملك نبوخذ نصر الثاني؛ صُوّرت في متحف بالبرازيل.'],
    16:['Particolare di un mattone invetriato proveniente da Babilonia, con una guardia persiana.','تفصيل من لبنة مزجّجة من بابل، عليها صورة حارس فارسي.'],
    17:['Fiore in mattoni piatti con smalto colorato: fase più antica della Porta di Ishtar, sotto il livello del suolo.','زهرة من طوب مسطّح ذي طلاء ملوّن: مرحلة أقدم من بوابة عشتار، وكانت تحت مستوى الأرض.'],
    18:['Campione di lapislazzuli: la pietra blu è diversa dallo smalto blu della Porta di Ishtar.','عينة من حجر اللازورد: الحجر الأزرق يختلف عن الطلاء الأزرق في بوابة عشتار.'],
    19:['Interno di una conchiglia di abalone: si vede la madreperla; non è un oggetto mesopotamico.','السطح الداخلي لصدفة أذن البحر: تظهر فيه أمّ اللؤلؤ؛ وهي ليست قطعة أثرية من بلاد ما بين النهرين.'],
    20:['Rilievo assiro con un genio alato, conservato al Walters Art Museum: non è un lamassu.','نحت آشوري بارز لِعبقري مجنّح محفوظ في متحف والترز؛ وليس لاماسو.'],
    21:['Drago mušḫuššu della Porta di Ishtar, fotografato nel Museo archeologico di Istanbul.','تنين موشخوشو من بوابة عشتار، صُوّر في متحف إسطنبول للآثار.'],
    22:['Mattoni iscritti della Porta di Ishtar: dettaglio di una dedica edilizia in scrittura cuneiforme.','طوب منقوش من بوابة عشتار: تفصيل من كتابة بنائية بالخط المسماري.']
  };

  function addImageCaptions() {
    document.querySelectorAll('#entries .entry').forEach(entry => {
      const image = entry.querySelector('img');
      const caption = entry.querySelector('figcaption');
      if (!image || !caption) return;
      const match = image.src.match(/image(\d+)\.(?:jpg|jpeg)$/i);
      const id = match ? Number(match[1]) : 0;
      const captionText = captions[id] || (id === 10
        ? ['Illustrazione storica dei Giardini pensili; non è una prova archeologica.','رسم تاريخي للحدائق المعلّقة؛ وليس دليلًا أثريًا.']
        : ['Immagine di esempio','صورة توضيحية']);
      caption.replaceChildren();
      for (const [index, language] of ['it','ar'].entries()) {
        const span = document.createElement('span');
        span.lang = language;
        if (language === 'ar') span.dir = 'rtl';
        span.textContent = captionText[index];
        if (index) caption.append(document.createElement('br'));
        caption.append(span);
      }
    });
  }

  function addImageCredits() {
    const details = document.querySelector('main details');
    if (!details || details.querySelector('.new-image-credits')) return;
    const heading = document.createElement('h3');
    heading.className = 'new-image-credits';
    heading.textContent = 'Crediti delle immagini aggiunte · اعتمادات الصور المضافة';
    details.append(heading);
    const items = [
      ['Argilla in lavorazione','Lavorazione contemporanea dell’argilla a San Bartolo Coyotepec, Messico — foto di Alejandro Linares Garcia; CC BY-SA 4.0.','الطين أثناء التشكيل','تشكيل معاصر للطين في سان بارتولو كويوتيبيك، المكسيك — تصوير Alejandro Linares Garcia؛ ترخيص CC BY-SA 4.0.','https://commons.wikimedia.org/wiki/File:CarlomagnoWorkshop12.JPG','https://creativecommons.org/licenses/by-sa/4.0/'],
      ['Mattone di Nabucodonosor','William Loppes — CC BY-SA 4.0.','لبنة نبوخذ نصر','William Loppes — ترخيص CC BY-SA 4.0.','https://commons.wikimedia.org/wiki/File:Nebuchadnezzar%27s_Brick.png','https://creativecommons.org/licenses/by-sa/4.0/'],
      ['Mattone con guardia persiana','Osama Shukir Muhammed Amin — CC BY-SA 4.0.','لبنة عليها حارس فارسي','Osama Shukir Muhammed Amin — ترخيص CC BY-SA 4.0.','https://commons.wikimedia.org/wiki/File:Glazed_brick_depicting_part_of_a_Persian_guard._From_Babylon,_Iraq._Achaemenid_period,_6th-5th_century_BCE._Pergamon_Museum.jpg','https://creativecommons.org/licenses/by-sa/4.0/'],
      ['Fiore smaltato della Porta di Ishtar','Osama Shukir Muhammed Amin — CC BY-SA 4.0.','زهرة مزجّجة من بوابة عشتار','Osama Shukir Muhammed Amin — ترخيص CC BY-SA 4.0.','https://commons.wikimedia.org/wiki/File:Flower_from_the_2nd_building_phase_of_the_Ishtar_Gate_of_Babylon,_colored_glaze_on_flat_bricks._6th_century_BCE._Pergamon_Museum.jpg','https://creativecommons.org/licenses/by-sa/4.0/'],
      ['Lapislazzuli','Philippe Giabbanelli — CC BY-SA 3.0.','اللازورد','Philippe Giabbanelli — ترخيص CC BY-SA 3.0.','https://commons.wikimedia.org/wiki/File:Lapis_Lazulis.jpg','https://creativecommons.org/licenses/by-sa/3.0/'],
      ['Interno di conchiglia di abalone','Kowloonese — CC BY-SA 3.0 e GFDL 1.2 o successiva.','السطح الداخلي لصدفة أذن البحر','Kowloonese — ترخيص CC BY-SA 3.0 ورخصة GFDL 1.2 أو أحدث.','https://commons.wikimedia.org/wiki/File:AbaloneInside.jpg','https://creativecommons.org/licenses/by-sa/3.0/'],
      ['Genio alato assiro','Walters Art Museum — fotografia di opera bidimensionale in pubblico dominio.','عبقري آشوري مجنّح','متحف والترز للفنون — صورة لعمل ثنائي الأبعاد ضمن الملكية العامة.','https://commons.wikimedia.org/wiki/File:Assyrian_-_Relief_with_Winged_Genius_-_Walters_219_-_Detail_A.jpg','https://creativecommons.org/publicdomain/mark/1.0/'],
      ['Drago mušḫuššu','Ywpark2003 — CC0 1.0.','تنين موشخوشو','Ywpark2003 — ترخيص CC0 1.0.','https://commons.wikimedia.org/wiki/File:Glazed_Brick_Relief_of_Mushkhushshu_Dragon_from_Ishtar_Gate_Babylon_Istanbul_Archaeology_Museums.jpg','https://creativecommons.org/publicdomain/zero/1.0/'],
      ['Iscrizione della Porta di Ishtar','Osama Shukir Muhammed Amin — CC BY-SA 4.0.','نقش بوابة عشتار','Osama Shukir Muhammed Amin — ترخيص CC BY-SA 4.0.','https://commons.wikimedia.org/wiki/File:Detail,_Nebuchadnezzar_II%27s_Building_Inscription_plaque_of_the_Ishtar_Gate,_from_Babylon,_Iraq._6th_century_BCE._Pergamon_Museum.jpg','https://creativecommons.org/licenses/by-sa/4.0/']
    ];
    for (const [titleIt, creditIt, titleAr, creditAr, commonsUrl, licenseUrl] of items) {
      const row = document.createElement('div');
      row.className = 'glossary-image-credit';
      const italian = document.createElement('p');
      italian.lang = 'it';
      const arabic = document.createElement('p');
      arabic.lang = 'ar';
      arabic.dir = 'rtl';
      const buildCell = (target, title, credit, commonsLabel, licenseLabel) => {
        const strong = document.createElement('strong');
        strong.textContent = title + ' — ';
        const source = document.createElement('a');
        source.href = commonsUrl;
        source.target = '_blank';
        source.rel = 'noopener noreferrer';
        source.textContent = commonsLabel;
        const license = document.createElement('a');
        license.href = licenseUrl;
        license.target = '_blank';
        license.rel = 'noopener noreferrer';
        license.textContent = licenseLabel;
        const changeNote = target.lang === 'ar' ? ' تم تغيير الحجم والضغط للويب. ' : ' Immagine ridimensionata e compressa per il web. ';
        target.append(strong, document.createTextNode(credit + changeNote), source, document.createTextNode(' · '), license);
      };
      buildCell(italian, titleIt, creditIt, 'Wikimedia Commons', 'licenza');
      buildCell(arabic, titleAr, creditAr, 'ويكيميديا كومنز', 'الرخصة');
      row.append(italian, arabic);
      details.append(row);
    }
  }

  addStyle();
  if (isGlossary) enhanceGlossary();
  installAudioControls();
})();
