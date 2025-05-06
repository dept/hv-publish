import Color from 'ansi-colors'

export default function log(msg: string, color: string | null = null): void {
   if (color) {
      console.log(Color[color](msg))
   } else {
      console.log(msg)
   }
} 