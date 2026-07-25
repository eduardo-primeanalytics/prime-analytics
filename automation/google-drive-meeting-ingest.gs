/**
 * Prime Analytics Ops — Google Drive meeting intake
 *
 * Add this file to a standalone Google Apps Script project owned by the shared
 * operations account. Configure the script properties listed below, then run
 * installTrigger() once.
 *
 * Required script properties:
 *   PRIME_OPS_FOLDER_ID
 *   PRIME_OPS_INGEST_URL   (https://primeanalytics.ai/__ops/ingest)
 *   PRIME_OPS_INGEST_TOKEN (same value as the Worker secret)
 */

const LOOKBACK_MINUTES = 20;
const MAX_FOLDER_DEPTH = 2;

function processNewMeetingNotes() {
  const properties = PropertiesService.getScriptProperties();
  const folderId = properties.getProperty('PRIME_OPS_FOLDER_ID');
  const ingestUrl = properties.getProperty('PRIME_OPS_INGEST_URL');
  const ingestToken = properties.getProperty('PRIME_OPS_INGEST_TOKEN');
  if (!folderId || !ingestUrl || !ingestToken) {
    throw new Error('Configure PRIME_OPS_FOLDER_ID, PRIME_OPS_INGEST_URL, and PRIME_OPS_INGEST_TOKEN.');
  }

  const now = new Date();
  const previousScan = properties.getProperty('PRIME_OPS_LAST_SCAN_AT');
  const fallback = new Date(now.getTime() - LOOKBACK_MINUTES * 60 * 1000);
  const scanFrom = previousScan ? new Date(previousScan) : fallback;
  const overlapFrom = new Date(scanFrom.getTime() - LOOKBACK_MINUTES * 60 * 1000);
  const rootFolder = DriveApp.getFolderById(folderId);
  const files = collectRecentGoogleDocs_(rootFolder, overlapFrom, 0);

  files.forEach((file) => {
    const document = DocumentApp.openById(file.getId());
    const notes = document.getBody().getText().trim();
    if (!notes) return;

    const response = UrlFetchApp.fetch(ingestUrl, {
      method: 'post',
      contentType: 'application/json',
      headers: { Authorization: `Bearer ${ingestToken}` },
      payload: JSON.stringify({
        external_source_id: `google-drive:${file.getId()}`,
        title: file.getName(),
        happened_at: file.getDateCreated().toISOString(),
        participants: inferParticipants_(file.getName(), notes),
        source_url: file.getUrl(),
        notes,
      }),
      muteHttpExceptions: true,
    });

    const status = response.getResponseCode();
    if (status < 200 || status >= 300) {
      throw new Error(`Prime Ops rejected ${file.getName()} (${status}): ${response.getContentText()}`);
    }
  });

  properties.setProperty('PRIME_OPS_LAST_SCAN_AT', now.toISOString());
}

function collectRecentGoogleDocs_(folder, createdAfter, depth) {
  const results = [];
  const files = folder.getFiles();
  while (files.hasNext()) {
    const file = files.next();
    if (file.getMimeType() === MimeType.GOOGLE_DOCS && file.getDateCreated() >= createdAfter) {
      results.push(file);
    }
  }

  if (depth >= MAX_FOLDER_DEPTH) return results;
  const folders = folder.getFolders();
  while (folders.hasNext()) {
    const childFolder = folders.next();
    collectRecentGoogleDocs_(childFolder, createdAfter, depth + 1)
      .forEach((file) => results.push(file));
  }
  return results;
}

function inferParticipants_(title, notes) {
  const text = `${title}\n${notes}`.toLowerCase();
  const participants = [];
  if (text.indexOf('eduardo') !== -1) participants.push('Eduardo');
  if (text.indexOf('josé') !== -1 || text.indexOf('jose') !== -1) participants.push('José');
  return participants;
}

function installTrigger() {
  ScriptApp.getProjectTriggers()
    .filter((trigger) => trigger.getHandlerFunction() === 'processNewMeetingNotes')
    .forEach((trigger) => ScriptApp.deleteTrigger(trigger));

  ScriptApp.newTrigger('processNewMeetingNotes')
    .timeBased()
    .everyMinutes(5)
    .create();
}
