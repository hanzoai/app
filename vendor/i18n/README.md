# @hanzo/i18n

Shared localization for the Hanzo landing, account interface and Platform navigation.
The registry contains all 35 languages requested for the interface, plus Arabic (36 total).
It distinguishes Simplified/Traditional Chinese and Latin-American/European Spanish.

```tsx
import { I18nProvider, LanguagePicker, useI18n } from '@hanzo/i18n/react'
import '@hanzo/i18n/rtl.css'

<I18nProvider userId={signedInSubject}>
  <LanguagePicker />
  <App />
</I18nProvider>
```

`t('English source', { name: 'Ada' })` translates authored interface copy. Never pass
user messages, organization names, code or API responses through it. Missing messages
fall back to their English source. Catalogs load only when selected. Failed loads keep
the current language and expose a retryable error. Rendering never calls an LLM.

Preferences are stored per user in this browser, with a separate anonymous preference;
other tabs for that account stay in sync. This is **not yet cross-device IAM sync**.
Server prerenders use English, then hydrate the saved/browser locale. Static SEO metadata
is still English; this package does not create translated route exports.

Arabic sets the document language and direction. Use logical layout properties
(`marginInlineStart`, `paddingInlineEnd`, `text-align: start`) and direction-aware
sidebar placement. Code, URLs and email inputs are isolated LTR. Directional icons can
opt in through `data-i18n-mirror`. Language names use their own scripts, without flags.

## Generate and verify

```sh
TRANSLATION_BASE_URL=http://evo.local:8731/v1 npm run translate
npm run validate
npm test
```

Optional variables: `TRANSLATION_MODEL`, `TRANSLATION_API_KEY`, `LOCALES=ar,fr-FR`,
`CONCURRENCY=2`. Only public source strings go to the offline generation endpoint.
The generator checkpoints complete batches, retries malformed responses, verifies keys
and placeholders, rejects truncated output, and records model/source provenance.
Catalog validation fails for missing messages; English copies are not used to fake coverage.
Machine translations still require native-speaker review, especially Bhojpuri and Amharic.

## Arabic model

**Jais 3**, not `jais-30b-chat-v3`. The pinned official artifact is in `models.json`.
The downloaded Q4 weights are stored outside this npm package under
`../models/Jais-3-32B-Q4_K_M/`; do not commit or publish model binaries with UI assets.
The upstream card lists Apache-2.0; retain attribution and license when redistributing
or creating a Hanzo derivative. No public model fork or fine-tune has been published.

```sh
hf download IFM/Jais-3-32B-GGUF Jais-3-32B-Q4_K_M.gguf README.md \
  --revision 7f88bd89cbf83ccce89d07776ad11f7bd62cc83b \
  --local-dir ../models/Jais-3-32B-Q4_K_M
```

A server needs a llama.cpp build with K2 Horizon support. Once that server passes an
Arabic smoke test, set its OpenAI-compatible URL and model name and use `LOCALES=ar`.
Remove or archive the prior Arabic catalog before regenerating it with a different
model; existing translations are retained for resumability.
