/* Immagini del glossario caricate direttamente, senza dipendere dal modulo audio. */
(function () {
  const imageByTerm = {
    Argilla: 14,
    Mattone: 15,
    'Mattone smaltato': 16,
    Smalto: 17,
    Lapislazzuli: 18,
    Madreperla: 19,
    Rilievo: 20,
    Iscrizione: 22,
    Restauro: 23,
    Frammento: 24,
    Archeologo: 25,
    Divinità: 26,
    Scriba: 27,
    Stilo: 28,
    'Terrazze sovrapposte': 29,
    Tempio: 30
  };

  const captions = {
    14: ['Lavorazione moderna dell’argilla in Messico: esempio attuale, non reperto mesopotamico.', 'تشكيل حديث للطين في المكسيك: مثال معاصر، وليس أثرًا من بلاد ما بين النهرين.'],
    15: ['Mattone con iscrizione del re Nabucodonosor II.', 'لبنة تحمل كتابة للملك نبوخذ نصر الثاني.'],
    16: ['Particolare di un mattone invetriato proveniente da Babilonia.', 'تفصيل من لبنة مزجّجة من بابل.'],
    17: ['Fiore di mattoni smaltati della Porta di Ishtar.', 'زهرة من الطوب المزجّج من بوابة عشتار.'],
    18: ['Campione di lapislazzuli: la pietra blu è diversa dallo smalto della Porta di Ishtar.', 'عينة من حجر اللازورد: يختلف الحجر الأزرق عن طلاء بوابة عشتار.'],
    19: ['Interno di una conchiglia di abalone: si vede la madreperla; non è un reperto mesopotamico.', 'السطح الداخلي لصدفة أذن البحر: تظهر فيه أمّ اللؤلؤ؛ وليست قطعة أثرية من بلاد ما بين النهرين.'],
    20: ['Rilievo assiro con genio alato: non è un lamassu.', 'نقش آشوري بارز لعبقري مجنّح: ليس لاماسو.'],
    21: ['Drago mušḫuššu della Porta di Ishtar, fotografato nel Museo archeologico di Istanbul.', 'تنين موشخوشو من بوابة عشتار، صُوّر في متحف إسطنبول للآثار.'],
    22: ['Mattoni iscritti della Porta di Ishtar: dettaglio di una dedica in scrittura cuneiforme.', 'طوب منقوش من بوابة عشتار: تفصيل من كتابة إهداء بالخط المسماري.'],
    23: ['Cilindro d’argilla con un’iscrizione sul restauro dello ziggurat di Ur voluto da Nabonide.', 'أسطوانة طينية تحمل كتابة عن ترميم زقورة أور بأمر من نابونيد.'],
    24: ['Frammento di tavoletta cuneiforme conservato al Metropolitan Museum of Art.', 'جزء من لوح مسماري محفوظ في متحف المتروبوليتان للفنون.'],
    25: ['Archeologa al lavoro in una trincea di scavo a Leicester: esempio attuale del lavoro sul campo.', 'عالمة آثار تعمل في خندق تنقيب في ليستر: مثال معاصر على العمل الميداني.'],
    26: ['Rilievo assiro del dio solare Shamash, conservato al British Museum.', 'نقش آشوري بارز للإله شمش، محفوظ في المتحف البريطاني.'],
    27: ['Replica della statua dello scriba sumero Dudu: non è l’originale.', 'نسخة من تمثال الكاتب السومري دودو: ليست التمثال الأصلي.'],
    28: ['Illustrazione di uno stilo per scrivere sull’argilla; non è un reperto mesopotamico.', 'رسم توضيحي لقلم للكتابة على الطين؛ وليس قطعة أثرية من بلاد ما بين النهرين.'],
    29: ['Modellino moderno dei Giardini pensili: ricostruzione ipotetica.', 'نموذج حديث للحدائق المعلّقة: إعادة بناء افتراضية.'],
    30: ['Ricostruzione digitale dello ziggurat di Ur-Nammu.', 'إعادة بناء رقمية لزقورة أور-نمو.']
  };

  const styles = document.createElement('style');
  styles.textContent = `
    .glossary-zoom-hint{font-size:14px;color:#5e6667}
    .glossary-zoom-hint span{display:inline-block;margin-left:8px}
    #entries .photo img{cursor:zoom-in;touch-action:manipulation}
    #entries .photo img:focus-visible{outline:4px solid #996232;outline-offset:3px}
    #glossary-image-dialog{border:0;border-radius:12px;padding:16px;max-width:96vw;max-height:96vh;background:#fbf8f1;color:#233c46}
    #glossary-image-dialog::backdrop{background:rgba(8,20,25,.88)}
    #glossary-image-dialog img{display:block;width:auto;max-width:92vw;height:auto;max-height:80vh;margin:12px auto;object-fit:contain}
    #glossary-image-dialog button{float:right;padding:9px 14px;border:1px solid #526a73;border-radius:6px;background:white;font:700 16px Arial,sans-serif;cursor:pointer}
    #glossary-image-dialog figcaption{text-align:center;line-height:1.7;padding:4px 12px}
    @media(max-width:650px){#glossary-image-dialog{padding:10px}#glossary-image-dialog img{max-width:88vw;max-height:72vh}}
  `;
  document.head.append(styles);

  const zoomHint = document.createElement('p');
  zoomHint.className = 'glossary-zoom-hint';
  zoomHint.innerHTML = 'Clicca o tocca un’immagine per ingrandirla. <span lang="ar" dir="rtl">انقر على الصورة أو المسها لتكبيرها.</span>';
  document.querySelector('.controls')?.insertBefore(zoomHint, document.querySelector('#print'));

  for (const term of terms) {
    if (imageByTerm[term.it]) term.image = imageByTerm[term.it];
  }
  draw();

  function updateGlossaryImages() {
    document.querySelectorAll('#entries .entry').forEach(entry => {
      if (entry.dataset.imageReady === 'true') return;
      const image = entry.querySelector('.photo img');
      const figure = entry.querySelector('.photo');
      if (!image || !figure) return;
      const term = terms.find(item => item.it === entry.querySelector('[lang="it"] h2')?.textContent);
      const id = term?.image || Number(image.src.match(/image(\d+)\./)?.[1] || 0);
      image.alt = `${term?.it || 'Immagine'} / ${term?.ar || ''}`;
      image.tabIndex = 0;
      image.setAttribute('role', 'button');
      image.setAttribute('aria-label', 'Ingrandisci immagine / تكبير الصورة');
      const caption = figure.querySelector('figcaption') || document.createElement('figcaption');
      caption.replaceChildren();
      const text = captions[id];
      if (text) {
        ['it', 'ar'].forEach((language, index) => {
          if (index) caption.append(document.createElement('br'));
          const span = document.createElement('span');
          span.lang = language;
          if (language === 'ar') span.dir = 'rtl';
          span.textContent = text[index];
          caption.append(span);
        });
      } else {
        caption.textContent = 'Immagine di esempio · صورة توضيحية';
      }
      if (!caption.parentElement) figure.append(caption);
      entry.dataset.imageReady = 'true';
    });
  }

  const entriesContainer = document.querySelector('#entries');
  entriesContainer.dataset.zoomReady = 'true';
  const dialog = document.createElement('dialog');
  dialog.id = 'glossary-image-dialog';
  dialog.setAttribute('aria-label', 'Immagine ingrandita · صورة مكبّرة');
  const close = document.createElement('button');
  close.type = 'button';
  close.textContent = 'Chiudi × · إغلاق';
  const large = document.createElement('img');
  const caption = document.createElement('figcaption');
  dialog.append(close, large, caption);
  document.body.append(dialog);
  close.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => {
    if (event.target === dialog) dialog.close();
  });
  entriesContainer.addEventListener('click', event => {
    const thumb = event.target.closest('.photo img');
    if (!thumb) return;
    large.src = thumb.src;
    large.alt = thumb.alt;
    const originalCaption = thumb.closest('figure').querySelector('figcaption');
    caption.replaceChildren(...Array.from(originalCaption.childNodes, node => node.cloneNode(true)));
    dialog.showModal();
  });
  entriesContainer.addEventListener('keydown', event => {
    if (event.target.matches('.photo img') && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      event.target.click();
    }
  });
  document.querySelector('#search').addEventListener('input', updateGlossaryImages);
  new MutationObserver(updateGlossaryImages).observe(entriesContainer, { childList: true, subtree: true });
  updateGlossaryImages();
})();
