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
  const files = DriveApp.getFolderById(folderId).getFiles();

  while (files.hasNext()) {
    const file = files.next();
    if (file.getDateCreated() < overlapFrom || file.getMimeType() !== MimeType.GOOGLE_DOCS) continue;

    const document = DocumentApp.openById(file.getId());
    const notes = document.getBody().getText().trim();
    if (!notes) continue;

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
  }

  properties.setProperty('PRIME_OPS_LAST_SCAN_AT', now.toISOString());
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

