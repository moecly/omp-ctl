import { useState } from "react";
import { Download, FolderOpen, Upload } from "lucide-react";

import { useApp } from "../hooks/useApp";
import { useAsync } from "../hooks/useAsync";
import { ipc } from "../lib/ipc";
import { errorText } from "../lib/types";
import { toast } from "../lib/toast";
import { Button, ConfirmDialog, Field, Input } from "../components/ui";
import { PageContainer } from "../components/shell/PageContainer";

export function Backup() {
  const { t } = useApp();
  const dirs = useAsync(() => ipc.getDirs(), []);
  const [snapshotPath, setSnapshotPath] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const doExport = async () => {
    setBusy(true);
    try {
      const dest = await ipc.exportSnapshot();
      setSnapshotPath(dest);
      toast.success(t.backup.export, t.backup.exported.replace("{path}", dest));
    } catch (e) {
      toast.error(t.backup.export, errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const doImport = async () => {
    if (!snapshotPath.trim()) return;
    setBusy(true);
    try {
      await ipc.importSnapshot(snapshotPath.trim());
      toast.success(t.backup.import, t.backup.imported.replace("{path}", snapshotPath.trim()));
    } catch (e) {
      toast.error(t.backup.import, errorText(e));
    } finally {
      setBusy(false);
      setConfirmOpen(false);
    }
  };

  return (
    <PageContainer
      title={t.backup.title}
      description={t.pageDesc.backup}
      actions={
        <Button
          variant="ghost"
          size="sm"
          disabled={!dirs.data}
          onClick={() => dirs.data && ipc.openInFileManager(`${dirs.data.store}/backup`)}
        >
          <FolderOpen size={14} />
          {t.backup.reveal}
        </Button>
      }
    >
      <div className="flex items-center gap-2">
        <Button variant="primary" size="sm" disabled={busy} onClick={doExport}>
          <Download size={14} />
          {t.backup.export}
        </Button>
      </div>
      <Field label={t.backup.pathLabel}>
        <Input mono value={snapshotPath} onChange={(e) => setSnapshotPath(e.target.value)} placeholder={t.backup.pathPlaceholder} />
      </Field>
      <div className="flex items-center gap-2">
        <Button size="sm" disabled={busy || !snapshotPath.trim()} onClick={() => setConfirmOpen(true)}>
          <Upload size={14} />
          {t.backup.import}
        </Button>
      </div>
      <ConfirmDialog
        open={confirmOpen}
        title={t.backup.import}
        message={t.backup.importConfirm.replace("{path}", snapshotPath.trim())}
        confirmLabel={t.common.confirm}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={doImport}
      />
    </PageContainer>
  );
}
