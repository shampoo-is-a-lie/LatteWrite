// OneDrive sync via Microsoft Graph. Structured to mirror drive.js so the sync
// abstraction in index.js can treat both providers the same way.
//
// PHASE 2 — needs an Azure app registration (client id) and a loopback OAuth
// flow analogous to auth.js. Left as a clearly-marked stub so the wiring exists
// and Google Drive (fully working) is the default provider today.

export async function syncBundle() {
  throw new Error('OneDrive sync is not implemented yet (phase 2)')
}
