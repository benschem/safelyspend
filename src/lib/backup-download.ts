import { exportAllData } from '@/lib/db';

/**
 * Save everything this device holds as a JSON file, through the browser's own
 * download: `budget-export-YYYY-MM-DD.json`, dated in UTC.
 *
 * The file is the same export Settings imports again, so it is a full backup of
 * the local budget. It is written unencrypted, which is why callers warn before
 * offering it.
 *
 * Rejects if the export cannot be read. Callers show their own message.
 */
export async function downloadBackup(): Promise<void> {
  const backup = await exportAllData();
  const json = JSON.stringify(backup, null, 2);
  const blob = new Blob([json], { type: 'application/json' });

  // A browser only saves a blob under a chosen filename through a clicked
  // anchor with a `download` attribute, so one is made, clicked and removed.
  const blobUrl = URL.createObjectURL(blob);
  const downloadLink = document.createElement('a');
  downloadLink.href = blobUrl;
  downloadLink.download = `budget-export-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(downloadLink);
  downloadLink.click();
  document.body.removeChild(downloadLink);
  URL.revokeObjectURL(blobUrl);
}
