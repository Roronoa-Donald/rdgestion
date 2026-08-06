/**
 * Module de scan de code-barre / QR via la caméra du device.
 *
 * Approche :
 * - Utilise l'API native `BarcodeDetector` quand disponible (Chromium récent, Android Chrome, Edge).
 * - Fallback : si l'API n'est pas disponible, on ouvre un modal invitant l'utilisateur
 *   à saisir manuellement le code (le matériel de boutique a souvent un scanner USB
 *   qui se comporte comme un clavier — saisie dans un champ input suffit).
 * - Au scan réussi : joue un "pim" (bip de confirmation) via WebAudio, puis résout la promesse
 *   avec le code détecté.
 *
 * Contrat :
 *   import { scanBarcode } from '../utils/barcode-scan.js';
 *   const code = await scanBarcode(); // ouvre la caméra + rend la promesse
 *   // `code` est une string (le code lu), ou undefined si annulé.
 *
 * Aucune dépendance externe. Aucune modification de l'identité visuelle.
 */

let audioCtx = null;

/**
 * Émet un "pim" (bip court) pour confirmer un scan réussi.
 * Utilise WebAudio (pas de fichier audio externe). Désactivé si l'AudioContext
 * ne peut pas être créée (navigateurs sans WebAudio).
 */
function playBeep() {
  try {
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      audioCtx = new AC();
    }
    // Si l'contexte est suspendu (auto-play policy), essayer de le résumer.
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    // Tonalité aiguë type scanner commerçant (~1200 Hz)
    osc.type = 'square';
    osc.frequency.value = 1200;

    // Enveloppe très courte (120 ms) pour un "pim" sec
    gain.gain.setValueAtTime(0.0001, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.18, audioCtx.currentTime + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.12);

    osc.connect(gain).connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.13);
  } catch (e) {
    // Silencieux — le beep est cosmétique, on ne doit jamais casser le scan à cause de lui.
    console.warn('[barcode-scan] beep failed:', e.message);
  }
}

/**
 * Détecte la prise en charge de l'API BarcodeDetector.
 * @returns {boolean}
 */
export function isBarcodeScanSupported() {
  return typeof window !== 'undefined' && 'BarcodeDetector' in window;
}

/**
 * Ouvre un modal de scan caméra (ou saisie manuelle en fallback).
 * Résout avec le code lu (string) ou `undefined` si l'utilisateur annule.
 *
 * @param {object} [opts]
 * @param {string} [opts.title] — Titre du modal.
 * @param {boolean} [opts.allowManual=true] — Autorise la saisie manuelle en fallback.
 * @returns {Promise<string|undefined>}
 */
