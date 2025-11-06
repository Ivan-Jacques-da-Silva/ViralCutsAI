import { EmptyState } from '../EmptyState'
import { Video, Upload } from 'lucide-react'

export default function EmptyStateExample() {
  return (
    <div className="space-y-8">
      <EmptyState 
        title="Nenhum vídeo analisado"
        description="Faça upload de um vídeo ou cole uma URL para começar"
      />
      <EmptyState 
        icon={<Upload className="h-16 w-16" />}
        title="Arraste um vídeo aqui"
        description="Suporta MP4, MOV e AVI até 2GB"
      />
    </div>
  )
}
