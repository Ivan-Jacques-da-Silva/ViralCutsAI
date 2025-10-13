import { DownloadModal } from '../DownloadModal'
import { Button } from '@/components/ui/button'
import { useState } from 'react'

export default function DownloadModalExample() {
  const [open, setOpen] = useState(false);
  
  const mockClips = [
    { id: '1', title: 'Momento impactante - Ação inicial', duration: '1:02' },
    { id: '2', title: 'Cena de transição dinâmica', duration: '0:58' },
    { id: '3', title: 'Final épico', duration: '1:05' },
  ];

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        Abrir Modal de Download
      </Button>
      <DownloadModal 
        open={open}
        onOpenChange={setOpen}
        clips={mockClips}
        onDownload={(ids) => console.log('Download clips:', ids)}
      />
    </>
  )
}
