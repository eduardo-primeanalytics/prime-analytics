/**
 * Prime Analytics Ops — Google Drive meeting intake
 *
 * Add this file to a standalone Google Apps Script project owned by the shared
 * operations account. Configure the script properties listed below, then run
 * installTrigger() once.
 *
 * Required script properties:
 *   PRIME_OPS_FOLDER_IDS  (the Apps Script owner's Google Meet folder ID;
 *                          additional founder folder IDs are optional fallbacks)
 *   PRIME_OPS_INGEST_URL   (https://primeanalytics.ai/__ops/ingest)
 *   PRIME_OPS_INGEST_TOKEN (same value as the Worker secret)
 *
 * PRIME_OPS_FOLDER_ID remains supported as a fallback for older installations.
 */

const LOOKBACK_MINUTES = 20;
const BACKFILL_DAYS = 30;
const MAX_FOLDER_DEPTH = 2;

function processNewMeetingNotes() {
  const properties = PropertiesService.getScriptProperties();
  const now = new Date();
  const previousScan = properties.getProperty('PRIME_OPS_LAST_SCAN_AT');
  const fallback = new Date(now.getTime() - LOOKBACK_MINUTES * 60 * 1000);
  const scanFrom = previousScan ? new Date(previousScan) : fallback;
  const overlapFrom = new Date(scanFrom.getTime() - LOOKBACK_MINUTES * 60 * 1000);
  processMeetingNotesSince_(overlapFrom);
  properties.setProperty('PRIME_OPS_LAST_SCAN_AT', now.toISOString());
}

/**
 * Run this manually after adding a founder folder or recovering from an outage.
 * Duplicate Google Drive file IDs are ignored by Prime Ops, so backfills are safe.
 */
function backfillMeetingNotes() {
  const createdAfter = new Date(Date.now() - BACKFILL_DAYS * 24 * 60 * 60 * 1000);
  processMeetingNotesSince_(createdAfter);
  PropertiesService.getScriptProperties().setProperty('PRIME_OPS_LAST_SCAN_AT', new Date().toISOString());
}

function processMeetingNotesSince_(createdAfter) {
  const properties = PropertiesService.getScriptProperties();
  const ingestUrl = properties.getProperty('PRIME_OPS_INGEST_URL');
  const ingestToken = properties.getProperty('PRIME_OPS_INGEST_TOKEN');
  const folderIds = getFolderIds_(properties);
  if (!folderIds.length || !ingestUrl || !ingestToken) {
    throw new Error('Configure PRIME_OPS_FOLDER_IDS, PRIME_OPS_INGEST_URL, and PRIME_OPS_INGEST_TOKEN.');
  }

  const filesById = {};
  folderIds.forEach((folderId) => {
    const rootFolder = DriveApp.getFolderById(folderId);
    collectRecentGoogleDocs_(rootFolder, createdAfter, 0)
      .forEach((file) => { filesById[file.getId()] = file; });
  });

  Object.keys(filesById).forEach((fileId) => {
    const file = filesById[fileId];
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
}

function getFolderIds_(properties) {
  const configured = properties.getProperty('PRIME_OPS_FOLDER_IDS')
    || properties.getProperty('PRIME_OPS_FOLDER_ID')
    || '';
  return configured
    .split(/[\s,]+/)
    .map((value) => value.trim())
    .filter((value, index, values) => value && values.indexOf(value) === index);
}

function collectRecentGoogleDocs_(folder, createdAfter, depth) {
  const results = [];
  const files = folder.getFiles();
  while (files.hasNext()) {
    const file = files.next();
    if (file.getDateCreated() < createdAfter) continue;
    const documentFile = resolveGoogleDoc_(file);
    if (documentFile) results.push(documentFile);
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

function resolveGoogleDoc_(file) {
  if (file.getMimeType() === MimeType.GOOGLE_DOCS) return file;
  if (
    file.getMimeType() === 'application/vnd.google-apps.shortcut'
    && file.getTargetMimeType() === MimeType.GOOGLE_DOCS
    && file.getTargetId()
  ) {
    return DriveApp.getFileById(file.getTargetId());
  }
  return null;
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