export function scanBarcode(opts = {}) {
  const { title = 'Scanner un code-barre', allowManual = true } = opts;

  return new Promise((resolve) => {
    let settled = false;
    const done = (val) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(val);
    };

    // === Construire le modal ===
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.zIndex = '10001'; // Au-dessus du modal produit si appelé depuis le form

    overlay.innerHTML = `
      <div class="modal-content" style="max-width: 420px; padding: 0; overflow: hidden;">
        <div class="modal-header">
          <h3 class="barcode-modal-title" style="font-size: 16px; font-weight: 600;">${title}</h3>
          <button class="barcode-close" style="font-size: 20px;" aria-label="Fermer le scanner">×</button>
        </div>
        <div class="modal-body" style="padding: 16px;">
          <div id="barcode-video-container" style="position: relative; width: 100%; aspect-ratio: 4/3; background: #000; border-radius: 6px; overflow: hidden; display: none;">
            <video id="barcode-video" style="width: 100%; height: 100%; object-fit: cover;" playsinline muted></video>
            <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; pointer-events: none; border: 2px solid var(--accent-color, #1E3A8A); border-radius: 6px; box-shadow: 0 0 0 9999px rgba(0,0,0,0.2);"></div>
          </div>
          <div id="barcode-fallback" style="display: none; text-align: center; padding: 24px 0;">
            <p style="color: var(--text-secondary); font-size: 13px; margin-bottom: 12px;">
              La caméra n'est pas disponible sur ce navigateur. Saisissez le code manuellement ou utilisez un scanner USB.
            </p>
            <input type="text" id="barcode-manual-input" class="form-input" style="font-size: 16px; text-align: center; letter-spacing: 2px;" placeholder="Code-barre" inputmode="numeric" autocomplete="off">
            <button id="barcode-manual-submit" class="btn btn-primary" style="width: 100%; margin-top: 12px; padding: 12px;">Valider</button>
          </div>
          <div id="barcode-error" style="display: none; color: var(--error); text-align: center; padding: 16px 0; font-size: 13px;"></div>
          <p id="barcode-hint" style="font-size: 12px; color: var(--text-secondary); text-align: center; margin-top: 12px;">Présentez le code-barre devant la caméra.</p>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // === Cleanup ===
    let stream = null;
    let detector = null;
    let detectLoop = null;

    function cleanup() {
      // Arrêter la boucle de détection
      if (detectLoop) {
        cancelAnimationFrame(detectLoop);
        detectLoop = null;
      }
      // Arrêter la caméra
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
        stream = null;
      }
      // Fermer le modal
      if (overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
      // Hook de fermeture du dialog accessible
      document.removeEventListener('keydown', onEsc);
    }

    function onEsc(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        done(undefined);
      }
    }

    overlay.querySelector('.barcode-close').addEventListener('click', () => done(undefined));
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) done(undefined);
    });
    document.addEventListener('keydown', onEsc);

    const videoContainer = overlay.querySelector('#barcode-video-container');
    const fallback = overlay.querySelector('#barcode-fallback');
    const errorBox = overlay.querySelector('#barcode-error');
    const hint = overlay.querySelector('#barcode-hint');
    const video = overlay.querySelector('#barcode-video');

    // === Cas 1 : BarcodeDetector natif disponible ===
    if (isBarcodeScanSupported()) {
      videoContainer.style.display = 'block';

      // Demander les formats supportés pour limiter aux barcodes + QR
      let formats;
      try {
        // Certains navigateurs supportent getSupportedFormats(), d'autres non.
        const supported = window.BarcodeDetector.getSupportedFormats
          ? await window.BarcodeDetector.getSupportedFormats()
          : [];
        // Garder les formats pertinents : EAN-13, EAN-8, UPC-A, UPC-E, QR, Code 128, Code 39
        const wanted = [
          'ean_13', 'ean_8', 'upc_a', 'upc_e',
          'qr_code', 'code_128', 'code_39', 'code_93',
          'itf', 'codabar', 'data_matrix', 'pdf417'
        ];
        formats = supported.length > 0 ? supported.filter((f) => wanted.includes(f)) : undefined;
      } catch (_) {
        formats = undefined;
      }

      try {
        detector = new window.BarcodeDetector({ formats });
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false
        });
        video.srcObject = stream;
        await video.play();

        // Boucle de détection
        const tick = async () => {
          if (settled || !detector || video.readyState !== video.HAVE_ENOUGH_DATA) {
            detectLoop = requestAnimationFrame(tick);
            return;
          }
          try {
            const codes = await detector.detect(video);
            if (codes && codes.length > 0) {
              const value = codes[0].rawValue;
              if (value) {
                // Succès !
                playBeep();
                // Petit délai pour que le beep soit audible avant de fermer
                setTimeout(() => done(value), 150);
                return;
              }
            }
          } catch (_) {
            // detect() peut échouer sporadiquement (frame vide), on continue
          }
          detectLoop = requestAnimationFrame(tick);
        };
        detectLoop = requestAnimationFrame(tick);
      } catch (err) {
        // Caméra refusée ou indisponible — basculer sur le fallback
        console.warn('[barcode-scan] camera failed, fallback to manual:', err.message);
        videoContainer.style.display = 'none';
        if (allowManual) {
          showFallback();
        } else {
          errorBox.style.display = 'block';
          errorBox.textContent = 'Caméra indisponible : ' + (err.message || 'permission refusée');
        }
      }
    } else {
      // === Cas 2 : pas de BarcodeDetector — saisie manuelle ===
      videoContainer.style.display = 'none';
      if (allowManual) {
        showFallback();
      } else {
        errorBox.style.display = 'block';
        errorBox.textContent = "Ce navigateur ne supporte pas le scan caméra. Utilisez un scanner USB (saisie clavier).";
        hint.style.display = 'none';
      }
    }

    function showFallback() {
      fallback.style.display = 'block';
      hint.style.display = 'none';
      const input = overlay.querySelector('#barcode-manual-input');
      const submit = overlay.querySelector('#barcode-manual-submit');
      // Focus pour qu'un scanner USB (keyboard wedge) remplisse directement le champ
      setTimeout(() => input.focus(), 50);

      const validateManual = () => {
        const val = input.value.trim();
        if (val) {
          playBeep();
          setTimeout(() => done(val), 120);
        } else {
          input.focus();
        }
      };
      submit.addEventListener('click', validateManual);
      // Un scanner USB envoie souvent un Enter final — on intercepte
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          validateManual();
        }
      });
    }
  });
}
