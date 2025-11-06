import { VideoCard } from '../VideoCard'

export default function VideoCardExample() {
  const mockClip = {
    id: '1',
    thumbnailUrl: 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=400&h=225&fit=crop',
    duration: '1:02',
    startTime: '00:45',
    endTime: '01:47',
    title: 'Momento impactante - Ação inicial'
  };

  return (
    <div className="max-w-sm">
      <VideoCard 
        clip={mockClip}
        onDownload={(id) => console.log('Download clip:', id)}
        onPreview={(id) => console.log('Preview clip:', id)}
      />
    </div>
  )
}
