import { URLInput } from '../URLInput'

export default function URLInputExample() {
  return (
    <URLInput 
      onSubmit={(url) => console.log('URL submitted:', url)} 
    />
  )
}
