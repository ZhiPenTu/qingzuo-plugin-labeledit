import { Download, FileUp, LoaderCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface HeaderProps { filename?: string; busy: boolean; exporting: boolean; onOpen: () => void; onExport: () => void }
export function Header({ filename, busy, exporting, onOpen, onExport }: HeaderProps) {
  return <header className="app-header">
    <div className="file-context">
      <span className="file-kind" aria-hidden="true">PDF</span>
      <span className="filename" title={filename}>{filename ?? '未打开 PDF'}</span>
    </div>
    <div className="header-actions">
      <Button variant="outline" onClick={onOpen} disabled={busy}><FileUp data-icon="inline-start" />打开 PDF</Button>
      <Button onClick={onExport} disabled={!filename || busy}>
        {exporting ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : <Download data-icon="inline-start" />}{exporting ? '正在导出' : '导出 PDF'}
      </Button>
    </div>
  </header>;
}
