// Legal content for the website — mirrors the app's src/aura/data/legal.js
// (single source of truth). Includes the EULA "objectionable content" clause
// required by App Store Guideline 1.2 for apps with user-generated content.
window.LEGAL = (function () {
  const APP = 'TrueDo';
  const CONTACT = 'ashishjhadeveloper@gmail.com';
  const EFFECTIVE = 'July 2, 2026';

  const PRIVACY = [
    { p: `This Privacy Policy explains how ${APP} ("the app", "we", "us") collects, uses, stores and protects your information. By using ${APP} you agree to the practices described here.` },
    { note: `Effective ${EFFECTIVE}` },
    { h2: '1. Who we are' },
    { p: `${APP} is a personal organiser that keeps your money, tasks, notes and private documents in one place. You can reach us any time at ${CONTACT}.` },
    { h2: '2. Information we collect' },
    { li: 'Account email — when you sign in with email and password, or with Apple or Google, we collect the email address on that account so we can authenticate you and sync your data across devices. With Apple/Google sign-in we receive only your name and email as shared by Apple/Google — never your Apple ID or Google password.' },
    { li: 'Content you create — finances (accounts, balances, transactions, budgets, goals), tasks, notes, bookmarks, documents and photos you add, and any passwords or secrets you choose to save in the Vault.' },
    { li: 'On-device media you select — photos and files are only accessed when you explicitly pick them to add to the app.' },
    { li: 'Health information you log — if you use the Health tab: your health profile (age, sex, height, weight, goal weight, activity level, lifestyle habits), the food, weight and steps entries you log, and your groceries and favourite foods. You can erase all of it at any time from Health → Settings → Reset health data.' },
    { li: 'Apple Health (optional, read-only) — with your permission, the app reads your steps, heart rate and active energy from Apple Health to show them on your Health page and in your health score. We never write to Apple Health without asking, never use Apple Health data for advertising or marketing, and never share or sell it to third parties. You can revoke access at any time in iOS Settings → Health → Data Access & Devices.' },
    { p: 'We do NOT connect to your bank, we do NOT import transactions automatically, and we do NOT collect advertising identifiers, location, contacts, or browsing history.' },
    { h2: '3. Device permissions we ask for' },
    { p: 'Every permission is optional, requested only when you first use the feature that needs it, and the app keeps working if you decline. You can change any of them later in your device Settings.' },
    { li: 'Camera — only when you scan a meal with the AI food scanner or capture a photo or document for your Vault.' },
    { li: 'Photo library — only when you pick pictures to add to your gallery, notes or Vault.' },
    { li: 'Microphone — only while you talk to the AI assistant by voice or use voice typing.' },
    { li: 'Speech recognition — to turn what you say into text while you dictate.' },
    { li: 'Apple Health — read-only access to steps, heart rate and active energy, as described above.' },
    { li: 'Face ID — to unlock your private Vault. Biometrics are handled entirely by your device’s operating system; your face data never reaches the app or our servers.' },
    { li: 'Notifications — to deliver the reminders you set up (tasks, dues, daily brief). Fully configurable per type, or can be left off.' },
    { h2: '4. How your data is stored' },
    { p: 'When you are signed out, your data stays on your device. When you sign in, your data is synced to our backend (Google Firebase) and tied to your account so you can access it from more than one device.' },
    { li: 'Vault PINs are never stored in plain text — only a one-way salted hash is kept. Locked notes are encrypted with a key derived from your PIN, so their contents cannot be read from your synced data without it.' },
    { li: 'Data in transit is encrypted using industry-standard TLS.' },
    { h2: '5. How we use your information' },
    { li: 'To provide the app’s core features and sync your content across your devices.' },
    { li: 'To authenticate you when you sign in.' },
    { li: 'To respond to your support requests.' },
    { p: 'We do not sell your personal information, and we do not use it for advertising or profiling.' },
    { h2: '6. Third-party services' },
    { p: 'We use Google Firebase (Authentication, Firestore and Cloud Storage) to sign you in, host your synced data, and store the photos and documents you add. If you choose Sign in with Apple or Sign in with Google, that respective provider authenticates you. Your data is processed by these providers only to deliver the app’s functionality, under their respective privacy terms.' },
    { p: `AI assistant — ${APP} includes an optional AI assistant ("Ti") powered by Google’s Gemini API. When you choose to use it, only the content of your request is sent to Google to generate a reply: your typed message in chat, or your spoken audio and its transcript in voice mode, along with the relevant items from your own ${APP} data needed to answer.` },
    { li: 'Your identity is never shared — your name, email address and location are not sent to Google with your AI requests.' },
    { li: 'PIN / Face-ID-locked Vault items are never sent to the AI.' },
    { li: 'Food photos you scan are sent to the AI only to estimate the meal and its nutrition, and health details you have logged may be included when needed to answer a health question you ask. Apple Health data is never sent for advertising or any purpose other than answering your request.' },
    { li: 'Your requests are processed only to answer you and are NOT used to train Google’s models. Google acts as our service provider under the Google APIs Terms of Service and the Google Privacy Policy.' },
    { li: 'AI features are optional — you can use the app fully without them.' },
    { h2: '7. Data retention & deletion' },
    { p: `You can delete your account and all associated data at any time from Profile → Delete account. This permanently removes your synced content (finances, tasks, notes, documents, health data and vault items) and signs you out. You can also erase just your health data from Health → Settings → Reset health data, or email ${CONTACT} to request deletion.` },
    { h2: '8. Children’s privacy' },
    { p: `${APP} is not directed to children under 13 (or the minimum age of digital consent in your country), and we do not knowingly collect data from them.` },
    { h2: '9. Your rights' },
    { p: 'Depending on where you live, you may have the right to access, correct, export or delete your personal data. Contact us to exercise these rights.' },
    { h2: '10. Changes to this policy' },
    { p: 'We may update this policy from time to time. Material changes will be reflected by a new effective date shown above.' },
    { h2: '11. Contact' },
    { p: `Questions about privacy? Email ${CONTACT}.` },
  ];

  const TERMS = [
    { p: `These Terms of Service ("Terms") govern your use of ${APP}. By downloading or using the app you agree to these Terms.` },
    { note: `Effective ${EFFECTIVE}` },
    { h2: '1. Using the app' },
    { p: `${APP} is provided for your personal, non-commercial use. You are responsible for the accuracy of the information you enter and for keeping your account credentials and Vault PINs secure.` },
    { h2: '2. Your content' },
    { p: 'You own the content you create in the app. You grant us only the limited permission needed to store and sync that content so the app works for you. We do not claim ownership of your data.' },
    { h2: '3. Subscriptions (TrueDo Pro)' },
    { p: 'TrueDo Pro is an optional auto-renewable subscription, available as a 1-month or 1-year term. The price for your selected term, in your local currency, is shown in the app before you subscribe.' },
    { li: 'Payment is charged to your Apple ID at confirmation of purchase.' },
    { li: 'Your subscription automatically renews for the same term unless auto-renewal is turned off at least 24 hours before the end of the current period.' },
    { li: 'You can manage or cancel your subscription any time in iOS Settings → [your name] → Subscriptions. Cancelling stops future renewals; you keep Pro access until the end of the period you already paid for.' },
    { li: 'Any unused portion of a free trial, if one is offered, is forfeited when you purchase a subscription.' },
    { p: 'This section, together with <a href="https://www.apple.com/legal/internet-services/itunes/dev/stdeula/" target="_blank" rel="noopener">Apple\'s Standard End User License Agreement</a>, governs your purchase of TrueDo Pro.' },
    { h2: '4. Objectionable content & conduct' },
    { p: 'There is zero tolerance for objectionable, abusive, harassing, hateful, or illegal content, or for abusive behaviour toward other users in shared features (such as Circles and shared lists/notes).' },
    { li: 'You agree not to post, share, or transmit content that is unlawful, threatening, abusive, harassing, defamatory, obscene, or otherwise objectionable.' },
    { li: 'You may report objectionable content or block another user at any time from the shared item or member list. We review reports and may remove content and suspend or terminate accounts that violate these Terms, typically within 24 hours of a report.' },
    { li: 'By using shared features you agree to be reachable for moderation purposes and accept that violating users may be ejected.' },
    { h2: '5. Not financial advice' },
    { p: `${APP} helps you record and organise your finances. It does not provide financial, investment, tax or legal advice, and the figures you see are based solely on what you enter. Always consult a qualified professional for financial decisions.` },
    { h2: '6. AI assistant' },
    { p: `${APP} includes an optional AI assistant ("Ti"), powered by Google Gemini. AI responses are generated automatically and can be inaccurate, incomplete or out of date — treat them as helpful suggestions, not professional advice, and verify anything important before relying on it. Your use of the AI is also subject to Google’s applicable terms.` },
    { h2: '7. Acceptable use' },
    { li: 'Do not use the app for any unlawful purpose or to store content you do not have the right to store.' },
    { li: 'Do not attempt to disrupt, reverse-engineer or gain unauthorised access to the app or its backend.' },
    { li: 'Do not misuse the AI assistant to generate or obtain harmful, illegal, hateful, sexual or abusive content. Such requests are filtered and refused.' },
    { h2: '8. Availability' },
    { p: 'We work to keep the app available and reliable, but we provide it "as is" without warranties of any kind. Sync depends on your network and our backend provider, and we are not liable for data loss caused by factors outside our reasonable control. Please keep your own backups of anything critical.' },
    { h2: '9. Limitation of liability' },
    { p: 'To the maximum extent permitted by law, we are not liable for any indirect, incidental or consequential damages arising from your use of the app.' },
    { h2: '10. Termination' },
    { p: 'You may stop using the app and delete your account at any time. We may suspend or terminate access if these Terms are violated.' },
    { h2: '11. Changes to these Terms' },
    { p: 'We may update these Terms from time to time. Continued use after changes means you accept the updated Terms.' },
    { h2: '12. Contact' },
    { p: `Questions about these Terms? Email ${CONTACT}.` },
  ];

  const ABOUT = [
    { p: `${APP} keeps your money, tasks, notes and private documents together in one calm, private space — on iPhone and on the web.` },
    { h2: 'Your privacy comes first' },
    { li: 'Signed out, your data lives on your device.' },
    { li: 'Signed in, it syncs securely so you can pick up on any device.' },
    { li: 'Vault PINs are stored only as a one-way hash; on the web, locked secure notes are encrypted.' },
    { h2: 'Support' },
    { p: `Need help or have feedback? Email ${CONTACT} and we’ll get back to you, usually within 1–2 business days.` },
  ];

  function render(blocks) {
    return blocks.map((b) => {
      if (b.h2) return `<h2>${b.h2}</h2>`;
      if (b.li) return `<li>${b.li}</li>`;
      if (b.note) return `<p class="note">${b.note}</p>`;
      return `<p>${b.p}</p>`;
    }).join('');
  }
  return { APP, CONTACT, EFFECTIVE, PRIVACY, TERMS, ABOUT, render };
})();
