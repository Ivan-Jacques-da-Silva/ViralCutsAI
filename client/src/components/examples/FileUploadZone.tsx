import { FileUploadZone } from '../FileUploadZone'

export default function FileUploadZoneExample() {
  return (
    <FileUploadZone 
      onFileSelect={(file) => console.log('File selected:', file.name)} 
    />
  )
}
