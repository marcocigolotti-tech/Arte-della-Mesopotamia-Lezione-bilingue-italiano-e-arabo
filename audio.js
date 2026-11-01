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
      #image-zoom{border:0;border-radius:10px;padding:16px;max-width:min(96vw,1300px);max-height:96vh;background:#fbf8f1;color:#233c46}
      #image-zoom::backdrop{background:rgba(8,20,25,.88)}#image-zoom img{display:block;max-width:92vw;max-height:82vh;width:auto;height:auto;margin:12px auto;object-fit:contain}
      #image-zoom button{float:right;padding:9px 14px;border:1px solid #526a73;border-radius:6px;background:white;font-weight:bold}#image-zoom figcaption{text-align:center;line-height:1.6}
      #entries .photo img{cursor:zoom-in}#entries .photo img:focus-visible{outline:4px solid #996232;outline-offset:3px}
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
      'Iscrizione': 22,
      'Restauro': 23,
      'Frammento': 24,
      'Archeologo': 25,
      'Divinità': 26,
      'Scriba': 27,
      'Stilo': 28,
      'Terrazze sovrapposte': 29,
      'Tempio': 30
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
    enableImageZoom();
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
    22:['Mattoni iscritti della Porta di Ishtar: dettaglio di una dedica edilizia in scrittura cuneiforme.','طوب منقوش من بوابة عشتار: تفصيل من كتابة بنائية بالخط المسماري.'],
    23:['Cilindro d’argilla con un’iscrizione che ricorda il restauro dello ziggurat di Ur voluto da Nabonide.','أسطوانة طينية تحمل كتابة تذكر ترميم زقورة أور بأمر من نابونيد.'],
    24:['Frammento di tavoletta cuneiforme conservato al Metropolitan Museum of Art.','جزء من لوح مسماري محفوظ في متحف المتروبوليتان للفنون.'],
    25:['Archeologa al lavoro in una trincea di scavo a Leicester, in Inghilterra: esempio attuale del lavoro sul campo.','عالمة آثار تعمل في خندق تنقيب في ليستر بإنجلترا: مثال معاصر على العمل الميداني.'],
    26:['Rilievo assiro del dio solare Shamash, conservato al British Museum.','نقش آشوري بارز للإله شمش، محفوظ في المتحف البريطاني.'],
    27:['Replica della statua dello scriba sumero Dudu, dedicata al dio Ningirsu.','نسخة من تمثال الكاتب السومري دودو، المهدى إلى الإله نينجيرسو.'],
    28:['Illustrazione di uno stilo usato per scrivere su argilla; non è un reperto mesopotamico.','رسم توضيحي لقلم يُستخدم للكتابة على الطين؛ وليس قطعة أثرية من بلاد ما بين النهرين.'],
    29:['Modellino moderno dei Giardini pensili: ricostruzione ipotetica, non immagine certa dei giardini antichi.','نموذج حديث للحدائق المعلّقة: إعادة بناء افتراضية، وليست صورة مؤكدة للحدائق القديمة.'],
    30:['Ricostruzione digitale dello ziggurat di Ur-Nammu, edificio religioso a terrazze.','إعادة بناء رقمية لزقورة أور-نمو، وهي مبنى ديني ذو مصاطب.']
  };

  function enableImageZoom() {
    const entries = document.querySelector('#entries');
    if (!entries || entries.dataset.zoomReady) return;
    entries.dataset.zoomReady = 'true';
    const dialog = document.createElement('dialog');
    dialog.id = 'image-zoom';
    dialog.setAttribute('aria-label', 'Immagine ingrandita / صورة مكبّرة');
    const close = document.createElement('button');
    close.type = 'button'; close.textContent = 'Chiudi × / إغلاق';
    const image = document.createElement('img');
    const caption = document.createElement('figcaption');
    dialog.append(close, image, caption); document.body.append(dialog);
    close.addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
    entries.addEventListener('click', event => {
      const thumb = event.target.closest('.photo img');
      if (!thumb) return;
      image.src = thumb.src; image.alt = thumb.alt;
      caption.replaceChildren(...Array.from(thumb.closest('figure').querySelector('figcaption').childNodes).map(node => node.cloneNode(true)));
      dialog.showModal();
    });
    entries.addEventListener('keydown', event => {
      if ((event.key === 'Enter' || event.key === ' ') && event.target.matches('.photo img')) {
        event.preventDefault(); event.target.click();
      }
    });
    const enableKeyboardAccess = () => entries.querySelectorAll('.photo img').forEach(img => { img.tabIndex = 0; img.setAttribute('role','button'); img.setAttribute('aria-label','Ingrandisci immagine / تكبير الصورة'); });
    enableKeyboardAccess();
    new MutationObserver(enableKeyboardAccess).observe(entries,{childList:true,subtree:true});
  }

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
      ['Iscrizione della Porta di Ishtar','Osama Shukir Muhammed Amin — CC BY-SA 4.0.','نقش بوابة عشتار','Osama Shukir Muhammed Amin — ترخيص CC BY-SA 4.0.','https://commons.wikimedia.org/wiki/File:Detail,_Nebuchadnezzar_II%27s_Building_Inscription_plaque_of_the_Ishtar_Gate,_from_Babylon,_Iraq._6th_century_BCE._Pergamon_Museum.jpg','https://creativecommons.org/licenses/by-sa/4.0/'],
      ['Restauro dello ziggurat di Ur','Osama Shukir Muhammed Amin — CC BY-SA 4.0.','ترميم زقورة أور','Osama Shukir Muhammed Amin — ترخيص CC BY-SA 4.0.','https://commons.wikimedia.org/wiki/File:Nabonidus%27s_preoccupation_with_the_moon_god_Sin_led_to_building_work_outside_Babylon._This_clay_cylinder_records_the_restoration_of_Sin%27s_ziggurat_at_Ur,_and_also_asks_him_to_protect_Nabonidus_and_his_son,_Belshazzar._From_Ur,_Iraq.jpg','https://creativecommons.org/licenses/by-sa/4.0/'],
      ['Frammento di tavoletta cuneiforme','The Metropolitan Museum of Art — CC0 1.0.','جزء من لوح مسماري','متحف المتروبوليتان للفنون — CC0 1.0.','https://commons.wikimedia.org/wiki/File:Cuneiform_tablet-_fragment_MET_vs86.11.491.jpg','https://creativecommons.org/publicdomain/zero/1.0/'],
      ['Archeologa al lavoro','Sue Hutton — CC BY-SA 2.0.','عالمة آثار أثناء العمل','Sue Hutton — ترخيص CC BY-SA 2.0.','https://commons.wikimedia.org/wiki/File:Archaeologist_working_in_Trench.jpg','https://creativecommons.org/licenses/by-sa/2.0/'],
      ['Rilievo del dio Shamash','Fotografia di Capillon; immagine in pubblico dominio.','نقش الإله شمش','تصوير Capillon؛ الصورة ضمن الملكية العامة.','https://commons.wikimedia.org/wiki/File:Shamash.jpg','https://creativecommons.org/publicdomain/mark/1.0/'],
      ['Replica dello scriba Dudu','Osama Shukir Muhammed Amin — CC BY-SA 4.0.','نسخة تمثال الكاتب دودو','Osama Shukir Muhammed Amin — ترخيص CC BY-SA 4.0.','https://commons.wikimedia.org/wiki/File:A_replica_of_the_seated_statue_of_the_Sumerian_scribe_Dudu,_dedicated_to_god_Ningirsu._Sulaymaniyah_Museum.jpg','https://creativecommons.org/licenses/by-sa/4.0/'],
      ['Stilo','Pearson Scott Foresman — pubblico dominio.','قلم الكتابة','Pearson Scott Foresman — ضمن الملكية العامة.','https://commons.wikimedia.org/wiki/File:Stylus_(PSF).png','https://creativecommons.org/publicdomain/mark/1.0/'],
      ['Modellino dei Giardini pensili','DestinationFearFan — CC BY-SA 4.0.','نموذج الحدائق المعلّقة','DestinationFearFan — ترخيص CC BY-SA 4.0.','https://commons.wikimedia.org/wiki/File:Hanging_Gardens_of_Babylon_model.jpg','https://creativecommons.org/licenses/by-sa/4.0/'],
      ['Ricostruzione dello ziggurat di Ur-Nammu','wikiwikiyarou — pubblico dominio.','إعادة بناء زقورة أور-نمو','wikiwikiyarou — ضمن الملكية العامة.','https://commons.wikimedia.org/wiki/File:Ziggurat_of_ur.jpg','https://creativecommons.org/publicdomain/mark/1.0/']
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

  if (isGlossary) document.querySelector('#search')?.addEventListener('input', addImageCaptions);

  addStyle();
  if (isGlossary) enhanceGlossary();
  installAudioControls();
})();
