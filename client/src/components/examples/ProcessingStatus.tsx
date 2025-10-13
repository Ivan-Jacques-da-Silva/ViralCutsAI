import { ProcessingStatus } from '../ProcessingStatus'

export default function ProcessingStatusExample() {
  return (
    <div className="space-y-4 max-w-md">
      <ProcessingStatus 
        fileName="video-example.mp4"
        progress={35}
        status="analyzing"
      />
      <ProcessingStatus 
        fileName="tutorial-completo.mov"
        progress={100}
        status="complete"
      />
    </div>
  )
}
